// Runs every morning (8am St Vincent time) and sends phone notifications:
// invoices that became overdue, truck and machine servicing, tomorrow's bookings, bins to collect,
// project stages, retention, late deliveries and budget overruns,
// and a summary of last week on Mondays.
import { getStore } from '@netlify/blobs';
import { normalise } from '../lib/core.mjs';
import { sendToSubs } from '../lib/push.mjs';
import { buildAlerts } from '../lib/alerts.mjs';

export default async () => {
  const data = getStore({ name: 'nv-data', consistency: 'strong' });
  const cfg = getStore({ name: 'nv-config', consistency: 'strong' });
  const res = await data.getWithMetadata('db', { type: 'json' });
  const keys = await cfg.get('vapid', { type: 'json' });
  if (!res || !keys) return new Response('Nothing to send.');
  const db = normalise(res.data);
  if (!db.pushSubs.length) return new Response('No devices signed up.');
  // "Today" in St Vincent (UTC-4)
  const today = new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10);
  let total = 0; const dead = [];
  for (const user of db.users.filter(u => u.active !== false)) {
    const subs = db.pushSubs.filter(s => s.userId === user.id);
    if (!subs.length) continue;
    const np = user.notify || {}, map = { overdue: 'collections', reminders: 'maintenance', bookings: 'bookings', bins: 'bookings', projects: 'collections', weekly: 'summary', monthly: 'summary' }, freq = np.summaryFreq || 'weekly';
    const msgs = buildAlerts(db, user, today).filter(m => np[map[m.kind]] !== false)
      .filter(m => (m.kind !== 'weekly' || freq !== 'monthly') && (m.kind !== 'monthly' || freq === 'monthly' || freq === 'both'));
    for (const m of msgs) {
      const r = await sendToSubs(db, subs.filter(s => (s.prefs || {})[m.kind] !== false), m, keys);
      total += r.sent; dead.push(...r.dead);
    }
  }
  if (dead.length) {
    // Remove phones that have switched notifications off or been reset.
    for (let i = 0; i < 3; i++) {
      const cur = await data.getWithMetadata('db', { type: 'json' });
      const d2 = normalise(cur.data); d2.pushSubs = d2.pushSubs.filter(s => !dead.includes(s.endpoint));
      const w = await data.setJSON('db', d2, { onlyIfMatch: cur.etag });
      if (!w || w.modified !== false) break;
    }
  }
  return new Response('Sent ' + total + ' notifications.');
};

export const config = { schedule: '0 12 * * *' };
