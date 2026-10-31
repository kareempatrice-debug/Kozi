// Reading calendar links from Airbnb and Booking.com (the iCal format both sites use for “Export calendar”).
export function parseIcs(text) {
  const raw = String(text || '').replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  const events = []; let cur = null;
  const val = l => l.slice(l.indexOf(':') + 1).trim();
  const toIso = v => { const m = /^(\d{4})(\d{2})(\d{2})/.exec(v || ''); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; };
  for (const l of raw) {
    if (l === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (l === 'END:VEVENT') { if (cur) { if (!cur.end && cur.start) cur.end = new Date(Date.parse(cur.start + 'T12:00:00Z') + 864e5).toISOString().slice(0, 10); events.push(cur); } cur = null; continue; }
    if (!cur) continue;
    const key = l.split(/[;:]/)[0].toUpperCase();
    if (key === 'UID') cur.uid = val(l);
    else if (key === 'SUMMARY') cur.summary = val(l);
    else if (key === 'DESCRIPTION') cur.description = val(l).replace(/\\n/g, '\n').replace(/\\,/g, ',');
    else if (key === 'DTSTART') cur.start = toIso(val(l));
    else if (key === 'DTEND') cur.end = toIso(val(l));
    else if (key === 'STATUS') cur.status = val(l);
  }
  return events.filter(e => (e.status || '').toUpperCase() !== 'CANCELLED');
}
/** Fetch every calendar link set on the units. A link that fails is reported, and nothing is cancelled because of it. */
export async function fetchChannelFeeds(db) {
  const jobs = [];
  for (const u of db.units || []) {
    const ch = u.channels || {};
    for (const [k, source] of [['airbnb', 'Airbnb'], ['booking', 'Booking.com']]) {
      if (!ch[k]) continue;
      jobs.push((async () => {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 12000);
        try {
          const r = await fetch(ch[k], { signal: ctl.signal, headers: { 'user-agent': 'NV-Ops-Calendar-Sync/1.0' } });
          if (!r.ok) return { unitId: u.id, source, ok: false, error: 'The site answered ' + r.status + '. Check the link.' };
          const text = await r.text(); if (text.length > 3e6) return { unitId: u.id, source, ok: false, error: 'The calendar is too large.' };
          if (!/BEGIN:VCALENDAR/.test(text)) return { unitId: u.id, source, ok: false, error: 'That link is not a calendar (iCal) link.' };
          return { unitId: u.id, source, ok: true, events: parseIcs(text) };
        } catch (e) { return { unitId: u.id, source, ok: false, error: e.name === 'AbortError' ? 'The site took too long to answer.' : 'Could not reach the site.' }; }
        finally { clearTimeout(t); }
      })());
    }
  }
  return Promise.all(jobs);
}
