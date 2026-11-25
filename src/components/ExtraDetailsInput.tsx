import type { ActualTheme } from '../types';
import {
  EXTRA_FIELDS,
  MAX_SELECTED_EXTRAS,
  selectedExtraFields,
  type ExtraFieldId,
} from '../services/extraDetails';

interface ExtraDetailsInputProps {
  selected: ExtraFieldId[];
  onSelectedChange: (selected: ExtraFieldId[]) => void;
  disabled: boolean;
  theme: ActualTheme;
  /** Replaces the default "for this run only" note */
  note?: string;
}

/**
 * Optional extra details to pull from each CV for this run only (e.g. location), picked from
 * a fixed list. Deliberately not saved: requests like this are rare and client-specific.
 */
export function ExtraDetailsInput({ selected, onSelectedChange, disabled, theme, note }: ExtraDetailsInputProps) {
  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';

  const isFull = selected.length >= MAX_SELECTED_EXTRAS;

  const toggle = (id: ExtraFieldId) => {
    if (selected.includes(id)) {
      onSelectedChange(selected.filter((s) => s !== id));
    } else if (!isFull) {
      onSelectedChange([...selected, id]);
    }
  };

  const preview = selectedExtraFields(selected).map((field) => field.example).join(' · ');

  return (
    <div
      style={{
        padding: '1.5rem',
        border: `2px solid ${borderColor}`,
        background: bgColor,
        boxShadow: `4px 4px 0px ${borderColor}`,
        marginBottom: '1.5rem',
      }}
    >
      <div
        style={{
          fontSize: '0.875rem',
          fontWeight: 'bold',
          marginBottom: '0.5rem',
          letterSpacing: '0.1em',
          color: textColor,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span>[ EXTRA DETAILS ]</span>
        <span
          title="Extra things to pull from each CV for this longlist, such as location. They are shown after the candidate's name on the slide, in list order. If a CV doesn't mention one, it's left blank."
          style={{ cursor: 'help', fontSize: '0.875rem', opacity: 0.6 }}
        >
          ⓘ
        </span>
      </div>
      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '1rem', lineHeight: 1.4, color: textColor }}>
        {note ?? `Optional, pick up to ${MAX_SELECTED_EXTRAS}. For this run only, cleared on reload or reset.`}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        {EXTRA_FIELDS.map((field) => {
          const isSelected = selected.includes(field.id);
          const enabled = !disabled && (isSelected || !isFull);
          return (
            <button
              key={field.id}
              onClick={() => toggle(field.id)}
              disabled={!enabled}
              aria-pressed={isSelected}
              title={field.instruction}
              style={{
                padding: '0.5rem 1rem',
                background: isSelected ? textColor : 'none',
                border: `2px solid ${borderColor}`,
                color: isSelected ? bgColor : textColor,
                fontFamily: 'Courier New, monospace',
                fontWeight: 'bold',
                cursor: enabled ? 'pointer' : 'not-allowed',
                letterSpacing: '0.1em',
                fontSize: '0.75rem',
                opacity: enabled ? 1 : 0.4,
              }}
            >
              [ {field.label.toUpperCase()} ]
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '0.75rem', color: textColor }}>
        {preview ? (
          <>
            On the slide: <span style={{ fontWeight: 'bold' }}>JANE DOE</span> · {preview}
          </>
        ) : (
          'Nothing selected: slides show the usual details only.'
        )}
      </div>
    </div>
  );
}
