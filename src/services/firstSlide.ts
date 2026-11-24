// Geometry and helpers for the first (title) slide. All measurements in inches on the
// current 4:3 design (10 x 7.5 in), matching public/assets/first-slide.png.
import type { SlideBox } from '../shared/apiTypes';

export const SLIDE_WIDTH = 10;
export const SLIDE_HEIGHT = 7.5;

/** "LONGLIST / position / date", right-aligned in the white rectangle */
export const FIRST_SLIDE_TEXT_BOX: SlideBox = { x: 2.72, y: 5.5, w: 4.13, h: 1.24 };
export const FIRST_SLIDE_FONT_PT = 18;

/** Where a new logo goes: fitted into the top left of the white rectangle */
export const DEFAULT_LOGO_AREA: SlideBox = { x: 2.62, y: 4.72, w: 2.9, h: 0.8 };

/** Fit a logo of the given pixel size into the default area, keeping its proportions */
export function defaultLogoPlacement(widthPx: number, heightPx: number): SlideBox {
  const aspect = widthPx / heightPx;
  let w = DEFAULT_LOGO_AREA.w;
  let h = w / aspect;
  if (h > DEFAULT_LOGO_AREA.h) {
    h = DEFAULT_LOGO_AREA.h;
    w = h * aspect;
  }
  return { x: DEFAULT_LOGO_AREA.x, y: DEFAULT_LOGO_AREA.y, w, h };
}

/** Finnish date format used on the slide, e.g. 24.11.2026 */
export function formatSlideDate(date: Date): string {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

/** The text block on the first slide */
export function firstSlideText(position: string, date: Date): string {
  return ['LONGLIST', position.trim(), formatSlideDate(date)].filter(Boolean).join('\n');
}
