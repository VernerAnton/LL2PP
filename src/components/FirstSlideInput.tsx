import type { ActualTheme } from '../types';
import type { Client } from '../shared/apiTypes';
import { formatSlideDate } from '../services/firstSlide';

interface FirstSlideInputProps {
  clients: Client[];
  clientId: string;
  onClientIdChange: (id: string) => void;
  position: string;
  onPositionChange: (position: string) => void;
  onManageClients: () => void;
  theme: ActualTheme;
}

/** Client (for the logo) and position for the first slide. Used for this deck only, not saved. */
export function FirstSlideInput({
  clients,
  clientId,
  onClientIdChange,
  position,
  onPositionChange,
  onManageClients,
  theme,
}: FirstSlideInputProps) {
  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const fieldBg = theme === 'dark' ? '#1a1a1a' : '#fff';

  const label = { display: 'block', fontSize: '0.75rem', marginBottom: '0.5rem', opacity: 0.8 } as const;
  const field = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '0.5rem 0.75rem',
    border: `2px solid ${borderColor}`,
    background: fieldBg,
    color: textColor,
    fontFamily: 'Courier New, monospace',
    fontSize: '0.875rem',
  } as const;

  const client = clients.find((c) => c.id === clientId);

  return (
    <div
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
        [ FIRST SLIDE ]
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 220px' }}>
          <label style={label} htmlFor="first-slide-client">
            CLIENT (LOGO):
          </label>
          <select id="first-slide-client" value={clientId} onChange={(e) => onClientIdChange(e.target.value)} style={field}>
            <option value="">No logo</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.hasLogo ? '' : ' (no logo yet)'}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: '1 1 220px' }}>
          <label style={label} htmlFor="first-slide-position">
            POSITION:
          </label>
          <input
            id="first-slide-position"
            type="text"
            value={position}
            onChange={(e) => onPositionChange(e.target.value)}
            placeholder="e.g. Sales Executive"
            style={field}
          />
        </div>
      </div>

      <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: '0.75rem', lineHeight: 1.4 }}>
        On the slide: {client?.hasLogo ? `${client.name} logo · ` : ''}LONGLIST · {position.trim() || '(no position)'} ·{' '}
        {formatSlideDate(new Date())}.{' '}
        <button
          onClick={onManageClients}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: textColor,
            textDecoration: 'underline',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'inherit',
          }}
        >
          Add or edit clients and logos
        </button>
      </div>
    </div>
  );
}
