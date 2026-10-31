// On the 1st of every month (6am St Vincent time): saves "<Month Year> Back Up" for the month
// just ended into the NV Ops Backups folder in Google Drive (or emails it if Drive is not set up).
import { getStore } from '@netlify/blobs';
import { normalise } from '../lib/core.mjs';
import { monthlyBackup, monthLabel } from '../lib/reports.mjs';
import { sendMail, mailConfigured } from '../lib/mail.mjs';

export default async () => {
  const res = await getStore({ name: 'nv-data', consistency: 'strong' }).get('db', { type: 'json' });
  if (!res) return new Response('Nothing to back up yet.');
  const lastMonth = new Date(Date.now() - 2 * 86400000); // the run is on the 1st, so step back into last month
  try {
    const r = await monthlyBackup(normalise(res), monthLabel(lastMonth));
    return new Response(r.label + ' saved to ' + r.where);
  } catch (e) {
    console.error('Monthly backup failed:', e.message);
    const db = normalise(res);
    if (db.settings.backupAlerts !== false && mailConfigured() && db.settings.backupEmails) {
      try { await sendMail({ to: db.settings.backupEmails, subject: 'NV Ops: monthly backup failed', text: 'The scheduled monthly backup did not complete.\n\nReason: ' + e.message + '\n\nDaily copies inside the app are unaffected. Open the app, go to Data Management, then Backups, and tap Back up now once the problem is fixed.' }); } catch (x) {}
    }
    return new Response('Failed: ' + e.message, { status: 500 });
  }
};

export const config = { schedule: '0 10 1 * *' };
