// On 1 January (8am St Vincent time): emails last year's year-end pack (PDF + spreadsheet)
// to the addresses in Business settings.
import { getStore } from '@netlify/blobs';
import { normalise } from '../lib/core.mjs';
import { emailYearEnd } from '../lib/reports.mjs';
import { mailConfigured } from '../lib/mail.mjs';

export default async () => {
  if (!mailConfigured()) { console.log('Year-end pack skipped: email not set up.'); return new Response('Email not set up.'); }
  const res = await getStore({ name: 'nv-data', consistency: 'strong' }).get('db', { type: 'json' });
  if (!res) return new Response('No records.');
  const db = normalise(res);
  if (db.settings.annualReports === false) return new Response('Annual report switched off.');
  const year = new Date().getUTCFullYear() - 1;
  await emailYearEnd(db, year, db.settings.reportEmails);
  return new Response('Year-end pack for ' + year + ' emailed.');
};

export const config = { schedule: '0 12 1 1 *' };
