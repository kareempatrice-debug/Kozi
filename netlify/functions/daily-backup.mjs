// Runs once a day: copies the whole database into the "til-backups" store
// under today's date, and removes copies older than 180 days.
import { getStore } from '@netlify/blobs';

export default async () => {
  const data = getStore({ name: 'nv-data', consistency: 'strong' });
  const backups = getStore({ name: 'nv-backups', consistency: 'strong' });
  const db = await data.get('db', { type: 'json' });
  if (!db) return new Response('Nothing to back up yet.');
  const { users, ...rest } = db; // passwords are not copied into backups
  const key = new Date().toISOString().slice(0, 10);
  await backups.setJSON(key, rest);
  const cutoff = new Date(Date.now() - 180 * 86400000).toISOString().slice(0, 10);
  const { blobs } = await backups.list();
  for (const b of blobs) if (b.key < cutoff) await backups.delete(b.key);
  return new Response('Backed up ' + key);
};

export const config = { schedule: '@daily' };
