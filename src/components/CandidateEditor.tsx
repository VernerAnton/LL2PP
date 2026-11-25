import { useState } from 'react';
import type { ActualTheme, CandidateData, Education, WorkExperience } from '../types';

interface CandidateEditorProps {
  candidate: CandidateData;
  onSave: (data: CandidateData) => Promise<void>;
  onCancel: () => void;
  theme: ActualTheme;
}

const MAX_ROLES = 5;

/** Fix a saved candidate by hand: name, roles, education and extra details */
export function CandidateEditor({ candidate, onSave, onCancel, theme }: CandidateEditorProps) {
  const [name, setName] = useState(candidate.name);
  const [work, setWork] = useState<WorkExperience[]>(candidate.workHistory.map((w) => ({ ...w })));
  const [education, setEducation] = useState<Education[]>(candidate.education.map((e) => ({ ...e })));
  const [extras, setExtras] = useState(candidate.extras?.map((x) => ({ ...x })) ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const fieldBg = theme === 'dark' ? '#2a2a2a' : '#fefdfb';

  const input = (flex: string) =>
    ({
      flex,
      minWidth: 0,
      padding: '0.35rem 0.5rem',
      border: `1px solid ${borderColor}`,
      background: fieldBg,
      color: textColor,
      fontFamily: 'Courier New, monospace',
      fontSize: '0.75rem',
    }) as const;
  const smallButton = {
    padding: '0.3rem 0.6rem',
    background: 'none',
    border: `1px solid ${borderColor}`,
    color: textColor,
    fontFamily: 'Courier New, monospace',
    fontWeight: 'bold',
    cursor: 'pointer',
    fontSize: '0.7rem',
    whiteSpace: 'nowrap',
  } as const;
  const sectionLabel = { fontSize: '0.7rem', fontWeight: 'bold', opacity: 0.8, margin: '0.75rem 0 0.35rem' } as const;
  const row = { display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.35rem' } as const;

  const updateWork = (i: number, field: keyof WorkExperience, value: string) =>
    setWork(work.map((w, j) => (j === i ? { ...w, [field]: value } : w)));
  const updateEducation = (i: number, field: keyof Education, value: string) =>
    setEducation(education.map((e, j) => (j === i ? { ...e, [field]: value } : e)));

  const handleSave = async () => {
    if (!name.trim()) return setError('Name is required');
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...candidate,
        name: name.trim(),
        // Rows left empty are dropped; a role needs a company and a title, education an institution
        workHistory: work
          .filter((w) => w.company.trim() && w.jobTitle.trim())
          .map((w) => ({ company: w.company.trim(), jobTitle: w.jobTitle.trim(), dates: w.dates?.trim() || undefined })),
        education: education
          .filter((e) => e.institution.trim())
          .map((e) => ({ institution: e.institution.trim(), degree: e.degree?.trim() || undefined, dates: e.dates?.trim() || undefined })),
        ...(extras.length ? { extras: extras.map((x) => ({ label: x.label, value: x.value.trim() })) } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  };

  return (
    <div style={{ color: textColor }}>
      <div style={sectionLabel}>NAME:</div>
      <div style={row}>
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" style={input('1 1 240px')} />
      </div>

      {extras.length > 0 && (
        <>
          <div style={sectionLabel}>EXTRA DETAILS:</div>
          {extras.map((x, i) => (
            <div key={x.label} style={row}>
              <span style={{ flex: '0 0 11rem', fontSize: '0.7rem', alignSelf: 'center' }}>{x.label}:</span>
              <input
                value={x.value}
                onChange={(e) => setExtras(extras.map((y, j) => (j === i ? { ...y, value: e.target.value } : y)))}
                aria-label={x.label}
                style={input('1 1 160px')}
              />
            </div>
          ))}
        </>
      )}

      <div style={sectionLabel}>WORK HISTORY (COMPANY · TITLE · DATES):</div>
      {work.map((w, i) => (
        <div key={i} style={row}>
          <input value={w.company} onChange={(e) => updateWork(i, 'company', e.target.value)} placeholder="Company" style={input('2 1 140px')} />
          <input value={w.jobTitle} onChange={(e) => updateWork(i, 'jobTitle', e.target.value)} placeholder="Title" style={input('2 1 140px')} />
          <input value={w.dates ?? ''} onChange={(e) => updateWork(i, 'dates', e.target.value)} placeholder="03/2020 - Present" style={input('1 1 110px')} />
          <button onClick={() => setWork(work.filter((_, j) => j !== i))} aria-label="Remove role" style={smallButton}>
            ×
          </button>
        </div>
      ))}
      {work.length < MAX_ROLES && (
        <button onClick={() => setWork([...work, { company: '', jobTitle: '' }])} style={smallButton}>
          + ADD ROLE
        </button>
      )}

      <div style={sectionLabel}>EDUCATION (INSTITUTION · DEGREE · DATES):</div>
      {education.map((ed, i) => (
        <div key={i} style={row}>
          <input value={ed.institution} onChange={(e) => updateEducation(i, 'institution', e.target.value)} placeholder="Institution" style={input('2 1 140px')} />
          <input value={ed.degree ?? ''} onChange={(e) => updateEducation(i, 'degree', e.target.value)} placeholder="Degree" style={input('2 1 140px')} />
          <input value={ed.dates ?? ''} onChange={(e) => updateEducation(i, 'dates', e.target.value)} placeholder="2012 - 2014" style={input('1 1 110px')} />
          <button onClick={() => setEducation(education.filter((_, j) => j !== i))} aria-label="Remove education" style={smallButton}>
            ×
          </button>
        </div>
      ))}
      <button onClick={() => setEducation([...education, { institution: '' }])} style={smallButton}>
        + ADD EDUCATION
      </button>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', alignItems: 'center' }}>
        <button onClick={() => void handleSave()} disabled={saving} style={{ ...smallButton, background: textColor, color: fieldBg }}>
          {saving ? 'SAVING…' : 'SAVE'}
        </button>
        <button onClick={onCancel} disabled={saving} style={smallButton}>
          CANCEL
        </button>
        {error && <span style={{ fontSize: '0.7rem', color: '#ff6b6b' }}>Error: {error}</span>}
      </div>
    </div>
  );
}
