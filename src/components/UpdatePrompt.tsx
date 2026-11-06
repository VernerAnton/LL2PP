import type { ActualTheme } from '../types';
import { APP_VERSION } from '../version';

interface UpdatePromptProps {
  latestVersion: number | null;
  onReload: () => void;
  onDismiss: () => void;
  theme: ActualTheme;
}

export function UpdatePrompt({ latestVersion, onReload, onDismiss, theme }: UpdatePromptProps) {
  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';

  const buttonStyle = {
    padding: '0.5rem 1rem',
    border: `2px solid ${borderColor}`,
    fontFamily: 'Courier New, monospace',
    fontWeight: 'bold',
    cursor: 'pointer',
    letterSpacing: '0.1em',
    fontSize: '0.75rem',
  } as const;

  const versionNote =
    latestVersion !== null && latestVersion !== APP_VERSION
      ? `You're on V${APP_VERSION}, V${latestVersion} is available.`
      : `You're on V${APP_VERSION}.`;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '1rem',
        right: '1rem',
        bottom: '1rem',
        maxWidth: '560px',
        margin: '0 auto',
        padding: '1rem 1.25rem',
        border: `2px solid ${borderColor}`,
        background: bgColor,
        boxShadow: `4px 4px 0px ${borderColor}`,
        color: textColor,
        display: 'flex',
        flexWrap: 'wrap', // stacks at phone width, single row when there's room
        alignItems: 'center',
        gap: '0.75rem 1rem',
        zIndex: 1000,
      }}
    >
      <div style={{ flex: '1 1 240px' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 'bold', letterSpacing: '0.05em' }}>
          A newer version is ready.
        </div>
        <div style={{ fontSize: '0.75rem', opacity: 0.75, marginTop: '0.25rem', lineHeight: 1.4 }}>
          {versionNote} Reloading clears uploaded CVs and results.
        </div>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flex: '0 0 auto' }}>
        <button type="button" onClick={onDismiss} style={{ ...buttonStyle, background: 'none', color: textColor }}>
          [ LATER ]
        </button>
        <button type="button" onClick={onReload} style={{ ...buttonStyle, background: textColor, color: bgColor }}>
          [ RELOAD ]
        </button>
      </div>
    </div>
  );
}
