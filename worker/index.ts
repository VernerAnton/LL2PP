// LL2PP Worker: serves the API. The React app itself is served as static assets; only /api/*
// reaches this code (see "run_worker_first" in wrangler.jsonc).
import type { ExtractRequest, ThinkingEffort } from '../src/shared/apiTypes';
import { EXTRA_FIELDS, MAX_SELECTED_EXTRAS, type ExtraFieldId } from '../src/services/extraDetails';
import { checkAccess } from './auth';
import { handleClients } from './clients';
import { handleSearches } from './searches';
import { extractCV, getModel } from './extract';
import { HttpError, json } from './http';

const MAX_CV_CHARS = 300_000;
const EFFORTS: ThinkingEffort[] = ['low', 'medium', 'high'];

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });

    const auth = await checkAccess(request, env);
    if (!auth.ok) return json({ error: auth.error }, 401);

    try {
      const parts = url.pathname.split('/').filter(Boolean).slice(1); // drop "api"
      const [resource, ...rest] = parts;

      if (resource === 'me' && request.method === 'GET') return json({ email: auth.email });
      if (resource === 'model' && request.method === 'GET') return json({ model: await getModel(env) });
      if (resource === 'extract' && request.method === 'POST') {
        return json(await extractCV(env, parseExtractRequest(await request.json())));
      }
      if (resource === 'clients') return await handleClients(request, env, rest);
      if (resource === 'searches') return await handleSearches(request, env, rest);

      throw new HttpError(404, 'Not found');
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      if (error instanceof SyntaxError) return json({ error: 'Invalid request body' }, 400);
      console.error('Unhandled API error:', error);
      return json({ error: 'Server error' }, 500);
    }
  },
} satisfies ExportedHandler<Env>;

function parseExtractRequest(body: unknown): ExtractRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.cvText !== 'string' || !b.cvText.trim()) throw new HttpError(400, 'cvText is required');
  if (b.cvText.length > MAX_CV_CHARS) throw new HttpError(400, 'CV text is too long');
  if (!EFFORTS.includes(b.effort as ThinkingEffort)) throw new HttpError(400, 'Invalid effort');
  const ids = Array.isArray(b.extraFields) ? b.extraFields : [];
  const known = new Set(EXTRA_FIELDS.map((f) => f.id));
  if (ids.length > MAX_SELECTED_EXTRAS || !ids.every((id) => known.has(id as ExtraFieldId))) {
    throw new HttpError(400, 'Invalid extra details');
  }
  return { cvText: b.cvText, extraFields: ids as ExtraFieldId[], effort: b.effort as ThinkingEffort };
}
