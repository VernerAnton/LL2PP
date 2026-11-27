// CV extraction from the browser's side: sends each CV's text to the Worker, which calls Claude.
import type { CandidateData } from '../types';
import type { CvDocument, ExtractResponse, ThinkingEffort, TokenUsage } from '../shared/apiTypes';
import type { ExtraFieldId } from './extraDetails';
import { api, jsonBody } from './api';
import { RateLimiter } from './rateLimiter';

// Space out request starts (1 per second) so bursts don't trip per-minute rate limits.
const rateLimiter = new RateLimiter(1000);

/** Thinking level chosen in the UI. Auto picks a level per job and retries a bad result at high. */
export type ThinkingLevel = 'auto' | ThinkingEffort;

export type { TokenUsage };

export interface ExtractionResult {
  success: boolean;
  data?: CandidateData;
  error?: string;
  usage?: TokenUsage;
}

/** One document of a candidate: its text, or the PDF file itself when it has no text (a scanned CV) */
export type CvPart = { text: string } | { pdf: Blob };

export interface ExtractOptions {
  extraFields: ExtraFieldId[];
  level: ThinkingLevel;
  /** What kind of CV this is, for Auto: longlist exports are clean, individual CVs vary */
  source: 'longlist' | 'individual';
}

export class AIService {
  /**
   * Extract structured data from one CV's text
   */
  /**
   * Extract one candidate from one document, or from several documents bound together (read as
   * one profile)
   */
  static extractCVData(parts: CvPart[], options: ExtractOptions): Promise<ExtractionResult> {
    return rateLimiter.enqueue(() => this.extract(parts, options));
  }

  private static async extract(parts: CvPart[], options: ExtractOptions): Promise<ExtractionResult> {
    // Scanned CVs go to Claude as the PDF, which it reads as page images
    const documents: CvDocument[] = await Promise.all(
      parts.map(async (part) => ('text' in part ? { text: part.text } : { pdfBase64: await toBase64(part.pdf) }))
    );
    const auto = options.level === 'auto';
    const effort: ThinkingEffort =
      options.level === 'auto' ? (options.source === 'longlist' ? 'low' : 'medium') : options.level;

    let result = await this.request(documents, options.extraFields, effort);

    // Auto: a CV that came back broken or without any work history gets one more try at high effort
    const incomplete = result.success && (result.data?.workHistory.length ?? 0) === 0;
    if (auto && effort !== 'high' && ((!result.success && result.retryAtHigherEffort) || incomplete)) {
      const retry = await this.request(documents, options.extraFields, 'high');
      if (retry.success || !result.success) {
        result = { ...retry, usage: addUsage(result.usage, retry.usage) };
      } else if (result.usage) {
        result = { ...result, usage: addUsage(result.usage, retry.usage) };
      }
    }

    return {
      success: result.success,
      data: result.data ? { ...result.data, rawText: parts.map((p) => ('text' in p ? p.text : '')).join('\n\n') } : undefined,
      error: result.error,
      usage: result.usage,
    };
  }

  private static async request(documents: CvDocument[], extraFields: ExtraFieldId[], effort: ThinkingEffort): Promise<ExtractResponse> {
    try {
      return await api<ExtractResponse>('extract', {
        method: 'POST',
        body: jsonBody({ documents, extraFields, effort }),
      });
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /** The model the server will use (the newest Claude Sonnet) */
  static async getModel(): Promise<string> {
    return (await api<{ model: string }>('model')).model;
  }
}

function addUsage(a?: TokenUsage, b?: TokenUsage): TokenUsage | undefined {
  if (!a) return b;
  if (!b) return a;
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    estimatedCost: a.estimatedCost + b.estimatedCost,
  };
}

/** File contents as base64 (without the data: prefix) */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(new Error('Could not read the PDF'));
    reader.readAsDataURL(blob);
  });
}
