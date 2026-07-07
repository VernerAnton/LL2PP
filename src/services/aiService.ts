// AI service for CV data extraction - Provider Agnostic (OpenAI/Anthropic)
import type { CandidateData, WorkExperience, Education, AiProvider, AnthropicModel } from '../types';
import { RateLimiter } from './rateLimiter';
import { z } from 'zod';

// Rate limiter instance (1 request per second to be safe)
const rateLimiter = new RateLimiter(1000);

// Zod schema for validating AI-extracted CV data
const WorkExperienceSchema = z.object({
  company: z.string().min(1, 'Company name is required'),
  jobTitle: z.string().min(1, 'Job title is required'),
  dates: z.string().optional(),
});

const EducationSchema = z.object({
  institution: z.string().min(1, 'Institution name is required'),
  degree: z.string().optional(), // Optional - formal degrees, exchange programs (e.g. Erasmus), and significant certificates are all valid
  dates: z.string().optional(),
});

const CVDataSchema = z.object({
  name: z.string().min(1, 'Candidate name is required'),
  workHistory: z.array(WorkExperienceSchema).max(5, 'Maximum 5 work experiences'),
  education: z.array(EducationSchema).optional().default([]), // Education array can be empty if no degrees found
});

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

interface AIResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export class AIService {
  private static apiKey: string | null = null;
  private static provider: AiProvider = 'anthropic';
  private static anthropicModel: AnthropicModel = 'claude-sonnet-5';
  private static extendedThinking: boolean = false;
  private static retryDelays: number[] = [2000, 4000, 8000]; // 2s, 4s, 8s

  /**
   * Set API key for the AI provider
   */
  static setApiKey(key: string | null): void {
    this.apiKey = key;
    console.log(`🔧 API Key ${key ? 'set' : 'cleared'}`);
  }

  /**
   * Set AI provider (OpenAI or Anthropic)
   */
  static setProvider(provider: AiProvider): void {
    this.provider = provider;
    console.log(`🔧 AI Provider set to: ${provider}`);
  }

  /**
   * Set Anthropic model (Haiku, Sonnet, or Opus)
   */
  static setAnthropicModel(model: AnthropicModel): void {
    this.anthropicModel = model;
    console.log(`🔧 Anthropic Model set to: ${model}`);
  }

