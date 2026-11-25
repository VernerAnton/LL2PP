// The slide design (size, backgrounds, box positions), stored on the server
import { createContext, useContext } from 'react';
import { BUILT_IN_BACKGROUNDS, BUILT_IN_DESIGN, type SlideDesign, type SlideKind } from '../shared/design';
import { api, ApiError } from './api';

/** Marks a background whose new image is attached to the save request (see worker/design.ts) */
export const NEW_BACKGROUND = -1;

export const getDesign = () => api<SlideDesign>('design');

export const resetDesign = () => api<SlideDesign>('design', { method: 'DELETE' });

/** Save the design; `files` holds the new background images for slides marked NEW_BACKGROUND */
export function saveDesign(design: SlideDesign, files: Partial<Record<SlideKind, Blob>>): Promise<SlideDesign> {
  const form = new FormData();
  form.append('design', JSON.stringify(design));
  for (const [kind, blob] of Object.entries(files)) if (blob) form.append(kind, blob, kind);
  return api<SlideDesign>('design', { method: 'PUT', body: form });
}

/** URL of a slide's background: the uploaded one, or the built-in image */
export function backgroundUrl(design: SlideDesign, kind: SlideKind): string {
  const version = design.backgrounds[kind];
  return version === null ? `/${BUILT_IN_BACKGROUNDS[kind]}` : `/api/design/background/${kind}?v=${version}`;
}

/** A slide's background as a data URL, for embedding in the PPTX */
export async function backgroundDataUrl(design: SlideDesign, kind: SlideKind): Promise<string> {
  const response = await fetch(backgroundUrl(design, kind));
  if (!response.ok) throw new ApiError(response.status, `Could not load the ${kind} slide background`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Could not read the ${kind} slide background`));
    reader.readAsDataURL(blob);
  });
}

/** The design currently in use, provided by App */
export const DesignContext = createContext<SlideDesign>(BUILT_IN_DESIGN);
export const useDesign = () => useContext(DesignContext);
