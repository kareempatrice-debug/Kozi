// On the 7th of January, April, July and October (8am St Vincent time): emails the quarter just ended.
// Labelled Final when every month in it is closed in Business Settings, otherwise Provisional.
import { getStore } from '@netlify/blobs';
import { normalise } from '../lib/core.mjs';
import { emailReport, lastQuarter } from '../lib/reports.mjs';
import { mailConfigured } from '../lib/mail.mjs';

export default async () => {
  const res = await getStore({ name: 'nv-data', consistency: 'strong' }).get('db', { type: 'json' });
  if (!res) return new Response('No records.');
  const db = normalise(res);
  if (db.settings.quarterlyReports === false) return new Response('Quarterly reports switched off.');
  if (!mailConfigured()) { console.log('Quarterly report skipped: email not set up.'); return new Response('Email not set up.'); }
  const q = lastQuarter();
  const r = await emailReport(db, q, db.settings.reportEmails);
  return new Response(q.label + ' report emailed (' + r.status + ').');
};

export const config = { schedule: '0 12 7 1,4,7,10 *' };
