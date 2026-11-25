import { useEffect, useRef, useState } from 'react';
import type { ActualTheme } from '../types';
import type { SlideBox } from '../shared/apiTypes';
import {
  BUILT_IN_BACKGROUNDS,
  SLIDE_DIMENSIONS,
  SLIDE_KINDS,
  detectSlideSize,
  rescaleDesign,
  validateDesign,
  type SlideDesign,
  type SlideKind,
  type SlideSize,
} from '../shared/design';
import { NEW_BACKGROUND, backgroundUrl, resetDesign, saveDesign } from '../services/designService';
import { firstSlideText } from '../services/firstSlide';
import { loadImage } from '../services/imageTools';
import { clamp, handleStyle, startDrag } from './dragUtils';
import { exampleTextImage } from './LogoEditor';

interface DesignPageProps {
  design: SlideDesign;
  onDesignChange: (design: SlideDesign) => void;
  theme: ActualTheme;
}

/** A background picked in this session but not saved yet */
interface NewBackground {
  blob: Blob;
  url: string;
  size: SlideSize;
}

const SLIDE_TITLES: Record<SlideKind, string> = {
  first: 'FIRST SLIDE',
  content: 'CANDIDATE SLIDES',
  last: 'LAST SLIDE',
};

const MIN_BOX = 0.2; // inches

/**
 * The slide design: the three background images and where the text goes. The slide size (4:3 or
 * 16:9) follows the backgrounds' proportions. Changes are a draft until saved.
 */
