import { useEffect, useRef, useState } from 'react';
import type { ActualTheme } from '../types';
import type { Client, PixelRect, SlideBox } from '../shared/apiTypes';
import { autoTrim, cropToPng, loadImage, prepareOriginal } from '../services/imageTools';
import { deleteLogo, originalLogoUrl, saveLogo } from '../services/clientsService';
import { FIRST_SLIDE_FONT_PT, defaultLogoPlacement, firstSlideText } from '../services/firstSlide';
import { backgroundUrl, useDesign } from '../services/designService';
import { SLIDE_DIMENSIONS } from '../shared/design';
import { clamp, handleStyle, startDrag } from './dragUtils';

interface LogoEditorProps {
  client: Client;
  onSaved: (client: Client) => void;
  theme: ActualTheme;
}

type Step = 'crop' | 'place';

/** Smallest crop, in pixels of the original image */
const MIN_CROP_PX = 8;
/** Smallest logo width on the slide, in inches */
const MIN_LOGO_WIDTH = 0.3;

/**
 * Logo editor for one client: upload, crop (with automatic trimming of empty borders), then
 * move and resize the logo on a preview of the real first slide. Saved per client and used for
 * every deck made for that client.
 */
export function LogoEditor({ client, onSaved, theme }: LogoEditorProps) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [newOriginal, setNewOriginal] = useState<Blob | null>(null); // set only for a fresh upload
  const [crop, setCrop] = useState<PixelRect | null>(null);
  const [placement, setPlacement] = useState<SlideBox | null>(null);
  const [step, setStep] = useState<Step>('place');
  const [croppedUrl, setCroppedUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const design = useDesign();
  const logoArea = design.firstSlide.logoArea;

  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';

  // Load the saved logo when the client changes
  useEffect(() => {
    setImage(null);
    setNewOriginal(null);
    setCrop(null);
    setPlacement(null);
    setDirty(false);
    setError(null);
    if (!client.hasLogo) return;
    let cancelled = false;
    setStatus('loading');
    loadImage(originalLogoUrl(client))
      .then((img) => {
        if (cancelled) return;
        const savedCrop = client.crop ?? { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
        setImage(img);
        setCrop(savedCrop);
        setPlacement(client.placement ?? defaultLogoPlacement(logoArea, savedCrop.w, savedCrop.h));
        setStep('place');
      })
      .catch(() => !cancelled && setError('Could not load the saved logo'))
      .finally(() => !cancelled && setStatus('idle'));
    return () => {
      cancelled = true;
    };
  }, [client.id, client.logoVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preview of the cropped logo for the slide view
  useEffect(() => {
    if (!image || !crop) return setCroppedUrl(null);
    let url: string | null = null;
    let cancelled = false;
    cropToPng(image, crop).then(({ blob }) => {
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setCroppedUrl(url);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [image, crop]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const { blob, image: img } = await prepareOriginal(file);
      const trimmed = autoTrim(img);
      setImage(img);
      setNewOriginal(blob);
      setCrop(trimmed);
      setPlacement(defaultLogoPlacement(logoArea, trimmed.w, trimmed.h));
      setStep('crop');
      setDirty(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // Keep the placement's proportions in step with the crop (same width, new height)
  const updateCrop = (next: PixelRect) => {
    setCrop(next);
    setDirty(true);
    setPlacement((p) => (p ? { ...p, h: p.w * (next.h / next.w) } : defaultLogoPlacement(logoArea, next.w, next.h)));
  };

  const handleSave = async () => {
    if (!image || !crop || !placement) return;
    setStatus('saving');
    setError(null);
    try {
      const { blob, width, height } = await cropToPng(image, crop);
      const saved = await saveLogo(client.id, blob, { crop, widthPx: width, heightPx: height, placement }, newOriginal ?? undefined);
      setNewOriginal(null);
      setDirty(false);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStatus('idle');
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Remove the logo of ${client.name}?`)) return;
    try {
      onSaved(await deleteLogo(client.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const button = (enabled = true, primary = false) =>
    ({
      padding: '0.5rem 1rem',
      background: primary ? textColor : 'none',
      border: `2px solid ${borderColor}`,
      color: primary ? bgColor : textColor,
      fontFamily: 'Courier New, monospace',
      fontWeight: 'bold',
      cursor: enabled ? 'pointer' : 'not-allowed',
      letterSpacing: '0.1em',
      fontSize: '0.75rem',
      opacity: enabled ? 1 : 0.5,
    }) as const;

  const busy = status !== 'idle';

  return (
    <div>
      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,.svg"
        style={{ display: 'none' }}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button onClick={() => fileInput.current?.click()} disabled={busy} style={button(!busy)}>
          [ {image ? 'REPLACE LOGO' : 'UPLOAD LOGO'} ]
        </button>
        {image && (
          <>
            <button onClick={() => setStep('crop')} aria-pressed={step === 'crop'} style={button(true, step === 'crop')}>
              [ 1. CROP ]
            </button>
            <button onClick={() => setStep('place')} aria-pressed={step === 'place'} style={button(true, step === 'place')}>
              [ 2. PLACE ]
            </button>
          </>
        )}
      </div>

      {status === 'loading' && <div style={{ fontSize: '0.75rem', opacity: 0.7, color: textColor }}>Loading logo…</div>}
      {!image && status === 'idle' && (
        <div style={{ fontSize: '0.75rem', opacity: 0.7, color: textColor, lineHeight: 1.4 }}>
          No logo yet. Upload a PNG, JPG, WebP or SVG. Empty borders are trimmed automatically.
        </div>
      )}

      {image && crop && step === 'crop' && (
        <>
          <CropView image={image} crop={crop} onChange={updateCrop} borderColor={borderColor} />
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            <button onClick={() => updateCrop(autoTrim(image))} style={button()}>
              [ AUTO-TRIM ]
            </button>
            <button onClick={() => updateCrop({ x: 0, y: 0, w: image.naturalWidth, h: image.naturalHeight })} style={button()}>
              [ FULL IMAGE ]
            </button>
            <button onClick={() => setStep('place')} style={button(true, true)}>
              [ NEXT: PLACE → ]
            </button>
          </div>
          <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '0.5rem', color: textColor }}>
            Drag the corners to crop, or drag inside the frame to move it.
          </div>
        </>
      )}

      {image && placement && step === 'place' && (
        <>
          <PlaceView
            logoUrl={croppedUrl}
            placement={placement}
            onChange={(p) => {
              setPlacement(p);
              setDirty(true);
            }}
          />
          <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '0.5rem', color: textColor }}>
            Drag the logo to move it, drag its corner to resize. Text and date are examples.
          </div>
        </>
      )}

      {image && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '1rem', alignItems: 'center' }}>
          <button onClick={handleSave} disabled={busy || !dirty} style={button(!busy && dirty, true)}>
            [ {status === 'saving' ? 'SAVING…' : 'SAVE LOGO'} ]
          </button>
          {crop && (
            <button
              onClick={() => {
                setPlacement(defaultLogoPlacement(logoArea, crop.w, crop.h));
                setDirty(true);
              }}
              style={button()}
            >
              [ RESET POSITION ]
            </button>
          )}
          {client.hasLogo && (
            <button onClick={handleRemove} disabled={busy} style={{ ...button(!busy), borderColor: '#ff6b6b', color: '#ff6b6b' }}>
              [ REMOVE LOGO ]
            </button>
          )}
          <span style={{ fontSize: '0.7rem', opacity: 0.7, color: textColor }}>
            {dirty ? 'Unsaved changes' : client.hasLogo ? '✓ Saved' : ''}
          </span>
        </div>
      )}

      {error && <div style={{ fontSize: '0.75rem', color: '#ff6b6b', marginTop: '0.75rem' }}>Error: {error}</div>}
    </div>
  );
}

// --- Crop ---------------------------------------------------------------------------------------

function CropView({
  image,
  crop,
  onChange,
  borderColor,
}: {
  image: HTMLImageElement;
  crop: PixelRect;
  onChange: (crop: PixelRect) => void;
  borderColor: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const W = image.naturalWidth;
  const H = image.naturalHeight;
  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  /** Screen px -> image px */
  const scale = () => W / (box.current?.getBoundingClientRect().width || W);

  const moveFrame = (e: React.PointerEvent) => {
    const start = crop;
    const s = scale();
    startDrag(e, (dx, dy) =>
      onChange({ ...start, x: clamp(start.x + dx * s, 0, W - start.w), y: clamp(start.y + dy * s, 0, H - start.h) })
    );
  };

  const dragCorner = (corner: 'nw' | 'ne' | 'sw' | 'se') => (e: React.PointerEvent) => {
    const start = crop;
    const s = scale();
    startDrag(e, (dx, dy) => {
      let left = start.x, top = start.y, right = start.x + start.w, bottom = start.y + start.h;
      if (corner.includes('w')) left = clamp(left + dx * s, 0, right - MIN_CROP_PX);
      if (corner.includes('e')) right = clamp(right + dx * s, left + MIN_CROP_PX, W);
      if (corner.includes('n')) top = clamp(top + dy * s, 0, bottom - MIN_CROP_PX);
      if (corner.includes('s')) bottom = clamp(bottom + dy * s, top + MIN_CROP_PX, H);
      onChange({ x: left, y: top, w: right - left, h: bottom - top });
    });
  };

  return (
    <div
      ref={box}
      style={{
        position: 'relative',
        // As wide as fits (max 560px) while staying at most 420px tall, keeping proportions
        width: `min(100%, ${Math.round(Math.min(560, (420 * W) / H))}px)`,
        aspectRatio: `${W} / ${H}`,
        overflow: 'hidden',
        border: `1px solid ${borderColor}`,
        // Checkerboard, so transparent areas are visible
        background: 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 50% / 16px 16px',
        userSelect: 'none',
      }}
    >
      <img src={image.src} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <div
        data-testid="crop-frame"
        onPointerDown={moveFrame}
        style={{
          position: 'absolute',
          left: pct(crop.x, W),
          top: pct(crop.y, H),
          width: pct(crop.w, W),
          height: pct(crop.h, H),
          outline: '2px dashed #e63946',
          boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.45)', // dims everything outside the crop
          cursor: 'move',
          touchAction: 'none',
        }}
      >
        <div onPointerDown={dragCorner('nw')} style={{ ...handleStyle('nwse-resize'), left: 0, top: 0 }} />
        <div onPointerDown={dragCorner('ne')} style={{ ...handleStyle('nesw-resize'), left: '100%', top: 0 }} />
        <div onPointerDown={dragCorner('sw')} style={{ ...handleStyle('nesw-resize'), left: 0, top: '100%' }} />
        <div data-testid="crop-se" onPointerDown={dragCorner('se')} style={{ ...handleStyle('nwse-resize'), left: '100%', top: '100%' }} />
      </div>
    </div>
  );
}

// --- Place on the first slide ---------------------------------------------------------------------

function PlaceView({
  logoUrl,
  placement,
  onChange,
}: {
  logoUrl: string | null;
  placement: SlideBox;
  onChange: (placement: SlideBox) => void;
}) {
  const slide = useRef<HTMLDivElement>(null);
  const design = useDesign();
  const { width: SLIDE_WIDTH, height: SLIDE_HEIGHT } = SLIDE_DIMENSIONS[design.size];
  const textBox = design.firstSlide.textBox;
  const pctX = (inches: number) => `${(inches / SLIDE_WIDTH) * 100}%`;
  const pctY = (inches: number) => `${(inches / SLIDE_HEIGHT) * 100}%`;

  /** Screen px -> inches */
  const scale = () => SLIDE_WIDTH / (slide.current?.getBoundingClientRect().width || 1);

  const move = (e: React.PointerEvent) => {
    const start = placement;
    const s = scale();
    startDrag(e, (dx, dy) =>
      onChange({
        ...start,
        x: clamp(start.x + dx * s, 0, SLIDE_WIDTH - start.w),
        y: clamp(start.y + dy * s, 0, SLIDE_HEIGHT - start.h),
      })
    );
  };

  const resize = (e: React.PointerEvent) => {
    const start = placement;
    const aspect = start.w / start.h;
    const s = scale();
    startDrag(e, (dx) => {
      const maxW = Math.min(SLIDE_WIDTH - start.x, (SLIDE_HEIGHT - start.y) * aspect);
      const w = clamp(start.w + dx * s, MIN_LOGO_WIDTH, maxW);
      onChange({ ...start, w, h: w / aspect });
    });
  };

  const text = firstSlideText('Position', new Date());

  return (
    <div
      ref={slide}
      data-testid="slide-preview"
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 640,
        aspectRatio: `${SLIDE_WIDTH} / ${SLIDE_HEIGHT}`,
        backgroundImage: `url(${backgroundUrl(design, 'first')})`,
        backgroundSize: '100% 100%',
        border: '1px solid #999',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Example text, where the real text goes. Drawn as an image so browser dark-mode
          features and extensions can't recolor it (they leave images alone). */}
      <img
        src={exampleTextImage(text, textBox.w, textBox.h)}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          left: pctX(textBox.x),
          top: pctY(textBox.y),
          width: pctX(textBox.w),
          height: pctY(textBox.h),
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />

      {logoUrl && (
        <div
          data-testid="logo-box"
          onPointerDown={move}
          style={{
            position: 'absolute',
            left: pctX(placement.x),
            top: pctY(placement.y),
            width: pctX(placement.w),
            height: pctY(placement.h),
            outline: '1px dashed #e63946',
            cursor: 'move',
            touchAction: 'none',
          }}
        >
          <img src={logoUrl} alt="" draggable={false} style={{ width: '100%', height: '100%', display: 'block' }} />
          <div data-testid="logo-resize" onPointerDown={resize} style={{ ...handleStyle('nwse-resize'), left: '100%', top: '100%' }} />
        </div>
      )}
    </div>
  );
}

/**
 * The first slide's text block as an SVG image, in hundredths of an inch: right-aligned,
 * bold, 18pt (0.25 in), the same box as on the real slide.
 */
export function exampleTextImage(text: string, boxW: number, boxH: number): string {
  const w = boxW * 100;
  const h = boxH * 100;
  const size = (FIRST_SLIDE_FONT_PT / 72) * 100;
  const escape = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = text
    .split('\n')
    .map((line, i) => `<text x="${w}" y="${size * (0.9 + i * 1.2)}">${escape(line)}</text>`)
    .join('');
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<g font-family="Calibri, Carlito, Arial, sans-serif" font-weight="bold" font-size="${size}" text-anchor="end" fill="#000">` +
    `${lines}</g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
