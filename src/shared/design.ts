// The slide design: size, which backgrounds to use, and where every text box goes. Shared by the
// app (preview, editor, PPTX generation) and the Worker (validation). The built-in design is the
// original template (public/assets/*.png); a saved design replaces any part of it.
import type { SlideBox } from './apiTypes';

export type SlideSize = '4:3' | '16:9';
export type SlideKind = 'first' | 'content' | 'last';
export const SLIDE_KINDS: SlideKind[] = ['first', 'content', 'last'];

/** Slide dimensions in inches. 16:9 is PowerPoint's widescreen (13.333 x 7.5 in). */
export const SLIDE_DIMENSIONS: Record<SlideSize, { width: number; height: number }> = {
  '4:3': { width: 10, height: 7.5 },
  '16:9': { width: 13.333, height: 7.5 },
};

export interface CandidateSlot {
  education: SlideBox; // left column
  experience: SlideBox; // name line + work history
}

export interface SlideDesign {
  size: SlideSize;
  /** null = built-in background; a number = version of the uploaded background (for cache busting) */
  backgrounds: Record<SlideKind, number | null>;
  firstSlide: {
    textBox: SlideBox; // LONGLIST / position / date
    logoArea: SlideBox; // where a newly uploaded client logo is fitted
  };
  contentSlide: {
    slots: CandidateSlot[]; // four candidates per slide
  };
}

export const CANDIDATES_PER_SLIDE = 4;

export const BUILT_IN_DESIGN: SlideDesign = {
  size: '4:3',
  backgrounds: { first: null, content: null, last: null },
  firstSlide: {
    textBox: { x: 2.72, y: 5.5, w: 4.13, h: 1.24 },
    logoArea: { x: 2.62, y: 4.72, w: 2.9, h: 0.8 },
  },
  contentSlide: {
    slots: [
      { education: { x: 0.64, y: 0.78, w: 3.94, h: 1.55 }, experience: { x: 4.81, y: 0.78, w: 5.18, h: 1.55 } },
      { education: { x: 0.64, y: 2.41, w: 3.94, h: 1.55 }, experience: { x: 4.81, y: 2.41, w: 5.18, h: 1.55 } },
      { education: { x: 0.64, y: 4.09, w: 3.94, h: 1.55 }, experience: { x: 4.81, y: 4.09, w: 5.18, h: 1.55 } },
      { education: { x: 0.64, y: 5.89, w: 3.94, h: 1.55 }, experience: { x: 4.81, y: 5.89, w: 5.18, h: 1.55 } },
    ],
  },
};

/** Built-in background images, served with the app */
export const BUILT_IN_BACKGROUNDS: Record<SlideKind, string> = {
  first: 'assets/first-slide.png',
  content: 'assets/template-background.png',
  last: 'assets/last-slide.png',
};

/** Which standard size an image's proportions match (2% tolerance), or null */
export function detectSlideSize(widthPx: number, heightPx: number): SlideSize | null {
  const ratio = widthPx / heightPx;
  for (const size of Object.keys(SLIDE_DIMENSIONS) as SlideSize[]) {
    const { width, height } = SLIDE_DIMENSIONS[size];
    if (Math.abs(ratio / (width / height) - 1) < 0.02) return size;
  }
  return null;
}

/** Stretch every box horizontally to a new slide width (a starting point after a size change) */
export function rescaleDesign(design: SlideDesign, size: SlideSize): SlideDesign {
  const factor = SLIDE_DIMENSIONS[size].width / SLIDE_DIMENSIONS[design.size].width;
  const scale = (b: SlideBox): SlideBox => ({ ...b, x: b.x * factor, w: b.w * factor });
  return {
    ...design,
    size,
    firstSlide: { textBox: scale(design.firstSlide.textBox), logoArea: scale(design.firstSlide.logoArea) },
    contentSlide: {
      slots: design.contentSlide.slots.map((s) => ({ education: scale(s.education), experience: scale(s.experience) })),
    },
  };
}

/** Returns a problem description, or null when the design is valid */
export function validateDesign(design: SlideDesign): string | null {
  if (!(design.size in SLIDE_DIMENSIONS)) return 'Unknown slide size';
  const { width, height } = SLIDE_DIMENSIONS[design.size];
  const boxes: [string, SlideBox][] = [
    ['first slide text', design.firstSlide?.textBox],
    ['first slide logo spot', design.firstSlide?.logoArea],
    ...(design.contentSlide?.slots ?? []).flatMap((s, i): [string, SlideBox][] => [
      [`candidate ${i + 1} education`, s.education],
      [`candidate ${i + 1} name and experience`, s.experience],
    ]),
  ];
  if ((design.contentSlide?.slots ?? []).length !== CANDIDATES_PER_SLIDE) return 'The content slide needs 4 candidate slots';
  for (const [name, b] of boxes) {
    const ok =
      b &&
      [b.x, b.y, b.w, b.h].every((v) => typeof v === 'number' && Number.isFinite(v)) &&
      b.w >= 0.2 &&
      b.h >= 0.2 &&
      b.x >= -0.01 &&
      b.y >= -0.01 &&
      b.x + b.w <= width + 0.01 &&
      b.y + b.h <= height + 0.01;
    if (!ok) return `The ${name} box is outside the slide or too small`;
  }
  for (const kind of SLIDE_KINDS) {
    const v = design.backgrounds?.[kind];
    if (v !== null && !(typeof v === 'number' && Number.isInteger(v) && v > 0)) return 'Invalid background reference';
    // The built-in backgrounds are 4:3, so any other size needs all three replaced
    if (v === null && design.size !== '4:3') return `A ${design.size} design needs its own ${kind} slide background`;
  }
  return null;
}
