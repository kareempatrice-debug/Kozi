// Emails the weekly business summary on Monday 8am St Vincent time, to the report recipients.
import { getStore } from '@netlify/blobs';
import { normalise } from '../lib/core.mjs';
import { emailSummary } from '../lib/reports.mjs';
import { mailConfigured } from '../lib/mail.mjs';

export default async () => {
  const res = await getStore({ name: 'nv-data', consistency: 'strong' }).get('db', { type: 'json' });
  if (!res) return new Response('No records.');
  const db = normalise(res);
  if (db.settings.weeklyEmail === false) return new Response('weekly email switched off.');
  if (!mailConfigured() || !db.settings.reportEmails) { console.log('weekly email skipped: email not set up.'); return new Response('Email not set up.'); }
  const r = await emailSummary(db, 'weekly', db.settings.reportEmails);
  return new Response('weekly report emailed for ' + r.label);
};

export const config = { schedule: '0 12 * * 1' };
