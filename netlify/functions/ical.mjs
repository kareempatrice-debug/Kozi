// The calendar link for each unit that Airbnb and Booking.com read, so nights already booked elsewhere are closed there too.
import { getStore } from '@netlify/blobs';
import { normalise, unitCalendar } from '../lib/core.mjs';

export default async (req, context) => {
  const token = String((context.params || {}).token || '').replace(/\.ics$/i, '');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return new Response('Not found', { status: 404 });
  const res = await getStore({ name: 'nv-data', consistency: 'strong' }).get('db', { type: 'json' });
  if (!res) return new Response('Not found', { status: 404 });
  const ex = new URL(req.url).searchParams.get('for');
  const ics = unitCalendar(normalise(res), token, ex === 'airbnb' ? 'Airbnb' : ex === 'booking' ? 'Booking.com' : '');
  if (!ics) return new Response('Not found', { status: 404 });
  return new Response(ics, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } });
};
export const config = { path: '/ical/:token' };