  /**
   * Enable or disable extended thinking for deeper reasoning
   */
  static setExtendedThinking(enabled: boolean): void {
    this.extendedThinking = enabled;
    console.log(`🔧 Extended Thinking: ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Extract structured data from a single CV text
   */
  static async extractCVData(cvText: string): Promise<ExtractionResult> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'API key not set. Please enter your API key.',
      };
    }

    // Use rate limiter to queue the request
    return rateLimiter.enqueue(async () => {
      return this.extractWithRetry(cvText);
    });
  }

  /**
   * Extract with retry logic (3 attempts with smart backoff for 429 errors)
   */
  private static async extractWithRetry(
    cvText: string,
    attempt: number = 1
  ): Promise<ExtractionResult> {
    const maxAttempts = 3;

    try {
      const result = await this.performExtraction(cvText);
      return result;
    } catch (error: any) {
      console.error(`❌ Extraction attempt ${attempt} failed:`, error.message);

      if (attempt < maxAttempts) {
        // Check if this is a 429 rate limit error with retry-after header
        let delay = this.retryDelays[attempt - 1];

        if (error.retryAfter) {
          // Use the exact retry-after time from Anthropic API
          delay = error.retryAfter * 1000; // Convert seconds to milliseconds
          console.log(`⏱️  Rate limit hit. API says retry after ${error.retryAfter}s... (attempt ${attempt + 1}/${maxAttempts})`);
        } else {
          console.log(`⏳ Retrying in ${delay / 1000}s... (attempt ${attempt + 1}/${maxAttempts})`);
        }

        await this.sleep(delay);
        return this.extractWithRetry(cvText, attempt + 1);
      }

      return {
        success: false,
        error: `Failed after ${maxAttempts} attempts: ${error.message}`,
      };
    }
  }

  /**
   * Calculate cost based on model and token usage
   */
  private static calculateCost(inputTokens: number, outputTokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      // Anthropic Claude 5 / 4.6 (per 1M tokens)
      'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
      // Sonnet 5 introductory pricing ($2/$10) applies through 2026-08-31; reverts to $3/$15 after
      'claude-sonnet-5': { input: 2.00, output: 10.00 },
      'claude-opus-4-6': { input: 5.00, output: 25.00 },
      // Anthropic Claude 4.6 / 4.5 legacy (per 1M tokens)
      'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
      'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
      'claude-opus-4-5-20251101': { input: 5.00, output: 25.00 },
      // OpenAI (per 1M tokens)
      'gpt-4-turbo': { input: 10.00, output: 30.00 },
      'gpt-4': { input: 30.00, output: 60.00 },
      'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    };

    const model = this.provider === 'anthropic' ? this.anthropicModel : 'gpt-4-turbo';
    const rates = pricing[model] || { input: 0, output: 0 };

    const inputCost = (inputTokens / 1_000_000) * rates.input;
    const outputCost = (outputTokens / 1_000_000) * rates.output;

    return inputCost + outputCost;
  }

  /**
   * Perform the actual extraction using the selected AI provider
   */
  private static async performExtraction(cvText: string): Promise<ExtractionResult> {
    const prompt = this.buildExtractionPrompt(cvText);

    let response: AIResponse;

    if (this.provider === 'openai') {
      response = await this.callOpenAI(prompt);
    } else {
      response = await this.callAnthropic(prompt);
    }

    // Parse the JSON response
    const extractedData = this.parseResponse(response.text);

    // Validate and clean the data
    const candidateData: CandidateData = {
      name: extractedData.name || 'Unknown',
      workHistory: this.cleanWorkHistory(extractedData.workHistory || []),
      education: this.cleanEducation(extractedData.education || []),
      rawText: cvText,
    };

    // Filter out board member roles
    candidateData.workHistory = this.filterBoardMemberRoles(candidateData.workHistory);

    // Calculate usage and cost
    const totalTokens = response.usage.inputTokens + response.usage.outputTokens;
    const estimatedCost = this.calculateCost(response.usage.inputTokens, response.usage.outputTokens);

    return {
      success: true,
      data: candidateData,
      usage: {
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        totalTokens,
        estimatedCost,
      },
    };
  }

  /**
   * Build the extraction prompt with explicit formatting requirements
   */
  private static buildExtractionPrompt(cvText: string): string {
    return `You are a CV data extraction specialist. Extract structured information from the CV below.

CRITICAL INSTRUCTIONS:

1. FULL NAME
   - Extract the candidate's complete full name

2. WORK HISTORY (Maximum 5 most recent positions)
   - EXCLUDE all board positions including: Board Member, Board Director, Advisory Board, Board of Directors, Non-Executive Director, Supervisory Board, Board Observer, Board Advisor
   - ONLY include operational/employment positions where the person actively worked (CEO, CTO, Manager, Engineer, etc.)
   - If someone has both operational and board roles, ONLY include the operational ones
   - Extract: company name, job title, and dates
   - Date format: Use MM/YYYY - MM/YYYY if months are available (example: "03/2020 - 08/2023"), or YYYY - YYYY if only years (example: "2020 - 2023")
   - For current positions, use "Present" as end date (example: "01/2022 - Present" or "2022 - Present")
   - If dates are not present in the CV, omit the dates field entirely — do NOT guess or invent dates
   - List most recent position first

3. EDUCATION
   - INCLUDE: formal degrees (Bachelor, Master, MBA, PhD, etc.), significant certificate programs, and international exchange semesters (e.g. Erasmus, study abroad semesters)
   - For exchange semesters or certificates that have no formal degree title, map the program or exchange name to the "degree" field (e.g. "Erasmus Exchange Semester", "Google Data Analytics Certificate")
   - EXCLUDE: high school / secondary education, short online courses (< 3 months), and entries that list only an institution with no program or exchange specified
   - Extract: institution name, degree/program/exchange name (if applicable), and dates
   - If no qualifying education is found, return empty array: []
   - Date format: Use MM/YYYY - MM/YYYY if months are available, or YYYY - YYYY if only years (example: "2018 - 2020")
   - If dates missing, omit the dates field entirely

REQUIRED OUTPUT FORMAT (JSON only, no other text):
{
  "name": "Full Name",
  "workHistory": [
    {
      "company": "Company Name",
      "jobTitle": "Job Title",
      "dates": "MM/YYYY - MM/YYYY" or "YYYY - YYYY"
    }
  ],
  "education": [
    {
      "institution": "Institution Name",
      "degree": "Degree/Program/Exchange Name (if applicable)",
      "dates": "YYYY - YYYY" or "MM/YYYY - MM/YYYY"
    }
  ]
}

CV TEXT:
${cvText}`;
  }

  /**
   * Call OpenAI API
   */
  private static async callOpenAI(prompt: string): Promise<AIResponse> {
    const url = 'https://api.openai.com/v1/chat/completions';

    console.log('🤖 Calling OpenAI API...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that extracts structured data from CVs. Always respond with valid JSON only, no additional text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ OpenAI API Error:', errorText);
      throw new Error(`OpenAI API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0]?.message?.content) {
      throw new Error('Invalid response structure from OpenAI API');
    }

