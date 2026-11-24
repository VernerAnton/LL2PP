import type { ActualTheme } from '../types';
import type { ThinkingLevel } from '../services/aiService';

interface AiSettingsProps {
  activeModel: string | null; // model in use, once looked up
  modelError: string | null;
  thinkingLevel: ThinkingLevel;
  onThinkingLevelChange: (level: ThinkingLevel) => void;
  disabled: boolean;
  theme: ActualTheme;
}

const LEVELS: { id: ThinkingLevel; label: string; description: string }[] = [
  {
    id: 'auto',
    label: 'AUTO',
    description:
      '🤖 Auto: low for longlist exports, medium for individual CVs. A CV that comes back incomplete is retried once at high.',
  },
  { id: 'low', label: 'LOW', description: '⚡ Low: quick reasoning, fastest and cheapest.' },
  { id: 'medium', label: 'MEDIUM', description: '⚖️ Medium: more careful, for CVs with unusual layouts.' },
  { id: 'high', label: 'HIGH', description: '🧠 High: most careful, slowest and highest token usage.' },
];

export function AiSettings({ activeModel, modelError, thinkingLevel, onThinkingLevelChange, disabled, theme }: AiSettingsProps) {
  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';

  const label = { display: 'block', fontSize: '0.75rem', marginBottom: '0.5rem', opacity: 0.8, color: textColor } as const;

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
      <div style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '1rem', letterSpacing: '0.1em', color: textColor }}>
        [ CLAUDE SETTINGS ]
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <div style={label}>MODEL:</div>
        <div style={{ fontSize: '0.75rem', fontFamily: 'Courier New, monospace', fontWeight: 'bold', color: textColor }}>
          CLAUDE SONNET (NEWEST){activeModel ? ` → ${activeModel}` : ''}
        </div>
        <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '0.5rem', color: modelError ? '#ff6b6b' : textColor }}>
          {modelError ?? '⚖️ Automatically uses the latest Sonnet release. The API key is kept on the server.'}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ ...label, display: 'inline', marginBottom: 0 }}>THINKING LEVEL:</span>
          <span
            title="How carefully Claude reasons before extracting each CV (Claude's effort setting). Higher levels help with messy or unusual CVs but are slower and use more tokens."
            style={{ cursor: 'help', fontSize: '0.75rem', opacity: 0.6, color: textColor }}
          >
            ⓘ
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {LEVELS.map((level) => {
            const selected = thinkingLevel === level.id;
            return (
              <button
                key={level.id}
                onClick={() => onThinkingLevelChange(level.id)}
                disabled={disabled}
                aria-pressed={selected}
                style={{
                  padding: '0.5rem 1rem',
                  background: selected ? textColor : 'none',
                  border: `2px solid ${borderColor}`,
                  color: selected ? bgColor : textColor,
                  fontFamily: 'Courier New, monospace',
                  fontWeight: 'bold',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  letterSpacing: '0.1em',
                  fontSize: '0.75rem',
                  opacity: disabled && !selected ? 0.5 : 1,
                }}
              >
                [ {level.label} ]
              </button>
            );
          })}
        </div>
        <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '0.5rem', color: textColor, lineHeight: 1.4 }}>
          {LEVELS.find((l) => l.id === thinkingLevel)?.description}
        </div>
      </div>
    </div>
  );
}
