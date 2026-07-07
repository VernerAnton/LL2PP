// Core types for LL2PP application

export type Theme = 'system' | 'light' | 'dark'; // User's preference
export type ActualTheme = 'light' | 'dark'; // What actually gets applied to UI

export type ProcessingStatus = 'idle' | 'parsing' | 'extracting' | 'generating' | 'done' | 'error';

// AI Provider types
export type AiProvider = 'openai' | 'anthropic';

export type OpenAIModel = 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo';
export type AnthropicModel =
  | 'claude-haiku-4-5-20251001'     // Haiku 4.5 - Fastest, cheapest ($1/1M in, $5/1M out)
  | 'claude-sonnet-5'               // Sonnet 5 - Latest balanced (intro $2/1M in, $10/1M out through 2026-08-31; then $3/$15)
  | 'claude-opus-4-6'               // Opus 4.6 - Most capable ($5/1M in, $25/1M out)
  | 'claude-sonnet-4-6'             // Sonnet 4.6 - Legacy ($3/1M in, $15/1M out)
  | 'claude-sonnet-4-5-20250929'    // Sonnet 4.5 - Legacy ($3/1M in, $15/1M out)
  | 'claude-opus-4-5-20251101';     // Opus 4.5 - Legacy ($5/1M in, $25/1M out)

export type OutputMethod = 'slides' | 'manual';

export type ParseMode = 'longlist' | 'individual';

// Concurrency level for parallel API requests (1-5)
export type ConcurrencyLevel = 1 | 2 | 3 | 4 | 5;

export interface WorkExperience {
  jobTitle: string;
  company: string;
  dates?: string; // Format: "MM/YYYY - MM/YYYY"
}

export interface Education {
  institution: string;
  degree?: string; // Degree is optional - some candidates may not list one
  dates?: string; // Format: "MM/YYYY - MM/YYYY"
}

export interface CandidateData {
  name: string;
  workHistory: WorkExperience[];
  education: Education[];
  rawText?: string; // Original CV text for debugging
}

export interface ParsedCV {
  pageNumbers: number[];
  text: string;
}

export interface ProcessingError {
  candidateIndex: number;
  candidateName?: string;
  error: string;
  rawText?: string;
}

export interface AppState {
  theme: Theme;
  apiKey: string | null;
  aiProvider: AiProvider;
  outputMethod: OutputMethod;
  uploadedFile: File | null;
  processingStatus: ProcessingStatus;
  parsedCVs: ParsedCV[];
  extractedCandidates: CandidateData[];
  failedExtractions: ProcessingError[];
  progressCurrent: number;
  progressTotal: number;
  generatedSlidesUrl: string | null;
}