    if (!data.usage) {
      throw new Error('No usage data in OpenAI response');
    }

    return {
      text: data.choices[0].message.content,
      usage: {
        inputTokens: data.usage.prompt_tokens || 0,
        outputTokens: data.usage.completion_tokens || 0,
      },
    };
  }

  /**
   * Call Anthropic API with selected model
   */
  private static async callAnthropic(prompt: string): Promise<AIResponse> {
    // Direct browser API call (supported since mid-2024 with CORS header)
    const url = 'https://api.anthropic.com/v1/messages';

    console.log(`🤖 Calling Anthropic API (${this.anthropicModel}) directly from browser...`);
    console.log(`🔑 API Key prefix: ${this.apiKey?.substring(0, 15)}...`);

    // Extended thinking requires temperature=1 and higher max_tokens to accommodate thinking budget
    const thinkingBudget = 8000;
    const requestBody: Record<string, any> = {
      model: this.anthropicModel,
      max_tokens: this.extendedThinking ? thinkingBudget + 2048 : 2048,
      system: 'You are a helpful assistant that extracts structured data from CVs. Always respond with valid JSON only, no additional text or explanations.',
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
    };

    if (this.extendedThinking) {
      requestBody.thinking = { type: 'enabled', budget_tokens: thinkingBudget };
      // temperature must be 1 (or omitted) when extended thinking is enabled
    } else {
      requestBody.temperature = 0.1;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey!,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',  // Enable CORS for browser calls
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Anthropic API Error Response:', errorText);
      console.error('❌ Response Status:', response.status, response.statusText);
      console.error('❌ Response Headers:', Object.fromEntries(response.headers.entries()));

      // For 429 rate limit errors, capture the retry-after header
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after');
        const error: any = new Error(`Anthropic API request failed: ${response.status} ${response.statusText}`);

        if (retryAfter) {
          error.retryAfter = parseInt(retryAfter, 10);
          console.warn(`⚠️  Rate limit exceeded. Retry after ${retryAfter} seconds.`);
        }

        throw error;
      }

      throw new Error(`Anthropic API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.content || !Array.isArray(data.content)) {
      throw new Error('Invalid response structure from Anthropic API');
    }

    // Find the text block — when extended thinking is enabled, thinking blocks come first
    const textBlock = data.content.find((block: any) => block.type === 'text');
    if (!textBlock?.text) {
      throw new Error('No text content in Anthropic API response');
    }

    if (!data.usage) {
      throw new Error('No usage data in Anthropic response');
    }

    return {
      text: textBlock.text,
      usage: {
        inputTokens: data.usage.input_tokens || 0,
        outputTokens: data.usage.output_tokens || 0,
      },
    };
  }

  /**
   * Parse and validate JSON response from AI (may be wrapped in markdown code blocks)
   */
  private static parseResponse(responseText: string): any {
    let jsonText = responseText.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    // Parse JSON
    let parsed: any;
    try {
      parsed = JSON.parse(jsonText);
    } catch (e) {
      console.error('❌ Failed to parse JSON:', jsonText);
      throw new Error('Failed to parse JSON response from AI');
    }

    // Validate with Zod schema
    const validationResult = CVDataSchema.safeParse(parsed);

    if (!validationResult.success) {
      console.error('❌ AI response validation failed:', validationResult.error.format());
      console.error('Response data:', parsed);
      throw new Error(`AI returned invalid data structure: ${validationResult.error.issues[0]?.message || 'Unknown validation error'}`);
    }

    return validationResult.data;
  }

  /**
   * Clean and validate work history data
   */
  private static cleanWorkHistory(workHistory: any[]): WorkExperience[] {
    return workHistory
      .filter((item) => item.company && item.jobTitle)
      .slice(0, 5) // Ensure max 5 entries
      .map((item) => ({
        company: String(item.company).trim(),
        jobTitle: String(item.jobTitle).trim(),
        dates: item.dates ? String(item.dates).trim() : undefined,
      }));
  }

  /**
   * Clean and validate education data
   */
  private static cleanEducation(education: any[]): Education[] {
    return education
      .filter((item) => item.institution) // Only require institution, degree is optional
      .map((item) => ({
        institution: String(item.institution).trim(),
        degree: item.degree ? String(item.degree).trim() : undefined, // Handle optional degree
        dates: item.dates ? String(item.dates).trim() : undefined,
      }));
  }

  /**
   * Filter out board member roles (client-side backup)
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
   * Sleep utility for retry delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clear rate limiter queue
   */
  static clearQueue(): void {
    rateLimiter.clear();
  }

  /**
   * Get current queue length
   */
  static getQueueLength(): number {
    return rateLimiter.getQueueLength();
  }
}
