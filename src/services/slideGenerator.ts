// PPTX slide generation service using PptxGenJS
// Generates 4-up candidate slides from extracted CV data
import PptxGenJS from 'pptxgenjs';
import type { CandidateData } from '../types';
import { layoutConfig } from './layoutConfig';
import type { SlideBox } from '../shared/apiTypes';
import { CANDIDATES_PER_SLIDE, SLIDE_DIMENSIONS, type CandidateSlot, type SlideDesign, type SlideKind } from '../shared/design';
import { FIRST_SLIDE_FONT_PT, firstSlideText } from './firstSlide';

// Configuration for overflow handling
const OVERFLOW_CONFIG = {
  maxExperienceBullets: 5,   // Limit work history to top 5 roles
  maxEducationChars: 120,    // Warn if education text exceeds this
};

/** What goes on the first slide besides the fixed design */
export interface FirstSlideOptions {
  position: string;
  /** The client's logo as a data URL (image/png) and where it goes */
  logo?: { dataUrl: string; placement: SlideBox };
}

/** A slide background for PptxGenJS: a path served with the app, or image data */
export type BackgroundImage = { path: string } | { data: string };

/** The design to build the deck with, and its background images */
export interface DeckDesign {
  design: SlideDesign;
  backgrounds: Record<SlideKind, BackgroundImage>;
}

export interface GenerationResult {
  success: boolean;
  count: number;
  error?: string;
}

export class SlideGenerator {
  /**
   * Main function to generate the presentation
   */
  static async generate(candidates: CandidateData[], firstSlide: FirstSlideOptions, deck: DeckDesign): Promise<GenerationResult> {
    try {
      // Validate input
      if (!candidates || candidates.length === 0) {
        return {
          success: false,
          count: 0,
          error: 'No candidates to generate. Please extract CV data first.'
        };
      }

      console.log(`📊 Starting presentation generation for ${candidates.length} candidates...`);

      const prs = new PptxGenJS();

      // 1. Set up presentation properties
      // 4:3 (10 x 7.5 in) or widescreen 16:9 (13.33 x 7.5 in), from the design
      prs.layout = deck.design.size === '16:9' ? 'LAYOUT_WIDE' : 'LAYOUT_4x3';
      prs.author = 'LL2PP - LongList to PowerPoint';
      prs.title = `Candidate Longlist - ${new Date().toLocaleDateString()}`;

      // 2. Define slide master with template background image
      this.defineTemplateMaster(prs, deck.backgrounds.content);

      // 3. Add First Slide (title/intro slide with text box)
      this.addFirstSlide(prs, firstSlide, deck);

      // 4. Process Candidates in Batches of 4
      const totalSlides = Math.ceil(candidates.length / CANDIDATES_PER_SLIDE);
      let slideCount = 0;

      for (let i = 0; i < candidates.length; i += CANDIDATES_PER_SLIDE) {
        slideCount++;
        console.log(`📄 Generating slide ${slideCount} of ${totalSlides}...`);

        const group = candidates.slice(i, i + CANDIDATES_PER_SLIDE);

        // Create a new slide using the template master
        const slide = prs.addSlide({ masterName: 'TEMPLATE_MASTER' });

        // 4. Place each candidate in their slot
        group.forEach((candidate, idx) => {
          this.addCandidateToSlide(slide, candidate, deck.design.contentSlide.slots[idx]);
        });
      }

      // 5. Add Last Slide (conclusion/outro slide)
      this.addLastSlide(prs, deck.backgrounds.last);

      // 6. Save with descriptive filename
      const filename = `Candidates_${candidates.length}_${new Date().toISOString().slice(0, 10)}.pptx`;
      console.log(`💾 Saving presentation: ${filename}`);
      await prs.writeFile({ fileName: filename });

      console.log(`✅ Presentation generated successfully: ${slideCount} slides, ${candidates.length} candidates`);

      return { success: true, count: candidates.length };

    } catch (error: any) {
      console.error('❌ Generation Error:', error);
      return {
        success: false,
        count: 0,
        error: error.message || 'Unknown error during presentation generation'
      };
    }
  }

