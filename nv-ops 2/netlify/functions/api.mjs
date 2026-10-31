// The app's single server endpoint: /api
import { getStore } from '@netlify/blobs';
import crypto from 'node:crypto';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { mailConfigured, mailFrom, sendMail } from '../lib/mail.mjs';
import { emailSummary, emailYearEnd, monthlyBackup, buildYearPdf, buildPeriodPdf, buildWorkbook, scopeDb, emailReport, logoDataUrl, monthLabel } from '../lib/reports.mjs';
import { driveConfigured } from '../lib/drive.mjs';
import { fetchChannelFeeds } from '../lib/channels.mjs';
import { emptyDb, normalise, DRIVER_ACTIONS, OTHER_ACTIONS, actions, clientView, setupOwner, login, makeToken, readToken, publicUser, AppError, addSession, deviceName, inviteByCode, acceptInvite, bizAllowed, applyChannelFeeds } from '../lib/core.mjs';

const KEY = 'db';
const store = () => getStore({ name: 'nv-data', consistency: 'strong' });

async function readDb() {
  const res = await store().getWithMetadata(KEY, { type: 'json' });
  return res ? { db: normalise(res.data), etag: res.etag, exists: true } : { db: emptyDb(), etag: null, exists: false };
}

// Read, change, and save with a version check, retrying if someone else saved first.
async function mutate(fn) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { db, etag, exists } = await readDb();
    const result = fn(db);
    const opts = etag ? { onlyIfMatch: etag } : exists ? {} : { onlyIfNew: true };
    const saved = await store().setJSON(KEY, db, opts);
    if (!saved || saved.modified !== false) return { db, result };
    await new Promise(r => setTimeout(r, 120 + Math.random() * 200));
  }
  throw new AppError('Someone else is saving at the same moment. Please try again.', 409);
}

// Reads a setting from Netlify, trying both ways Netlify exposes it to functions.
function env(name) {
  try { const v = globalThis.Netlify && globalThis.Netlify.env && globalThis.Netlify.env.get(name); if (v) return String(v).trim(); } catch (e) {}
  return process.env[name] ? String(process.env[name]).trim() : '';
}

// The key that signs people's sign-ins. Uses SESSION_SECRET if it is set properly;
// otherwise the app creates its own random key once and keeps it in private storage.
let cachedSecret = null;
async function sessionSecret() {
  const fromEnv = env('SESSION_SECRET');
  if (fromEnv.length >= 32) return fromEnv;
  if (cachedSecret) return cachedSecret;
  const cfg = getStore({ name: 'nv-config', consistency: 'strong' });
  let s = await cfg.get('session-secret', { type: 'text' });
  if (!s) {
    s = crypto.randomBytes(48).toString('hex');
    const res = await cfg.set('session-secret', s, { onlyIfNew: true });
    if (res && res.modified === false) s = await cfg.get('session-secret', { type: 'text' });
  }
  cachedSecret = s;
  return s;
}

// Short-lived signed notes (used to remember a Face ID challenge between two requests).
function signNote(obj, secret) {
  const body = Buffer.from(JSON.stringify(obj)).toString('base64url');
  return body + '.' + crypto.createHmac('sha256', secret).update(body).digest('base64url');
}
function readNote(tok, secret) {
  const [body, sig] = String(tok || '').split('.');
  if (!body || !sig) return null;
  const expect = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  const o = JSON.parse(Buffer.from(body, 'base64url').toString());
  return o && o.e > Date.now() ? o : null;
}

// Keys that let the server send notifications to phones. Created once, kept privately.
let cachedVapid = null;
async function vapidKeys() {
  if (cachedVapid) return cachedVapid;
  const cfg = getStore({ name: 'nv-config', consistency: 'strong' });
  let k = await cfg.get('vapid', { type: 'json' });
  if (!k) {
    const webpush = (await import('web-push')).default;
    k = webpush.generateVAPIDKeys();
    const res = await cfg.setJSON('vapid', k, { onlyIfNew: true });
    if (res && res.modified === false) k = await cfg.get('vapid', { type: 'json' });
  }
  cachedVapid = k;
  return k;
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
});

