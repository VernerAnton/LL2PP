// Saved searches and their candidates (extracted data only). Deleting a search removes everything.
import type { CandidateData, ExtraDetail } from '../src/types';
import type { SavedCandidate, SearchDetail, SearchSummary } from '../src/shared/apiTypes';
import { EXTRA_FIELDS, MAX_SELECTED_EXTRAS, type ExtraFieldId } from '../src/services/extraDetails';
import { HttpError, json } from './http';

interface SearchRow {
  id: string;
  name: string;
  client_id: string | null;
  position: string;
  extra_fields: string;
  created_at: string;
  updated_at: string;
  candidate_count?: number;
}

interface CandidateRow {
  id: string;
  data: string;
  source_file: string;
}

const MAX_CANDIDATES_PER_REQUEST = 50;

function toSummary(row: SearchRow): SearchSummary {
  return {
    id: row.id,
    name: row.name,
    clientId: row.client_id,
    position: row.position,
    extraFields: JSON.parse(row.extra_fields) as ExtraFieldId[],
    candidateCount: row.candidate_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getSearchRow(env: Env, id: string): Promise<SearchRow> {
  const row = await env.DB.prepare(
    `SELECT s.*, (SELECT COUNT(*) FROM candidates c WHERE c.search_id = s.id) AS candidate_count
       FROM searches s WHERE s.id = ?`
  ).bind(id).first<SearchRow>();
  if (!row) throw new HttpError(404, 'Search not found');
  return row;
}

async function getDetail(env: Env, id: string): Promise<SearchDetail> {
  const row = await getSearchRow(env, id);
  const { results } = await env.DB.prepare(
    'SELECT id, data, source_file FROM candidates WHERE search_id = ? ORDER BY sort_order, created_at'
  ).bind(id).all<CandidateRow>();
  const candidates: SavedCandidate[] = results.map((c) => ({
    id: c.id,
    data: JSON.parse(c.data) as CandidateData,
    sourceFile: c.source_file,
  }));
  return { ...toSummary(row), candidates };
}

const touch = (env: Env, id: string) =>
  env.DB.prepare("UPDATE searches SET updated_at = datetime('now') WHERE id = ?").bind(id);

// --- validation ------------------------------------------------------------------------------

function text(value: unknown, field: string, max: number, required = false): string {
  if (value === undefined || value === null) {
    if (required) throw new HttpError(400, `${field} is required`);
    return '';
  }
  if (typeof value !== 'string') throw new HttpError(400, `${field} must be text`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpError(400, `${field} is required`);
  if (trimmed.length > max) throw new HttpError(400, `${field} is too long`);
  return trimmed;
}

const optionalText = (value: unknown, field: string, max: number) => text(value, field, max) || undefined;

function list(value: unknown, field: string, max: number): unknown[] {
  if (!Array.isArray(value)) throw new HttpError(400, `${field} must be a list`);
  if (value.length > max) throw new HttpError(400, `Too many ${field} entries`);
  return value;
}

/** Keep exactly the extracted fields; anything else (such as CV text) is dropped */
function cleanCandidate(value: unknown): CandidateData {
  const v = (value ?? {}) as Record<string, unknown>;
  const workHistory = list(v.workHistory, 'work history', 15).map((w) => {
    const e = (w ?? {}) as Record<string, unknown>;
    return {
      company: text(e.company, 'Company', 300, true),
      jobTitle: text(e.jobTitle, 'Job title', 300, true),
      dates: optionalText(e.dates, 'Dates', 100),
    };
  });
  const education = list(v.education, 'education', 15).map((d) => {
    const e = (d ?? {}) as Record<string, unknown>;
    return {
      institution: text(e.institution, 'Institution', 300, true),
      degree: optionalText(e.degree, 'Degree', 300),
      dates: optionalText(e.dates, 'Dates', 100),
    };
  });
  const extras: ExtraDetail[] | undefined =
    v.extras === undefined
      ? undefined
      : list(v.extras, 'extra details', MAX_SELECTED_EXTRAS).map((x) => {
          const e = (x ?? {}) as Record<string, unknown>;
          return { label: text(e.label, 'Label', 100, true), value: text(e.value, 'Value', 200) };
        });
  return {
    name: text(v.name, 'Name', 200, true),
    workHistory,
    education,
    ...(extras ? { extras } : {}),
  };
}

function cleanExtraFields(value: unknown): ExtraFieldId[] {
  const ids = value === undefined ? [] : list(value, 'extra details', MAX_SELECTED_EXTRAS);
  const known = new Set<string>(EXTRA_FIELDS.map((f) => f.id));
  if (!ids.every((id) => typeof id === 'string' && known.has(id))) throw new HttpError(400, 'Invalid extra details');
  return [...new Set(ids as ExtraFieldId[])];
}

async function cleanClientId(env: Env, value: unknown): Promise<string | null> {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string') throw new HttpError(400, 'Invalid client');
  const exists = await env.DB.prepare('SELECT 1 FROM clients WHERE id = ?').bind(value).first();
  if (!exists) throw new HttpError(400, 'Client not found');
  return value;
}

// --- routes ----------------------------------------------------------------------------------

export async function handleSearches(request: Request, env: Env, parts: string[]): Promise<Response> {
  const method = request.method;
  const [id, sub, candidateId] = parts;

  // /api/searches
  if (!id) {
    if (method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT s.*, (SELECT COUNT(*) FROM candidates c WHERE c.search_id = s.id) AS candidate_count
           FROM searches s ORDER BY s.updated_at DESC`
      ).all<SearchRow>();
      return json(results.map(toSummary));
    }
    if (method === 'POST') {
      const body = await request.json<Record<string, unknown>>();
      const newId = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO searches (id, name, client_id, position, extra_fields) VALUES (?, ?, ?, ?, ?)')
        .bind(
          newId,
          text(body.name, 'Search name', 200, true),
          await cleanClientId(env, body.clientId),
          text(body.position, 'Position', 200),
          JSON.stringify(cleanExtraFields(body.extraFields))
        )
        .run();
      return json(await getDetail(env, newId), 201);
    }
    throw new HttpError(405, 'Method not allowed');
  }

  // /api/searches/:id
  if (!sub) {
    if (method === 'GET') return json(await getDetail(env, id));
    if (method === 'PATCH') {
      await getSearchRow(env, id);
      const body = await request.json<Record<string, unknown>>();
      const updates: D1PreparedStatement[] = [];
      if (body.name !== undefined) {
        updates.push(env.DB.prepare('UPDATE searches SET name = ? WHERE id = ?').bind(text(body.name, 'Search name', 200, true), id));
      }
      if (body.position !== undefined) {
        updates.push(env.DB.prepare('UPDATE searches SET position = ? WHERE id = ?').bind(text(body.position, 'Position', 200), id));
      }
      if (body.clientId !== undefined) {
        updates.push(env.DB.prepare('UPDATE searches SET client_id = ? WHERE id = ?').bind(await cleanClientId(env, body.clientId), id));
      }
      // Extra details are fixed at creation, so every candidate in a search has the same ones
      if (body.extraFields !== undefined) throw new HttpError(400, 'Extra details cannot be changed after creating a search');
      if (updates.length) await env.DB.batch([...updates, touch(env, id)]);
      return json(await getDetail(env, id));
    }
    if (method === 'DELETE') {
      await getSearchRow(env, id);
      await env.DB.batch([
        env.DB.prepare('DELETE FROM candidates WHERE search_id = ?').bind(id),
        env.DB.prepare('DELETE FROM searches WHERE id = ?').bind(id),
      ]);
      return json({ deleted: true });
    }
    throw new HttpError(405, 'Method not allowed');
  }

  // /api/searches/:id/order  { ids: [...] }
  if (sub === 'order' && !candidateId) {
    if (method !== 'PUT') throw new HttpError(405, 'Method not allowed');
    const detail = await getDetail(env, id);
    const body = await request.json<{ ids?: unknown }>();
    const ids = list(body.ids, 'order', 10_000);
    const current = new Set(detail.candidates.map((c) => c.id));
    if (ids.length !== current.size || !ids.every((cid) => typeof cid === 'string' && current.has(cid))) {
      throw new HttpError(400, 'The order must list every candidate of the search once');
    }
    await env.DB.batch([
      ...ids.map((cid, index) =>
        env.DB.prepare('UPDATE candidates SET sort_order = ? WHERE id = ? AND search_id = ?').bind(index, cid, id)
      ),
      touch(env, id),
    ]);
    return json(await getDetail(env, id));
  }

  if (sub !== 'candidates') throw new HttpError(404, 'Not found');

  // /api/searches/:id/candidates  { candidates: [{ data, sourceFile }] }
  if (!candidateId) {
    if (method !== 'POST') throw new HttpError(405, 'Method not allowed');
    await getSearchRow(env, id);
    const body = await request.json<{ candidates?: unknown }>();
    const incoming = list(body.candidates, 'candidates', MAX_CANDIDATES_PER_REQUEST).map((c) => {
      const e = (c ?? {}) as Record<string, unknown>;
      return { data: cleanCandidate(e.data), sourceFile: text(e.sourceFile, 'File name', 300) };
    });
    const max = await env.DB.prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM candidates WHERE search_id = ?')
      .bind(id).first<{ m: number }>();
    let next = (max?.m ?? -1) + 1;
    const created: SavedCandidate[] = [];
    const statements = incoming.map((c) => {
      const newId = crypto.randomUUID();
      created.push({ id: newId, data: c.data, sourceFile: c.sourceFile });
      return env.DB.prepare('INSERT INTO candidates (id, search_id, sort_order, data, source_file) VALUES (?, ?, ?, ?, ?)')
        .bind(newId, id, next++, JSON.stringify(c.data), c.sourceFile);
    });
    if (statements.length) await env.DB.batch([...statements, touch(env, id)]);
    return json(created, 201);
  }

  // /api/searches/:id/candidates/:candidateId
  const exists = await env.DB.prepare('SELECT 1 FROM candidates WHERE id = ? AND search_id = ?').bind(candidateId, id).first();
  if (!exists) throw new HttpError(404, 'Candidate not found');
  if (method === 'PATCH') {
    const body = await request.json<{ data?: unknown }>();
    const data = cleanCandidate(body.data);
    await env.DB.batch([
      env.DB.prepare('UPDATE candidates SET data = ? WHERE id = ?').bind(JSON.stringify(data), candidateId),
      touch(env, id),
    ]);
    return json({ id: candidateId, data });
  }
  if (method === 'DELETE') {
    await env.DB.batch([env.DB.prepare('DELETE FROM candidates WHERE id = ?').bind(candidateId), touch(env, id)]);
    return json({ deleted: true });
  }
  throw new HttpError(405, 'Method not allowed');
}
