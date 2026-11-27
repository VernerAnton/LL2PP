// LL2PP Worker: serves the API. The React app itself is served as static assets; only /api/*
// reaches this code (see "run_worker_first" in wrangler.jsonc).
import { MAX_DOCUMENTS_PER_CANDIDATE, type CvDocument, type ExtractRequest, type ThinkingEffort } from '../src/shared/apiTypes';
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
  // Older open tabs send a single cvText / cvPdfBase64; current ones send documents[]
  const raw: unknown[] = Array.isArray(b.documents)
    ? b.documents
    : typeof b.cvText === 'string'
      ? [{ text: b.cvText }]
      : typeof b.cvPdfBase64 === 'string'
        ? [{ pdfBase64: b.cvPdfBase64 }]
        : [];
  if (raw.length === 0) throw new HttpError(400, 'No CV text or PDF was sent');
  if (raw.length > MAX_DOCUMENTS_PER_CANDIDATE) throw new HttpError(400, `At most ${MAX_DOCUMENTS_PER_CANDIDATE} documents per candidate`);
  let textChars = 0;
  let pdfChars = 0;
  const documents: CvDocument[] = raw.map((d) => {
    const doc = (d ?? {}) as Record<string, unknown>;
    if (typeof doc.text === 'string' && doc.text.trim()) {
      textChars += doc.text.length;
      return { text: doc.text };
    }
    if (typeof doc.pdfBase64 === 'string' && doc.pdfBase64) {
      // Scanned CV: the PDF goes to Claude, which reads the pages as images
      if (!doc.pdfBase64.startsWith('JVBERi')) throw new HttpError(400, 'That file is not a PDF'); // "%PDF" in base64
      pdfChars += doc.pdfBase64.length;
      return { pdfBase64: doc.pdfBase64 };
    }
    throw new HttpError(400, 'A document has no text and no PDF');
  });
  if (textChars > MAX_CV_CHARS) throw new HttpError(400, 'CV text is too long');
  if (pdfChars > MAX_PDF_BASE64_CHARS) throw new HttpError(400, 'The PDFs are too large (max 15 MB together)');
  if (!EFFORTS.includes(b.effort as ThinkingEffort)) throw new HttpError(400, 'Invalid effort');
  const ids = Array.isArray(b.extraFields) ? b.extraFields : [];
  const known = new Set(EXTRA_FIELDS.map((f) => f.id));
  if (ids.length > MAX_SELECTED_EXTRAS || !ids.every((id) => known.has(id as ExtraFieldId))) {
    throw new HttpError(400, 'Invalid extra details');
  }
  return { documents, extraFields: ids as ExtraFieldId[], effort: b.effort as ThinkingEffort };
}
