// LL2PP Worker: serves the API. The React app itself is served as static assets; only /api/*
// reaches this code (see "run_worker_first" in wrangler.jsonc).
import type { CvInput, ExtractRequest, ThinkingEffort } from '../src/shared/apiTypes';
import { EXTRA_FIELDS, MAX_SELECTED_EXTRAS, type ExtraFieldId } from '../src/services/extraDetails';
import { checkAccess } from './auth';
import { handleClients } from './clients';
import { handleSearches } from './searches';
import { handleDesign } from './design';
import { extractCV, getModel } from './extract';
import { HttpError, json } from './http';

const MAX_CV_CHARS = 300_000;
// 15 MB of PDF, base64-encoded (Claude accepts up to 32 MB per request)
const MAX_PDF_BASE64_CHARS = Math.ceil((15 * 1024 * 1024 * 4) / 3);
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
      if (resource === 'design') return await handleDesign(request, env, rest);

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
  let cv: CvInput;
  if (typeof b.cvText === 'string' && b.cvText.trim()) {
    if (b.cvText.length > MAX_CV_CHARS) throw new HttpError(400, 'CV text is too long');
    cv = { cvText: b.cvText };
  } else if (typeof b.cvPdfBase64 === 'string' && b.cvPdfBase64) {
    // Scanned CV: the PDF goes to Claude, which reads the pages as images
    if (b.cvPdfBase64.length > MAX_PDF_BASE64_CHARS) throw new HttpError(400, 'The PDF is too large (max 15 MB)');
    if (!b.cvPdfBase64.startsWith('JVBERi')) throw new HttpError(400, 'That file is not a PDF'); // "%PDF" in base64
    cv = { cvPdfBase64: b.cvPdfBase64 };
  } else {
    throw new HttpError(400, 'No CV text or PDF was sent');
  }
  if (!EFFORTS.includes(b.effort as ThinkingEffort)) throw new HttpError(400, 'Invalid effort');
  const ids = Array.isArray(b.extraFields) ? b.extraFields : [];
  const known = new Set(EXTRA_FIELDS.map((f) => f.id));
  if (ids.length > MAX_SELECTED_EXTRAS || !ids.every((id) => known.has(id as ExtraFieldId))) {
    throw new HttpError(400, 'Invalid extra details');
  }
  return { ...cv, extraFields: ids as ExtraFieldId[], effort: b.effort as ThinkingEffort };
}
