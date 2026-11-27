import type { ActualTheme } from '../types';
import type { SearchUsage } from '../shared/apiTypes';

interface UsageSummaryProps {
  usage: SearchUsage;
  /** Candidates read successfully, for the cost per candidate */
  candidates: number;
  title: string;
  note?: string;
  inProgress?: boolean;
  model?: string | null;
  theme: ActualTheme;
}

export const EMPTY_USAGE: SearchUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0, cvReads: 0 };

/** Add one CV's usage (all its requests, failed ones included) to a running total */
export function addToUsage(
  total: SearchUsage,
  usage: { inputTokens: number; outputTokens: number; estimatedCost: number } | undefined,
  requests: number
): SearchUsage {
  return {
    inputTokens: total.inputTokens + (usage?.inputTokens ?? 0),
    outputTokens: total.outputTokens + (usage?.outputTokens ?? 0),
    costUsd: total.costUsd + (usage?.estimatedCost ?? 0),
    cvReads: total.cvReads + requests,
  };
}

/** Token use and estimated cost, shown the same way for longlist runs and saved searches */
export function UsageSummary({ usage, candidates, title, note, inProgress, model, theme }: UsageSummaryProps) {
  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';

  const stats: [string, string][] = [
    ['INPUT TOKENS', usage.inputTokens.toLocaleString('en-US')],
    ['OUTPUT TOKENS', usage.outputTokens.toLocaleString('en-US')],
    ['TOTAL TOKENS', (usage.inputTokens + usage.outputTokens).toLocaleString('en-US')],
    ['ESTIMATED COST', `$${usage.costUsd.toFixed(usage.costUsd < 1 ? 4 : 2)}`],
  ];

  return (
    <div
      data-testid="usage-summary"
      style={{
        padding: '1.5rem',
        border: `2px solid ${borderColor}`,
        background: bgColor,
        boxShadow: `4px 4px 0px ${borderColor}`,
        marginBottom: '1.5rem',
        color: textColor,
      }}
    >
      <div style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '1rem', letterSpacing: '0.1em' }}>
        [ {inProgress ? '⏳ ' : ''}
        {title}
        {inProgress ? ' (IN PROGRESS)' : ''} ]
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
        {stats.map(([label, value]) => (
          <div key={label}>
            <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '0.25rem' }}>{label}:</div>
            <div style={{ fontSize: '1.15rem', fontWeight: 'bold', fontFamily: 'Courier New, monospace' }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '1rem', lineHeight: 1.5 }}>
        💡 {usage.cvReads} Claude call{usage.cvReads === 1 ? '' : 's'}
        {candidates > 0 ? ` · cost per candidate $${(usage.costUsd / candidates).toFixed(4)}` : ''}
        {model ? ` · model ${model}` : ''}. Output tokens include Claude's thinking. Failed and retried CVs count too.
        {note ? ` ${note}` : ''}
      </div>
    </div>
  );
}
