// Sends email from a Gmail account using an app password (no extra services needed).
import nodemailer from 'nodemailer';

function env(name) {
  try { const v = globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(name); if (v) return String(v).trim(); } catch (e) {}
  return process.env[name] ? String(process.env[name]).trim() : '';
}
export function mailConfigured() { return !!(env('GMAIL_ADDRESS') && env('GMAIL_APP_PASSWORD')); }
export function mailFrom() { return env('GMAIL_ADDRESS'); }

export async function sendMail({ to, subject, text, html, attachments }) {
  if (!mailConfigured()) {
    const e = new Error('Email is not set up yet. Add GMAIL_ADDRESS and GMAIL_APP_PASSWORD in Netlify, then redeploy.');
    e.status = 400; throw e;
  }
  const transport = globalThis.__testTransport || nodemailer.createTransport({ service: 'gmail', auth: { user: env('GMAIL_ADDRESS'), pass: env('GMAIL_APP_PASSWORD').replace(/\s+/g, '') } });
  return transport.sendMail({ from: '"NV Ops" <' + env('GMAIL_ADDRESS') + '>', to, subject, text, html, attachments });
}