export function DesignPage({ design, onDesignChange, theme }: DesignPageProps) {
  const [draft, setDraft] = useState<SlideDesign>(design);
  // Per slide: undefined = as saved, null = back to built-in, object = new upload
  const [replacements, setReplacements] = useState<Partial<Record<SlideKind, NewBackground | null>>>({});
  const [status, setStatus] = useState<'idle' | 'saving'>('idle');
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);
  const fileInputs = useRef<Partial<Record<SlideKind, HTMLInputElement | null>>>({});

  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';

  // A saved design from elsewhere (e.g. after reset) replaces the draft
  useEffect(() => {
    setDraft(design);
    setReplacements({});
  }, [design]);

  // --- backgrounds and size -------------------------------------------------------------------
  /** The size each slide's background will have if the draft is saved */
  const sizeOf = (kind: SlideKind, repl = replacements): SlideSize => {
    const r = repl[kind];
    if (r) return r.size;
    if (r === null) return '4:3'; // built-in
    return design.backgrounds[kind] === null ? '4:3' : design.size;
  };
  const sizes = SLIDE_KINDS.map((k) => sizeOf(k));
  const sizesAgree = sizes.every((s) => s === sizes[0]);

  /** Apply a background change; if all three now share a new size, stretch the boxes to it */
  const changeBackgrounds = (next: Partial<Record<SlideKind, NewBackground | null>>) => {
    setReplacements(next);
    const nextSizes = SLIDE_KINDS.map((k) => sizeOf(k, next));
    if (nextSizes.every((s) => s === nextSizes[0]) && nextSizes[0] !== draft.size) {
      setDraft((d) => rescaleDesign(d, nextSizes[0]));
    }
  };

  const pickBackground = async (kind: SlideKind, file: File | undefined) => {
    if (!file) return;
    setMessage(null);
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      return setMessage({ kind: 'error', text: 'Backgrounds must be PNG or JPG images.' });
    }
    const url = URL.createObjectURL(file);
    const image = await loadImage(url);
    const size = detectSlideSize(image.naturalWidth, image.naturalHeight);
    if (!size) {
      URL.revokeObjectURL(url);
      return setMessage({
        kind: 'error',
        text: `That image is ${image.naturalWidth}×${image.naturalHeight}. Slide backgrounds must be 4:3 (e.g. 2000×1500) or 16:9 (e.g. 1920×1080). Export the slide from PowerPoint as a picture.`,
      });
    }
    changeBackgrounds({ ...replacements, [kind]: { blob: file, url, size } });
  };

  const previewUrl = (kind: SlideKind): string => {
    const r = replacements[kind];
    if (r) return r.url;
    if (r === null) return `/${BUILT_IN_BACKGROUNDS[kind]}`;
    return backgroundUrl(design, kind);
  };

  // --- saving ---------------------------------------------------------------------------------
  const toSave = (): SlideDesign => ({
    ...draft,
    backgrounds: Object.fromEntries(
      SLIDE_KINDS.map((k) => {
        const r = replacements[k];
        return [k, r ? NEW_BACKGROUND : r === null ? null : design.backgrounds[k]];
      })
    ) as Record<SlideKind, number | null>,
  });

  const problem = !sizesAgree
    ? `The backgrounds don't match: ${SLIDE_KINDS.map((k, i) => `${k} ${sizes[i]}`).join(', ')}. All three must be 4:3 or all 16:9.`
    : validateDesign({ ...toSave(), backgrounds: { first: 1, content: 1, last: 1 } }) ??
      (draft.size !== '4:3' && SLIDE_KINDS.some((k) => sizeOf(k) === '4:3') ? 'A 16:9 design needs all three backgrounds replaced.' : null);

  const changed = JSON.stringify(draft) !== JSON.stringify(design) || Object.keys(replacements).length > 0;
  const firstSlideChanged =
    replacements.first !== undefined || draft.size !== design.size || JSON.stringify(draft.firstSlide) !== JSON.stringify(design.firstSlide);

  const handleSave = async () => {
    setStatus('saving');
    setMessage(null);
    try {
      const files: Partial<Record<SlideKind, Blob>> = {};
      for (const k of SLIDE_KINDS) {
        const r = replacements[k];
        if (r) files[k] = r.blob;
      }
      const saved = await saveDesign(toSave(), files);
      onDesignChange(saved);
      setMessage({
        kind: 'ok',
        text: firstSlideChanged
          ? 'Design saved. The first slide changed: check each client’s logo position on the CLIENTS tab.'
          : 'Design saved. New decks use it from now on.',
      });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setStatus('idle');
    }
  };

  const handleReset = async () => {
    if (!confirm('Go back to the built-in design? Uploaded backgrounds and all position changes are removed.')) return;
    setStatus('saving');
    try {
      onDesignChange(await resetDesign());
      setMessage({ kind: 'ok', text: 'Back to the built-in design.' });
    } catch (e) {
      setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) });
    } finally {
      setStatus('idle');
    }
  };

  // --- box editing ----------------------------------------------------------------------------
  const setTextBox = (box: SlideBox) => setDraft((d) => ({ ...d, firstSlide: { ...d.firstSlide, textBox: box } }));
  const setLogoArea = (box: SlideBox) => setDraft((d) => ({ ...d, firstSlide: { ...d.firstSlide, logoArea: box } }));
  const setSlot = (i: number, part: 'education' | 'experience', box: SlideBox) =>
    setDraft((d) => ({
      ...d,
      contentSlide: { slots: d.contentSlide.slots.map((s, j) => (j === i ? { ...s, [part]: box } : s)) },
    }));

  // --- styles ---------------------------------------------------------------------------------
  const panel = {
    padding: '1.5rem',
    border: `2px solid ${borderColor}`,
    background: bgColor,
    boxShadow: `4px 4px 0px ${borderColor}`,
    marginBottom: '1.5rem',
    color: textColor,
  } as const;
  const title = { fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '1rem', letterSpacing: '0.1em' } as const;
  const hint = { fontSize: '0.75rem', opacity: 0.7, lineHeight: 1.4 } as const;
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
      whiteSpace: 'nowrap',
    }) as const;

  const { width, height } = SLIDE_DIMENSIONS[draft.size];
  const busy = status !== 'idle';

  const backgroundLabel = (kind: SlideKind) => {
    const r = replacements[kind];
    if (r) return `new image, ${r.size} (not saved yet)`;
    if (r === null) return 'built-in (not saved yet)';
    return design.backgrounds[kind] === null ? 'built-in' : `uploaded, ${design.size}`;
  };

  return (
    <>
      <div style={panel}>
        <div style={title}>[ SLIDE DESIGN ]</div>
        <div style={hint}>
          The background images and where the text goes. Export each slide of your template from PowerPoint as a
          picture and upload it here, then drag the boxes into place. Slide size follows the images:{' '}
          <strong>
            {draft.size} ({width} × {height} in)
          </strong>
          .
        </div>
      </div>

      {SLIDE_KINDS.map((kind) => (
        <div key={kind} style={panel}>
          <div style={title}>[ {SLIDE_TITLES[kind]} ]</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
            <input
              ref={(el) => {
                fileInputs.current[kind] = el;
              }}
              type="file"
              accept="image/png,image/jpeg"
              style={{ display: 'none' }}
              data-testid={`background-input-${kind}`}
              onChange={(e) => {
                void pickBackground(kind, e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <button onClick={() => fileInputs.current[kind]?.click()} disabled={busy} style={button(!busy)}>
              [ REPLACE BACKGROUND ]
            </button>
            {(replacements[kind] || (replacements[kind] === undefined && design.backgrounds[kind] !== null)) && (
              <button onClick={() => changeBackgrounds({ ...replacements, [kind]: null })} disabled={busy} style={button(!busy)}>
                [ USE BUILT-IN ]
              </button>
            )}
            <span style={hint}>Background: {backgroundLabel(kind)}</span>
          </div>

          <SlideBoxEditor
            backgroundUrl={previewUrl(kind)}
            width={width}
            height={height}
            boxes={
              kind === 'first'
                ? [
                    { id: 'text', label: 'Text: LONGLIST / position / date', box: draft.firstSlide.textBox, onChange: setTextBox, showText: true },
                    { id: 'logo', label: 'Logo spot for new client logos', box: draft.firstSlide.logoArea, onChange: setLogoArea },
                  ]
                : kind === 'content'
                  ? draft.contentSlide.slots.flatMap((slot, i) => [
                      { id: `edu-${i}`, label: `${i + 1} · Education`, box: slot.education, onChange: (b: SlideBox) => setSlot(i, 'education', b) },
                      { id: `exp-${i}`, label: `${i + 1} · Name + work history`, box: slot.experience, onChange: (b: SlideBox) => setSlot(i, 'experience', b) },
                    ])
                  : []
            }
          />
          <div style={{ ...hint, marginTop: '0.5rem' }}>
            {kind === 'last'
              ? 'No text on this slide, just the background.'
              : 'Drag a box to move it, drag its corner to resize. Boxes are only shown here, not on the slides.'}
          </div>
        </div>
      ))}

      <div style={panel}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => void handleSave()} disabled={busy || !changed || !!problem} style={button(!busy && changed && !problem, true)}>
            [ {status === 'saving' ? 'SAVING…' : 'SAVE DESIGN'} ]
          </button>
          <button
            onClick={() => {
              setDraft(design);
              setReplacements({});
              setMessage(null);
            }}
            disabled={busy || !changed}
            style={button(!busy && changed)}
          >
            [ DISCARD CHANGES ]
          </button>
          <button onClick={() => void handleReset()} disabled={busy} style={{ ...button(!busy), borderColor: '#ff6b6b', color: '#ff6b6b' }}>
            [ RESET TO BUILT-IN DESIGN ]
          </button>
        </div>
        {changed && problem && <div style={{ fontSize: '0.75rem', color: '#ff6b6b', marginTop: '0.75rem' }}>{problem}</div>}
        {changed && !problem && <div style={{ ...hint, marginTop: '0.75rem' }}>Unsaved changes.</div>}
        {message && (
          <div style={{ fontSize: '0.75rem', marginTop: '0.75rem', color: message.kind === 'error' ? '#ff6b6b' : textColor }}>
            {message.kind === 'ok' ? '✓ ' : 'Error: '}
            {message.text}
          </div>
        )}
      </div>
    </>
  );
}

// --- A slide with movable, resizable boxes ---------------------------------------------------------

interface EditableBox {
  id: string;
  label: string;
  box: SlideBox;
  onChange: (box: SlideBox) => void;
  /** Show the first slide's example text inside the box */
  showText?: boolean;
}

function SlideBoxEditor({
  backgroundUrl,
  width,
  height,
  boxes,
}: {
  backgroundUrl: string;
  width: number;
  height: number;
  boxes: EditableBox[];
}) {
  const slide = useRef<HTMLDivElement>(null);
  const pctX = (inches: number) => `${(inches / width) * 100}%`;
  const pctY = (inches: number) => `${(inches / height) * 100}%`;
  /** Screen px -> inches */
  const scale = () => width / (slide.current?.getBoundingClientRect().width || 1);

  const move = (item: EditableBox) => (e: React.PointerEvent) => {
    const start = item.box;
    const s = scale();
    startDrag(e, (dx, dy) =>
      item.onChange({ ...start, x: clamp(start.x + dx * s, 0, width - start.w), y: clamp(start.y + dy * s, 0, height - start.h) })
    );
  };

  const resize = (item: EditableBox) => (e: React.PointerEvent) => {
    const start = item.box;
    const s = scale();
    startDrag(e, (dx, dy) =>
      item.onChange({
        ...start,
        w: clamp(start.w + dx * s, MIN_BOX, width - start.x),
        h: clamp(start.h + dy * s, MIN_BOX, height - start.y),
      })
    );
  };

  return (
    <div
      ref={slide}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: 720,
        aspectRatio: `${width} / ${height}`,
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: '100% 100%',
        border: '1px solid #999',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {boxes.map((item) => (
        <div
          key={item.id}
          data-testid={`box-${item.id}`}
          onPointerDown={move(item)}
          style={{
            position: 'absolute',
            left: pctX(item.box.x),
            top: pctY(item.box.y),
            width: pctX(item.box.w),
            height: pctY(item.box.h),
            outline: '2px dashed #e63946',
            background: 'rgba(230, 57, 70, 0.08)',
            cursor: 'move',
            touchAction: 'none',
          }}
        >
          {item.showText && (
            <img
              src={exampleTextImage(firstSlideText('Position', new Date()), item.box.w, item.box.h)}
              alt=""
              draggable={false}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.55, pointerEvents: 'none' }}
            />
          )}
          <span
            style={{
              position: 'absolute',
              left: 2,
              top: 2,
              fontSize: 10,
              lineHeight: 1.1,
              background: 'rgba(230, 57, 70, 0.9)',
              color: '#fff',
              padding: '1px 3px',
              fontFamily: 'Arial, sans-serif',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              maxWidth: 'calc(100% - 4px)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {item.label}
          </span>
          <div data-testid={`box-${item.id}-resize`} onPointerDown={resize(item)} style={{ ...handleStyle('nwse-resize'), left: '100%', top: '100%' }} />
        </div>
      ))}
    </div>
  );
}
