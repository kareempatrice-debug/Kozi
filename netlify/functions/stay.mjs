// The website's booking panel: what is free, reserve and hold, and "I have paid".
import { getStore } from '@netlify/blobs';
import { normalise, publicAvailability, publicBook, publicPaid, AppError } from '../lib/core.mjs';

export default async (req) => {
  const origin = req.headers.get('origin') || '';
  const allow = (process.env.SITE_ORIGIN || '').split(',').map(s => s.trim().replace(/\/$/, '')).filter(Boolean);
  const cors = { 'access-control-allow-origin': !allow.length ? '*' : allow.includes(origin) ? origin : allow[0], 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' };
  const json = (o, status) => new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ 'content-type': 'application/json', 'cache-control': 'no-store' }, cors) });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ ok: false, error: 'Use POST.' }, 405);
  if (allow.length && origin && !allow.includes(origin)) return json({ ok: false, error: 'Not allowed.' }, 403);
  let body; try { const t = await req.text(); if (t.length > 8000) return json({ ok: false, error: 'Too long.' }, 413); body = JSON.parse(t); } catch (e) { return json({ ok: false, error: 'Bad request.' }, 400); }
  const fn = { availability: publicAvailability, book: publicBook, paid: publicPaid }[body.action];
  if (!fn) return json({ ok: false, error: 'Unknown request.' }, 400);
  const store = getStore({ name: 'nv-data', consistency: 'strong' });
  try {
    for (let i = 0; i < 6; i++) {
      const cur = await store.getWithMetadata('db', { type: 'json' });
      if (!cur) return json({ ok: false, error: 'Not ready.' }, 503);
      const db = normalise(cur.data); const result = fn(db, body);
      const w = await store.setJSON('db', db, { onlyIfMatch: cur.etag });
      if (!w || w.modified !== false) return json(Object.assign({ ok: true }, result));
      await new Promise(r => setTimeout(r, 120 + Math.random() * 200));
    }
    return json({ ok: false, error: 'Busy. Please try again.' }, 503);
  } catch (e) {
    return json({ ok: false, error: e instanceof AppError ? e.message : 'Something went wrong.' }, e instanceof AppError ? e.status : 500);
  }
};
export const config = { path: '/stay' };
