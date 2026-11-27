import { useState } from 'react';
import type { ActualTheme } from '../types';
import { MAX_DOCUMENTS_PER_CANDIDATE } from '../shared/apiTypes';
import { suggestGroups } from '../services/bindSuggestions';

/** One candidate in the upload list: a single CV file, or several bound together */
export interface UploadEntry {
  id: string;
  files: File[];
}

interface BindDialogProps {
  entries: UploadEntry[];
  onChange: (entries: UploadEntry[]) => void;
  onClose: () => void;
  theme: ActualTheme;
}

/** Single files that look like the same person (by file name). Only ever a suggestion. */
export function bindSuggestions(entries: UploadEntry[]): UploadEntry[][] {
  const singles = entries.filter((e) => e.files.length === 1);
  return suggestGroups(singles.map((e) => e.files[0].name))
    .map((group) => group.map((i) => singles[i]))
    .filter((group) => group.length <= MAX_DOCUMENTS_PER_CANDIDATE);
}

/** Bind entries into one: their files become one candidate */
export function bindEntries(entries: UploadEntry[], toBind: UploadEntry[]): UploadEntry[] {
  const ids = new Set(toBind.map((e) => e.id));
  const merged: UploadEntry = { id: crypto.randomUUID(), files: toBind.flatMap((e) => e.files) };
  const firstIndex = entries.findIndex((e) => ids.has(e.id));
  const rest = entries.filter((e) => !ids.has(e.id));
  rest.splice(Math.min(firstIndex, rest.length), 0, merged);
  return rest;
}

/** Split a bound entry back into single files */
export function unbindEntry(entries: UploadEntry[], entry: UploadEntry): UploadEntry[] {
  return entries.flatMap((e) => (e.id === entry.id ? e.files.map((file) => ({ id: crypto.randomUUID(), files: [file] })) : [e]));
}

/**
 * Pop-up for binding CV files that belong to one candidate (e.g. a CV in parts, or in two
 * languages): tick files and bind them, as many groups as needed, then Done.
 */
export function BindDialog({ entries, onChange, onClose, theme }: BindDialogProps) {
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const fieldBg = theme === 'dark' ? '#1a1a1a' : '#fff';

  const singles = entries.filter((e) => e.files.length === 1);
  const groups = entries.filter((e) => e.files.length > 1);
  const suggestions = bindSuggestions(entries);
  const canBind = ticked.size >= 2 && ticked.size <= MAX_DOCUMENTS_PER_CANDIDATE;

  const toggle = (id: string) =>
    setTicked((t) => {
      const next = new Set(t);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const bind = (toBind: UploadEntry[]) => {
    onChange(bindEntries(entries, toBind));
    setTicked(new Set());
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
      whiteSpace: 'nowrap',
    }) as const;
  const smallButton = { ...button(), padding: '0.25rem 0.6rem', fontSize: '0.7rem', letterSpacing: 0 } as const;
  const section = { fontSize: '0.75rem', fontWeight: 'bold', margin: '1rem 0 0.5rem', opacity: 0.85 } as const;
  const row = { display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', padding: '0.4rem 0', borderTop: `1px solid ${borderColor}` } as const;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bind CVs"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 900,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '1.5rem',
          border: `2px solid ${borderColor}`,
          background: bgColor,
          boxShadow: `4px 4px 0px ${borderColor}`,
          color: textColor,
        }}
      >
        <div style={{ fontSize: '0.875rem', fontWeight: 'bold', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>[ 🔗 BIND CVs ]</div>
        <div style={{ fontSize: '0.75rem', opacity: 0.7, lineHeight: 1.4 }}>
          Bind files that belong to the same person (a CV in parts, the same CV in two languages, a CV and an
          attachment). Each group is read as one candidate. Up to {MAX_DOCUMENTS_PER_CANDIDATE} files per group.
        </div>

        {suggestions.length > 0 && (
          <>
            <div style={section}>SUGGESTED (SIMILAR NAMES, CHECK THEY'RE THE SAME PERSON):</div>
            {suggestions.map((group) => (
              <div key={group.map((e) => e.id).join()} data-testid="bind-suggestion" style={row}>
                <span style={{ fontSize: '0.75rem' }}>{group.map((e) => e.files[0].name).join(' + ')}</span>
                <button onClick={() => bind(group)} style={smallButton}>
                  QUICK BIND
                </button>
              </div>
            ))}
          </>
        )}

        <div style={section}>NOT BOUND ({singles.length}): TICK THE FILES OF ONE PERSON</div>
        {singles.length === 0 && <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>Every file is in a group.</div>}
        {singles.map((e) => (
          <label key={e.id} style={{ ...row, justifyContent: 'flex-start', cursor: 'pointer' }}>
            <input type="checkbox" checked={ticked.has(e.id)} onChange={() => toggle(e.id)} />
            <span style={{ fontSize: '0.75rem' }}>{e.files[0].name}</span>
          </label>
        ))}
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => bind(singles.filter((e) => ticked.has(e.id)))} disabled={!canBind} style={button(canBind, true)}>
            [ 🔗 BIND SELECTED{ticked.size ? ` (${ticked.size})` : ''} ]
          </button>
          {ticked.size > MAX_DOCUMENTS_PER_CANDIDATE && (
            <span style={{ fontSize: '0.7rem', color: '#ff6b6b' }}>At most {MAX_DOCUMENTS_PER_CANDIDATE} files per candidate.</span>
          )}
        </div>

        {groups.length > 0 && (
          <>
            <div style={section}>BOUND ({groups.length}):</div>
            {groups.map((g) => (
              <div key={g.id} data-testid="bound-group" style={{ ...row, background: fieldBg, padding: '0.4rem 0.5rem' }}>
                <span style={{ fontSize: '0.75rem' }}>🔗 {g.files.map((f) => f.name).join(' + ')}</span>
                <button onClick={() => onChange(unbindEntry(entries, g))} style={smallButton}>
                  UNBIND
                </button>
              </div>
            ))}
          </>
        )}

        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={button(true, true)}>
            [ DONE ]
          </button>
        </div>
      </div>
    </div>
  );
}
