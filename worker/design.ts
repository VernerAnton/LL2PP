// The slide design: one JSON document in D1, uploaded backgrounds in R2.
import { BUILT_IN_DESIGN, SLIDE_KINDS, validateDesign, type SlideDesign, type SlideKind } from '../src/shared/design';
import { HttpError, json } from './http';

const MAX_BACKGROUND_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg'];
/** In a save request, marks a background whose new image is attached as a file field named after the slide */
export const NEW_BACKGROUND = -1;

const backgroundKey = (kind: SlideKind) => `design/${kind}`;

async function loadDesign(env: Env): Promise<SlideDesign> {
  const row = await env.DB.prepare('SELECT data FROM design WHERE id = 1').first<{ data: string }>();
  return row ? (JSON.parse(row.data) as SlideDesign) : BUILT_IN_DESIGN;
}

export async function handleDesign(request: Request, env: Env, parts: string[]): Promise<Response> {
  const method = request.method;
  const [sub, kind] = parts;

  // /api/design/background/:kind
  if (sub === 'background') {
    if (method !== 'GET' || !SLIDE_KINDS.includes(kind as SlideKind)) throw new HttpError(404, 'Not found');
    const object = await env.FILES.get(backgroundKey(kind as SlideKind));
    if (!object) throw new HttpError(404, 'No custom background');
    return new Response(object.body, {
      headers: {
        'content-type': object.httpMetadata?.contentType ?? 'image/png',
        // URLs carry ?v=<version>, so a replaced background always gets a new URL
        'cache-control': 'private, max-age=31536000, immutable',
      },
    });
  }
  if (sub) throw new HttpError(404, 'Not found');

  // /api/design
  if (method === 'GET') return json(await loadDesign(env));

  if (method === 'DELETE') {
    // Back to the built-in design
    await env.FILES.delete(SLIDE_KINDS.map(backgroundKey));
    await env.DB.prepare('DELETE FROM design WHERE id = 1').run();
    return json(BUILT_IN_DESIGN);
  }

  if (method === 'PUT') {
    // multipart: "design" (JSON) plus a file field per slide whose background is NEW_BACKGROUND
    const current = await loadDesign(env);
    const form = await request.formData();
    let next: SlideDesign;
    try {
      next = JSON.parse(String(form.get('design'))) as SlideDesign;
    } catch {
      throw new HttpError(400, 'Invalid design');
    }
    if (!next || typeof next !== 'object' || !next.backgrounds) throw new HttpError(400, 'Invalid design');

    const uploads: { kind: SlideKind; file: File }[] = [];
    const backgrounds = { ...next.backgrounds };
    for (const kind of SLIDE_KINDS) {
      const value = backgrounds[kind];
      if (value === NEW_BACKGROUND) {
        const file = form.get(kind);
        if (!(file instanceof File) || !IMAGE_TYPES.includes(file.type)) {
          throw new HttpError(400, `The ${kind} slide background must be a PNG or JPG`);
        }
        if (file.size > MAX_BACKGROUND_BYTES) throw new HttpError(400, `The ${kind} slide background is too large (max 10 MB)`);
        uploads.push({ kind, file });
        backgrounds[kind] = Date.now() + uploads.length; // new version number
      } else if (value !== null && value !== current.backgrounds[kind]) {
        throw new HttpError(400, `The ${kind} slide background changed in the meantime; reload the page`);
      }
    }
    next = {
      size: next.size,
      backgrounds,
      firstSlide: next.firstSlide,
      contentSlide: next.contentSlide,
    };
    const problem = validateDesign(next);
    if (problem) throw new HttpError(400, problem);

    for (const { kind, file } of uploads) {
      await env.FILES.put(backgroundKey(kind), file.stream(), { httpMetadata: { contentType: file.type } });
    }
    // Backgrounds switched back to built-in: remove the uploaded image
    const dropped = SLIDE_KINDS.filter((k) => next.backgrounds[k] === null && current.backgrounds[k] !== null);
    if (dropped.length) await env.FILES.delete(dropped.map(backgroundKey));

    await env.DB.prepare(
      "INSERT INTO design (id, data, updated_at) VALUES (1, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at"
    ).bind(JSON.stringify(next)).run();
    return json(next);
  }

  throw new HttpError(405, 'Method not allowed');
}
