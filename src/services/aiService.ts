// AI service for CV data extraction using Claude (Anthropic API)
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { CandidateData, WorkExperience, Education } from '../types';
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

// The app always uses the newest Claude Sonnet the API key can access (looked up via the
// Models API). This is the known-good model used if that lookup fails or the newest model
// rejects the request.
const FALLBACK_MODEL = 'claude-sonnet-5-5';

// Per-1M-token prices (USD) for the cost estimate shown in the UI. The Models API doesn't
// report prices, so a newer Sonnet not listed here is estimated at Sonnet 5.5 rates.
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5-5': { input: 2.00, output: 10.00 },
  // Server-side refusal fallbacks may hand a request to another model
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
  private static apiKey: string | null = null;
  // Newest compatible Sonnet, looked up once per API key
  private static model: Promise<string> | null = null;
  private static extendedThinking: boolean = false;
  // Retries for answers that fail validation. API errors (429, 5xx, network) are retried
  // inside the SDK, which honours the API's retry-after header.
  private static maxAttempts = 2;

  /**
   * Set the Anthropic API key (null clears it)
   */
  static setApiKey(key: string | null): void {
    if (key === this.apiKey) return;
    this.apiKey = key;
    this.model = null;
    // BYOK: the user's own key is used directly from their browser; it never touches our servers.
    this.client = key
      ? new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, maxRetries: 3 })
      : null;
  }

  /**
   * The model extraction runs on: the newest active Claude Sonnet that supports everything
   * the request uses. Looked up once per API key, so a new Sonnet release is picked up
   * automatically on the next page load.
   */
  static getModel(): Promise<string> {
    if (!this.client) return Promise.resolve(FALLBACK_MODEL);
    if (!this.model) this.model = this.findNewestSonnet(this.client);
    return this.model;
  }

  private static async findNewestSonnet(client: Anthropic): Promise<string> {
    try {
      const sonnets: Anthropic.ModelInfo[] = [];
      for await (const model of client.models.list()) {
        if (model.line === 'sonnet' && model.lifecycle === 'active' && this.isCompatible(model)) {
          sonnets.push(model);
        }
      }
      sonnets.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const newest = sonnets[0]?.id ?? FALLBACK_MODEL;
      console.log(`🤖 Using model: ${newest}`);
      return newest;
    } catch (error) {
      console.warn(`⚠️ Could not look up the newest Sonnet, using ${FALLBACK_MODEL}:`, error);
      return FALLBACK_MODEL;
    }
  }

  /**
   * Whether a model supports the features the extraction request relies on
   */
  private static isCompatible(model: Anthropic.ModelInfo): boolean {
    const caps = model.capabilities;
    if (!caps) return false;
    return (
      caps.structured_outputs.supported &&
      caps.thinking.types.adaptive.supported &&
      caps.effort.low.supported &&
      caps.effort.high.supported
    );
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
      const model = await this.getModel();
      try {
        return await this.performExtraction(client, model, cvText);
      } catch (error) {
        lastError = this.describeError(error);
        console.error(`❌ Extraction attempt ${attempt} failed:`, lastError);

        // A newer Sonnet may not accept a request built for Sonnet 5.5. Switch to the
        // known-good model for the rest of the session and try again.
        if (error instanceof Anthropic.BadRequestError && model !== FALLBACK_MODEL) {
          console.warn(`⚠️ ${model} rejected the request; switching to ${FALLBACK_MODEL}`);
          this.model = Promise.resolve(FALLBACK_MODEL);
          continue;
        }

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
  private static async performExtraction(client: Anthropic, model: string, cvText: string): Promise<ExtractionResult> {
    const response = await client.beta.messages.parse({
      model,
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
      // If a safety classifier declines a CV by mistake, the API retries it on a
      // fallback model within the same call instead of failing.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
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
    const rates = PRICING[model] ?? PRICING[FALLBACK_MODEL];
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
      return 'This API key does not have access to Claude Sonnet.';
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
