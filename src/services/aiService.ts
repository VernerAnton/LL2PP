// AI service for CV data extraction using Claude (Anthropic API)
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { CandidateData, WorkExperience, Education, AnthropicModel } from '../types';
import { RateLimiter } from './rateLimiter';

// Space out request starts (1 per second) so bursts don't trip per-minute rate limits.
const rateLimiter = new RateLimiter(1000);

// Schema for the extracted CV data. It is sent to the API as a structured-output JSON schema,
// so Claude's answer is guaranteed to be valid JSON of this shape, and the SDK validates the
// constraints the API can't enforce (e.g. non-empty strings) on the way back.
const WorkExperienceSchema = z.object({
  company: z.string().min(1),
  jobTitle: z.string().min(1),
  dates: z.string().optional(),
});

const EducationSchema = z.object({
  institution: z.string().min(1),
  // Optional - formal degrees, exchange programs (e.g. Erasmus), and significant certificates are all valid
  degree: z.string().optional(),
  dates: z.string().optional(),
});

const CVDataSchema = z.object({
  name: z.string().min(1),
  workHistory: z.array(WorkExperienceSchema),
  education: z.array(EducationSchema),
});

type CVData = z.infer<typeof CVDataSchema>;

// Per-1M-token prices (USD) used for the cost estimate shown in the UI
const PRICING: Record<string, { input: number; output: number }> = {
  // Haiku 5.5 rates apply to prompts up to 100K tokens ($0.50/$2.50 beyond) — CV prompts stay well under
  'claude-haiku-5-5': { input: 0.10, output: 0.50 },
  'claude-sonnet-5-5': { input: 2.00, output: 10.00 },
  'claude-opus-5-5': { input: 4.00, output: 20.00 },
};

const SYSTEM_PROMPT = `You extract structured candidate data from CVs for a recruitment longlist. The data is placed on presentation slides, so it must be accurate and consistently formatted.

1. Name
   - The candidate's complete full name.

2. Work history (at most the 5 most recent positions, most recent first)
   - Include only operational/employment positions the person actively held (CEO, CTO, Manager, Engineer, etc.).
   - Exclude all board positions: Board Member, Board Director, Advisory Board, Board of Directors, Non-Executive Director, Supervisory Board, Board Observer, Board Advisor. If someone has both operational and board roles, keep only the operational ones.
   - For each position give the company name, job title, and dates.
   - Dates: "MM/YYYY - MM/YYYY" when months are available (e.g. "03/2020 - 08/2023"), otherwise "YYYY - YYYY" (e.g. "2020 - 2023"). Use "Present" as the end date for current positions (e.g. "01/2022 - Present").
   - If the CV gives no dates for a position, leave the dates out. Never guess or invent dates.

3. Education
   - Include formal degrees (Bachelor, Master, MBA, PhD, etc.), significant certificate programs, and international exchange semesters (e.g. Erasmus, study abroad).
   - For exchanges or certificates without a formal degree title, put the program or exchange name in the degree field (e.g. "Erasmus Exchange Semester", "Google Data Analytics Certificate").
   - Exclude high school / secondary education, short online courses (under 3 months), and entries that list only an institution with no program or exchange.
   - Give the institution name, degree/program/exchange name where there is one, and dates in the same format as work history (leave dates out if missing).
   - If nothing qualifies, return an empty list.`;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number; // in USD
}

export interface ExtractionResult {
  success: boolean;
  data?: CandidateData;
  error?: string;
  usage?: TokenUsage;
}

export class AIService {
  private static client: Anthropic | null = null;
  private static anthropicModel: AnthropicModel = 'claude-sonnet-5-5';
  private static extendedThinking: boolean = false;
  // Retries for answers that fail validation. API errors (429, 5xx, network) are retried
  // inside the SDK, which honours the API's retry-after header.
  private static maxAttempts = 2;