  /**
   * Maps a CandidateData object to a specific slot on the slide
   * Uses 2-column layout: Education (left) and Experience (right)
   * Format matches LinkedIn export: Name in CAPS, Company - Job Title dates
   */
  private static addCandidateToSlide(slide: any, candidate: CandidateData, slot: CandidateSlot | undefined) {
    if (!slot) return;
    const { fonts, colors } = layoutConfig;

    // --- DATA PREPARATION ---
    // 1. Experience: Format WorkHistory array into bulleted list
    // Format: Company - Job Title dates
    // Limit to top 5 items to prevent overflow
    const experienceText = candidate.workHistory.length > 0
      ? candidate.workHistory
          .slice(0, OVERFLOW_CONFIG.maxExperienceBullets)
          .map(w => {
            const dateStr = w.dates ? ` ${w.dates}` : '';
            return `${w.company} - ${w.jobTitle}${dateStr}`;
          })
          .join('\n')
      : 'No operational experience found (board positions filtered)';

    // 2. Education: Format Education array
    // Institution with >>> prefix for VBA macro to identify and format (bold, capitalize, etc.)
    // >>> prefix allows PowerPoint VBA macro to identify and bold institution names
    const educationText = candidate.education
      .map(e => {
        if (e.degree) {
          const dateStr = e.dates ? ` · (${e.dates})` : '';
          return `>>>${e.institution}\n• ${e.degree}${dateStr}`;
        } else {
          // No degree - just show institution
          return `>>>${e.institution}`;
        }
      })
      .join('\n');

    // --- LEFT COLUMN: EDUCATION ---
    // Starts at 10pt, automatically shrinks if content is too long (min 6pt)
    // Institution names have >>> prefix for VBA macro formatting
    if (educationText) {
      slide.addText(educationText, {
        x: slot.education.x,
        y: slot.education.y,
        w: slot.education.w,
        h: slot.education.h,
        fontSize: fonts.education,
        color: this.hexToRgb(colors.education),
        fit: 'shrink',  // Dynamic sizing - shrinks to fit content
        shrinkToFitMin: 6,  // Minimum font size when shrinking (prevents tiny text)
        wrap: true,
        valign: 'top',
        lineSpacing: 12,
        margin: 0  // Remove default padding to prevent coordinate shifting
      });
    }

    // --- RIGHT COLUMN: NAME + EXPERIENCE ---

    // A. NAME (top of right column, in CAPS and bold), followed on the same line by any
    // extra details requested for this run: "JANE DOE · Helsinki"
    // Fixed 13pt font for the name - does NOT shrink to maintain prominence
    const extrasText = (candidate.extras ?? [])
      .map(e => e.value)
      .filter(Boolean)
      .join(' · ');
    const nameLine = this.layoutNameLine(candidate.name.toUpperCase(), extrasText, slot.experience.w);

    slide.addText(
      [
        { text: candidate.name.toUpperCase(), options: { bold: true, fontSize: fonts.name } },
        ...(extrasText
          ? [{ text: `  ·  ${extrasText}`, options: { bold: false, fontSize: nameLine.extrasFontSize } }]
          : []),
      ],
      {
        x: slot.experience.x,
        y: slot.experience.y,
        w: slot.experience.w,
        h: nameLine.height,
        color: this.hexToRgb(colors.name),
        wrap: true,
        valign: 'top',
        margin: 0  // Remove default padding to prevent coordinate shifting
      }
    );

    // B. WORK HISTORY (Bulleted List below name)
    // Starts at 10pt, automatically shrinks if content is too long (min 6pt)
    slide.addText(experienceText, {
      x: slot.experience.x,
      y: slot.experience.y + nameLine.height + 0.05,
      w: slot.experience.w,
      h: slot.experience.h - nameLine.height - 0.10, // Use most of the box height minus name
      fontSize: fonts.experience,
      color: this.hexToRgb(colors.experience),
      bullet: true,
      fit: 'shrink',  // Dynamic sizing - shrinks to fit content
      shrinkToFitMin: 6,  // Minimum font size when shrinking
      wrap: true,
      valign: 'top',
      margin: 0  // Remove default padding to prevent coordinate shifting
    });
  }

