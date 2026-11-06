// PDF parsing service using pdf.js
import * as pdfjsLib from 'pdfjs-dist';
import type { ParsedCV } from '../types';

import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// Use the PDF.js worker bundled with the app, so it always matches the installed pdfjs-dist version
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export class PDFService {
  /**
   * Get total page count from PDF without parsing content
   */
  static async getPageCount(file: File): Promise<number> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  }

  /**
   * Parse PDF file and extract text from all pages
   * Preserves line breaks by detecting Y-position changes
   */
  static async parsePDF(file: File): Promise<string[]> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pageTexts: string[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();

      // Preserve line breaks by detecting Y-position changes
      let pageText = '';
      let lastY = -1;

      textContent.items.forEach((item: any, idx: number) => {
        const currentY = item.transform[5]; // Y-coordinate

        // If Y position changes significantly (>2 units), it's a new line
        if (lastY !== -1 && Math.abs(currentY - lastY) > 2) {
          pageText += '\n';
        } else if (idx > 0) {
          // Same line, add space between words
          pageText += ' ';
        }

        pageText += item.str;
        lastY = currentY;
      });

      pageTexts.push(pageText);
    }

    return pageTexts;
  }

  /**
   * Split PDF pages into individual CVs based on "Page 1 of" markers
   * Supports multiple formats: "Page 1 of X", "Page 1/X", "1 of X", "1/X"
   */
  static splitIntoCVs(pageTexts: string[]): ParsedCV[] {
    const cvs: ParsedCV[] = [];
    let currentCV: ParsedCV | null = null;

    pageTexts.forEach((pageText, index) => {
      const normalizedText = pageText.replace(/\s+/g, ' ').toLowerCase();

      // Detect various "page 1" patterns (case-insensitive)
      const patterns = [
        /page\s*1\s*of\s*\d+/i,     // "Page 1 of 3"
        /page\s*1\s*\/\s*\d+/i,     // "Page 1 / 3" or "Page 1/3"
        /^1\s*of\s*\d+/i,           // "1 of 3" at start of text
        /^1\s*\/\s*\d+/i,           // "1/3" at start of text
        /\bpage\s*1\b/i,            // Just "Page 1" (more lenient)
      ];

      const isNewCV = patterns.some(pattern => pattern.test(normalizedText));

      if (isNewCV) {
        // Start a new CV
        if (currentCV) {
          cvs.push(currentCV);
        }
        currentCV = {
          pageNumbers: [index + 1],
          text: pageText
        };
      } else if (currentCV) {
        // Continue current CV
        currentCV.pageNumbers.push(index + 1);
        currentCV.text += '\n\n' + pageText;
      } else {
        // No CV started yet, this might be a cover page or header
        // Start a CV anyway to not lose data
        currentCV = {
          pageNumbers: [index + 1],
          text: pageText
        };
      }
    });

    // Add the last CV
    if (currentCV) {
      cvs.push(currentCV);
    }

    return cvs;
  }

  /**
   * Main method: Parse PDF and split into individual CVs
   */
  static async parseAndSplit(file: File): Promise<ParsedCV[]> {
    console.log('📄 Parsing PDF file:', file.name);

    const pageTexts = await this.parsePDF(file);
    console.log(`✅ Extracted text from ${pageTexts.length} pages`);

    const cvs = this.splitIntoCVs(pageTexts);
    console.log(`✅ Detected ${cvs.length} individual CVs`);

    cvs.forEach((cv, index) => {
      console.log(`  CV ${index + 1}: Pages ${cv.pageNumbers.join(', ')}`);
    });

    return cvs;
  }
}
