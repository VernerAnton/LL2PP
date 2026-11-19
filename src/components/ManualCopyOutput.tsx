/**
 * ManualCopyOutput Component
 *
 * Displays extracted candidate data in formatted text for manual copying.
 * Includes a copy-to-clipboard button for easy manual workflow.
 */

import { useState } from 'react';
import type { CandidateData, ActualTheme } from '../types';
import { shortLabel } from '../services/extraDetails';

interface ManualCopyOutputProps {
  candidates: CandidateData[];
  theme: ActualTheme;
}

export function ManualCopyOutput({ candidates, theme }: ManualCopyOutputProps) {
  const [copySuccess, setCopySuccess] = useState(false);

  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';

  /**
   * Format a single candidate according to the specified format:
   * - Name
   * - Work: • JobTitle — Company (dates)
   * - Education: Institution (bold) then • Degree (dates)
   */
  const formatCandidate = (candidate: CandidateData): string => {
    const lines: string[] = [];

    // Name
    lines.push(candidate.name);
    // Extra details requested for this run (e.g. Location: Helsinki)
    candidate.extras?.forEach(extra => {
      if (extra.value) lines.push(`${shortLabel(extra.label)}: ${extra.value}`);
    });
    lines.push('');

    // Work History
    if (candidate.workHistory.length > 0) {
      candidate.workHistory.forEach(work => {
        const dates = work.dates ? ` (${work.dates})` : '';
        lines.push(`• ${work.jobTitle} — ${work.company}${dates}`);
      });
      lines.push('');
    }

    // Education (Institution bold, then • Degree underneath)
    if (candidate.education.length > 0) {
      candidate.education.forEach(edu => {
        lines.push(edu.institution);
        const dates = edu.dates ? ` (${edu.dates})` : '';
        lines.push(`• ${edu.degree}${dates}`);
        lines.push('');
      });
    }

    return lines.join('\n');
  };

  /**
   * Format all candidates as a single text block
   */
  const formatAllCandidates = (): string => {
    return candidates
      .map((candidate, index) => {
        const formatted = formatCandidate(candidate);
        // Add separator between candidates (except for last one)
        return index < candidates.length - 1
          ? formatted + '\n────────────────────────────────────────\n\n'
          : formatted;
      })
      .join('');
  };

  const formattedText = formatAllCandidates();

  /**
   * Copy formatted text to clipboard
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert('Failed to copy to clipboard');
    }
  };

  return (
    <div style={{
      padding: '1.5rem',
      border: `2px solid ${borderColor}`,
      background: bgColor,
      boxShadow: `4px 4px 0px ${borderColor}`,
      marginBottom: '1.5rem'
    }}>
      <div style={{
        fontSize: '0.875rem',
        fontWeight: 'bold',
        marginBottom: '1rem',
        letterSpacing: '0.1em',
        color: textColor
      }}>
        [ 📋 MANUAL COPY - {candidates.length} CANDIDATES ]
      </div>

      <textarea
        readOnly
        value={formattedText}
        style={{
          width: '100%',
          minHeight: '400px',
          padding: '1rem',
          fontFamily: 'Courier New, monospace',
          fontSize: '0.875rem',
          border: `1px solid ${borderColor}`,
          background: theme === 'dark' ? '#1a1a1a' : '#fff',
          color: textColor,
          resize: 'vertical',
          lineHeight: '1.5'
        }}
      />

      <button
        onClick={handleCopy}
        style={{
          marginTop: '1rem',
          padding: '0.75rem 1.5rem',
          background: 'none',
          border: `2px solid ${borderColor}`,
          color: textColor,
          fontFamily: 'Courier New, monospace',
          fontWeight: 'bold',
          cursor: 'pointer',
          letterSpacing: '0.1em',
          fontSize: '0.875rem'
        }}
      >
        {copySuccess ? '[ ✓ COPIED! ]' : '[ 📋 COPY TO CLIPBOARD ]'}
      </button>

      <div style={{
        fontSize: '0.75rem',
        opacity: 0.6,
        marginTop: '0.5rem',
        color: textColor
      }}>
        Copy this text to manually paste into your presentation or document
      </div>
    </div>
  );
}
