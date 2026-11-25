// First (title) slide helpers. Positions come from the slide design (src/shared/design.ts).
import type { SlideBox } from '../shared/apiTypes';

/** "LONGLIST / position / date": bold, right-aligned */
export const FIRST_SLIDE_FONT_PT = 18;

/** Fit a logo of the given pixel size into the design's logo spot, keeping its proportions */
export function defaultLogoPlacement(area: SlideBox, widthPx: number, heightPx: number): SlideBox {
  const aspect = widthPx / heightPx;
  let w = area.w;
  let h = w / aspect;
  if (h > area.h) {
    h = area.h;
    w = h * aspect;
  }
  return { x: area.x, y: area.y, w, h };
}

/** Finnish date format used on the slide, e.g. 24.11.2026 */
export function formatSlideDate(date: Date): string {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

/** The text block on the first slide */
export function firstSlideText(position: string, date: Date): string {
  return ['LONGLIST', position.trim(), formatSlideDate(date)].filter(Boolean).join('\n');
}
