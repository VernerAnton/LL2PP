// Clients and their logos. Logo images live in R2; crop and placement live in D1.
import type { Client, LogoMeta, PixelRect, SlideBox } from '../src/shared/apiTypes';
import { json, HttpError } from './http';

interface ClientRow {
  id: string;
  name: string;
  has_logo: number;
  logo_version: number;
  logo_width_px: number | null;
  logo_height_px: number | null;
  crop: string | null;
  placement: string | null;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const originalKey = (id: string) => `logos/${id}/original`;
const logoKey = (id: string) => `logos/${id}/logo.png`;

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    hasLogo: row.has_logo === 1,
    logoVersion: row.logo_version,
    logoWidthPx: row.logo_width_px,
    logoHeightPx: row.logo_height_px,
    crop: row.crop ? (JSON.parse(row.crop) as PixelRect) : null,
    placement: row.placement ? (JSON.parse(row.placement) as SlideBox) : null,
  };
}

async function getRow(env: Env, id: string): Promise<ClientRow> {
  const row = await env.DB.prepare('SELECT * FROM clients WHERE id = ?').bind(id).first<ClientRow>();
  if (!row) throw new HttpError(404, 'Client not found');
  return row;
}

function cleanName(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name) throw new HttpError(400, 'Client name is required');
  if (name.length > 120) throw new HttpError(400, 'Client name is too long');
  return name;
}

function isFiniteBox(value: unknown): value is { x: number; y: number; w: number; h: number } {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return ['x', 'y', 'w', 'h'].every((k) => typeof v[k] === 'number' && Number.isFinite(v[k] as number));
}

function checkPlacement(value: unknown): SlideBox {
  if (!isFiniteBox(value) || value.w <= 0 || value.h <= 0) throw new HttpError(400, 'Invalid logo placement');
  return { x: value.x, y: value.y, w: value.w, h: value.h };
}

export async function handleClients(request: Request, env: Env, parts: string[]): Promise<Response> {
  const method = request.method;
  const [id, sub, subsub] = parts;

  // /api/clients
  if (!id) {
    if (method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM clients ORDER BY name COLLATE NOCASE').all<ClientRow>();
      return json(results.map(toClient));
    }
    if (method === 'POST') {
      const body = await request.json<{ name?: unknown }>();
      const newId = crypto.randomUUID();
      await env.DB.prepare('INSERT INTO clients (id, name) VALUES (?, ?)').bind(newId, cleanName(body.name)).run();
      return json(toClient(await getRow(env, newId)), 201);
    }
    throw new HttpError(405, 'Method not allowed');
  }

  // /api/clients/:id
  if (!sub) {
    if (method === 'GET') return json(toClient(await getRow(env, id)));
    if (method === 'PATCH') {
      await getRow(env, id);
      const body = await request.json<{ name?: unknown; placement?: unknown }>();
      if (body.name !== undefined) {
        await env.DB.prepare("UPDATE clients SET name = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(cleanName(body.name), id).run();
      }
      if (body.placement !== undefined) {
        await env.DB.prepare("UPDATE clients SET placement = ?, updated_at = datetime('now') WHERE id = ?")
          .bind(JSON.stringify(checkPlacement(body.placement)), id).run();
      }
      return json(toClient(await getRow(env, id)));
    }
    if (method === 'DELETE') {
      await getRow(env, id);
      await env.FILES.delete([originalKey(id), logoKey(id)]);
      // Searches for this client keep going, just without a logo
      await env.DB.batch([
        env.DB.prepare('UPDATE searches SET client_id = NULL WHERE client_id = ?').bind(id),
        env.DB.prepare('DELETE FROM clients WHERE id = ?').bind(id),
      ]);
      return json({ deleted: true });
    }
    throw new HttpError(405, 'Method not allowed');
  }

  if (sub !== 'logo') throw new HttpError(404, 'Not found');

  // /api/clients/:id/logo/original
  if (subsub === 'original') {
    if (method !== 'GET') throw new HttpError(405, 'Method not allowed');
    return serveObject(env, originalKey(id));
  }
  if (subsub) throw new HttpError(404, 'Not found');

  // /api/clients/:id/logo
  if (method === 'GET') return serveObject(env, logoKey(id));

  if (method === 'PUT') {
    // multipart: logo (cropped PNG, required), original (optional: only on a new upload), meta (JSON)
    const row = await getRow(env, id);
    const form = await request.formData();
    const logo = form.get('logo');
    const original = form.get('original');
    const metaRaw = form.get('meta');
    if (!(logo instanceof File) || logo.type !== 'image/png') throw new HttpError(400, 'The cropped logo must be a PNG');
    if (logo.size > MAX_IMAGE_BYTES) throw new HttpError(400, 'Logo is too large (max 5 MB)');
    if (original !== null) {
      if (!(original instanceof File) || !IMAGE_TYPES.includes(original.type)) {
        throw new HttpError(400, 'The logo must be a PNG, JPG or WebP image');
      }
      if (original.size > MAX_IMAGE_BYTES) throw new HttpError(400, 'Logo is too large (max 5 MB)');
    } else if (row.has_logo !== 1) {
      throw new HttpError(400, 'Upload the original logo image first');
    }
    let meta: LogoMeta;
    try {
      meta = JSON.parse(typeof metaRaw === 'string' ? metaRaw : '') as LogoMeta;
    } catch {
      throw new HttpError(400, 'Invalid logo details');
    }
    if (!isFiniteBox(meta.crop) || !(meta.widthPx > 0) || !(meta.heightPx > 0)) {
      throw new HttpError(400, 'Invalid logo details');
    }
    const placement = checkPlacement(meta.placement);

    if (original instanceof File) {
      await env.FILES.put(originalKey(id), original.stream(), { httpMetadata: { contentType: original.type } });
    }
    await env.FILES.put(logoKey(id), logo.stream(), { httpMetadata: { contentType: 'image/png' } });
    await env.DB.prepare(
      `UPDATE clients SET has_logo = 1, logo_version = logo_version + 1, logo_width_px = ?, logo_height_px = ?,
         crop = ?, placement = ?, updated_at = datetime('now') WHERE id = ?`
    )
      .bind(Math.round(meta.widthPx), Math.round(meta.heightPx), JSON.stringify(meta.crop), JSON.stringify(placement), id)
      .run();
    return json(toClient(await getRow(env, id)));
  }

  if (method === 'DELETE') {
    await env.FILES.delete([originalKey(id), logoKey(id)]);
    await env.DB.prepare(
      `UPDATE clients SET has_logo = 0, logo_width_px = NULL, logo_height_px = NULL, crop = NULL, placement = NULL,
         updated_at = datetime('now') WHERE id = ?`
    ).bind(id).run();
    return json(toClient(await getRow(env, id)));
  }
  throw new HttpError(405, 'Method not allowed');
}

async function serveObject(env: Env, key: string): Promise<Response> {
  const object = await env.FILES.get(key);
  if (!object) throw new HttpError(404, 'No logo');
  return new Response(object.body, {
    headers: {
      'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      // URLs carry ?v=<logoVersion>, so a changed logo always gets a new URL
      'cache-control': 'private, max-age=31536000, immutable',
    },
  });
}
