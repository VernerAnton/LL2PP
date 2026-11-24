// Clients and logos, stored on the server (D1 + R2)
import type { Client, LogoMeta, SlideBox } from '../shared/apiTypes';
import { api, ApiError, jsonBody } from './api';

export const listClients = () => api<Client[]>('clients');

export const createClient = (name: string) =>
  api<Client>('clients', { method: 'POST', body: jsonBody({ name }) });

export const renameClient = (id: string, name: string) =>
  api<Client>(`clients/${id}`, { method: 'PATCH', body: jsonBody({ name }) });

export const savePlacement = (id: string, placement: SlideBox) =>
  api<Client>(`clients/${id}`, { method: 'PATCH', body: jsonBody({ placement }) });

export const deleteClient = (id: string) => api<{ deleted: boolean }>(`clients/${id}`, { method: 'DELETE' });

export const deleteLogo = (id: string) => api<Client>(`clients/${id}/logo`, { method: 'DELETE' });

/** Save a logo: the cropped PNG, plus the original image when it is a new upload */
export function saveLogo(id: string, logo: Blob, meta: LogoMeta, original?: Blob): Promise<Client> {
  const form = new FormData();
  form.append('logo', logo, 'logo.png');
  if (original) form.append('original', original, 'original');
  form.append('meta', JSON.stringify(meta));
  return api<Client>(`clients/${id}/logo`, { method: 'PUT', body: form });
}

/** URL of the cropped logo; the version makes a changed logo a new URL */
export const logoUrl = (client: Client) => `/api/clients/${client.id}/logo?v=${client.logoVersion}`;
export const originalLogoUrl = (client: Client) => `/api/clients/${client.id}/logo/original?v=${client.logoVersion}`;

/** The cropped logo as a data URL, for embedding in the PPTX */
export async function logoDataUrl(client: Client): Promise<string> {
  const response = await fetch(logoUrl(client));
  if (!response.ok) throw new ApiError(response.status, 'Could not load the client logo');
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read the client logo'));
    reader.readAsDataURL(blob);
  });
}