  /**
   * Set the Anthropic API key (null clears it)
   */
  static setApiKey(key: string | null): void {
    // BYOK: the user's own key is used directly from their browser; it never touches our servers.
    this.client = key
      ? new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 3 })
      : null;
  }

  /**
   * Set the Claude model (Haiku, Sonnet, or Opus)
   */
  static setAnthropicModel(model: AnthropicModel): void {
    this.anthropicModel = model;
  }

  /**
   * Enable or disable extended thinking for deeper reasoning
   */
  static setExtendedThinking(enabled: boolean): void {
    this.extendedThinking = enabled;
  }

  /**
   * Extract structured data from a single CV text
   */
  static async extractCVData(cvText: string): Promise<ExtractionResult> {
    if (!this.client) {
      return {
        success: false,
        error: 'API key not set. Please enter your Anthropic API key.',
      };
    }

    const client = this.client;
    return rateLimiter.enqueue(() => this.extractWithRetry(client, cvText));
  }

  /**
   * Run the extraction, retrying once if Claude's answer fails validation
   */
  private static async extractWithRetry(client: Anthropic, cvText: string): Promise<ExtractionResult> {
    let lastError = 'Unknown error';

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.performExtraction(client, cvText);
      } catch (error) {
        lastError = this.describeError(error);
        console.error(`❌ Extraction attempt ${attempt} failed:`, lastError);

        // The SDK has already retried transient API errors; anything left (bad key,
        // bad request, exhausted retries) won't be fixed by trying again.
        if (error instanceof Anthropic.APIError) break;
      }
    }

    return { success: false, error: lastError };
  }

  /**
   * Call Claude and turn the response into candidate data
   */
  private static async performExtraction(client: Anthropic, cvText: string): Promise<ExtractionResult> {
    // Sonnet 5.5 / Opus 5.5: if a safety classifier declines a CV by mistake, the API retries it
    // on a fallback model within the same call. Haiku 5.5 has no server-side fallback.
    const fallback = this.anthropicModel !== 'claude-haiku-5-5';

    const response = await client.beta.messages.parse({
      model: this.anthropicModel,
      // Leaves room for thinking tokens as well as the JSON answer
      max_tokens: 16000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Extract the candidate data from this CV:\n\n${cvText}` }],
      // Claude 5.5 models think adaptively; effort sets how deep. Extended thinking = high effort.
      ...(this.extendedThinking ? { thinking: { type: 'adaptive' as const } } : {}),
      output_config: {
        effort: this.extendedThinking ? 'high' : 'low',
        format: betaZodOutputFormat(CVDataSchema),
      },
      ...(fallback ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : {}),
    });

    if (response.stop_reason === 'refusal') {
      const category = response.stop_details?.category;
      throw new Error(`Claude declined to process this CV${category ? ` (${category})` : ''}`);
    }
    if (response.stop_reason === 'max_tokens') {
      throw new Error('Claude ran out of output tokens before finishing');
    }
    if (!response.parsed_output) {
      throw new Error('Claude returned no structured data');
    }

    const candidateData = this.toCandidateData(response.parsed_output, cvText);

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;

    return {
      success: true,
      data: candidateData,
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        // response.model is the model that actually answered (differs if a fallback ran)
        estimatedCost: this.calculateCost(response.model, inputTokens, outputTokens),
      },
    };
  }

  /**
   * Calculate estimated cost in USD
   */
  private static calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const rates = PRICING[model] ?? PRICING[this.anthropicModel];
    return (inputTokens / 1_000_000) * rates.input + (outputTokens / 1_000_000) * rates.output;
  }

  /**
   * Clean the parsed data and map it to the app's candidate type
   */
  private static toCandidateData(data: CVData, cvText: string): CandidateData {
    const workHistory: WorkExperience[] = this.filterBoardMemberRoles(
      data.workHistory.map((item) => ({
        company: item.company.trim(),
        jobTitle: item.jobTitle.trim(),
        dates: item.dates?.trim() || undefined,
      }))
    ).slice(0, 5);

    const education: Education[] = data.education.map((item) => ({
      institution: item.institution.trim(),
      degree: item.degree?.trim() || undefined,
      dates: item.dates?.trim() || undefined,
    }));

    return {
      name: data.name.trim(),
      workHistory,
      education,
      rawText: cvText,
    };
  }

  /**
   * Filter out board member roles (client-side backup to the prompt instruction)
   */
  private static filterBoardMemberRoles(workHistory: WorkExperience[]): WorkExperience[] {
    const boardKeywords = [
      'board member',
      'board director',
      'advisory board',
      'board of directors',
      'non-executive director',
      'supervisory board',
      'board observer',
      'board advisor',
    ];

    return workHistory.filter((experience) => {
      const titleLower = experience.jobTitle.toLowerCase();
      return !boardKeywords.some((keyword) => titleLower.includes(keyword));
    });
  }

  /**
   * Turn an error into a message that makes sense in the UI
   */
  private static describeError(error: unknown): string {
    if (error instanceof Anthropic.AuthenticationError) {
      return 'Invalid API key. Check the key in the API key section.';
    }
    if (error instanceof Anthropic.PermissionDeniedError) {
      return 'This API key does not have access to the selected model.';
    }
    if (error instanceof Anthropic.RateLimitError) {
      return 'Rate limit reached. Lower the concurrency level or try again in a minute.';
    }
    if (error instanceof Anthropic.APIConnectionError) {
      return 'Could not reach the Anthropic API. Check your internet connection.';
    }
    if (error instanceof Anthropic.APIError) {
      return `Anthropic API error ${error.status ?? ''}: ${error.message}`.trim();
    }
    return error instanceof Error ? error.message : String(error);
  }
}
