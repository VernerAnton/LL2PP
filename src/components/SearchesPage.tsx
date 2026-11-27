import { useEffect, useRef, useState } from 'react';
import type { ActualTheme, ConcurrencyLevel } from '../types';
import type { Client, FailedFile, SavedCandidate, SearchDetail, SearchSummary } from '../shared/apiTypes';
import { MAX_SELECTED_EXTRAS, selectedExtraFields, type ExtraFieldId } from '../services/extraDetails';
import { AIService, type CvPart, type ThinkingLevel } from '../services/aiService';
import { PDFService, hasUsableText } from '../services/pdfService';
import { formatSlideDate } from '../services/firstSlide';
import {
  addCandidates,
  getFailedFile,
  keepFailedFile,
  removeAllFailedFiles,
  removeFailedFile,
  updateFailedFile,
  createSearch,
  deleteCandidate,
  deleteSearch,
  getSearch,
  listSearches,
  reorderCandidates,
  updateCandidate,
  updateSearch,
} from '../services/searchesService';
import { ExtraDetailsInput } from './ExtraDetailsInput';
import { FileUploader } from './FileUploader';
import { GenerateButton } from './GenerateButton';
import { ManualCopyOutput } from './ManualCopyOutput';
import { CandidateEditor } from './CandidateEditor';
import { UsageSummary, addToUsage } from './UsageSummary';
import { BindDialog, bindEntries, bindSuggestions, unbindEntry, type UploadEntry } from './BindDialog';

interface SearchesPageProps {
  clients: Client[];
  thinkingLevel: ThinkingLevel;
  concurrencyLevel: ConcurrencyLevel;
  theme: ActualTheme;
}

interface BatchFailure {
  fileName: string;
  error: string;
}

/** SQLite "YYYY-MM-DD HH:MM:SS" (UTC) -> 24.11.2026 */
const shortDate = (sqlite: string) => formatSlideDate(new Date(sqlite.replace(' ', 'T') + 'Z'));

/**
 * Saved searches: individual CVs that arrive in batches over days or weeks. Each CV is extracted
 * and saved as it is processed (extracted data only). When the search is done, the deck is
 * downloaded and the search deleted.
 */
