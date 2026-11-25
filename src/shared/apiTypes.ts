// Request/response shapes shared by the browser app (src/) and the Worker (worker/)
import type { CandidateData } from '../types';
import type { ExtraFieldId } from '../services/extraDetails';

export type ThinkingEffort = 'low' | 'medium' | 'high';

export interface ExtractRequest {
  cvText: string;
  extraFields: ExtraFieldId[];
  effort: ThinkingEffort;
}

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

export interface SearchSummary {
  id: string;
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

export interface SearchDetail extends SearchSummary {
  candidates: SavedCandidate[];
}
