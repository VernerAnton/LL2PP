// Final touches to the generated PPTX that PptxGenJS can't express, so the deck comes out exactly
// as the old PowerPoint macro (FormatEducationBoxes + ApplyTemplate) used to leave it:
// - the company theme ("Suorahakutoimisto Yellow": Calibri, black/white with yellow accents),
//   taken from a deck the macro had processed;
// - Arial as the font of the education column's degree bullets.
import JSZip from 'jszip';
import themeXml from '../assets/pptx-theme.xml?raw';

const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

// Degree bullets are the only bullets indented 13.5pt (171450 EMU); work history uses 27pt
const DEGREE_BULLET = '<a:pPr marL="171450" indent="-171450"><a:buSzPct val="100000"/>';
const DEGREE_BULLET_ARIAL = '<a:pPr marL="171450" indent="-171450"><a:buFont typeface="Arial"/>';

export async function finishDeck(pptx: ArrayBuffer): Promise<Blob> {
  const zip = await JSZip.loadAsync(pptx);

  zip.file('ppt/theme/theme1.xml', themeXml);

  const slides = Object.keys(zip.files).filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path));
  for (const path of slides) {
    const xml = await zip.file(path)!.async('string');
    zip.file(path, xml.split(DEGREE_BULLET).join(DEGREE_BULLET_ARIAL));
  }

  return zip.generateAsync({ type: 'blob', mimeType: PPTX_MIME, compression: 'DEFLATE' });
}

/** Save a file in the browser */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
