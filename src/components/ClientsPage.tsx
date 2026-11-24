import { useState } from 'react';
import type { ActualTheme } from '../types';
import type { Client } from '../shared/apiTypes';
import { createClient, deleteClient, renameClient } from '../services/clientsService';
import { LogoEditor } from './LogoEditor';

interface ClientsPageProps {
  clients: Client[];
  loadError: string | null;
  onClientsChange: (clients: Client[]) => void;
  theme: ActualTheme;
}

/** Client library: each client's name and logo (cropped and placed for the first slide) */
export function ClientsPage({ clients, loadError, onClientsChange, theme }: ClientsPageProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const fieldBg = theme === 'dark' ? '#1a1a1a' : '#fff';

  const selected = clients.find((c) => c.id === selectedId) ?? null;

  const sorted = (list: Client[]) => [...list].sort((a, b) => a.name.localeCompare(b.name, 'fi', { sensitivity: 'base' }));
  const replace = (client: Client) => onClientsChange(sorted(clients.map((c) => (c.id === client.id ? client : c))));

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = () =>
    run(async () => {
      const name = newName.trim();
      if (!name) return;
      const client = await createClient(name);
      onClientsChange(sorted([...clients, client]));
      setNewName('');
      setSelectedId(client.id);
      setRenameValue(client.name);
    });

  const handleRename = () =>
    run(async () => {
      if (!selected || !renameValue.trim() || renameValue.trim() === selected.name) return;
      replace(await renameClient(selected.id, renameValue.trim()));
    });

  const handleDelete = () =>
    run(async () => {
      if (!selected || !confirm(`Delete client ${selected.name} and its logo?`)) return;
      await deleteClient(selected.id);
      onClientsChange(clients.filter((c) => c.id !== selected.id));
      setSelectedId(null);
    });

  const panel = {
    padding: '1.5rem',
    border: `2px solid ${borderColor}`,
    background: bgColor,
    boxShadow: `4px 4px 0px ${borderColor}`,
    marginBottom: '1.5rem',
    color: textColor,
  } as const;
  const title = { fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '1rem', letterSpacing: '0.1em' } as const;
  const input = {
    flex: '1 1 200px',
    minWidth: 0,
    padding: '0.5rem 0.75rem',
    border: `2px solid ${borderColor}`,
    background: fieldBg,
    color: textColor,
    fontFamily: 'Courier New, monospace',
    fontSize: '0.875rem',
  } as const;
  const button = (enabled = true) =>
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

  return (
    <>
      <div style={panel}>
        <div style={title}>[ CLIENTS ]</div>
        <div style={{ fontSize: '0.75rem', opacity: 0.7, marginBottom: '1rem', lineHeight: 1.4 }}>
          Add a client once with its logo; pick it when making a longlist and the logo goes on the first slide.
        </div>

        {loadError && <div style={{ fontSize: '0.75rem', color: '#ff6b6b', marginBottom: '1rem' }}>Error: {loadError}</div>}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: clients.length ? '1rem' : 0 }}>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleCreate()}
            placeholder="New client name, e.g. Innofactor"
            disabled={busy}
            style={input}
          />
          <button onClick={() => void handleCreate()} disabled={busy || !newName.trim()} style={button(!busy && !!newName.trim())}>
            [ + ADD CLIENT ]
          </button>
        </div>

        {clients.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {clients.map((client) => {
              const isSelected = client.id === selectedId;
              return (
                <button
                  key={client.id}
                  onClick={() => {
                    setSelectedId(client.id);
                    setRenameValue(client.name);
                    setError(null);
                  }}
                  aria-pressed={isSelected}
                  style={{ ...button(), background: isSelected ? textColor : 'none', color: isSelected ? bgColor : textColor }}
                >
                  {client.name}
                  {client.hasLogo ? '' : ' (no logo)'}
                </button>
              );
            })}
          </div>
        )}
        {error && <div style={{ fontSize: '0.75rem', color: '#ff6b6b', marginTop: '0.75rem' }}>Error: {error}</div>}
      </div>

      {selected && (
        <div style={panel}>
          <div style={title}>[ {selected.name.toUpperCase()} ]</div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleRename()}
              disabled={busy}
              aria-label="Client name"
              style={input}
            />
            <button
              onClick={() => void handleRename()}
              disabled={busy || !renameValue.trim() || renameValue.trim() === selected.name}
              style={button(!busy && !!renameValue.trim() && renameValue.trim() !== selected.name)}
            >
              [ RENAME ]
            </button>
            <button onClick={() => void handleDelete()} disabled={busy} style={{ ...button(!busy), borderColor: '#ff6b6b', color: '#ff6b6b' }}>
              [ DELETE CLIENT ]
            </button>
          </div>

          <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.75rem', opacity: 0.8 }}>LOGO ON THE FIRST SLIDE:</div>
          <LogoEditor client={selected} onSaved={replace} theme={theme} />
        </div>
      )}
    </>
  );
}
