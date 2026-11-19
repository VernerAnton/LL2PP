import { useState } from 'react';
import type { ActualTheme } from '../types';
import { LOCATION_FIELD, MAX_EXTRA_FIELDS, shortLabel } from '../services/extraDetails';

interface ExtraDetailsInputProps {
  fields: string[];
  onFieldsChange: (fields: string[]) => void;
  disabled: boolean;
  theme: ActualTheme;
}

/**
 * Optional extra details to pull from each CV for this run only (e.g. location).
 * Deliberately not saved: requests like this are rare and client-specific.
 */
export function ExtraDetailsInput({ fields, onFieldsChange, disabled, theme }: ExtraDetailsInputProps) {
  const [inputValue, setInputValue] = useState('');

  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';

  const isFull = fields.length >= MAX_EXTRA_FIELDS;

  const addField = (label: string) => {
    const trimmed = label.trim();
    if (!trimmed || isFull) return;
    if (fields.some((f) => f.toLowerCase() === trimmed.toLowerCase())) return;
    onFieldsChange([...fields, trimmed]);
  };

  const handleAdd = () => {
    addField(inputValue);
    setInputValue('');
  };

  const buttonStyle = (enabled: boolean) =>
    ({
      padding: '0.5rem 1rem',
      background: 'none',
      border: `2px solid ${borderColor}`,
      color: textColor,
      fontFamily: 'Courier New, monospace',
      fontWeight: 'bold',
      cursor: enabled ? 'pointer' : 'not-allowed',
      letterSpacing: '0.1em',
      fontSize: '0.75rem',
      opacity: enabled ? 1 : 0.5,
      whiteSpace: 'nowrap',
    }) as const;

  const canAdd = !disabled && !isFull && inputValue.trim().length > 0;
  const hasLocation = fields.some((f) => f.toLowerCase() === LOCATION_FIELD.toLowerCase());
  const canAddLocation = !disabled && !isFull && !hasLocation;

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
          title="Extra things to pull from each CV for this longlist, such as location. Values are shown after the candidate's name on the slide. Text in parentheses tells Claude what form to use and isn't shown, e.g. 'Location (town or city only)'. If a CV doesn't mention it, it's left blank."
          style={{ cursor: 'help', fontSize: '0.875rem', opacity: 0.6 }}
        >
          ⓘ
        </span>
      </div>
      <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '1rem', lineHeight: 1.4, color: textColor }}>
        Optional, for this run only. Shown after the name on each slide. Cleared on reload or reset.
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: fields.length > 0 ? '1rem' : 0 }}>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd();
          }}
          disabled={disabled || isFull}
          placeholder="e.g. Languages (spoken languages)"
          style={{
            flex: '1 1 200px',
            minWidth: 0,
            padding: '0.5rem 0.75rem',
            border: `2px solid ${borderColor}`,
            background: theme === 'dark' ? '#1a1a1a' : '#fff',
            color: textColor,
            fontFamily: 'Courier New, monospace',
            fontSize: '0.875rem',
          }}
        />
        <button onClick={handleAdd} disabled={!canAdd} style={buttonStyle(canAdd)}>
          [ ADD ]
        </button>
        <button
          onClick={() => addField(LOCATION_FIELD)}
          disabled={!canAddLocation}
          title={`Adds "${LOCATION_FIELD}"`}
          style={buttonStyle(canAddLocation)}
        >
          [ + LOCATION ]
        </button>
      </div>

      {fields.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {fields.map((field) => (
            <span
              key={field}
              title={field}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.35rem 0.5rem 0.35rem 0.75rem',
                border: `1px solid ${borderColor}`,
                background: theme === 'dark' ? '#1a1a1a' : '#fff',
                color: textColor,
                fontSize: '0.75rem',
                fontWeight: 'bold',
              }}
            >
              {shortLabel(field)}
              <button
                onClick={() => onFieldsChange(fields.filter((f) => f !== field))}
                disabled={disabled}
                aria-label={`Remove ${shortLabel(field)}`}
                style={{
                  background: 'none',
                  border: 'none',
                  color: textColor,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  fontFamily: 'Courier New, monospace',
                  fontWeight: 'bold',
                  fontSize: '0.875rem',
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
