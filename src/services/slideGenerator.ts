// PPTX slide generation service using PptxGenJS
// Generates 4-up candidate slides from extracted CV data
import PptxGenJS from 'pptxgenjs';
import type { CandidateData } from '../types';
import { layoutConfig } from './layoutConfig';

// Configuration for overflow handling
const OVERFLOW_CONFIG = {
  maxExperienceBullets: 5,   // Limit work history to top 5 roles
  maxEducationChars: 120,    // Warn if education text exceeds this
};

export interface GenerationResult {
  success: boolean;
  count: number;
  error?: string;
}

export class SlideGenerator {
  /**
   * Main function to generate the presentation
   */
  static async generate(candidates: CandidateData[]): Promise<GenerationResult> {
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
      prs.layout = 'LAYOUT_4x3'; // 4:3 standard aspect ratio
      prs.author = 'LL2PP - LongList to PowerPoint';
      prs.title = `Candidate Longlist - ${new Date().toLocaleDateString()}`;

      // 2. Define slide master with template background image
      this.defineTemplateMaster(prs);

      // 3. Add First Slide (title/intro slide with text box)
      this.addFirstSlide(prs);

      // 4. Process Candidates in Batches of 4
      const totalSlides = Math.ceil(candidates.length / 4);
      let slideCount = 0;

      for (let i = 0; i < candidates.length; i += 4) {
        slideCount++;
        console.log(`📄 Generating slide ${slideCount} of ${totalSlides}...`);

        const group = candidates.slice(i, i + 4);

        // Create a new slide using the template master
        const slide = prs.addSlide({ masterName: 'TEMPLATE_MASTER' });

        // 4. Place each candidate in their slot
        group.forEach((candidate, idx) => {
          this.addCandidateToSlide(slide, candidate, idx);
        });
      }

      // 5. Add Last Slide (conclusion/outro slide)
      this.addLastSlide(prs);

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
  private static addCandidateToSlide(slide: any, candidate: CandidateData, slotIndex: number) {
    if (slotIndex >= layoutConfig.slots.length) return;

    const slot = layoutConfig.slots[slotIndex];
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

    // A. NAME (top of right column, in CAPS and bold)
    // Fixed 13pt font - does NOT shrink to maintain prominence
    slide.addText(candidate.name.toUpperCase(), {
      x: slot.experience.x,
      y: slot.experience.y,
      w: slot.experience.w,
      h: 0.25,
      fontSize: fonts.name,
      color: this.hexToRgb(colors.name),
      bold: true,
      wrap: true,
      valign: 'top',
      margin: 0  // Remove default padding to prevent coordinate shifting
    });

    // B. WORK HISTORY (Bulleted List below name)
    // Starts at 10pt, automatically shrinks if content is too long (min 6pt)
    slide.addText(experienceText, {
      x: slot.experience.x,
      y: slot.experience.y + 0.30,
      w: slot.experience.w,
      h: slot.experience.h - 0.35, // Use most of the box height minus name
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
   * Define slide master using template background image
   * - Full template slide exported as PNG/JPG from your template PPTX
   * - All visual elements (colors, logo, layout boxes) are burned into the background image
   * - Text is placed on top using coordinates from layoutConfig
   */
  private static defineTemplateMaster(prs: any): void {
    prs.defineSlideMaster({
      title: 'TEMPLATE_MASTER',
      background: { path: 'assets/template-background.png' }, // Full template slide as background
      objects: []  // No additional objects needed - everything is in the background image
    });

    console.log('✅ Slide master defined with template background image');
  }

  /**
   * Add first slide with background image and text box
   * Text box contains: "LONGLIST", "Job Title", "Date" (right-aligned, each on own line)
   */
  private static addFirstSlide(prs: any): void {
    const slide = prs.addSlide();

    // Add background image (full slide)
    slide.addImage({
      path: 'assets/first-slide.png',
      x: 0,
      y: 0,
      w: '100%',
      h: '100%'
    });

    // Add text box with placeholder content
    // Measurements converted from cm to inches:
    // X: 6.91 cm = 2.72 inches
    // Y: 13.98 cm = 5.50 inches
    // Width: 10.48 cm = 4.13 inches
    // Height: 3.16 cm = 1.24 inches
    const textContent = 'LONGLIST\nJob Title\nDate';

    slide.addText(textContent, {
      x: 2.72,
      y: 5.50,
      w: 4.13,
      h: 1.24,
      align: 'right',
      valign: 'top',
      fontSize: 18,
      bold: true,
      color: '000000',
      wrap: true,
      margin: 0
    });

    console.log('✅ First slide added with background and text box');
  }

  /**
   * Add last slide with background image only (no text boxes)
   */
  private static addLastSlide(prs: any): void {
    const slide = prs.addSlide();

    // Add background image (full slide)
    slide.addImage({
      path: 'assets/last-slide.png',
      x: 0,
      y: 0,
      w: '100%',
      h: '100%'
    });

    console.log('✅ Last slide added with background image');
  }

  /**
   * Helper: PptxGenJS wants colors without '#' prefix
   */
  private static hexToRgb(hex: string): string {
    return hex.replace('#', '');
  }
}
