// Core types for LL2PP application

export type Theme = 'system' | 'light' | 'dark'; // User's preference
export type ActualTheme = 'light' | 'dark'; // What actually gets applied to UI

export type ProcessingStatus = 'idle' | 'parsing' | 'extracting' | 'generating' | 'done' | 'error';

// AI Provider types
export type AiProvider = 'openai' | 'anthropic';

export type OpenAIModel = 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo';
export type AnthropicModel =
  | 'claude-haiku-5-5'   // Haiku 5.5 - Fastest, cheapest ($0.10/1M in, $0.50/1M out; prompts up to 100K tokens)
  | 'claude-sonnet-5-5'  // Sonnet 5.5 - Latest balanced ($2/1M in, $10/1M out)
  | 'claude-opus-5-5';   // Opus 5.5 - Most capable ($4/1M in, $20/1M out)

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
