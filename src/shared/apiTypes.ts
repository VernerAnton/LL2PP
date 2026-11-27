// Request/response shapes shared by the browser app (src/) and the Worker (worker/)
import type { CandidateData } from '../types';
import type { ExtraFieldId } from '../services/extraDetails';

export type ThinkingEffort = 'low' | 'medium' | 'high';

/** One document of a candidate: extracted text, or (for scanned CVs with no text) the PDF, base64-encoded */
export type CvDocument = { text: string } | { pdfBase64: string };

/** Up to MAX_DOCUMENTS_PER_CANDIDATE documents that belong to one candidate (bound together by the owner) */
export interface ExtractRequest {
  documents: CvDocument[];
  extraFields: ExtraFieldId[];
  effort: ThinkingEffort;
  /** For a saved search: the server adds this request's token use and cost to the search's totals */
  searchId?: string;
}

export const MAX_DOCUMENTS_PER_CANDIDATE = 5;

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number; // in USD
}

export interface ExtractResponse {
  success: boolean;
  data?: CandidateData;
  error?: string;
  usage?: TokenUsage;
  model?: string;
  /** The failure was a problem with Claude's answer, which a higher effort may fix */
  retryAtHigherEffort?: boolean;
}

/** A rectangle in inches on a slide (10 x 7.5 in for the current 4:3 design) */
export interface SlideBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A rectangle in pixels of an image */
export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Client {
  id: string;
  name: string;
  hasLogo: boolean;
  logoVersion: number;
  logoWidthPx: number | null;
  logoHeightPx: number | null;
  crop: PixelRect | null;
  placement: SlideBox | null;
}

export interface LogoMeta {
  crop: PixelRect;
  widthPx: number;
  heightPx: number;
  placement: SlideBox;
}

/** Token use and estimated cost of a search so far (every Claude call, including failed ones) */
export interface SearchUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  /** Extraction requests made: each CV (or bound group) read, plus Auto's retries */
  cvReads: number;
}

export interface SearchSummary {
  id: string;
  usage: SearchUsage;
  name: string;
  clientId: string | null;
  position: string;
  extraFields: ExtraFieldId[];
  candidateCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedCandidate {
  id: string;
  data: CandidateData;
  sourceFile: string;
}

/** A CV file that couldn't be processed, kept (up to 30 days) so it can be retried */
export interface FailedFile {
  id: string;
  /** Files bound together as one candidate share a group id; null for a single file */
  groupId: string | null;
  fileName: string;
  error: string;
  createdAt: string;
}

export interface SearchDetail extends SearchSummary {
  candidates: SavedCandidate[];
  failedFiles: FailedFile[];
}
