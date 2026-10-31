// Sends notifications to phones that have switched them on.
import webpush from 'web-push';

export async function sendToSubs(db, subs, payload, keys) {
  webpush.setVapidDetails('mailto:Transislandtruckingsvg@outlook.com', keys.publicKey, keys.privateKey);
  let sent = 0; const dead = [];
  for (const s of subs) {
    try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload), { TTL: 86400 }); sent++; }
    catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) dead.push(s.endpoint); else console.error('push failed', e && e.statusCode, e && e.body); }
  }
  return { sent, dead };
}

export async function sendToUser(db, userId, payload, keys) {
  const subs = (db.pushSubs || []).filter(s => s.userId === userId);
  const r = await sendToSubs(db, subs, payload, keys);
  return r.sent;
}
