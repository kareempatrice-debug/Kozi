// Emails the monthly business summary on the 1st of each month, 8am St Vincent time, to the report recipients.
import { getStore } from '@netlify/blobs';
import { normalise } from '../lib/core.mjs';
import { emailSummary } from '../lib/reports.mjs';
import { mailConfigured } from '../lib/mail.mjs';

export default async () => {
  const res = await getStore({ name: 'nv-data', consistency: 'strong' }).get('db', { type: 'json' });
  if (!res) return new Response('No records.');
  const db = normalise(res);
  if (db.settings.monthlyEmail === false) return new Response('monthly email switched off.');
  if (!mailConfigured() || !db.settings.reportEmails) { console.log('monthly email skipped: email not set up.'); return new Response('Email not set up.'); }
  const r = await emailSummary(db, 'monthly', db.settings.reportEmails);
  return new Response('monthly report emailed for ' + r.label);
};

export const config = { schedule: '0 12 1 * *' };