  /**
   * Decide how the name line fits: shrink the extra details (10pt down to 7pt) so the line
   * stays on one line, and if even that won't fit, let it wrap onto a second line and
   * report the taller height so the work history moves down instead of being overlapped.
   */
  private static layoutNameLine(name: string, extrasText: string, widthInches: number) {
    const ONE_LINE = 0.25; // inches - the original name box height
    const TWO_LINES = 0.45;
    if (!extrasText) return { extrasFontSize: 10, height: ONE_LINE };

    // 6% safety margin for differences between browser and PowerPoint text rendering
    const available = widthInches * 72 * 0.94; // points
    const nameWidth = this.measureText(name, layoutConfig.fonts.name, true);

    for (let size = 10; size >= 7; size--) {
      if (nameWidth + this.measureText(`  ·  ${extrasText}`, size, false) <= available) {
        return { extrasFontSize: size, height: ONE_LINE };
      }
    }
    return { extrasFontSize: 9, height: TWO_LINES };
  }

  private static measureContext: CanvasRenderingContext2D | null | undefined;

  /**
   * Width of a piece of text in points, measured in the deck's font (Calibri, from the
   * theme). Where Calibri isn't installed the browser measures a wider fallback font,
   * which errs on the side of shrinking or wrapping rather than overflowing.
   */
  private static measureText(text: string, sizePt: number, bold: boolean): number {
    if (this.measureContext === undefined) {
      this.measureContext = document.createElement('canvas').getContext('2d');
    }
    const ctx = this.measureContext;
    if (!ctx) {
      // No canvas: conservative average character widths
      return text.length * sizePt * (bold ? 0.72 : 0.52);
    }
    // Canvas works in CSS px at 96 per inch; points are 72 per inch
    ctx.font = `${bold ? 'bold ' : ''}${sizePt}pt Calibri, Carlito, Arial, sans-serif`;
    return ctx.measureText(text).width * 0.75;
  }

  /**
   * Slide master for the candidate slides: the design's content background. All visual
   * elements are in the image; text is placed on top at the design's positions.
   */
  private static defineTemplateMaster(prs: any, background: BackgroundImage): void {
    prs.defineSlideMaster({
      title: 'TEMPLATE_MASTER',
      background: this.imageSource(background),
      objects: []
    });
  }

  /**
   * First slide: background image, the client's logo (where it was placed in the logo
   * editor), and "LONGLIST / position / date" at the design's text position
   */
  private static addFirstSlide(prs: any, options: FirstSlideOptions, deck: DeckDesign): void {
    const slide = prs.addSlide();
    slide.addImage({ ...this.imageSource(deck.backgrounds.first), x: 0, y: 0, w: '100%', h: '100%' });

    if (options.logo) {
      const { dataUrl, placement } = options.logo;
      // A placement made for a wider design must not stick out of a narrower slide
      const { width, height } = SLIDE_DIMENSIONS[deck.design.size];
      const w = Math.min(placement.w, width);
      const h = placement.h * (w / placement.w);
      slide.addImage({
        data: dataUrl.replace(/^data:/, ''), // PptxGenJS wants "image/png;base64,..."
        x: Math.min(Math.max(0, placement.x), width - w),
        y: Math.min(Math.max(0, placement.y), height - h),
        w,
        h
      });
    }

    slide.addText(firstSlideText(options.position, new Date()), {
      ...deck.design.firstSlide.textBox,
      align: 'right',
      valign: 'top',
      fontSize: FIRST_SLIDE_FONT_PT,
      bold: true,
      color: '000000',
      wrap: true,
      margin: 0
    });
  }

  /**
   * Last slide: background image only
   */
  private static addLastSlide(prs: any, background: BackgroundImage): void {
    const slide = prs.addSlide();
    slide.addImage({ ...this.imageSource(background), x: 0, y: 0, w: '100%', h: '100%' });
  }

  /** PptxGenJS image source: a path, or data as "image/png;base64,..." */
  private static imageSource(image: BackgroundImage): { path: string } | { data: string } {
    return 'path' in image ? image : { data: image.data.replace(/^data:/, '') };
  }

  /**
   * Helper: PptxGenJS wants colors without '#' prefix
   */
  private static hexToRgb(hex: string): string {
    return hex.replace('#', '');
  }
}
