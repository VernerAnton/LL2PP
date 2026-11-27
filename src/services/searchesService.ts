// Saved searches (individual CVs in batches), stored on the server as extracted data only
import type { CandidateData } from '../types';
import type { FailedFile, SavedCandidate, SearchDetail, SearchSummary } from '../shared/apiTypes';
import type { ExtraFieldId } from './extraDetails';
import { api, ApiError, jsonBody } from './api';

export const listSearches = () => api<SearchSummary[]>('searches');

export const getSearch = (id: string) => api<SearchDetail>(`searches/${id}`);

export const createSearch = (input: { name: string; clientId: string | null; position: string; extraFields: ExtraFieldId[] }) =>
  api<SearchDetail>('searches', { method: 'POST', body: jsonBody(input) });

export const updateSearch = (id: string, changes: { name?: string; clientId?: string | null; position?: string }) =>
  api<SearchDetail>(`searches/${id}`, { method: 'PATCH', body: jsonBody(changes) });

export const deleteSearch = (id: string) => api<{ deleted: boolean }>(`searches/${id}`, { method: 'DELETE' });

/** Save extracted candidates; CV text (rawText) is stripped before sending */
export const addCandidates = (id: string, candidates: { data: CandidateData; sourceFile: string }[]) =>
  api<SavedCandidate[]>(`searches/${id}/candidates`, {
    method: 'POST',
    body: jsonBody({ candidates: candidates.map((c) => ({ data: withoutCvText(c.data), sourceFile: c.sourceFile })) }),
  });

export const updateCandidate = (searchId: string, candidateId: string, data: CandidateData) =>
  api<{ id: string; data: CandidateData }>(`searches/${searchId}/candidates/${candidateId}`, {
    method: 'PATCH',
    body: jsonBody({ data: withoutCvText(data) }),
  });

export const deleteCandidate = (searchId: string, candidateId: string) =>
  api<{ deleted: boolean }>(`searches/${searchId}/candidates/${candidateId}`, { method: 'DELETE' });

export const reorderCandidates = (searchId: string, ids: string[]) =>
  api<SearchDetail>(`searches/${searchId}/order`, { method: 'PUT', body: jsonBody({ ids }) });

function withoutCvText(data: CandidateData): CandidateData {
  const { rawText: _rawText, ...rest } = data;
  return rest;
}

// --- Files that couldn't be read, kept for a retry ---------------------------------------------

/** Keep a file that couldn't be read. Files bound as one candidate share a groupId. */
export function keepFailedFile(searchId: string, file: Blob, fileName: string, error: string, groupId?: string): Promise<FailedFile> {
  const form = new FormData();
  form.append('file', file, fileName);
  form.append('error', error.slice(0, 1000));
  if (groupId) form.append('groupId', groupId);
  return api<FailedFile>(`searches/${searchId}/failed`, { method: 'POST', body: form });
}

export async function getFailedFile(searchId: string, fileId: string): Promise<Blob> {
  const response = await fetch(`/api/searches/${searchId}/failed/${fileId}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, (body as { error?: string } | null)?.error ?? 'Could not load the stored file');
  }
  return response.blob();
}

export const updateFailedFile = (searchId: string, fileId: string, error: string) =>
  api<{ updated: boolean }>(`searches/${searchId}/failed/${fileId}`, { method: 'PATCH', body: jsonBody({ error: error.slice(0, 1000) }) });

export const removeFailedFile = (searchId: string, fileId: string) =>
  api<{ deleted: boolean }>(`searches/${searchId}/failed/${fileId}`, { method: 'DELETE' });

export const removeAllFailedFiles = (searchId: string) =>
  api<{ deleted: boolean }>(`searches/${searchId}/failed`, { method: 'DELETE' });
