// Image helpers for the logo editor: loading, SVG conversion, trimming empty borders, cropping
import type { PixelRect } from '../shared/apiTypes';

/** Longest side of a rasterised SVG and of the cropped logo stored for the slides */
const MAX_LONG_SIDE = 1600;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not open the image'));
    image.src = src;
  });
}

/**
 * Turn an uploaded file into the "original" kept on the server. PNG, JPG and WebP are kept as
 * they are; SVG is drawn into a PNG, because PowerPoint and the slide generator need a bitmap.
 */
export async function prepareOriginal(file: File): Promise<{ blob: Blob; image: HTMLImageElement }> {
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  if (!isSvg) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      throw new Error('Use a PNG, JPG, WebP or SVG image');
    }
    return { blob: file, image: await loadImage(URL.createObjectURL(file)) };
  }

  const svgImage = await loadImage(URL.createObjectURL(file));
  // SVGs without width/height report 0; fall back to a sensible size
  const width = svgImage.naturalWidth || 1200;
  const height = svgImage.naturalHeight || 600;
  const scale = MAX_LONG_SIDE / Math.max(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext('2d')!.drawImage(svgImage, 0, 0, canvas.width, canvas.height);
  const blob = await canvasToPng(canvas);
  return { blob, image: await loadImage(URL.createObjectURL(blob)) };
}

/**
 * The smallest rectangle containing everything that isn't empty space: transparent pixels and
 * near-white pixels both count as empty. Returns the whole image if nothing is found.
 */
export function autoTrim(image: HTMLImageElement): PixelRect {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const alpha = data[i + 3];
      const nearWhite = data[i] > 235 && data[i + 1] > 235 && data[i + 2] > 235;
      if (alpha > 16 && !nearWhite) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return { x: 0, y: 0, w: width, h: height };

  // A pixel of breathing room so anti-aliased edges aren't clipped
  const pad = 1;
  const x = Math.max(0, minX - pad);
  const y = Math.max(0, minY - pad);
  return { x, y, w: Math.min(width, maxX + pad + 1) - x, h: Math.min(height, maxY + pad + 1) - y };
}

/** Cut the crop out of the image as a PNG, at most MAX_LONG_SIDE on its longest side */
export async function cropToPng(image: HTMLImageElement, crop: PixelRect): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, MAX_LONG_SIDE / Math.max(crop.w, crop.h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(crop.w * scale));
  canvas.height = Math.max(1, Math.round(crop.h * scale));
  canvas.getContext('2d')!.drawImage(image, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
  return { blob: await canvasToPng(canvas), width: canvas.width, height: canvas.height };
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not create the image'))), 'image/png')
  );
}