/** Plain-English reasons for email failures, instead of a general server error. */
function mailProblem(err) {
  if (!err || err instanceof AppError) return '';
  const m = String(err.message || ''), code = err.code || '', rc = err.responseCode || 0;
  if (/Email is not set up yet/.test(m)) return 'Email is not set up yet. Add GMAIL_ADDRESS and GMAIL_APP_PASSWORD in Netlify (Site configuration, Environment variables), then redeploy.';
  if (code === 'EAUTH' || rc === 535 || rc === 534) return 'Gmail refused to sign in. In Netlify, check GMAIL_ADDRESS and that GMAIL_APP_PASSWORD is the 16-letter app password (not your normal Gmail password), then redeploy.';
  if (['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ECONNRESET'].includes(code)) return 'Could not reach Gmail just now. Please try again in a minute.';
  if (rc === 552 || /size/i.test(m) && rc >= 500) return 'Gmail would not accept the email because the attachment is too large.';
  if (code === 'EENVELOPE' || rc === 553 || rc === 550) return 'Gmail would not send to one of the report addresses. Check them under Reports, Financial Reports.';
  return '';
}

export default async (req, context) => {
  globalThis.__nvctx = context || {};
  if (req.method !== 'POST') return json({ ok: false, error: 'Use POST.' }, 405);
  const secret = await sessionSecret();

  let body;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'Bad request.' }, 400); }
  const action = String(body.action || '');

  try {
    if (action === 'status') {
      const { db } = await readDb();
      return json({ ok: true, setUp: db.users.length > 0 });
    }

    if (action === 'setup') {
      let code = env('SETUP_CODE');
      if (!code) {
        // SETUP_CODE is not reaching this deploy. Fall back to a one-time code written only to this site's function log,
        // which only people with access to the Netlify account can read.
        const ctx = globalThis.__nvctx || {}, where = ' (site "' + ((ctx.site && ctx.site.name) || 'unknown') + '", deploy type "' + ((ctx.deploy && ctx.deploy.context) || 'unknown') + '")';
        const { result: pc } = await mutate(db => { if (db.users.length) throw new AppError('This app is already set up. Sign in instead.'); if (!db.pendingSetupCode) db.pendingSetupCode = crypto.randomBytes(4).toString('hex').toUpperCase(); return db.pendingSetupCode; });
        console.log('NV Ops one-time setup code: ' + pc + where);
        if (String(body.setupCode || '').trim().toUpperCase() !== pc) throw new AppError('The server cannot see SETUP_CODE' + where + '. Use the one-time setup code instead: in Netlify, open this site, then Logs, then Functions, then api, find the line "NV Ops one-time setup code", and enter that code here.', 401);
        code = pc;
      } else if (String(body.setupCode || '').trim() !== code) throw new AppError('That setup code is not right.', 401);
      let sid = '';
      const { result: user } = await mutate(db => { const u = setupOwner(db, body); delete db.pendingSetupCode; sid = addSession(db, u.id, deviceName(req.headers.get('user-agent'))); return u; });
      return json({ ok: true, token: makeToken(user, secret, 60, sid) });
    }

    if (action === 'login') {
      let outcome;
      let sid = '';
      await mutate(db => { outcome = login(db, body); if (outcome.ok) sid = addSession(db, outcome.user.id, deviceName(req.headers.get('user-agent'))); });
      if (!outcome.ok) throw outcome.error;
      return json({ ok: true, token: makeToken(outcome.user, secret, 60, sid), mustChange: !!outcome.user.mustChange });
    }

    // ---- invitations: open without signing in, using the single-use code ----
    if (action === 'inviteInfo') {
      const { db: cur } = await readDb(); const inv = inviteByCode(cur, body.code);
      return json({ ok: true, valid: !!inv, name: inv ? inv.name : '', role: inv ? inv.role : '', business: cur.settings.businessName });
    }
    if (action === 'acceptInvite') {
      let sid = '';
      const { result: u } = await mutate(db => { const nu = acceptInvite(db, body); sid = addSession(db, nu.id, deviceName(req.headers.get('user-agent'))); return nu; });
      return json({ ok: true, token: makeToken(u, secret, 60, sid) });
    }

    // ---- Face ID / fingerprint sign-in (passkeys) ----
    const site = new URL(req.url); const rpID = site.hostname, origin = site.origin;
    if (action === 'passkeyLoginStart') {
      const opts = await generateAuthenticationOptions({ rpID, userVerification: 'required' });
      return json({ ok: true, options: opts, note: signNote({ c: opts.challenge, e: Date.now() + 5 * 60000 }, secret) });
    }
    if (action === 'passkeyLoginFinish') {
      const n = readNote(body.note, secret);
      if (!n) throw new AppError('That took too long. Try again.', 401);
      const resp = body.response || {};
      let outUser = null;
      // verification is asynchronous, so it runs outside the save loop
      const { db: cur } = await readDb();
      const user = cur.users.find(u => u.active !== false && (u.passkeys || []).some(k => k.id === resp.id));
      if (!user) throw new AppError('This device is not set up for Face ID sign-in. Sign in with your password.', 401);
      const key = user.passkeys.find(k => k.id === resp.id);
      let v;
      try {
        v = await verifyAuthenticationResponse({ response: resp, expectedChallenge: n.c, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true,
          credential: { id: key.id, publicKey: Buffer.from(key.publicKey, 'base64url'), counter: key.counter || 0, transports: key.transports } });
      } catch (e) { throw new AppError('Face ID sign-in could not be checked. Sign in with your password.', 401); }
      if (!v.verified) throw new AppError('Face ID sign-in failed.', 401);
      await mutate(db => { const u = db.users.find(x => x.id === user.id); const k = u.passkeys.find(x => x.id === key.id); k.counter = v.authenticationInfo.newCounter; k.lastUsed = new Date().toISOString(); u.lastLogin = k.lastUsed; outUser = u; });
      let sid = '';
      await mutate(db => { sid = addSession(db, outUser.id, deviceName(req.headers.get('user-agent')) + ' (Face ID)'); });
      return json({ ok: true, token: makeToken(outUser, secret, 60, sid), mustChange: !!outUser.mustChange });
    }

    // Everything below needs a signed-in user.
    const { db: current } = await readDb();
    const user = readToken(current, body.token, secret);
    if (!user) return json({ ok: false, error: 'SIGNED_OUT' }, 401);

    if (action === 'load') return json({ ok: true, data: clientView(current, user) });

    // Files (photos, receipts, dockets) are kept in their own store.
    if (user.role === 'driver' && ['uploadFile', 'deleteFile'].includes(action) && !(body.target && ['booking', 'fuel', 'incident', 'project'].includes(body.target.kind))) throw new AppError('Crew can attach files to jobs and projects only.', 403);
    if (user.role === 'other' && ['uploadFile', 'deleteFile', 'restoreBackup', 'sendBackupNow', 'sendYearEnd'].includes(action)) throw new AppError('Your access is view only.', 403);
    if (user.role === 'driver' && ['listBackups', 'restoreBackup'].includes(action)) throw new AppError('Your access does not include that.', 403);
    if (action === 'uploadFile') {
      const f = body.file || {};
      const data = String(f.data || '');
      if (!data) throw new AppError('No file received.');
      if (data.length > 5_500_000) throw new AppError('That file is too large. Keep files under 4 MB.');
      const id = 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      await getStore({ name: 'nv-files', consistency: 'strong' }).set(id, data, { metadata: { type: String(f.type || ''), name: String(f.name || '') } });
      const { db } = await mutate(db => { const me = db.users.find(u => u.id === user.id); return actions.addAttachment(db, me, { target: body.target, file: { id, name: f.name, type: f.type, docType: f.docType, expires: f.expires, size: Math.round(data.length * 0.75) } }); });
      return json({ ok: true, result: { id }, data: clientView(db, db.users.find(u => u.id === user.id)) });
    }
    if (action === 'getFile') {
      const r = await getStore({ name: 'nv-files', consistency: 'strong' }).getWithMetadata(String(body.id || ''), { type: 'text' });
      if (!r) throw new AppError('That file was not found.');
      return json({ ok: true, file: { data: r.data, type: r.metadata && r.metadata.type, name: r.metadata && r.metadata.name } });
    }
    if (action === 'deleteFile') {
      const { db } = await mutate(db => { const me = db.users.find(u => u.id === user.id); return actions.removeAttachment(db, me, { target: body.target, fileId: body.id }); });
      await getStore({ name: 'nv-files', consistency: 'strong' }).delete(String(body.id || ''));
      return json({ ok: true, data: clientView(db, db.users.find(u => u.id === user.id)) });
    }

    if (action === 'listBackups' || action === 'restoreBackup') {
      if (user.role !== 'owner') throw new AppError('Your access does not include that.', 403);
      const backups = getStore({ name: 'nv-backups', consistency: 'strong' });
      if (action === 'listBackups') {
        const { blobs } = await backups.list();
        return json({ ok: true, backups: blobs.map(b => b.key).sort().reverse() });
      }
      const snap = await backups.get(String(body.key || ''), { type: 'json' });
      if (!snap) throw new AppError('That backup was not found.');
      const { db } = await mutate(db => {
        const keepUsers = db.users; // never roll back passwords and access
        Object.keys(db).forEach(k => delete db[k]);
        Object.assign(db, snap, { users: keepUsers });
        db.audit.unshift({ at: new Date().toISOString(), by: user.name, action: 'Restored backup', ref: body.key });
      });
      return json({ ok: true, data: clientView(db, user) });
    }

    if (action === 'passkeyRegStart') {
      const opts = await generateRegistrationOptions({ rpName: 'NV Ops', rpID, userName: user.username, userDisplayName: user.name,
        userID: new TextEncoder().encode(user.id), attestationType: 'none',
        excludeCredentials: (user.passkeys || []).map(k => ({ id: k.id, transports: k.transports })),
        authenticatorSelection: { residentKey: 'required', userVerification: 'required' } });
      return json({ ok: true, options: opts, note: signNote({ c: opts.challenge, u: user.id, e: Date.now() + 5 * 60000 }, secret) });
    }
    if (action === 'passkeyRegFinish') {
      const n = readNote(body.note, secret);
      if (!n || n.u !== user.id) throw new AppError('That took too long. Try again.');
      let v;
      try { v = await verifyRegistrationResponse({ response: body.response, expectedChallenge: n.c, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true }); }
      catch (e) { throw new AppError('This device could not be set up: ' + (e.message || 'unknown error')); }
      if (!v.verified) throw new AppError('This device could not be set up.');
      const c = v.registrationInfo.credential;
      const { db } = await mutate(db => {
        const u = db.users.find(x => x.id === user.id);
        u.passkeys = (u.passkeys || []).filter(k => k.id !== c.id);
        u.passkeys.push({ id: c.id, publicKey: Buffer.from(c.publicKey).toString('base64url'), counter: c.counter || 0, transports: c.transports || [],
          name: String(body.name || 'This device').slice(0, 60), at: new Date().toISOString() });
      });
      return json({ ok: true, data: clientView(db, db.users.find(u => u.id === user.id)) });
    }
    if (action === 'passkeyList') {
      return json({ ok: true, passkeys: (user.passkeys || []).map(k => ({ id: k.id, name: k.name, at: k.at, lastUsed: k.lastUsed || '' })) });
    }
    if (action === 'passkeyRemove') {
      await mutate(db => { const u = db.users.find(x => x.id === user.id); u.passkeys = (u.passkeys || []).filter(k => k.id !== body.id); });
      const { db } = await readDb(); const me = db.users.find(u => u.id === user.id);
      return json({ ok: true, passkeys: (me.passkeys || []).map(k => ({ id: k.id, name: k.name, at: k.at, lastUsed: k.lastUsed || '' })) });
    }

    // ---- email: backups and year-end pack (Developer only, except downloading the pack) ----
    if (action === 'emailStatus') return json({ ok: true, configured: mailConfigured(), from: user.role === 'owner' ? mailFrom() : '' });
    if (action === 'backupStatus') { if (user.role !== 'owner') throw new AppError('Your access does not include that.', 403); return json({ ok: true, drive: driveConfigured(), email: mailConfigured() }); }
    if (['sendTestEmail', 'sendYearEnd', 'sendBackupNow'].includes(action)) {
      if (user.role !== 'owner') throw new AppError('Your access does not include that.', 403);
      if (action === 'sendTestEmail') {
        await sendMail({ to: current.settings.backupEmails, subject: 'NV Ops test email', text: 'Email from NV Ops is working. Weekly backups and the year-end pack will arrive from this address.' });
        return json({ ok: true, to: current.settings.backupEmails });
      }
      if (action === 'sendBackupNow') { const r = await monthlyBackup(current, monthLabel(new Date())); return json({ ok: true, ...r }); }
      const year = parseInt(body.year, 10) || new Date().getFullYear() - 1;
      await emailYearEnd(current, year, current.settings.reportEmails);
      return json({ ok: true, to: current.settings.reportEmails, year });
    }
    if (action === 'emailSummary') {
      if (user.role === 'driver' || user.role === 'other') throw new AppError('Your access does not include that.', 403);
      if (!current.settings.reportEmails) throw new AppError('Add report email addresses first.');
      if (!mailConfigured()) throw new AppError('Email is not set up yet. Add GMAIL_ADDRESS and GMAIL_APP_PASSWORD in Netlify (Site configuration, Environment variables), then redeploy.');
      const r = await emailSummary(current, body.kind === 'monthly' ? 'monthly' : 'weekly', current.settings.reportEmails);
      return json({ ok: true, to: r.to, label: r.label });
    }
    if (action === 'verifyBackup') {
      if (user.role !== 'owner') throw new AppError('Your access does not include that.', 403);
      const store = getStore({ name: 'nv-backups', consistency: 'strong' });
      const { blobs } = await store.list(); const key = blobs.map(b => b.key).sort().pop();
      if (!key) throw new AppError('No backups found yet.');
      const copy = await store.get(key, { type: 'json' });
      const counts = {}; ['invoices', 'clients', 'expenses', 'startup', 'capital', 'bookings', 'fuel', 'reminders', 'users'].forEach(k => { counts[k] = Array.isArray(copy && copy[k]) ? copy[k].length : -1; });
      const okAll = Object.values(counts).every(n => n >= 0) && counts.users > 0;
      const result = { at: new Date().toISOString(), key, ok: okAll, counts };
      await mutate(db => { db.settings.lastBackupCheck = result; });
      return json({ ok: true, result });
    }
    if (action === 'reportPdf' || action === 'reportXlsx' || action === 'emailReport') {
      if (user.role === 'driver') throw new AppError('Your access does not include that.', 403);
      const opt = { from: String(body.from || '').slice(0, 10), to: String(body.to || '').slice(0, 10), title: String(body.title || 'Financial Report').slice(0, 60), label: String(body.label || '').slice(0, 40), scope: String(body.scope || 'all').slice(0, 40) };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(opt.from) || !/^\d{4}-\d{2}-\d{2}$/.test(opt.to)) throw new AppError('Choose the reporting period.');
      const fname = 'NV-' + (opt.title + ' ' + opt.label).trim().replace(/\s+/g, '-');
      if (action === 'reportPdf') return json({ ok: true, file: { name: fname + '.pdf', base64: buildPeriodPdf(current, opt, await logoDataUrl()).toString('base64') } });
      if (action === 'reportXlsx') return json({ ok: true, file: { name: fname + '.xlsx', base64: buildWorkbook(scopeDb(current, opt.scope), null, opt.from, opt.to).toString('base64') } });
      if (user.role === 'other') throw new AppError('Your access is view only.', 403);
      if (!current.settings.reportEmails) throw new AppError('Add report email addresses first.');
      const r = await emailReport(current, opt, current.settings.reportEmails);
      return json({ ok: true, to: current.settings.reportEmails, status: r.status });
    }
    if (action === 'yearEndPdf') {
      if (user.role === 'driver') throw new AppError('Your access does not include that.', 403);
      const year = parseInt(body.year, 10) || new Date().getFullYear();
      const pdf = buildYearPdf(current, year, await logoDataUrl());
      return json({ ok: true, file: { name: 'NV-Year-End-' + year + '.pdf', base64: pdf.toString('base64') } });
    }

    if (action === 'pushKey') return json({ ok: true, key: (await vapidKeys()).publicKey });
    if (action === 'testPush') {
      const { sendToUser } = await import('../lib/push.mjs');
      const n = await sendToUser(current, user.id, { title: 'NV Ops', body: 'Notifications are working on this device.', url: '/#/dashboard' }, await vapidKeys());
      return json({ ok: true, sent: n });
    }

    if (!bizAllowed(user, action)) throw new AppError('Your access is for the other business. Ask the owner.', 403);
    if (action === 'syncChannels') {
      if (user.role !== 'owner' && user.role !== 'member') throw new AppError('Only the owner or a manager can do that.', 403);
      const feeds = await fetchChannelFeeds(current);
      const { db, result } = await mutate(db => applyChannelFeeds(db, db.users.find(u => u.id === user.id), feeds));
      return json({ ok: true, result, data: clientView(db, db.users.find(u => u.id === user.id)) });
    }
    const handler = actions[action];
    if (!handler) throw new AppError('Unknown action.');
    if (user.role === 'driver' && DRIVER_ACTIONS.indexOf(action) < 0) throw new AppError('Your access does not include that. Ask the office.', 403);
    if (user.role === 'other' && OTHER_ACTIONS.indexOf(action) < 0) throw new AppError('Your access is view only.', 403);
    if (action === 'revokeSession') body.current = user._sid || '';
    const { db, result } = await mutate(db => {
      const me = db.users.find(u => u.id === user.id);
      return handler(db, me, body);
    });
    const me = db.users.find(u => u.id === user.id);
    Object.defineProperty(me, '_sid', { value: user._sid || '', enumerable: false, configurable: true });
    if (action === 'deleteInvoice' && result && result.fileIds && result.fileIds.length) {
      const files = getStore({ name: 'nv-files', consistency: 'strong' });
      for (const id of result.fileIds) { try { await files.delete(id); } catch (e) { console.error('file delete failed', id); } }
    }
    return json({ ok: true, result, data: clientView(db, me) });
  } catch (err) {
    if (err && err.driveError) { console.error('Drive problem:', err.message); return json({ ok: false, error: err.message }, 400); }
    const mail = mailProblem(err);
    if (mail) { console.error('Email problem:', err.code || '', err.message); return json({ ok: false, error: mail }, 400); }
    const status = err instanceof AppError ? err.status : 500;
    if (!(err instanceof AppError)) console.error(err);
    return json({ ok: false, error: err instanceof AppError ? err.message : 'Something went wrong on the server.' }, status);
  }
};

export const config = { path: '/api' };