export function SearchesPage({ clients, thinkingLevel, concurrencyLevel, theme }: SearchesPageProps) {
  const [searches, setSearches] = useState<SearchSummary[] | null>(null);
  const [search, setSearch] = useState<SearchDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New search form
  const [newName, setNewName] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newExtras, setNewExtras] = useState<ExtraFieldId[]>([]);

  // Search settings form
  const [editName, setEditName] = useState('');
  const [editClientId, setEditClientId] = useState('');
  const [editPosition, setEditPosition] = useState('');

  // Adding CVs
  // Files chosen for the next run: each entry is one CV file, or several bound as one candidate
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [bindOpen, setBindOpen] = useState(false);
  const [uploaderKey, setUploaderKey] = useState(0);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [failures, setFailures] = useState<BatchFailure[]>([]);
  const [batchCost, setBatchCost] = useState<{ added: number; cost: number } | null>(null);
  const cancelRef = useRef(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  const borderColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const bgColor = theme === 'dark' ? '#2a2a2a' : '#fefdfb';
  const textColor = theme === 'dark' ? '#e0e0e0' : '#2a2a2a';
  const fieldBg = theme === 'dark' ? '#1a1a1a' : '#fff';

  const refreshList = () =>
    listSearches()
      .then(setSearches)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));

  useEffect(() => {
    void refreshList();
  }, []);

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

  const openSearch = (detail: SearchDetail) => {
    setSearch(detail);
    setEditName(detail.name);
    setEditClientId(detail.clientId ?? '');
    setEditPosition(detail.position);
    setEntries([]);
    setUploaderKey((k) => k + 1);
    setFailures([]);
    setBatchCost(null);
    setEditingId(null);
    setDownloaded(false);
    setError(null);
  };

  const backToList = () => {
    setSearch(null);
    void refreshList();
  };

  // --- styles ---------------------------------------------------------------------------------
  const panel = {
    padding: '1.5rem',
    border: `2px solid ${borderColor}`,
    background: bgColor,
    boxShadow: `4px 4px 0px ${borderColor}`,
    marginBottom: '1.5rem',
    color: textColor,
  } as const;
  const title = { fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '1rem', letterSpacing: '0.1em' } as const;
  const hint = { fontSize: '0.75rem', opacity: 0.7, lineHeight: 1.4 } as const;
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
  const danger = (enabled = true) => ({ ...button(enabled), borderColor: '#ff6b6b', color: '#ff6b6b' });
  const smallButton = (enabled = true) => ({ ...button(enabled), padding: '0.3rem 0.6rem', fontSize: '0.7rem', letterSpacing: 0 });

  const clientSelect = (id: string, value: string, onChange: (v: string) => void) => (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} style={field}>
      <option value="">No logo</option>
      {clients.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
          {c.hasLogo ? '' : ' (no logo yet)'}
        </option>
      ))}
    </select>
  );

  // --- list view ------------------------------------------------------------------------------
  if (!search) {
    const handleCreate = () =>
      run(async () => {
        if (!newName.trim()) return;
        const created = await createSearch({
          name: newName.trim(),
          clientId: newClientId || null,
          position: newPosition.trim(),
          extraFields: newExtras,
        });
        setNewName('');
        setNewClientId('');
        setNewPosition('');
        setNewExtras([]);
        openSearch(created);
      });

    return (
      <>
        <div style={panel}>
          <div style={title}>[ SAVED SEARCHES ]</div>
          <div style={{ ...hint, marginBottom: '1rem' }}>
            For individual CVs that arrive in batches. Each CV is saved as extracted data only (no PDFs, no CV
            text) until you finish and delete the search.
          </div>
          {searches === null && !error && <div style={hint}>Loading…</div>}
          {searches?.length === 0 && <div style={hint}>No saved searches yet.</div>}
          {searches && searches.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {searches.map((s) => (
                <button
                  key={s.id}
                  onClick={() => void run(async () => openSearch(await getSearch(s.id)))}
                  disabled={busy}
                  style={{ ...button(!busy), textAlign: 'left', whiteSpace: 'normal', letterSpacing: 0, fontWeight: 'normal' }}
                >
                  <span style={{ fontWeight: 'bold' }}>{s.name}</span>
                  <span style={{ opacity: 0.7 }}>
                    {' '}
                    · {clients.find((c) => c.id === s.clientId)?.name ?? 'no client'}
                    {s.position ? ` · ${s.position}` : ''} · {s.candidateCount} candidate{s.candidateCount === 1 ? '' : 's'} · $
                    {s.usage.costUsd.toFixed(2)} · updated{' '}
                    {shortDate(s.updatedAt)}
                  </span>
                </button>
              ))}
            </div>
          )}
          {error && <div style={{ fontSize: '0.75rem', color: '#ff6b6b', marginTop: '0.75rem' }}>Error: {error}</div>}
        </div>

        <div style={panel}>
          <div style={title}>[ NEW SEARCH ]</div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ flex: '1 1 100%' }}>
              <label style={label} htmlFor="new-search-name">
                NAME:
              </label>
              <input
                id="new-search-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Innofactor – Sales Executive"
                style={field}
              />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label style={label} htmlFor="new-search-client">
                CLIENT (LOGO):
              </label>
              {clientSelect('new-search-client', newClientId, setNewClientId)}
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label style={label} htmlFor="new-search-position">
                POSITION:
              </label>
              <input
                id="new-search-position"
                value={newPosition}
                onChange={(e) => setNewPosition(e.target.value)}
                placeholder="e.g. Sales Executive"
                style={field}
              />
            </div>
          </div>
          <ExtraDetailsInput
            selected={newExtras}
            onSelectedChange={setNewExtras}
            disabled={busy}
            theme={theme}
            note={`Optional, pick up to ${MAX_SELECTED_EXTRAS}. Fixed for this search, so every candidate gets the same details.`}
          />
          <button onClick={() => void handleCreate()} disabled={busy || !newName.trim()} style={button(!busy && !!newName.trim(), true)}>
            [ CREATE SEARCH ]
          </button>
        </div>
      </>
    );
  }

  // --- one search -----------------------------------------------------------------------------
  const client = clients.find((c) => c.id === search.clientId) ?? null;
  const extraLabels = selectedExtraFields(search.extraFields).map((f) => f.label);
  const settingsChanged =
    editName.trim() !== search.name || (editClientId || null) !== search.clientId || editPosition.trim() !== search.position;

  const setCandidates = (candidates: SavedCandidate[]) =>
    setSearch((s) => (s ? { ...s, candidates, candidateCount: candidates.length } : s));

  const handleSaveSettings = () =>
    run(async () => {
      if (!editName.trim()) throw new Error('Search name is required');
      openSearchKeepState(
        await updateSearch(search.id, { name: editName.trim(), clientId: editClientId || null, position: editPosition.trim() })
      );
    });

  // Settings saved: update the search but keep the page as it is
  const openSearchKeepState = (detail: SearchDetail) => {
    setSearch(detail);
    setEditName(detail.name);
    setEditClientId(detail.clientId ?? '');
    setEditPosition(detail.position);
  };

  /** One candidate to process: one or more files (bound together), new or stored after failing */
  interface Job {
    label: string; // file names, joined with " + "
    files: { name: string; get: () => Promise<Blob>; failedId?: string }[];
  }

  /**
   * Extract and save each candidate. Bound files are read together as one profile. A candidate
   * that fails is kept on the server (its files, still bound) so it can be retried later without
   * uploading again; a retry that succeeds removes the stored files.
   */
  const runJobs = async (jobs: Job[]) => {
    cancelRef.current = false;
    setProcessing(true);
    setFailures([]);
    setBatchCost(null);
    setError(null);
    setProgress({ done: 0, total: jobs.length });

    const searchId = search.id;
    const unkept: BatchFailure[] = [];
    let added = 0;
    let cost = 0;
    let done = 0;

    const processJob = async (job: Job) => {
      let blobs: Blob[] | null = null;
      let failure: string;
      const failedIds = job.files.flatMap((f) => (f.failedId ? [f.failedId] : []));
      try {
        blobs = await Promise.all(job.files.map((f) => f.get()));
        const parts: CvPart[] = [];
        for (const blob of blobs) {
          const text = (await PDFService.parsePDF(blob as File)).join('\n\n');
          // A scanned CV has no text layer: send the PDF itself, Claude reads the page images
          parts.push(hasUsableText(text) ? { text } : { pdf: blob });
        }
        const result = await AIService.extractCVData(parts, {
          extraFields: search.extraFields,
          level: thinkingLevel,
          source: 'individual',
          searchId, // the server adds the token use to this search's totals
        });
        cost += result.usage?.estimatedCost ?? 0;
        // Same totals as the server keeps, updated live (failed CVs count: they are billed)
        setSearch((s) => (s ? { ...s, usage: addToUsage(s.usage, result.usage, result.requests) } : s));
        if (result.success && result.data) {
          // Saved right away, so a closed tab or a failure later in the batch loses nothing
          const [saved] = await addCandidates(searchId, [{ data: result.data, sourceFile: job.label }]);
          added++;
          setSearch((s) => (s ? { ...s, candidates: [...s.candidates, saved], candidateCount: s.candidates.length + 1 } : s));
          if (failedIds.length) {
            await Promise.all(failedIds.map((id) => removeFailedFile(searchId, id)));
            setSearch((s) => (s ? { ...s, failedFiles: s.failedFiles.filter((f) => !failedIds.includes(f.id)) } : s));
          }
          return;
        }
        failure = result.error ?? 'Unknown error';
      } catch (e) {
        failure = e instanceof Error ? e.message : String(e);
      } finally {
        done++;
        setProgress({ done, total: jobs.length });
      }

      // Failed: keep the files (still bound together) for a later retry
      try {
        if (failedIds.length) {
          await Promise.all(failedIds.map((id) => updateFailedFile(searchId, id, failure)));
          setSearch((s) => (s ? { ...s, failedFiles: s.failedFiles.map((f) => (failedIds.includes(f.id) ? { ...f, error: failure } : f)) } : s));
        } else if (blobs) {
          const groupId = job.files.length > 1 ? crypto.randomUUID() : undefined;
          const kept = await Promise.all(
            job.files.map((f, i) => keepFailedFile(searchId, blobs![i], f.name, failure, groupId))
          );
          setSearch((s) => (s ? { ...s, failedFiles: [...s.failedFiles, ...kept] } : s));
        } else {
          unkept.push({ fileName: job.label, error: failure });
        }
      } catch (e) {
        unkept.push({ fileName: job.label, error: `${failure} (and the files couldn't be kept: ${e instanceof Error ? e.message : String(e)})` });
      }
    };

    for (let i = 0; i < jobs.length && !cancelRef.current; i += concurrencyLevel) {
      await Promise.all(jobs.slice(i, i + concurrencyLevel).map(processJob));
    }

    setFailures(unkept);
    setBatchCost({ added, cost });
    setProcessing(false);
    setDownloaded(false);
  };

  /** Each upload adds to the list (the same file twice is ignored) */
  const addFiles = (picked: File[]) => {
    setEntries((current) => {
      const have = new Set(current.flatMap((e) => e.files.map((f) => `${f.name}|${f.size}`)));
      const fresh = picked.filter((f) => !have.has(`${f.name}|${f.size}`));
      return [...current, ...fresh.map((file) => ({ id: crypto.randomUUID(), files: [file] }))];
    });
    setUploaderKey((k) => k + 1); // ready for the next pick
  };

  const handleProcess = async () => {
    if (entries.length === 0) return;
    const known = new Set(search.candidates.flatMap((c) => c.sourceFile.split(' + ')).filter(Boolean));
    const repeats = entries.flatMap((e) => e.files.map((f) => f.name)).filter((name) => known.has(name));
    if (repeats.length && !confirm(`Already added to this search:\n${repeats.join('\n')}\n\nAdd them again?`)) return;
    const jobs: Job[] = entries.map((e) => ({
      label: e.files.map((f) => f.name).join(' + '),
      files: e.files.map((file) => ({ name: file.name, get: async () => file })),
    }));
    setEntries([]);
    setUploaderKey((k) => k + 1);
    await runJobs(jobs);
  };

  /** Stored failed files, as candidates: bound files together, others one by one */
  const failedGroups = groupFailed(search.failedFiles);
  const fileCount = entries.reduce((n, e) => n + e.files.length, 0);
  const suggestions = bindSuggestions(entries);

  /** Retry the given groups of stored files (each group is read as one candidate) */
  const retryFailed = (groups: FailedFile[][]) =>
    runJobs(
      groups.map((group) => ({
        label: group.map((f) => f.fileName).join(' + '),
        files: group.map((f) => ({ name: f.fileName, failedId: f.id, get: () => getFailedFile(search.id, f.id) })),
      }))
    );

  const removeFailed = (groups: FailedFile[][] | 'all') =>
    run(async () => {
      if (groups === 'all' && !confirm(`Remove all ${failedGroups.length} that couldn't be read? The files are deleted from the server.`)) return;
      if (groups === 'all') await removeAllFailedFiles(search.id);
      else await Promise.all(groups.flat().map((f) => removeFailedFile(search.id, f.id)));
      const ids = groups === 'all' ? null : new Set(groups.flat().map((f) => f.id));
      setSearch((s) => (s ? { ...s, failedFiles: ids ? s.failedFiles.filter((f) => !ids.has(f.id)) : [] } : s));
    });

  const move = (index: number, delta: number) =>
    run(async () => {
      const next = [...search.candidates];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      setCandidates(next); // show the new order straight away
      setCandidates((await reorderCandidates(search.id, next.map((c) => c.id))).candidates);
    });

  const remove = (candidate: SavedCandidate) =>
    run(async () => {
      if (!confirm(`Remove ${candidate.data.name} from this search?`)) return;
      await deleteCandidate(search.id, candidate.id);
      setCandidates(search.candidates.filter((c) => c.id !== candidate.id));
    });

  const handleDelete = (afterDownload: boolean) =>
    run(async () => {
      const message = afterDownload
        ? `Finish "${search.name}" and delete it with all ${search.candidates.length} candidates?\n\nMake sure the deck is downloaded first. This can't be undone.`
        : `Delete "${search.name}" and all ${search.candidates.length} candidates? This can't be undone.`;
      if (!confirm(message)) return;
      await deleteSearch(search.id);
      backToList();
    });

  return (
    <>
      <div style={{ marginBottom: '1rem' }}>
        <button onClick={backToList} disabled={processing} style={button(!processing)}>
          [ ← ALL SEARCHES ]
        </button>
      </div>

      <div style={panel}>
        <div style={title}>[ {search.name.toUpperCase()} ]</div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <div style={{ flex: '1 1 100%' }}>
            <label style={label} htmlFor="search-name">
              NAME:
            </label>
            <input id="search-name" value={editName} onChange={(e) => setEditName(e.target.value)} style={field} />
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <label style={label} htmlFor="search-client">
              CLIENT (LOGO):
            </label>
            {clientSelect('search-client', editClientId, setEditClientId)}
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <label style={label} htmlFor="search-position">
              POSITION:
            </label>
            <input id="search-position" value={editPosition} onChange={(e) => setEditPosition(e.target.value)} style={field} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button onClick={() => void handleSaveSettings()} disabled={busy || !settingsChanged} style={button(!busy && settingsChanged, true)}>
            [ SAVE CHANGES ]
          </button>
          <span style={hint}>
            Extra details: {extraLabels.length ? extraLabels.join(', ') : 'none'} (fixed for this search) · created{' '}
            {shortDate(search.createdAt)}
          </span>
        </div>
      </div>

      <UsageSummary
        usage={search.usage}
        candidates={search.candidates.length}
        title="API USAGE: THIS SEARCH"
        note="Kept while the search exists and deleted with it."
        inProgress={processing}
        theme={theme}
      />

      <div style={panel}>
        <div style={title}>[ ADD CVs ]</div>
        <div style={{ ...hint, marginBottom: '1rem' }}>
          Upload a batch of individual CV PDFs. Each one is extracted and saved to this search as soon as it's done.
        </div>
        <FileUploader key={uploaderKey} onFileSelect={addFiles} theme={theme} disabled={processing} parseMode="individual" />

        {entries.length > 0 && (
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.35rem', opacity: 0.85 }}>
              TO PROCESS: {entries.length} candidate{entries.length === 1 ? '' : 's'} ({fileCount} file{fileCount === 1 ? '' : 's'}). Upload more to add them.
            </div>
            {entries.map((e) => (
              <div
                key={e.id}
                data-testid="upload-entry"
                style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between', padding: '0.3rem 0', borderTop: `1px solid ${borderColor}`, fontSize: '0.75rem' }}
              >
                <span>
                  {e.files.length > 1 ? '🔗 ' : ''}
                  {e.files.map((f) => f.name).join(' + ')}
                </span>
                <span style={{ display: 'flex', gap: '0.35rem' }}>
                  {e.files.length > 1 && (
                    <button onClick={() => setEntries(unbindEntry(entries, e))} disabled={processing} style={smallButton(!processing)}>
                      UNBIND
                    </button>
                  )}
                  <button
                    onClick={() => setEntries(entries.filter((x) => x.id !== e.id))}
                    disabled={processing}
                    aria-label={`Remove ${e.files.map((f) => f.name).join(' + ')}`}
                    style={smallButton(!processing)}
                  >
                    ✕
                  </button>
                </span>
              </div>
            ))}
            {suggestions.length > 0 && (
              <div style={{ ...hint, marginTop: '0.5rem' }}>
                💡 Similar names, possibly the same person:{' '}
                {suggestions.map((group) => (
                  <span key={group.map((x) => x.id).join()} style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center', marginRight: '0.75rem' }}>
                    {group.map((x) => x.files[0].name).join(' + ')}
                    <button onClick={() => setEntries(bindEntries(entries, group))} disabled={processing} style={smallButton(!processing)}>
                      QUICK BIND
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {processing ? (
            <button onClick={() => (cancelRef.current = true)} style={danger()}>
              [ ⏹️ STOP AFTER CURRENT CVs ]
            </button>
          ) : (
            <>
              <button onClick={() => void handleProcess()} disabled={entries.length === 0 || busy} style={button(entries.length > 0 && !busy, true)}>
                [ 🚀 PROCESS & SAVE {entries.length || ''} CV{entries.length === 1 ? '' : 's'} ]
              </button>
              {fileCount >= 2 && (
                <button onClick={() => setBindOpen(true)} disabled={busy} style={button(!busy)}>
                  [ 🔗 BIND CVs ]
                </button>
              )}
              {entries.length > 0 && (
                <button onClick={() => setEntries([])} disabled={busy} style={button(!busy)}>
                  [ CLEAR ]
                </button>
              )}
            </>
          )}
          {processing && (
            <span style={hint}>
              ⏳ {progress.done} / {progress.total} processed
            </span>
          )}
          {batchCost && !processing && (
            <span style={hint}>
              ✅ Added {batchCost.added} candidate{batchCost.added === 1 ? '' : 's'} · estimated cost ${batchCost.cost.toFixed(4)}
            </span>
          )}
        </div>
        {failures.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            {failures.map((f, i) => (
              <div key={i} style={{ fontSize: '0.75rem', color: '#ff6b6b', marginBottom: '0.25rem' }}>
                ✗ {f.fileName}: {f.error} (not saved, upload it again)
              </div>
            ))}
          </div>
        )}
      </div>

      {search.failedFiles.length > 0 && (
        <div style={{ ...panel, borderColor: '#ff6b6b' }}>
          <div style={title}>[ COULDN'T READ: {failedGroups.length} ]</div>
          <div style={{ ...hint, marginBottom: '1rem' }}>
            Kept so you can try again without uploading them. Each file is deleted as soon as a retry works, when you
            remove it or finish the search, and after 30 days at the latest. Bound files stay bound.
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <button onClick={() => void retryFailed(failedGroups)} disabled={busy || processing} style={button(!busy && !processing, true)}>
              [ ↻ RETRY ALL ]
            </button>
            <button onClick={() => void removeFailed('all')} disabled={busy || processing} style={danger(!busy && !processing)}>
              [ REMOVE ALL ]
            </button>
          </div>
          {failedGroups.map((group) => (
            <div
              key={group[0].id}
              data-testid="failed-file"
              style={{
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0',
                borderTop: `1px solid ${borderColor}`,
              }}
            >
              <div style={{ flex: '1 1 240px', fontSize: '0.75rem' }}>
                <div style={{ fontWeight: 'bold' }}>
                  {group.length > 1 ? '🔗 ' : ''}
                  {group.map((f) => f.fileName).join(' + ')}
                </div>
                <div style={{ color: '#ff6b6b', marginTop: '0.15rem' }}>{group[0].error}</div>
              </div>
              <div style={{ display: 'flex', gap: '0.35rem' }}>
                <button onClick={() => void retryFailed([group])} disabled={busy || processing} style={smallButton(!busy && !processing)}>
                  RETRY
                </button>
                <button onClick={() => void removeFailed([group])} disabled={busy || processing} style={{ ...smallButton(!busy && !processing), borderColor: '#ff6b6b', color: '#ff6b6b' }}>
                  REMOVE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Download and finish sit above the candidate list, so they're reachable without scrolling past every name */}
      {search.candidates.length > 0 && (
        <GenerateButton
          candidates={search.candidates.map((c) => c.data)}
          position={search.position}
          client={client}
          theme={theme}
          onGenerated={() => setDownloaded(true)}
        />
      )}

      <div style={{ ...panel, borderColor: downloaded ? '#ff6b6b' : borderColor }}>
        <div style={title}>[ FINISH ]</div>
        <div style={{ ...hint, marginBottom: '1rem' }}>
          {downloaded
            ? 'Deck downloaded. If this search is finished, delete it now so no candidate data is kept.'
            : 'When the search is done: download the deck, then delete the search. This removes all its candidate data.'}
        </div>
        <button onClick={() => void handleDelete(true)} disabled={busy || processing} style={danger(!busy && !processing)}>
          [ FINISH & DELETE SEARCH ]
        </button>
      </div>

      <div style={panel}>
        <div style={title}>[ CANDIDATES: {search.candidates.length} ]</div>
        {search.candidates.length === 0 && <div style={hint}>No candidates yet. Add the first batch of CVs above.</div>}
        {search.candidates.map((c, index) => (
          <div
            key={c.id}
            data-testid="saved-candidate"
            style={{ padding: '1rem', border: `1px solid ${borderColor}`, marginBottom: '0.75rem', background: fieldBg }}
          >
            {editingId === c.id ? (
              <CandidateEditor
                candidate={c.data}
                theme={theme}
                onCancel={() => setEditingId(null)}
                onSave={async (data) => {
                  const saved = await updateCandidate(search.id, c.id, data);
                  setCandidates(search.candidates.map((x) => (x.id === c.id ? { ...x, data: saved.data } : x)));
                  setEditingId(null);
                }}
              />
            ) : (
              <>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 'bold' }}>
                    {index + 1}. {c.data.name}
                    {c.data.extras?.some((x) => x.value) && (
                      <span style={{ fontWeight: 'normal', opacity: 0.8 }}>
                        {' '}
                        · {c.data.extras.filter((x) => x.value).map((x) => x.value).join(' · ')}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button onClick={() => void move(index, -1)} disabled={busy || index === 0} aria-label="Move up" style={smallButton(!busy && index > 0)}>
                      ↑
                    </button>
                    <button
                      onClick={() => void move(index, 1)}
                      disabled={busy || index === search.candidates.length - 1}
                      aria-label="Move down"
                      style={smallButton(!busy && index < search.candidates.length - 1)}
                    >
                      ↓
                    </button>
                    <button onClick={() => setEditingId(c.id)} disabled={busy} style={smallButton(!busy)}>
                      EDIT
                    </button>
                    <button onClick={() => void remove(c)} disabled={busy} style={{ ...smallButton(!busy), borderColor: '#ff6b6b', color: '#ff6b6b' }}>
                      REMOVE
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: '0.75rem', opacity: 0.75, marginTop: '0.5rem', lineHeight: 1.5 }}>
                  {c.data.workHistory.map((w, i) => (
                    <div key={i}>
                      • {w.jobTitle} at {w.company} {w.dates && `(${w.dates})`}
                    </div>
                  ))}
                  {c.data.education.map((e, i) => (
                    <div key={i}>
                      🎓 {e.degree ? `${e.degree}, ` : ''}
                      {e.institution} {e.dates && `(${e.dates})`}
                    </div>
                  ))}
                  {c.sourceFile && <div style={{ opacity: 0.6 }}>from {c.sourceFile}</div>}
                </div>
              </>
            )}
          </div>
        ))}
        {error && <div style={{ fontSize: '0.75rem', color: '#ff6b6b' }}>Error: {error}</div>}
      </div>

      {search.candidates.length > 0 && <ManualCopyOutput candidates={search.candidates.map((c) => c.data)} theme={theme} />}

      {bindOpen && <BindDialog entries={entries} onChange={setEntries} onClose={() => setBindOpen(false)} theme={theme} />}
    </>
  );
}

/** Group stored failed files: files bound as one candidate together, the rest one by one */
function groupFailed(files: FailedFile[]): FailedFile[][] {
  const groups = new Map<string, FailedFile[]>();
  for (const f of files) {
    const key = f.groupId ?? f.id;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  return [...groups.values()];
}

