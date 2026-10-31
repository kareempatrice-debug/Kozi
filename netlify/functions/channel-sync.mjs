// Every 30 minutes: release website bookings not paid in time, and read each unit's Airbnb and Booking.com calendars.
import { getStore } from '@netlify/blobs';
import { normalise, applyChannelFeeds, releaseHolds } from '../lib/core.mjs';
import { fetchChannelFeeds } from '../lib/channels.mjs';

export default async () => {
  const store = getStore({ name: 'nv-data', consistency: 'strong' });
  const first = await store.getWithMetadata('db', { type: 'json' });
  if (!first) return new Response('No data yet.');
  const db0 = normalise(first.data);
  const linked = (db0.units || []).some(u => u.channels && (u.channels.airbnb || u.channels.booking));
  const feeds = linked ? await fetchChannelFeeds(db0) : [];
  for (let i = 0; i < 5; i++) {
    const cur = await store.getWithMetadata('db', { type: 'json' });
    const db = normalise(cur.data); const released = releaseHolds(db); const sum = linked ? applyChannelFeeds(db, null, feeds) : { released };
    if (!linked && !released) return new Response('Nothing to do.');
    const w = await store.setJSON('db', db, { onlyIfMatch: cur.etag });
    if (!w || w.modified !== false) return new Response(JSON.stringify(sum));
    await new Promise(r => setTimeout(r, 200 + Math.random() * 300));
  }
  return new Response('Busy, will try again next time.', { status: 503 });
};
export const config = { schedule: '*/30 * * * *' };
