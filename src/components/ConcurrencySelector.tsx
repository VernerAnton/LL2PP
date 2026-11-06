import type { ConcurrencyLevel, ActualTheme } from '../types';

interface ConcurrencySelectorProps {
  level: ConcurrencyLevel;
  onLevelChange: (level: ConcurrencyLevel) => void;
  theme: ActualTheme;
}

export function ConcurrencySelector({ level, onLevelChange, theme }: ConcurrencySelectorProps) {
  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';

  const levels: ConcurrencyLevel[] = [1, 2, 3, 4, 5];

  const getDescription = (lvl: ConcurrencyLevel): string => {
    switch (lvl) {
      case 1: return 'Sequential (1 at a time) - Safest, works on every API usage tier';
      case 2: return 'Low parallel (2 concurrent) - Safe for most use cases';
      case 3: return 'Medium parallel (3 concurrent) - May hit rate limits on Tier 1';
      case 4: return 'High parallel (4 concurrent) - Best on Tier 2 or higher';
      case 5: return 'Max parallel (5 concurrent) - Fastest, but likely to hit rate limits on Tier 1';
      default: return '';
    }
  };

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
          marginBottom: '1rem',
          letterSpacing: '0.1em',
          color: textColor,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <span>[ CONCURRENCY LEVEL ]</span>
        <span
          title="ℹ️ New Anthropic accounts (Tier 1) should use level 1-2 to avoid rate limits (429 errors). Higher levels process CVs faster but may exceed your rate limit."
          style={{
            cursor: 'help',
            fontSize: '0.875rem',
            opacity: 0.6,
          }}
        >
          ⓘ
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {levels.map((lvl) => (
          <button
            key={lvl}
            onClick={() => onLevelChange(lvl)}
            style={{
              padding: '0.75rem 1.25rem',
              background: level === lvl ? textColor : 'none',
              border: `2px solid ${borderColor}`,
              color: level === lvl ? bgColor : textColor,
              fontFamily: 'Courier New, monospace',
              fontWeight: 'bold',
              cursor: 'pointer',
              letterSpacing: '0.1em',
              fontSize: '1rem',
            }}
          >
            [ {lvl} ]
          </button>
        ))}
      </div>

      <div
        style={{
          fontSize: '0.75rem',
          opacity: 0.7,
          lineHeight: '1.4',
          color: textColor,
        }}
      >
        {getDescription(level)}
      </div>

      <div
        style={{
          fontSize: '0.65rem',
          opacity: 0.5,
          marginTop: '0.5rem',
          color: textColor,
        }}
      >
        ⚠️  New accounts (Tier 1): level 1-2 recommended. Rate-limited requests are retried automatically, but higher levels may still fail with 429 errors.
      </div>
    </div>
  );
}
