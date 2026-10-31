// Core logic for NV Ops, the NV Construction Ltd operations app.
// Pure functions that take the database object and change it. The API file
// (api.mjs) loads the database from Netlify Blobs, calls these, and saves it.

import crypto from 'node:crypto';
import { COST_KEYS, invBalance as calcBalance, partnerShare, invJobProfit, expenseFunding, round2 } from './calc.mjs';

export const DEFAULT_SETTINGS = {
  businessName: 'NV Construction Ltd',
  phone: '+1 784-494-8602',
  whatsapp: '+1 784-494-8602',
  email: 'NVConstruction784@gmail.com',
  address: 'Arnosvale, Cane Hall\nSt Vincent & the Grenadines',
  website: 'nvconstruction784.com',
  bankName: '',
  accountName: 'NV Construction Ltd',
  accountNumber: '',
  paymentDays: 14,
  defaultPrice: 0,
  invoiceNote: '',
  tagline: 'Your all-in-one construction partner',
  partners: [],
  gbpRate: 0,
  quoteDays: 30,
  monthlyTarget: 0,
  lockedThrough: '',
  // Vehicle and machine register. The id is the name stored on every job, so it never changes; the rest is editable.
  vehicles: [
    { id: 'Skip truck', nickname: '', plate: '', make: '', model: '', year: '', vin: '', active: true },
    { id: 'Tipper 1', nickname: '', plate: '', make: '', model: '', year: '', vin: '', active: true },
    { id: 'Tipper 2', nickname: '', plate: '', make: '', model: '', year: '', vin: '', active: true },
    { id: 'Excavator', nickname: '', plate: '', make: '', model: '', year: '', vin: '', active: true }
  ],
  drivers: [],
  accountHolder: '',
  backupEmails: '',
  driveShare: '',
  reportEmails: '',
  // Optional standard prices by area (mainly skip bin hire), filled in on invoices, quotes and bookings.
  routeRates: []
};

export function emptyDb() {
  return {
    schema: 1,
    settings: { ...DEFAULT_SETTINGS },
    nextInvoiceNo: 1,
    users: [],
    clients: [],
    invoices: [],
    expenses: [],
    startup: [],
    quotes: [],
    nextQuoteNo: 1,
    reminders: [],
    capital: [],
    partnerTx: [],
    invites: [],
    incidents: [],
    driverPay: [],
    bookings: [],
    fuel: [],
    pushSubs: [],
    bins: [],
    hires: [],
    hours: [],
    hourPlans: {},
    projects: [],
    properties: [],
    units: [],
    tenancies: [],
    stays: [],
    repairs: [],
    aptSettings: { name: 'Cozy Apartments' },
    paySettings: {},
    requests: [],
    payroll: { people: [], runs: [], settings: {} },
    notices: [],
    payNotices: [],
    audit: []
  };
}

/** Older saved data may lack newer collections; fill them in. */
const OLD_VAT_NOTE = '';
export function normalise(db) {
  const e = emptyDb();
  for (const k of Object.keys(e)) if (db[k] === undefined) db[k] = e[k];
  db.settings = { ...DEFAULT_SETTINGS, ...db.settings };
  
  if (!Array.isArray(db.settings.closedMonths)) {
    const lt = db.settings.lockedThrough, list = [];
    if (lt && /^\d{4}-\d{2}$/.test(lt)) {
      const dates = [].concat((db.invoices || []).flatMap(i => [i.issueDate].concat((i.lines || []).map(l => l.date))), (db.expenses || []).map(e => e.date)).filter(Boolean).sort();
      let m = (dates[0] || lt + '-01').slice(0, 7);
      while (m <= lt) { list.push(m); const [y, mo] = m.split('-').map(Number); m = mo === 12 ? (y + 1) + '-01' : y + '-' + String(mo + 1).padStart(2, '0'); }
    }
    db.settings.closedMonths = list; db.settings.closedInfo = db.settings.closedInfo || {};
  }
  return db;
}

export class AppError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

// ---------- small helpers ----------
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const newId = (p = '') => p + crypto.randomBytes(6).toString('hex');
const nowIso = () => new Date().toISOString();
const str = (v, max = 500) => String(v == null ? '' : v).trim().slice(0, max);
const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0; };
const date = (v, label) => { const s = str(v, 10); if (!ISO.test(s)) throw new AppError('Choose a valid ' + label + '.'); return s; };
export function addDays(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + (Number(days) || 0))).toISOString().slice(0, 10);
}
function audit(db, user, action, ref) {
  db.audit.unshift({ at: nowIso(), by: user ? user.name : 'system', action, ref: ref || '' });
  if (db.audit.length > 1000) db.audit.length = 1000;
}
const stamp = (obj, user, isNew) => {
  if (isNew) { obj.createdBy = user.name; obj.createdAt = nowIso(); }
  obj.updatedBy = user.name; obj.updatedAt = nowIso();
};

// ---------- passwords and sessions ----------
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { salt, hash };
}
function passwordOk(user, password) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.hash, 'hex'));
}
function checkNewPassword(p) {
  if (String(p || '').length < 10) throw new AppError('Use a password of at least 10 characters.');
}
const b64u = (buf) => Buffer.from(buf).toString('base64url');
export function makeToken(user, secret, days = 60, sid) {
  const body = b64u(JSON.stringify(Object.assign({ u: user.id, v: user.tokenVersion || 0, e: Date.now() + days * 86400000 }, sid ? { s: sid } : {})));
  const sig = b64u(crypto.createHmac('sha256', secret).update(body).digest());
  return body + '.' + sig;
}
/** Records a new signed-in device; keeps the latest 15. */
export function addSession(db, userId, device) {
  const u = db.users.find(x => x.id === userId); if (!u) return '';
  const id = newId('s');
  u.sessions = [{ id, device: String(device || 'Unknown device').slice(0, 80), at: new Date().toISOString() }].concat(u.sessions || []).slice(0, 15);
  db.audit.unshift({ at: new Date().toISOString(), by: u.name, what: 'Signed in on ' + String(device || 'a device').slice(0, 60), ref: '' });
  return id;
}
export function deviceName(ua) {
  ua = String(ua || '');
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Device';
  const br = /CriOS|Chrome\//.test(ua) && !/Edg/.test(ua) ? 'Chrome' : /Edg/.test(ua) ? 'Edge' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'browser';
  return os + ' · ' + br;
}
/** Single-use invitation, valid 72 hours. Only a hash of the code is stored. */
export function inviteByCode(db, code) {
  const h = crypto.createHash('sha256').update(String(code || '')).digest('hex');
  const inv = (db.invites || []).find(i => i.hash === h);
  if (!inv || inv.usedAt || Date.parse(inv.expires) < Date.now()) return null;
  return inv;
}
export function acceptInvite(db, { code, username, password }) {
  const inv = inviteByCode(db, code); if (!inv) throw new AppError('This invitation has expired or been used. Ask for a new one.', 400);
  const owner = db.users.find(u => u.role === 'owner'); if (!owner) throw new AppError('Setup is not complete.');
  actions.addUser(db, owner, { name: inv.name, username, password, role: inv.role });
  { const nu = db.users.find(x => x.username === String(username || '').trim().toLowerCase()); if (nu && inv.biz && inv.biz !== 'both') nu.biz = inv.biz; if (nu && inv.tenancyId) { nu.tenancyId = inv.tenancyId; nu.biz = 'cozy'; } if (nu && inv.duty && DUTIES[inv.duty]) { nu.duty = inv.duty; nu.biz = DUTIES[inv.duty][0]; } }
  const u = db.users[db.users.length - 1]; u.mustChange = false; inv.usedAt = new Date().toISOString(); inv.userId = u.id;
  audit(db, u, 'Accepted invitation and set a password');
  return u;
}
export function readToken(db, token, secret) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const [body, sig] = token.split('.');
  const expect = b64u(crypto.createHmac('sha256', secret).update(body).digest());
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  let p; try { p = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { return null; }
  if (!p || Date.now() > p.e) return null;
  const user = db.users.find(u => u.id === p.u && u.active !== false);
  if (!user || (user.tokenVersion || 0) !== p.v) return null;
  if (p.s && !(user.sessions || []).some(x => x.id === p.s)) return null; // signed out remotely
  Object.defineProperty(user, '_sid', { value: p.s || '', enumerable: false, configurable: true, writable: true });
  return user;
}
export const publicUser = (u) => ({ id: u.id, name: u.name, username: u.username, role: u.role, biz: u.biz || 'both', duty: u.duty || '', tenancyId: u.tenancyId || '', active: u.active !== false, mustChange: !!u.mustChange, passkeys: (u.passkeys || []).length, prefs: u.prefs || {}, notify: u.notify || {}, lastLogin: u.lastLogin || '', sessions: (u.sessions || []).length, createdAt: u.createdAt || '' });

export function setupOwner(db, { name, username, password }) {
  if (db.users.length) throw new AppError('The app is already set up. Sign in instead.');
  checkNewPassword(password);
  const u = { id: newId('u'), name: str(name, 40) || 'Owner', username: str(username, 40).toLowerCase(), role: 'owner', active: true, tokenVersion: 0, ...hashPassword(password) };
  if (!/^[a-z0-9._-]{3,}$/.test(u.username)) throw new AppError('Choose a username of at least 3 letters or numbers.');
  db.users.push(u);
  audit(db, u, 'Set up the app', u.username);
  return u;
}

export function login(db, { username, password }) {
  const u = db.users.find(x => x.username === str(username, 40).toLowerCase() && x.active !== false);
  const fail = new AppError('Username or password not recognised.', 401);
  if (!u) throw fail;
  if (u.lockedUntil && Date.now() < u.lockedUntil) {
    throw new AppError('Too many wrong attempts. Try again in ' + Math.ceil((u.lockedUntil - Date.now()) / 60000) + ' minutes.', 429);
  }
  if (!passwordOk(u, password || '')) {
    u.failed = (u.failed || 0) + 1;
    if (u.failed >= 5) { u.lockedUntil = Date.now() + 15 * 60000; u.failed = 0; }
    return { ok: false, user: u, error: fail };
  }
  u.failed = 0; u.lockedUntil = 0; u.lastLogin = nowIso();
  return { ok: true, user: u };
}

// ---------- validation of records ----------
// Only the driver fee is required on a job (rule in force from this date; older jobs are left as recorded).
export const DRIVER_FEE_RULE_FROM = '2026-10-16';
function requireDriverFees(lines, existing) {
  return; // NV: no single cost is compulsory on a construction job
  const before = {}; (existing || []).forEach(l => { before[l.id] = l; });
  lines.forEach((l, i) => {
    const old = before[l.id];
    const applies = !old || l.date >= DRIVER_FEE_RULE_FROM;
    if (applies && !(l.costs.driver > 0)) throw new AppError('Enter the driver fee for ' + (lines.length > 1 ? 'job ' + (i + 1) : 'this job') + '. Every job has a driver fee.');
  });
}

function cleanLine(l, settings) {
  const qty = num(l.qty) || 1;
  const price = num(l.price);
  if (price <= 0) throw new AppError('Each line needs a price greater than zero.');
  return {
    id: str(l.id, 40) || newId('l'),
    date: date(l.date, 'job date'),
    title: str(l.title, 120) || 'Work',
    detail: str(l.detail, 300),
    truck: str(l.truck, 40),
    route: str(l.route, 80),
    category: str(l.category, 60) || 'Other',
    load: str(l.load, 60),
    qty, price,
    costs: COST_KEYS.reduce((o, k) => { const v = num(l.costs && l.costs[k]); if (v < 0) throw new AppError('Costs cannot be negative.'); o[k] = v; return o; }, {}),
    costNote: str(l.costNote, 120),
    driverId: str(l.driverId, 40),
    garbage: !!l.garbage
  };
}

function upsertClient(db, c, user) {
  const name = str(c && c.name, 100);
  if (!name) throw new AppError('Enter the customer name.');
  let client = c.id ? db.clients.find(x => x.id === c.id) : db.clients.find(x => x.name.toLowerCase() === name.toLowerCase());
  const isNew = !client;
  if (!client) { client = { id: newId('c') }; db.clients.push(client); }
  client.name = name;
  if (c.phone !== undefined) client.phone = str(c.phone, 40);
  if (c.email !== undefined) client.email = str(c.email, 120);
  if (c.address !== undefined) client.address = str(c.address, 200);
  if (c.notes !== undefined) client.notes = str(c.notes, 500);
  stamp(client, user, isNew);
  return client;
}

// ---------- actions ----------
export const actions = {
  deleteClient(db, user, { clientId }) {
    ownerOnly(user);
    const c = db.clients.find(x => x.id === clientId);
    if (!c) throw new AppError('That customer no longer exists.');
    const inv = db.invoices.filter(i => i.clientId === clientId).length, q = (db.quotes || []).filter(x => x.clientId === clientId).length;
    if (inv || q) throw new AppError(c.name + ' has ' + [inv ? inv + (inv === 1 ? ' invoice' : ' invoices') : '', q ? q + (q === 1 ? ' quote' : ' quotes') : ''].filter(Boolean).join(' and ') + '. Delete or move those first.');
    db.clients = db.clients.filter(x => x.id !== clientId);
    audit(db, user, 'Deleted customer ' + c.name);
    return {};
  },

  saveClient(db, user, { client }) {
    const c = upsertClient(db, client || {}, user);
    audit(db, user, 'Saved customer', c.name);
    return { id: c.id };
  },

  saveInvoice(db, user, { invoice }) {
    if (!invoice) throw new AppError('Nothing to save.');
    const lines = (invoice.lines || []).map(l => cleanLine(l, db.settings));
    if (!lines.length) throw new AppError('Add at least one line to the invoice.');
    const client = upsertClient(db, invoice.client || {}, user);
    const issueDate = date(invoice.issueDate, 'invoice date');
    const dueDate = invoice.dueDate ? date(invoice.dueDate, 'due date') : addDays(issueDate, db.settings.paymentDays);
    assertOpen(db, [issueDate].concat(lines.map(l => l.date)));
    const prior = invoice.id ? (db.invoices.find(x => x.id === invoice.id) || {}).lines : null;
    requireDriverFees(lines, prior);
    let inv;
    if (invoice.id) {
      inv = db.invoices.find(x => x.id === invoice.id);
      if (!inv) throw new AppError('That invoice no longer exists.');
      if (inv.void) throw new AppError('A cancelled invoice cannot be edited.');
      assertOpen(db, invDates(inv));
    } else {
      let no = db.nextInvoiceNo;
      if (invoice.no !== undefined && invoice.no !== null && String(invoice.no).trim() !== '') {
        // Owner only: record a past invoice under its original number.
        ownerOnly(user);
        no = parseInt(String(invoice.no).replace(/\D/g, ''), 10);
        if (!(no > 0)) throw new AppError('Enter a valid invoice number.');
        if (db.invoices.some(x => x.no === no)) throw new AppError('Invoice #' + String(no).padStart(3, '0') + ' already exists.');
      }
      inv = { id: newId('i'), no, payments: [], sent: [], void: null };
      db.invoices.push(inv);
      if (no >= db.nextInvoiceNo) db.nextInvoiceNo = no + 1;
    }
    Object.assign(inv, { clientId: client.id, issueDate, dueDate, lines, notes: str(invoice.notes, 500), internalNotes: str(invoice.internalNotes, 1000) });
    stamp(inv, user, !invoice.id);
    if (invoice.hireId) { const hr = (db.hires || []).find(x => x.id === invoice.hireId); if (hr) { hr.invoiceId = inv.id; stamp(hr, user, false); } }
    if (invoice.bookingId) {
      const b = db.bookings.find(x => x.id === invoice.bookingId);
      if (b) { b.status = 'Invoiced'; b.invoiceId = inv.id; stamp(b, user, false); }
    }
    audit(db, user, invoice.id ? 'Edited invoice' : 'Created invoice', '#' + inv.no);
    return { id: inv.id, no: inv.no };
  },

  addPayment(db, user, { invoiceId, payment }) {
    const inv = findInvoice(db, invoiceId);
    const amount = num(payment && payment.amount);
    if (amount <= 0) throw new AppError('Enter the amount received.');
    if (inv.void) throw new AppError('This invoice is cancelled.');
    const due = calcBalance(inv);
    if (due <= 0.009) throw new AppError('This invoice is already paid.');
    if (amount - due > 0.009) throw new AppError('That is more than the balance of EC$' + due.toFixed(2) + '.');
    const p = { id: newId('p'), date: date(payment.date, 'payment date'), amount, method: str(payment.method, 40) || 'Cash', note: str(payment.note, 200), by: user.name, at: nowIso() };
    assertOpen(db, [p.date]);
    inv.payments.push(p);
    stamp(inv, user, false);
    audit(db, user, 'Recorded payment EC$' + amount.toFixed(2), '#' + inv.no);
    return { id: p.id };
  },

  deletePayment(db, user, { invoiceId, paymentId }) {
    const inv = findInvoice(db, invoiceId);
    const p = inv.payments.find(x => x.id === paymentId);
    if (!p) throw new AppError('Payment not found.');
    assertOpen(db, [p.date]);
    inv.payments = inv.payments.filter(x => x.id !== paymentId);
    stamp(inv, user, false);
    audit(db, user, 'Removed payment EC$' + p.amount.toFixed(2), '#' + inv.no);
    return {};
  },

  voidInvoice(db, user, { invoiceId, reason }) {
    const inv = findInvoice(db, invoiceId);
    if (!str(reason)) throw new AppError('Give a reason for cancelling.');
    assertOpen(db, invDates(inv));
    inv.void = { at: nowIso(), by: user.name, reason: str(reason, 200) };
    stamp(inv, user, false);
    audit(db, user, 'Cancelled invoice: ' + str(reason, 200), '#' + inv.no);
    return {};
  },

  markSent(db, user, { invoiceId, via }) {
    const inv = findInvoice(db, invoiceId);
    inv.sent.push({ at: nowIso(), by: user.name, via: str(via, 40) || 'Shared' });
    return {};
  },

  saveExpense(db, user, { expense }) {
    const e = expense || {};
    const amount = num(e.amount);
    if (amount <= 0) throw new AppError('Enter an amount greater than zero.');
    const rec = {
      daysOff: Math.max(0, Math.min(365, Math.round(num(e.daysOff)))),
      date: date(e.date, 'date'),
      truck: str(e.truck, 40) || 'General',
      category: str(e.category, 60) || 'Other',
      description: str(e.description, 200),
      amount,
      method: str(e.method, 40),
      paidBy: str(e.paidBy, 40),
      notes: str(e.notes, 500),
      biz: e.biz === 'cozy' ? 'cozy' : 'nv',
      workshop: str(e.workshop, 80), jobType: str(e.jobType, 60), parts: num(e.parts), labour: num(e.labour), other: num(e.other), odometer: Math.max(0, Math.round(num(e.odometer))), downtimeHours: Math.max(0, Math.min(9000, num(e.downtimeHours)))
    };
    // Off-the-road dates: hours and days are worked out here so every screen and report agrees
    const okDt = v => /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(String(v || ''));
    rec.offFrom = okDt(e.offFrom) ? String(e.offFrom) : ''; rec.offTo = rec.offFrom && okDt(e.offTo) ? String(e.offTo) : '';
    if (rec.offFrom) {
      const t = v => Date.parse(v.length === 10 ? v + 'T00:00' : v);
      if (rec.offTo) {
        const h = (t(rec.offTo) - t(rec.offFrom)) / 3600000;
        if (!(h >= 0)) throw new AppError('Back on the road must be after the truck went off the road.');
        if (h > 24 * 366) throw new AppError('That is more than a year off the road. Check the dates.');
        rec.downtimeHours = Math.round(h); rec.daysOff = Math.ceil(h / 24);
      } else { rec.downtimeHours = 0; rec.daysOff = 0; }
    }
    if (!rec.description) throw new AppError('Describe the expense.');
    assertOpen(db, [rec.date]);
    let x;
    if (e.id) { x = db.expenses.find(z => z.id === e.id); if (!x) throw new AppError('That expense no longer exists.'); if (x.void) throw new AppError('A cancelled expense cannot be edited.'); assertOpen(db, [x.date]); }
    else { x = { id: newId('e'), void: null }; db.expenses.push(x); }
    Object.assign(x, rec);
    stamp(x, user, !e.id);
    audit(db, user, (e.id ? 'Edited' : 'Added') + ' expense EC$' + amount.toFixed(2), rec.description);
    return { id: x.id };
  },

  voidExpense(db, user, { id, reason }) {
    const x = db.expenses.find(z => z.id === id);
    if (!x) throw new AppError('That expense no longer exists.');
    if (!str(reason)) throw new AppError('Give a reason for cancelling.');
    assertOpen(db, [x.date]);
    x.void = { at: nowIso(), by: user.name, reason: str(reason, 200) };
    stamp(x, user, false);
    audit(db, user, 'Cancelled expense: ' + str(reason, 200), x.description);
    return {};
  },

  saveStartup(db, user, { item }) {
    const e = item || {};
    const amount = num(e.amount);
    if (amount <= 0) throw new AppError('Enter the amount in EC$.');
    const rec = {
      date: e.date ? date(e.date, 'date') : '',
      truck: str(e.truck, 40),
      category: str(e.category, 60) || 'Other',
      description: str(e.description, 200),
      amount,
      original: str(e.original, 60),
      paidBy: str(e.paidBy, 40),
      notes: str(e.notes, 1500)
    };
    if (!rec.description) rec.description = rec.category;
    let x;
    if (e.id) { x = db.startup.find(z => z.id === e.id); if (!x) throw new AppError('That item no longer exists.'); }
    else { x = { id: newId('s') }; db.startup.push(x); }
    Object.assign(x, rec);
    stamp(x, user, !e.id);
    audit(db, user, (e.id ? 'Edited' : 'Added') + ' start-up cost EC$' + amount.toFixed(2), rec.description);
    return { id: x.id };
  },

  deleteStartup(db, user, { id }) {
    const x = db.startup.find(z => z.id === id);
    if (!x) throw new AppError('That item no longer exists.');
    db.startup = db.startup.filter(z => z.id !== id);
    audit(db, user, 'Deleted start-up cost EC$' + x.amount.toFixed(2), x.description);
    return {};
  },

  saveSettings(db, user, { settings }) {
    ownerOnly(user);
    const s = settings || {};
    const out = { ...db.settings };
    ['businessName', 'phone', 'whatsapp', 'email', 'address', 'bankName', 'accountName', 'accountNumber', 'invoiceNote', 'tagline']
      .forEach(k => { if (s[k] !== undefined) out[k] = str(s[k], 300); });
    if (s.paymentDays !== undefined) out.paymentDays = Math.max(0, Math.min(120, parseInt(s.paymentDays, 10) || 0));
    if (s.defaultPrice !== undefined) out.defaultPrice = num(s.defaultPrice);
    if (s.gbpRate !== undefined) out.gbpRate = num(s.gbpRate) || out.gbpRate;
    if (s.monthlyTarget !== undefined) out.monthlyTarget = Math.max(0, num(s.monthlyTarget));
    if (Array.isArray(s.vehicles)) {
      const known = {}; (db.settings.vehicles || []).forEach(v => { known[v.id] = v; });
      const list = s.vehicles.map(v => ({ id: str(v.id, 40), nickname: str(v.nickname, 40), plate: str(v.plate, 20), make: str(v.make, 30), model: str(v.model, 40),
        year: str(v.year, 4), vin: str(v.vin, 40), active: v.active !== false })).filter(v => v.id);
      Object.keys(known).forEach(id => { if (!list.some(v => v.id === id)) list.push(Object.assign({}, known[id], { active: false })); }); // never lose a vehicle that jobs refer to
      if (new Set(list.map(v => v.id)).size !== list.length) throw new AppError('Two vehicles have the same name.');
      out.vehicles = list;
    }
    if (Array.isArray(s.drivers)) {
      out.drivers = s.drivers.map(d => ({ id: str(d.id, 40) || newId('d'), name: str(d.name, 60), phone: str(d.phone, 40), active: d.active !== false })).filter(d => d.name);
    }
    if (s.accountHolder !== undefined) out.accountHolder = str(s.accountHolder, 40);
    if (s.quarterlyReports !== undefined) out.quarterlyReports = !!s.quarterlyReports;
    if (Array.isArray(s.alertDays)) out.alertDays = s.alertDays.map(n => parseInt(n, 10)).filter(n => n > 0 && n <= 365).slice(0, 6).sort((a, b) => b - a);
    if (s.overdueReminderDays !== undefined) out.overdueReminderDays = Math.max(0, Math.min(90, parseInt(s.overdueReminderDays, 10) || 0));
    ['docShowLogo', 'docShowBank', 'docShowTerms', 'backupAlerts'].forEach(k => { if (s[k] !== undefined) out[k] = !!s[k]; });
    if (s.website !== undefined) out.website = str(s.website, 120);
    if (Array.isArray(s.expenseCategories)) out.expenseCategories = s.expenseCategories.map(x => str(x, 40)).filter(Boolean).slice(0, 40);
    if (s.annualReports !== undefined) out.annualReports = !!s.annualReports;
    if (s.weeklyEmail !== undefined) out.weeklyEmail = !!s.weeklyEmail;
    if (s.monthlyEmail !== undefined) out.monthlyEmail = !!s.monthlyEmail;

    const emails = v => str(v, 400).split(/[,;\s]+/).filter(Boolean);
    ['backupEmails', 'reportEmails', 'driveShare'].forEach(k => {
      if (s[k] === undefined) return;
      const list = emails(s[k]);
      if (list.some(x => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))) throw new AppError('Check the email addresses: one of them is not valid.');
      out[k] = list.join(', ');
    });
    if (Array.isArray(s.routeRates)) out.routeRates = s.routeRates.map(r => ({ route: str(r.route, 80), price: num(r.price), garbagePrice: num(r.garbagePrice), labour: num(r.labour), material: num(r.material), subcontract: num(r.subcontract), plant: num(r.plant), fuel: num(r.fuel), tipping: num(r.tipping) })).filter(r => r.route && (r.price || r.driver));
    if (s.quoteDays !== undefined) out.quoteDays = Math.max(1, Math.min(180, parseInt(s.quoteDays, 10) || 30));
    if (Array.isArray(s.partners)) {
      const p = s.partners.map(x => ({ name: str(x.name, 40), share: num(x.share) })).filter(x => x.name);
      const total = p.reduce((t, x) => t + x.share, 0);
      if (p.length && Math.abs(total - 100) > 0.01) throw new AppError('Partner shares must add up to 100%.');
      out.partners = p;
    }
    if (s.nextInvoiceNo !== undefined) {
      const n = parseInt(s.nextInvoiceNo, 10);
      const max = db.invoices.reduce((m, i) => Math.max(m, i.no || 0), 0);
      if (!(n > max)) throw new AppError('The next invoice number must be higher than ' + max + '.');
      db.nextInvoiceNo = n;
    }
    db.settings = out;
    audit(db, user, 'Changed business settings');
    return {};
  },

  addUser(db, user, { name, username, password, role }) {
    ownerOnly(user);
    username = str(username, 40).toLowerCase();
    if (!/^[a-z0-9._-]{3,}$/.test(username)) throw new AppError('Choose a username of at least 3 letters or numbers.');
    if (db.users.some(u => u.username === username)) throw new AppError('That username is already taken.');
    checkNewPassword(password);
    const u = { id: newId('u'), name: str(name, 40) || username, username, role: ['driver', 'other', 'tenant'].includes(role) ? role : 'member', active: true, mustChange: true, tokenVersion: 0, ...hashPassword(password) };
    db.users.push(u);
    audit(db, user, 'Gave access to ' + u.name, username);
    return {};
  },

  resetPassword(db, user, { userId, password }) {
    ownerOnly(user);
    const u = db.users.find(x => x.id === userId);
    if (!u) throw new AppError('User not found.');
    checkNewPassword(password);
    Object.assign(u, hashPassword(password), { mustChange: u.id !== user.id, tokenVersion: (u.tokenVersion || 0) + 1, failed: 0, lockedUntil: 0 });
    audit(db, user, 'Reset password for ' + u.name);
    return {};
  },

  setUserRole(db, user, { userId, role }) {
    ownerOnly(user);
    const u = db.users.find(x => x.id === userId);
    if (!u) throw new AppError('User not found.');
    if (u.role === 'owner') throw new AppError('The Developer role cannot be changed.');
    u.role = ['driver', 'other'].includes(role) ? role : 'member';
    u.tokenVersion = (u.tokenVersion || 0) + 1;
    audit(db, user, 'Changed ' + u.name + ' to ' + ({ driver: 'driver', other: 'other', member: 'partner' }[u.role]) + ' access');
    return {};
  },

  setUserActive(db, user, { userId, active }) {
    ownerOnly(user);
    const u = db.users.find(x => x.id === userId);
    if (!u) throw new AppError('User not found.');
    if (u.role === 'owner') throw new AppError('The Developer account cannot be removed.');
    u.active = !!active;
    u.tokenVersion = (u.tokenVersion || 0) + 1; // signs them out everywhere
    audit(db, user, (active ? 'Restored' : 'Removed') + ' access for ' + u.name);
    return {};
  },

  changePassword(db, user, { current, password }) {
    const u = db.users.find(x => x.id === user.id);
    if (!passwordOk(u, current || '')) throw new AppError('Your current password is not right.');
    checkNewPassword(password);
    Object.assign(u, hashPassword(password), { mustChange: false });
    audit(db, user, 'Changed own password');
    return {};
  },


  // Owner only: permanently remove an invoice (for test or mistaken invoices).
  deleteInvoice(db, user, { invoiceId, confirm }) {
    ownerOnly(user);
    const inv = db.invoices.find(x => x.id === invoiceId);
    if (!inv) throw new AppError('That invoice no longer exists.');
    if (parseInt(String(confirm || '').replace(/\D/g, ''), 10) !== inv.no) throw new AppError('Type the invoice number exactly to confirm.');
    if ((inv.payments || []).length) throw new AppError('This invoice has payments recorded. Remove the payments first, then delete it.');
    assertOpen(db, invDates(inv));
    db.invoices = db.invoices.filter(x => x.id !== invoiceId);
    // Unlink anything that pointed at it.
    db.bookings.forEach(b => { if (b.invoiceId === invoiceId) { b.invoiceId = null; b.status = 'Done'; } });
    db.quotes.forEach(q => { if (q.invoiceId === invoiceId) { q.invoiceId = null; q.status = 'Open'; } });
    // If it was the latest number, give that number back.
    const maxLeft = db.invoices.reduce((m, i) => Math.max(m, i.no || 0), 0);
    if (!db.invoices.length) db.nextInvoiceNo = Math.min(db.nextInvoiceNo, inv.no);
    else if (inv.no >= maxLeft && db.nextInvoiceNo > maxLeft + 1) db.nextInvoiceNo = maxLeft + 1;
    audit(db, user, 'Permanently deleted invoice #' + String(inv.no).padStart(3, '0') + ' (' + ((db.clients.find(c => c.id === inv.clientId) || {}).name || 'unknown customer') + ')', '#' + inv.no);
    return { no: inv.no, nextInvoiceNo: db.nextInvoiceNo, fileIds: (inv.attachments || []).map(a => a.id) };
  },

  // ---- merge two customer records that are the same customer (owner) ----
  mergeClients(db, user, { fromId, intoId }) {
    ownerOnly(user);
    const from = db.clients.find(c => c.id === fromId), into = db.clients.find(c => c.id === intoId);
    if (!from || !into) throw new AppError('Choose both customers.');
    if (from.id === into.id) throw new AppError('Choose two different customers.');
    let inv = 0, q = 0, bk = 0;
    db.invoices.forEach(i => { if (i.clientId === from.id) { i.clientId = into.id; inv++; } });
    (db.quotes || []).forEach(x => { if (x.clientId === from.id) { x.clientId = into.id; q++; } });
    (db.bookings || []).forEach(b => { if ((b.client || '').trim().toLowerCase() === from.name.trim().toLowerCase()) { b.client = into.name; bk++; } });
    ['phone', 'email', 'address', 'whatsapp'].forEach(k => { if (!into[k] && from[k]) into[k] = from[k]; });
    if (from.notes && from.notes !== into.notes) into.notes = [into.notes, from.notes].filter(Boolean).join('\n');
    db.clients = db.clients.filter(c => c.id !== from.id);
    audit(db, user, 'Merged customer "' + from.name + '" into "' + into.name + '" (' + inv + ' invoices, ' + q + ' quotes, ' + bk + ' bookings)');
    return { invoices: inv, quotes: q, bookings: bk };
  },

  // ---- month-end: close or reopen one month at a time (owner) ----
  closeMonth(db, user, { month }) {
    ownerOnly(user);
    const m = str(month, 7);
    if (!YM.test(m)) throw new AppError('Choose the month.');
    if (m >= new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 7)) throw new AppError('Only months that have finished can be closed.');
    if (isClosed(db, m)) return {};
    db.settings.closedMonths = closedMonths(db).concat([m]).sort();
    db.settings.closedInfo = Object.assign({}, db.settings.closedInfo, { [m]: { closedBy: user.name, closedAt: nowIso() } });
    audit(db, user, 'Closed ' + monthName(m));
    return {};
  },
  reopenMonth(db, user, { month, reason }) {
    ownerOnly(user);
    const m = str(month, 7), why = str(reason, 200);
    if (!isClosed(db, m)) return {};
    if (!why) throw new AppError('Say why the month is being reopened. It is kept in the Activity Log.');
    db.settings.closedMonths = closedMonths(db).filter(x => x !== m);
    const info = Object.assign({}, (db.settings.closedInfo || {})[m], { reopenedBy: user.name, reopenedAt: nowIso(), reason: why });
    db.settings.closedInfo = Object.assign({}, db.settings.closedInfo, { [m]: info });
    audit(db, user, 'Reopened ' + monthName(m) + ': ' + why);
    return {};
  },

  // ---- invitations (owner) ----
  createInvite(db, user, { name, role, code, biz, tenancyId, duty }) {
    if (role === 'tenant') { if (user.role !== 'owner' && user.role !== 'member') throw new AppError('Only the owner or a manager can do that.', 403); if (!db.tenancies.some(t => t.id === tenancyId)) throw new AppError('Tenancy not found.'); } else ownerOnly(user);
    const n = str(name, 60); if (!n) throw new AppError('Enter the person\'s name.');
    if (!['member', 'driver', 'other', 'tenant'].includes(role)) throw new AppError('Choose a role.');
    if (!/^[a-f0-9]{48}$/.test(String(code || ''))) throw new AppError('Invitation code missing.');
    const inv = { id: newId('iv'), hash: crypto.createHash('sha256').update(code).digest('hex'), name: n, role, biz: ['nv', 'cozy'].includes(biz) ? biz : 'both', tenancyId: role === 'tenant' ? String(tenancyId) : '', duty: DUTIES[duty] ? duty : '', expires: new Date(Date.now() + 72 * 3600000).toISOString(), createdBy: user.name, at: nowIso() };
    db.invites.push(inv); audit(db, user, 'Invited ' + n + ' (' + role + ')');
    return { id: inv.id, expires: inv.expires };
  },
  cancelInvite(db, user, { id }) { ownerOnly(user); const i = db.invites.find(x => x.id === id); if (!i) throw new AppError('Invitation not found.'); i.usedAt = i.usedAt || 'cancelled'; audit(db, user, 'Cancelled invitation for ' + i.name); return {}; },
  // ---- sessions: see and sign out devices ----
  revokeSession(db, user, { id, others, current }) {
    const u = db.users.find(x => x.id === user.id);
    const before = (u.sessions || []).length;
    if (!others && id === current) throw new AppError('Use Sign Out to sign out of this device.');
    u.sessions = (u.sessions || []).filter(x => others ? x.id === current : x.id !== id);
    if (others && !current) throw new AppError('Sign out and back in once on this device first, so it can stay signed in.');
    audit(db, u, others ? 'Signed out other devices' : 'Signed out a device');
    return { removed: before - u.sessions.length };
  },
  // ---- per-person notification preferences ----
  saveNotify(db, user, { notify }) {
    const n = notify || {}, u = db.users.find(x => x.id === user.id), out = {};
    ['collections', 'bookings', 'maintenance', 'reports', 'security', 'summary'].forEach(k => { out[k] = n[k] !== false; });
    out.summaryFreq = ['weekly', 'monthly', 'both'].includes(n.summaryFreq) ? n.summaryFreq : 'weekly';
    u.notify = out; return {};
  },
  // ---- vehicle incidents and breakdowns ----
  saveIncident(db, user, { incident }) {
    const x0 = incident || {};
    const rec = { truck: str(x0.truck, 40), date: date(x0.date, 'date'), type: str(x0.type, 40) || 'Breakdown', location: str(x0.location, 80), description: str(x0.description, 400),
      estimate: num(x0.estimate), status: ['Open', 'Awaiting repair', 'Resolved'].includes(x0.status) ? x0.status : 'Open',
      offFrom: x0.offFrom && ISO.test(x0.offFrom) ? x0.offFrom : '', offTo: x0.offTo && ISO.test(x0.offTo) ? x0.offTo : '' };
    if (!(db.settings.vehicles || []).some(v => v.id === rec.truck)) throw new AppError('Choose the vehicle.');
    if (!rec.description) throw new AppError('Describe what happened.');
    if (rec.offFrom && rec.offTo && rec.offTo < rec.offFrom) throw new AppError('The truck cannot be back before it went off the road.');
    let x;
    if (x0.id) { x = db.incidents.find(z => z.id === x0.id); if (!x) throw new AppError('That incident no longer exists.'); }
    else { x = { id: newId('in') }; db.incidents.push(x); }
    Object.assign(x, rec); stamp(x, user, !x0.id);
    audit(db, user, (x0.id ? 'Updated ' : 'Recorded ') + rec.type.toLowerCase() + ' on ' + rec.truck, rec.date);
    return { id: x.id };
  },
  deleteIncident(db, user, { id }) { ownerOnly(user); const x = db.incidents.find(z => z.id === id); if (!x) throw new AppError('That incident no longer exists.'); db.incidents = db.incidents.filter(z => z.id !== id); audit(db, user, 'Deleted incident on ' + x.truck); return {}; },

  // ---- each person's own display preferences (Home layout, theme, density) ----
  savePrefs(db, user, { prefs }) {
    const p = prefs || {}, u = db.users.find(x => x.id === user.id);
    const list = (v, max) => Array.isArray(v) ? v.map(x => str(x, 20)).filter(Boolean).slice(0, max) : undefined;
    const out = Object.assign({}, u.prefs || {});
    if (list(p.homeOrder, 40)) out.homeOrder = list(p.homeOrder, 40);
    if (list(p.homeOff, 40)) out.homeOff = list(p.homeOff, 40);
    if (list(p.quick, 20)) out.quick = list(p.quick, 20);
    if (p.hideAmounts !== undefined) out.hideAmounts = !!p.hideAmounts;
    if (p.reduceMotion !== undefined) out.reduceMotion = !!p.reduceMotion;
    if (['comfortable', 'compact'].includes(p.density)) out.density = p.density;
    if (['auto', 'light', 'dark'].includes(p.theme)) out.theme = p.theme;
    u.prefs = out;
    return {};
  },

  // ---- cash flow forecast assumptions (partners); the opening balance must be confirmed by a person ----
  saveForecast(db, user, { forecast }) {
    const f = forecast || {}, old = db.settings.forecast || {};
    const pick = (k, d, max) => f[k] === undefined ? (old[k] !== undefined ? old[k] : d) : Math.max(0, Math.min(max, parseInt(f[k], 10) || 0));
    const out = { baseDelay: pick('baseDelay', 0, 120), cautiousDelay: pick('cautiousDelay', 14, 120), optimisticRecovery: pick('optimisticRecovery', 50, 100),
      partnerTransfers: f.partnerTransfers === undefined ? old.partnerTransfers !== false : f.partnerTransfers !== false, runningCosts: f.runningCosts === undefined ? old.runningCosts !== false : f.runningCosts !== false };
    if (f.openingBalance === null || f.openingBalance === '' || f.openingBalance === undefined) Object.assign(out, { openingBalance: null, openingDate: '', confirmedBy: '' });
    else {
      out.openingBalance = num(f.openingBalance);
      const same = old.openingBalance === out.openingBalance;
      out.openingDate = same && old.openingDate ? old.openingDate : new Date().toISOString().slice(0, 10);
      out.confirmedBy = same && old.confirmedBy ? old.confirmedBy : user.name;
    }
    db.settings.forecast = out;
    audit(db, user, 'Updated cash flow forecast settings' + (out.openingBalance != null && old.openingBalance !== out.openingBalance ? ' (opening balance EC$' + out.openingBalance.toFixed(2) + ')' : ''));
    return {};
  },

  // ---- how a paid invoice's money was used: shared, partly used for business costs, or kept ----
  setInvoiceFunds(db, user, { invoiceId, mode, links }) {
    const inv = db.invoices.find(i => i.id === invoiceId);
    if (!inv || inv.void) throw new AppError('That invoice no longer exists.');
    if (calcBalance(inv) > 0.009) throw new AppError('Record the customer payment first.');
    const m = ['full', 'part', 'all'].includes(mode) ? mode : 'full';
    const clean = m === 'full' ? [] : (Array.isArray(links) ? links : []).map(l => ({ expenseId: str(l.expenseId, 40), amount: round2(num(l.amount)) })).filter(l => l.amount > 0);
    const seen = new Set();
    clean.forEach(l => {
      const e = db.expenses.find(x => x.id === l.expenseId && !x.void);
      if (!e) throw new AppError('A linked expense no longer exists.');
      if (seen.has(e.id)) throw new AppError('An expense is linked twice.'); seen.add(e.id);
      const other = expenseFunding(db, e.id, inv.id).total;
      if (l.amount > round2(e.amount - other) + 0.005) throw new AppError(e.description + ': only EC$' + Math.max(0, e.amount - other).toFixed(2) + ' of it is left to be paid from an invoice.');
    });
    const total = round2(clean.reduce((t, l) => t + l.amount, 0)), profit = invJobProfit(inv);
    if (total > Math.max(0, profit) + 0.005) throw new AppError('The linked amounts (EC$' + total.toFixed(2) + ') are more than this invoice\'s job profit (EC$' + profit.toFixed(2) + ').');
    inv.useOfFunds = { mode: m, links: clean, by: user.name, at: nowIso() };
    audit(db, user, m === 'full' ? 'Set invoice money to be shared as normal' : m === 'all' ? 'Kept invoice money for business costs' : 'Linked EC$' + total.toFixed(2) + ' of business costs to the invoice', '#' + String(inv.no).padStart(3, '0'));
    return {};
  },

  // ---- partner transactions: transfers and settlements between the partners (never business expenses) ----
  savePartnerTx(db, user, { tx }) {
    const t = tx || {};
    const names = (db.settings.partners || []).map(p => p.name);
    const rec = { date: date(t.date, 'date'), from: str(t.from, 40), to: str(t.to, 40), amount: num(t.amount),
      type: ['Profit share', 'Expense settlement', 'Other'].includes(t.type) ? t.type : 'Other',
      invoiceId: str(t.invoiceId, 40), method: str(t.method, 40) || 'Bank transfer', reference: str(t.reference, 80), note: str(t.note, 300) };
    if (rec.amount <= 0) throw new AppError('Enter the amount transferred.');
    if (!names.includes(rec.from) || !names.includes(rec.to) || rec.from === rec.to) throw new AppError('Choose who paid and who received it.');
    if (rec.invoiceId) {
      const inv = db.invoices.find(i => i.id === rec.invoiceId);
      if (!inv) throw new AppError('That invoice no longer exists.');
      if (calcBalance(inv) > 0.009) throw new AppError('Record the customer payment first; the transfer follows once the invoice is paid.');
    }
    let x;
    if (t.id) { x = db.partnerTx.find(z => z.id === t.id); if (!x) throw new AppError('That transaction no longer exists.'); }
    else { x = { id: newId('pt') }; db.partnerTx.push(x); }
    Object.assign(x, rec); stamp(x, user, !t.id);
    audit(db, user, (t.id ? 'Edited' : 'Recorded') + ' partner transfer EC$' + rec.amount.toFixed(2) + ' from ' + rec.from + ' to ' + rec.to, rec.invoiceId ? '#' + ((db.invoices.find(i => i.id === rec.invoiceId) || {}).no || '') : '');
    return { id: x.id };
  },

  deletePartnerTx(db, user, { id }) {
    ownerOnly(user);
    const x = db.partnerTx.find(z => z.id === id);
    if (!x) throw new AppError('That transaction no longer exists.');
    db.partnerTx = db.partnerTx.filter(z => z.id !== id);
    audit(db, user, 'Deleted partner transfer EC$' + x.amount.toFixed(2) + ' (' + x.date + ')');
    return {};
  },

  // ---- driver pay: what was paid to each driver (owed = their driver fees on jobs, less these payments) ----
  saveDriverPay(db, user, { pay }) {
    const p = pay || {};
    const drv = (db.settings.drivers || []).find(d => d.id === p.driverId);
    if (!drv) throw new AppError('Choose the driver.');
    const rec = { driverId: drv.id, date: date(p.date, 'date'), amount: num(p.amount), method: str(p.method, 40) || 'Cash', paidBy: str(p.paidBy, 40), note: str(p.note, 300) };
    if (rec.amount <= 0) throw new AppError('Enter the amount paid.');
    let x;
    if (p.id) { x = db.driverPay.find(z => z.id === p.id); if (!x) throw new AppError('That payment no longer exists.'); }
    else { x = { id: newId('dp') }; db.driverPay.push(x); }
    Object.assign(x, rec); stamp(x, user, !p.id);
    audit(db, user, (p.id ? 'Edited' : 'Recorded') + ' driver payment EC$' + rec.amount.toFixed(2) + ' to ' + drv.name);
    return { id: x.id };
  },

  deleteDriverPay(db, user, { id }) {
    ownerOnly(user);
    const x = db.driverPay.find(z => z.id === id);
    if (!x) throw new AppError('That payment no longer exists.');
    db.driverPay = db.driverPay.filter(z => z.id !== id);
    audit(db, user, 'Deleted driver payment EC$' + x.amount.toFixed(2));
    return {};
  },

  // ---- quotes ----
  saveQuote(db, user, { quote }) {
    if (!quote) throw new AppError('Nothing to save.');
    const lines = (quote.lines || []).map(l => cleanLine(l, db.settings));
    if (!lines.length) throw new AppError('Add at least one line to the quote.');
    requireDriverFees(lines, quote.id ? (db.quotes.find(x => x.id === quote.id) || {}).lines : null);
    const client = upsertClient(db, quote.client || {}, user);
    const issueDate = date(quote.issueDate, 'quote date');
    const validUntil = quote.validUntil ? date(quote.validUntil, 'valid-until date') : addDays(issueDate, db.settings.quoteDays || 30);
    let q;
    if (quote.id) {
      q = db.quotes.find(x => x.id === quote.id);
      if (!q) throw new AppError('That quote no longer exists.');
      if (q.status === 'Accepted') throw new AppError('This quote has already become an invoice.');
    } else {
      q = { id: newId('q'), no: db.nextQuoteNo++, status: 'Open', sent: [] };
      db.quotes.push(q);
    }
    Object.assign(q, { clientId: client.id, issueDate, validUntil, lines, notes: str(quote.notes, 500), internalNotes: str(quote.internalNotes, 1000) });
    stamp(q, user, !quote.id);
    audit(db, user, quote.id ? 'Edited quote' : 'Created quote', 'Q' + q.no);
    return { id: q.id, no: q.no };
  },

  setQuoteStatus(db, user, { quoteId, status }) {
    const q = db.quotes.find(x => x.id === quoteId);
    if (!q) throw new AppError('That quote no longer exists.');
    if (!['Open', 'Declined'].includes(status)) throw new AppError('Unknown status.');
    if (q.status === 'Accepted') throw new AppError('This quote has already become an invoice.');
    q.status = status; stamp(q, user, false);
    audit(db, user, 'Marked quote ' + status.toLowerCase(), 'Q' + q.no);
    return {};
  },

  deleteQuote(db, user, { quoteId }) {
    const q = db.quotes.find(x => x.id === quoteId);
    if (!q) throw new AppError('That quote no longer exists.');
    if (q.status === 'Accepted') throw new AppError('This quote has become an invoice and is kept for the record.');
    db.quotes = db.quotes.filter(x => x.id !== quoteId);
    audit(db, user, 'Deleted quote', 'Q' + q.no);
    return {};
  },

  convertQuote(db, user, { quoteId, jobDate }) {
    const q = db.quotes.find(x => x.id === quoteId);
    if (!q) throw new AppError('That quote no longer exists.');
    if (q.status === 'Accepted') throw new AppError('This quote has already become an invoice.');
    const d = jobDate ? date(jobDate, 'job date') : new Date().toISOString().slice(0, 10);
    assertOpen(db, [d]);
    q.lines.forEach(l => {
      if ((l.costs || {}).driver > 0) return;
      const rate = (db.settings.routeRates || []).find(r => r.route === l.route);
      if (rate && rate.driver > 0) { l.costs = Object.assign({}, l.costs, { driver: rate.driver }); return; }
      throw new AppError('Add the driver fee to this quote (Edit quote) before turning it into an invoice.');
    });
    const inv = { id: newId('i'), no: db.nextInvoiceNo++, clientId: q.clientId, issueDate: d, dueDate: addDays(d, db.settings.paymentDays),
      lines: q.lines.map(l => ({ ...l, id: newId('l'), date: d })), notes: q.notes, internalNotes: (q.internalNotes ? q.internalNotes + ' | ' : '') + 'From quote Q' + q.no,
      payments: [], sent: [], void: null, fromQuote: q.id };
    stamp(inv, user, true);
    db.invoices.push(inv);
    q.status = 'Accepted'; q.invoiceId = inv.id; stamp(q, user, false);
    audit(db, user, 'Turned quote Q' + q.no + ' into invoice', '#' + inv.no);
    return { id: inv.id, no: inv.no };
  },

  markQuoteSent(db, user, { quoteId, via }) {
    const q = db.quotes.find(x => x.id === quoteId);
    if (!q) throw new AppError('That quote no longer exists.');
    q.sent.push({ at: nowIso(), by: user.name, via: str(via, 40) || 'Shared' });
    return {};
  },

  // ---- truck reminders ----
  saveReminder(db, user, { reminder }) {
    const r = reminder || {};
    const rec = { truck: str(r.truck, 40), type: str(r.type, 60) || 'Other', due: r.due ? date(r.due, 'due date') : '',
      dueKm: Math.max(0, Math.round(num(r.dueKm))), everyKm: Math.max(0, Math.round(num(r.everyKm))),
      repeatMonths: Math.max(0, Math.min(60, parseInt(r.repeatMonths, 10) || 0)), note: str(r.note, 300), expectedCost: num(r.expectedCost) };
    if (!rec.due && !rec.dueKm) throw new AppError('Give a due date, a due mileage, or both.');
    let x;
    if (r.id) { x = db.reminders.find(z => z.id === r.id); if (!x) throw new AppError('That reminder no longer exists.'); }
    else { x = { id: newId('r'), history: [] }; db.reminders.push(x); }
    Object.assign(x, rec);
    stamp(x, user, !r.id);
    audit(db, user, (r.id ? 'Edited' : 'Added') + ' reminder: ' + rec.type, rec.truck);
    return { id: x.id };
  },

  completeReminder(db, user, { id, doneDate, cost, method, odometer }) {
    const x = db.reminders.find(z => z.id === id);
    if (!x) throw new AppError('That reminder no longer exists.');
    const done = doneDate ? date(doneDate, 'date done') : new Date().toISOString().slice(0, 10);
    if (num(cost) > 0) assertOpen(db, [done]);
    x.history = x.history || [];
    x.history.unshift({ due: x.due, dueKm: x.dueKm, done, odometer: Math.round(num(odometer)) || 0, by: user.name, cost: num(cost) });
    let expenseId = null;
    if (num(cost) > 0) {
      const e = { id: newId('e'), date: done, truck: x.truck, category: /insur/i.test(x.type) ? 'Insurance' : /licen|tax|inspect/i.test(x.type) ? 'Licensing' : 'Maintenance',
        description: x.type + (x.note ? ' - ' + x.note : ''), amount: num(cost), method: str(method, 40) || 'Cash', paidBy: '', notes: 'From reminder', void: null };
      stamp(e, user, true); db.expenses.push(e); expenseId = e.id;
    }
    const odo = Math.round(num(odometer)) || latestOdometer(db, x.truck);
    if (x.repeatMonths || x.everyKm) {
      if (x.repeatMonths && x.due) {
        const [y, m, d] = x.due.split('-').map(Number);
        x.due = new Date(Date.UTC(y, m - 1 + x.repeatMonths, d)).toISOString().slice(0, 10);
      }
      if (x.everyKm) x.dueKm = (odo || x.dueKm || 0) + x.everyKm;
    } else {
      db.reminders = db.reminders.filter(z => z.id !== id);
    }
    audit(db, user, 'Completed ' + x.type, x.truck);
    return { expenseId };
  },

  deleteReminder(db, user, { id }) {
    const x = db.reminders.find(z => z.id === id);
    if (!x) throw new AppError('That reminder no longer exists.');
    db.reminders = db.reminders.filter(z => z.id !== id);
    audit(db, user, 'Deleted reminder: ' + x.type, x.truck);
    return {};
  },

  // ---- partner capital records ----
  saveCapital(db, user, { entry }) {
    const e = entry || {};
    const amount = num(e.amount);
    if (amount <= 0) throw new AppError('Enter the EC$ value.');
    const rec = { partner: str(e.partner, 40), type: e.type === 'drawing' ? 'drawing' : 'contribution', truck: str(e.truck, 40), item: str(e.item, 120),
      original: str(e.original, 60), gbp: num(e.gbp), amount, date: e.date ? date(e.date, 'date') : '', notes: str(e.notes, 1500) };
    if (!rec.partner) throw new AppError('Choose the partner.');
    if (!rec.item) rec.item = rec.type === 'drawing' ? 'Profit paid out' : 'Contribution';
    let x;
    if (e.id) { x = db.capital.find(z => z.id === e.id); if (!x) throw new AppError('That record no longer exists.'); }
    else { x = { id: newId('k') }; db.capital.push(x); }
    Object.assign(x, rec);
    stamp(x, user, !e.id);
    audit(db, user, (e.id ? 'Edited ' : 'Added ') + rec.type + ' for ' + rec.partner, 'EC$' + amount.toFixed(2));
    return { id: x.id };
  },

  deleteCapital(db, user, { id }) {
    const x = db.capital.find(z => z.id === id);
    if (!x) throw new AppError('That record no longer exists.');
    db.capital = db.capital.filter(z => z.id !== id);
    audit(db, user, 'Deleted ' + x.type + ' for ' + x.partner, x.item);
    return {};
  },

  // ---- attachment records (file contents live in a separate store) ----
  addAttachment(db, user, { target, file }) {
    if (user.role === 'driver' && !['booking', 'fuel', 'incident', 'project'].includes(target && target.kind)) throw new AppError('Your access does not include that.', 403);
    const rec = findTarget(db, target);
    rec.attachments = rec.attachments || [];
    if (rec.attachments.length >= (target.kind === 'vehicle' || target.kind === 'project' ? 60 : 10)) throw new AppError('No more room for files on this record.');
    rec.attachments.push({ id: str(file.id, 60), name: str(file.name, 120), type: str(file.type, 60), size: Number(file.size) || 0, at: nowIso(), by: user.name,
      docType: str(file.docType, 40), expires: file.expires && ISO.test(file.expires) ? file.expires : '' });
    audit(db, user, 'Attached ' + str(file.name, 120), target.kind);
    return {};
  },

  removeAttachment(db, user, { target, fileId }) {
    const rec = findTarget(db, target);
    rec.attachments = (rec.attachments || []).filter(a => a.id !== fileId);
    audit(db, user, 'Removed attachment', target.kind);
    return {};
  },


  // ---- bookings (jobs planned ahead) ----
  saveBooking(db, user, { booking }) {
    const b = booking || {};
    const driver = user.role === 'driver';
    const rec = {
      date: date(b.date, 'job date'), time: str(b.time, 10), truck: str(b.truck, 40), route: str(b.route, 80),
      client: str(b.client, 100), phone: str(b.phone, 40), load: str(b.load, 80), title: str(b.title, 120), sailing: str(b.sailing, 120),
      notes: str(b.notes, 1000), driverId: str(b.driverId, 40)
    };
    if (!rec.client) throw new AppError('Enter the customer.');
    let x;
    if (b.id) {
      x = db.bookings.find(z => z.id === b.id);
      if (!x) throw new AppError('That booking no longer exists.');
      if (x.status === 'Invoiced') throw new AppError('This job has been invoiced; edit the invoice instead.');
    } else {
      x = { id: newId('b'), status: b.status === 'Done' ? 'Done' : b.status === 'Tentative' ? 'Tentative' : 'Booked', reportedBy: '' };
      db.bookings.push(x);
      if (x.status === 'Done') { x.doneAt = nowIso(); x.reportedBy = user.name; }
    }
    if (!driver) { rec.price = num(b.price); rec.qty = num(b.qty) || 1; rec.category = str(b.category, 60) || 'Building Materials';
      rec.costs = COST_KEYS.reduce((o, k) => { o[k] = num(b.costs && b.costs[k]); return o; }, {}); rec.driverId = str(b.driverId, 40); }
    else if (b.costs) { rec.costs = Object.assign({}, x.costs || {}, { fuel: num(b.costs.fuel), boat: num(b.costs.boat) }); }
    Object.assign(x, rec);
    stamp(x, user, !b.id);
    if (b.id && ['Tentative', 'Booked'].includes(b.status) && ['Tentative', 'Booked'].includes(x.status) && user.role !== 'driver') x.status = b.status;
    audit(db, user, (b.id ? 'Edited booking' : (x.status === 'Done' ? 'Reported job' : 'Booked job')) + ' for ' + rec.client, rec.date);
    return { id: x.id };
  },

  setBookingStatus(db, user, { id, status, note }) {
    const x = db.bookings.find(z => z.id === id);
    if (!x) throw new AppError('That booking no longer exists.');
    if (x.status === 'Invoiced') throw new AppError('This job has already been invoiced.');
    if (!['Tentative', 'Booked', 'Done', 'Cancelled'].includes(status)) throw new AppError('Unknown status.');
    if (user.role === 'driver' && status === 'Cancelled') throw new AppError('Ask the office to cancel a booking.');
    x.status = status;
    if (status === 'Done') { x.doneAt = nowIso(); x.reportedBy = user.name; }
    if (note) x.notes = (x.notes ? x.notes + '\n' : '') + user.name + ': ' + str(note, 500);
    stamp(x, user, false);
    audit(db, user, 'Marked booking ' + status.toLowerCase(), x.client);
    return {};
  },

  deleteBooking(db, user, { id }) {
    const x = db.bookings.find(z => z.id === id);
    if (!x) throw new AppError('That booking no longer exists.');
    if (x.status === 'Invoiced') throw new AppError('This job has been invoiced and is kept for the record.');
    db.bookings = db.bookings.filter(z => z.id !== id);
    audit(db, user, 'Deleted booking', x.client);
    return {};
  },

  // ---- fuel and mileage ----
  saveFuel(db, user, { entry }) {
    const e = entry || {};
    const litres = num(e.litres), cost = num(e.cost), odometer = Math.round(num(e.odometer));
    if (litres <= 0) throw new AppError('Enter the litres.');
    if (odometer <= 0) throw new AppError('Enter the odometer reading.');
    const rec = { date: date(e.date, 'date'), truck: str(e.truck, 40), litres, cost, odometer, full: e.full !== false, station: str(e.station, 80), notes: str(e.notes, 300), driverId: str(e.driverId, 40) };
    if (litres > 1500) throw new AppError('That is more litres than a truck tank holds. Check the figure.');
    const prev = db.fuel.filter(f => f.truck === rec.truck && f.id !== e.id && f.date <= rec.date).sort((a, b) => a.odometer - b.odometer).pop();
    if (prev && odometer < prev.odometer) throw new AppError('That odometer reading is lower than the last one for this truck (' + prev.odometer + ').');
    let x;
    if (e.id) { x = db.fuel.find(z => z.id === e.id); if (!x) throw new AppError('That entry no longer exists.'); }
    else { x = { id: newId('fu') }; db.fuel.push(x); }
    Object.assign(x, rec);
    stamp(x, user, !e.id);
    if (!e.id && e.asExpense && cost > 0 && user.role !== 'driver') {
      assertOpen(db, [rec.date]);
      const ex = { id: newId('e'), date: rec.date, truck: rec.truck, category: 'Fuel', description: litres + ' L fuel' + (rec.station ? ' at ' + rec.station : ''), amount: cost, method: 'Cash', paidBy: '', notes: 'From fuel log', void: null };
      stamp(ex, user, true); db.expenses.push(ex); x.expenseId = ex.id;
    }
    audit(db, user, (e.id ? 'Edited' : 'Logged') + ' fuel ' + litres + ' L', rec.truck);
    return { id: x.id };
  },

  deleteFuel(db, user, { id }) {
    const x = db.fuel.find(z => z.id === id);
    if (!x) throw new AppError('That entry no longer exists.');
    if (user.role === 'driver' && x.createdBy !== user.name) throw new AppError('Ask the office to remove this entry.');
    db.fuel = db.fuel.filter(z => z.id !== id);
    audit(db, user, 'Deleted fuel entry', x.truck);
    return {};
  },

  // ---- phone notifications ----
  savePushSub(db, user, { sub, prefs }) {
    if (!sub || !sub.endpoint || !sub.keys) throw new AppError('Notifications could not be set up on this device.');
    db.pushSubs = db.pushSubs.filter(p => p.endpoint !== sub.endpoint);
    db.pushSubs.push({ userId: user.id, endpoint: str(sub.endpoint, 1000), keys: { p256dh: str(sub.keys.p256dh, 200), auth: str(sub.keys.auth, 100) },
      prefs: Object.assign({ overdue: true, reminders: true, weekly: true, bookings: true }, prefs || {}), at: nowIso() });
    return {};
  },

  updatePushPrefs(db, user, { endpoint, prefs }) {
    const p = db.pushSubs.find(x => x.endpoint === endpoint && x.userId === user.id);
    if (!p) throw new AppError('Notifications are not switched on for this device.');
    p.prefs = Object.assign(p.prefs || {}, prefs || {});
    return {};
  },

  removePushSub(db, user, { endpoint }) {
    db.pushSubs = db.pushSubs.filter(p => !(p.endpoint === endpoint && p.userId === user.id));
    return {};
  },

  importData(db, user, { payload, replace }) {
    ownerOnly(user);
    const p = payload || {};
    const hasData = db.invoices.length || db.expenses.length || db.startup.length;
    if (hasData && !replace) throw new AppError('The app already holds records. Tick "Replace existing records" to import anyway.');
    const clients = [], invoices = [], expenses = [], startup = [];
    const clientByName = {};
    (p.invoices || []).forEach(src => {
      const name = str(src.client, 100) || 'Unknown customer';
      let c = clientByName[name.toLowerCase()];
      if (!c) { c = { id: newId('c'), name, phone: '', email: '', address: '', notes: '', createdBy: user.name, createdAt: nowIso() }; clientByName[name.toLowerCase()] = c; clients.push(c); }
      const lines = (src.lines || []).map(l => cleanLine(l, db.settings));
      if (!lines.length) return;
      const issueDate = date(src.issueDate, 'invoice date');
      invoices.push({
        id: newId('i'), no: parseInt(src.no, 10) || 0, clientId: c.id, issueDate,
        dueDate: addDays(issueDate, db.settings.paymentDays), lines, notes: str(src.notes, 500), internalNotes: str(src.internalNotes, 1000),
        payments: (src.payments || []).map(x => ({ id: newId('p'), date: date(x.date, 'payment date'), amount: num(x.amount), method: str(x.method, 40), note: str(x.note, 200), by: 'Import', at: nowIso() })),
        sent: [], void: null, createdBy: 'Import', createdAt: nowIso(), updatedBy: 'Import', updatedAt: nowIso()
      });
    });
    (p.expenses || []).forEach(e => {
      const amount = num(e.amount); if (amount <= 0) return;
      expenses.push({ id: newId('e'), date: date(e.date, 'date'), truck: str(e.truck, 40), category: str(e.category, 60), description: str(e.description, 200) || str(e.category, 60), amount, method: str(e.method, 40), paidBy: '', notes: str(e.notes, 500), void: null, createdBy: 'Import', createdAt: nowIso() });
    });
    (p.startup || []).forEach(s => {
      const amount = num(s.amount); if (amount <= 0) return;
      startup.push({ id: newId('s'), date: '', truck: str(s.truck, 40), category: str(s.category, 60), description: str(s.description, 200) || str(s.category, 60), amount, original: str(s.original, 60), paidBy: str(s.paidBy, 40), notes: str(s.notes, 1500), createdBy: 'Import', createdAt: nowIso() });
    });
    const capital = [];
    (p.capital || []).forEach(k => {
      const amount = num(k.amount); if (amount <= 0) return;
      capital.push({ id: newId('k'), partner: str(k.partner, 40), type: 'contribution', truck: str(k.truck, 40), item: str(k.item, 120), original: str(k.original, 60),
        gbp: num(k.gbp), amount, date: '', notes: str(k.notes, 1500), createdBy: 'Import', createdAt: nowIso() });
    });
    if (!invoices.length && !expenses.length) throw new AppError('No records were found in that file.');
    db.clients = clients; db.invoices = invoices; db.expenses = expenses; db.startup = startup;
    if (capital.length) db.capital = capital;
    if (num(p.gbpRate) > 0) db.settings.gbpRate = num(p.gbpRate);
    db.nextInvoiceNo = Math.max(db.nextInvoiceNo, invoices.reduce((m, i) => Math.max(m, i.no), 0) + 1);
    audit(db, user, 'Imported workbook: ' + invoices.length + ' invoices, ' + expenses.length + ' expenses, ' + startup.length + ' start-up items');
    return { invoices: invoices.length, expenses: expenses.length, startup: startup.length, clients: clients.length, capital: capital.length };
  }
};

// ---- closed months: once a month is closed, nothing dated in it can change ----
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const YM = /^\d{4}-\d{2}$/;
export const monthName = ym => MONTHS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);
export function closedMonths(db) { return ((db.settings && db.settings.closedMonths) || []).filter(m => YM.test(m)); }
export const isClosed = (db, ym) => closedMonths(db).includes(ym);
/** Kept for anything older that asks for a single cut-off: the latest closed month's last day. */
export function lockEnd(db) {
  const c = closedMonths(db).sort(); if (!c.length) return '';
  const [y, mo] = c[c.length - 1].split('-').map(Number);
  return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
}
function assertOpen(db, dates) {
  const hit = (dates || []).filter(Boolean).map(d => String(d).slice(0, 7)).find(m => isClosed(db, m));
  if (hit) throw new AppError(monthName(hit) + ' is closed, so records dated in it can no longer be changed. Reopen the month under Manage, Month-End if a correction is needed.');
}
const invDates = inv => [inv.issueDate].concat((inv.lines || []).map(l => l.date));

function findInvoice(db, id) {
  const inv = db.invoices.find(x => x.id === id);
  if (!inv) throw new AppError('That invoice no longer exists.');
  if (inv.void) throw new AppError('That invoice has been cancelled.');
  return inv;
}
function findTarget(db, t) {
  if (t && t.kind === 'vehicle') { const v = (db.settings.vehicles || []).find(x => x.id === t.id); if (!v) throw new AppError('That vehicle no longer exists.'); return v; }
  if (t && t.kind === 'project') { const p = (db.projects || []).find(x => x.id === t.id); if (!p) throw new AppError('That project no longer exists.'); p.attachments = p.attachments || []; return p; }
  const list = { invoice: db.invoices, expense: db.expenses, quote: db.quotes, booking: db.bookings, fuel: db.fuel, incident: db.incidents }[t && t.kind];
  const rec = list && list.find(x => x.id === t.id);
  if (!rec) throw new AppError('That record no longer exists.');
  return rec;
}
export function latestOdometer(db, truck) {
  return (db.fuel || []).filter(f => f.truck === truck).reduce((m, f) => Math.max(m, f.odometer || 0), 0);
}

// ==================== NV Construction additions: skip bins and engine hours ====================
// Inserted into core.mjs by convert.py so it can use the helpers above (str, num, date, newId, stamp, audit, AppError).
Object.assign(actions, {
  /** Skip bin register: one record per physical bin. */
  saveBin(db, user, { bin }) {
    if (user.role !== 'owner' && user.role !== 'member') throw new AppError('Only the owner or a manager can change the bin register.', 403);
    const b = bin || {}, name = str(b.name, 40);
    if (!name) throw new AppError('Give the bin a name or number, for example Bin 3.');
    const same = db.bins.find(x => x.name.toLowerCase() === name.toLowerCase() && x.id !== b.id);
    if (same) throw new AppError('There is already a bin called ' + same.name + '.');
    let x = b.id ? db.bins.find(z => z.id === b.id) : null;
    if (b.id && !x) throw new AppError('That bin no longer exists.');
    if (!x) { x = { id: newId('bin') }; db.bins.push(x); }
    Object.assign(x, { name, size: str(b.size, 40), notes: str(b.notes, 300), active: b.active !== false });
    stamp(x, user, !b.id); audit(db, user, (b.id ? 'Edited' : 'Added') + ' skip bin', name);
    return { id: x.id };
  },
  deleteBin(db, user, { id }) {
    if (user.role !== 'owner') throw new AppError('Only the owner can delete a bin.', 403);
    const x = db.bins.find(z => z.id === id); if (!x) throw new AppError('That bin no longer exists.');
    if (db.hires.some(h => h.binId === id)) throw new AppError(x.name + ' has hire history. Mark it out of service instead.');
    db.bins = db.bins.filter(z => z.id !== id); audit(db, user, 'Deleted skip bin', x.name); return {};
  },
  /** A bin going out to a site. Crew can record deliveries and collections. */
  saveHire(db, user, { hire }) {
    const h = hire || {};
    const bin = db.bins.find(b => b.id === h.binId); if (!bin) throw new AppError('Choose the bin.');
    const outDate = date(h.outDate, 'delivery date');
    const collectBy = h.collectBy ? date(h.collectBy, 'collect-by date') : '';
    if (collectBy && collectBy < outDate) throw new AppError('The collect-by date is before the delivery date.');
    const client = str(h.client, 100); if (!client) throw new AppError('Enter the customer.');
    const busy = db.hires.find(x => x.binId === bin.id && x.status === 'Out' && x.id !== h.id);
    if (busy) throw new AppError(bin.name + ' is already out with ' + busy.client + '. Collect it first.');
    let x = h.id ? db.hires.find(z => z.id === h.id) : null;
    if (h.id && !x) throw new AppError('That hire no longer exists.');
    if (!x) { x = { id: newId('h'), status: 'Out', backDate: '', invoiceId: '' }; db.hires.push(x); }
    Object.assign(x, { binId: bin.id, client, phone: str(h.phone, 40), area: str(h.area, 80), address: str(h.address, 200), outDate, collectBy, load: str(h.load, 60), notes: str(h.notes, 300) });
    stamp(x, user, !h.id); audit(db, user, (h.id ? 'Edited' : 'Delivered') + ' ' + bin.name, client);
    return { id: x.id };
  },
  collectHire(db, user, { id, backDate, undo }) {
    const x = db.hires.find(z => z.id === id); if (!x) throw new AppError('That hire no longer exists.');
    if (undo) { x.status = 'Out'; x.backDate = ''; }
    else { const d = date(backDate, 'collection date'); if (d < x.outDate) throw new AppError('The collection date is before the delivery date.'); x.status = 'Collected'; x.backDate = d; }
    stamp(x, user, false); audit(db, user, undo ? 'Marked bin back out' : 'Collected bin', x.client); return {};
  },
  deleteHire(db, user, { id }) {
    if (user.role === 'driver' || user.role === 'other') throw new AppError('Your access does not include deleting hires.', 403);
    const x = db.hires.find(z => z.id === id); if (!x) throw new AppError('That hire no longer exists.');
    db.hires = db.hires.filter(z => z.id !== id); audit(db, user, 'Deleted bin hire', x.client); return {};
  },
  /** Engine-hour meter readings, and services done at a reading. */
  saveHours(db, user, { entry }) {
    const e = entry || {}, truck = str(e.truck, 40); if (!truck) throw new AppError('Choose the machine.');
    const hours = num(e.hours); if (!(hours > 0)) throw new AppError('Enter the hour-meter reading.');
    const d = date(e.date, 'date');
    const prev = db.hours.filter(z => z.truck === truck && z.id !== e.id && z.date <= d).sort((a, b) => b.date < a.date ? -1 : b.date > a.date ? 1 : b.hours - a.hours)[0];
    if (prev && hours < prev.hours) throw new AppError('That is lower than the ' + prev.hours + ' hours recorded on ' + prev.date + '. Check the meter.');
    let x = e.id ? db.hours.find(z => z.id === e.id) : null;
    if (e.id && !x) throw new AppError('That reading no longer exists.');
    if (!x) { x = { id: newId('hr') }; db.hours.push(x); }
    Object.assign(x, { truck, date: d, hours, serviced: !!e.serviced, note: str(e.note, 200) });
    stamp(x, user, !e.id); audit(db, user, (x.serviced ? 'Recorded service at ' : 'Recorded ') + hours + ' hours', truck);
    return { id: x.id };
  },
  deleteHours(db, user, { id }) {
    const x = db.hours.find(z => z.id === id); if (!x) throw new AppError('That reading no longer exists.');
    if (user.role === 'driver' && x.createdBy !== user.name) throw new AppError('You can only delete your own readings.', 403);
    db.hours = db.hours.filter(z => z.id !== id); audit(db, user, 'Deleted hour reading', x.truck); return {};
  },
  setHourPlan(db, user, { truck, every }) {
    if (user.role !== 'owner' && user.role !== 'member') throw new AppError('Only the owner or a manager can set service intervals.', 403);
    const t = str(truck, 40); if (!t) throw new AppError('Choose the machine.');
    const n = Math.max(0, Math.round(num(every)));
    if (n) db.hourPlans[t] = { every: n }; else delete db.hourPlans[t];
    audit(db, user, n ? 'Service every ' + n + ' hours' : 'Removed hour-based servicing', t); return {};
  }
});


// ==================== NV Construction: building projects ====================
// A project is one residential or commercial build. Money comes in through stage payments (residential)
// or interim valuations with retention (commercial); costs are logged against the project and count as
// direct costs in every report (see Calc.facts). Inserted into core.mjs by convert.py.
const P_STATUS = ['Quoted', 'Won', 'On site', 'Handed over', 'Defects period', 'Closed', 'Lost'];
const P_SECTORS = ['Residential', 'Commercial'];
const P_HEADINGS = ['labour', 'material', 'subcontract', 'plant', 'fuel', 'tipping', 'other'];
const pmgr = u => { if (u.role !== 'owner' && u.role !== 'member') throw new AppError('Only the owner or a manager can change project money or settings.', 403); };
const pfind = (db, id) => { const p = (db.projects || []).find(x => x.id === id); if (!p) throw new AppError('That project no longer exists.'); return p; };
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
/** Contract value now: the contract sum plus approved variations. */
export function projectValue(p) { return r2((p.contractSum || 0) + (p.variations || []).filter(v => v.status === 'Approved').reduce((t, v) => t + v.amount, 0)); }
/** What has been invoiced through the project (live invoices only). */
export function projectInvoiced(db, p) { return r2(db.invoices.filter(i => i.projectId === p.id && !i.void).reduce((t, i) => t + (i.lines || []).reduce((s, l) => s + (l.qty || 1) * (l.price || 0), 0), 0)); }
function projectInvoice(db, user, p, title, detail, amount, extra) {
  if (!(amount > 0.009)) throw new AppError('There is nothing to invoice: the amount works out at EC$' + r2(amount).toFixed(2) + '.');
  const client = db.clients.find(c => c.id === p.clientId);
  const res = actions.saveInvoice(db, user, { invoice: { client: client ? { id: client.id, name: client.name } : { name: p.client }, issueDate: extra.date || new Date().toISOString().slice(0, 10),
    notes: extra.notes || '', lines: [{ date: extra.date || new Date().toISOString().slice(0, 10), truck: '', route: p.area, category: p.type, load: '', title, detail, qty: 1, price: r2(amount), costs: {} }] } });
  const inv = db.invoices.find(i => i.id === res.id); inv.projectId = p.id;
  if (!p.clientId) p.clientId = inv.clientId;
  return inv;
}
Object.assign(actions, {
  saveProject(db, user, { project }) {
    pmgr(user);
    const x0 = project || {}, name = str(x0.name, 120); if (!name) throw new AppError('Give the project a name, for example “Charles residence, Calliaqua”.');
    const sector = P_SECTORS.includes(x0.sector) ? x0.sector : 'Residential', status = P_STATUS.includes(x0.status) ? x0.status : 'Quoted';
    const clientName = str(x0.client, 100); if (!clientName) throw new AppError('Enter the client.');
    const known = db.clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
    const client = upsertClient(db, Object.assign({ name: clientName }, known ? {} : { phone: x0.phone, email: x0.email, address: x0.site }), user);
    const stages = (Array.isArray(x0.stages) ? x0.stages : []).slice(0, 20).map(s => ({ id: s.id || newId('st'), name: str(s.name, 80) || 'Stage', pct: Math.max(0, Math.min(100, num(s.pct))), due: s.due && ISO.test(s.due) ? s.due : '', invoiceId: s.invoiceId || '' })).filter(s => s.pct > 0);
    const pctTotal = stages.reduce((t, s) => t + s.pct, 0);
    if (stages.length && Math.abs(pctTotal - 100) > 0.01) throw new AppError('The payment stages add up to ' + r2(pctTotal) + '%. They need to add up to 100%.');
    const budget = (Array.isArray(x0.budget) ? x0.budget : []).slice(0, 80).map(b => ({ id: b.id || newId('bg'), section: str(b.section, 80) || 'General', heading: P_HEADINGS.includes(b.heading) ? b.heading : 'other', amount: Math.max(0, num(b.amount)) })).filter(b => b.amount > 0);
    let p = x0.id ? db.projects.find(z => z.id === x0.id) : null;
    if (x0.id && !p) throw new AppError('That project no longer exists.');
    if (p) { const kept = stages.filter(s => s.invoiceId).map(s => s.id); (p.stages || []).filter(s => s.invoiceId).forEach(s => { if (!kept.includes(s.id)) throw new AppError('The stage “' + s.name + '” has been invoiced, so it cannot be removed or changed.'); }); }
    if (!p) { p = { id: newId('p'), variations: [], costs: [], subs: [], diary: [], snags: [], valuations: [], orders: [], attachments: [], createdAt: nowIso() }; db.projects.push(p); }
    Object.assign(p, { name, clientId: client.id, client: client.name, phone: str(x0.phone, 40) || client.phone || '', site: str(x0.site, 200), area: str(x0.area, 80), sector, type: str(x0.type, 60) || (sector === 'Commercial' ? 'Commercial construction' : 'New home construction'),
      status, contractSum: Math.max(0, num(x0.contractSum)), start: x0.start && ISO.test(x0.start) ? x0.start : '', finish: x0.finish && ISO.test(x0.finish) ? x0.finish : '',
      handover: x0.handover && ISO.test(x0.handover) ? x0.handover : '', retentionPct: Math.max(0, Math.min(20, num(x0.retentionPct))), defectsMonths: Math.max(0, Math.min(24, parseInt(x0.defectsMonths, 10) || 0)),
      billing: sector === 'Commercial' && x0.billing !== 'stages' ? 'valuations' : (x0.billing === 'valuations' ? 'valuations' : 'stages'), stages, budget, notes: str(x0.notes, 1000), quoteId: x0.quoteId || p.quoteId || '' });
    if (p.status === 'Handed over' && !p.handover) p.handover = new Date().toISOString().slice(0, 10);
    stamp(p, user, !x0.id); audit(db, user, (x0.id ? 'Edited' : 'Created') + ' project', name);
    return { id: p.id };
  },
  setProjectStatus(db, user, { id, status }) {
    pmgr(user); const p = pfind(db, id); if (!P_STATUS.includes(status)) throw new AppError('Choose a valid status.');
    p.status = status; if (status === 'Handed over' && !p.handover) p.handover = new Date().toISOString().slice(0, 10);
    stamp(p, user, false); audit(db, user, 'Project ' + status.toLowerCase(), p.name); return {};
  },
  deleteProject(db, user, { id }) {
    if (user.role !== 'owner') throw new AppError('Only the owner can delete a project.', 403);
    const p = pfind(db, id); if (db.invoices.some(i => i.projectId === id && !i.void)) throw new AppError('This project has invoices. Cancel them first, or set the project to Closed or Lost instead.');
    db.projects = db.projects.filter(x => x.id !== id); audit(db, user, 'Deleted project', p.name); return {};
  },
  /** Turns a quote into a project: the quote total becomes the contract sum, the quote's estimated costs become the budget. */
  projectFromQuote(db, user, { quoteId, sector }) {
    pmgr(user); const q = db.quotes.find(x => x.id === quoteId); if (!q) throw new AppError('That quote no longer exists.');
    const ex = db.projects.find(p => p.quoteId === quoteId); if (ex) return { id: ex.id };
    const client = db.clients.find(c => c.id === q.clientId) || { name: 'Client' };
    const total = (q.lines || []).reduce((t, l) => t + (l.qty || 1) * (l.price || 0), 0);
    const budget = [];
    (q.lines || []).forEach(l => P_HEADINGS.forEach(h => { const a = num((l.costs || {})[h]) * (l.qty || 1); if (a > 0) budget.push({ section: str(l.title, 80) || 'General', heading: h, amount: a }); }));
    const sec = sector === 'Commercial' ? 'Commercial' : 'Residential';
    const l0 = (q.lines || [])[0] || {};
    return actions.saveProject(db, user, { project: { name: (str(l0.title, 80) || 'Project') + ', ' + client.name, client: client.name, phone: client.phone, site: client.address || '', area: l0.route || '', sector: sec, type: l0.category, status: 'Won', contractSum: total,
      retentionPct: sec === 'Commercial' ? 5 : 0, defectsMonths: 6, billing: sec === 'Commercial' ? 'valuations' : 'stages', quoteId,
      stages: sec === 'Commercial' ? [] : [{ name: 'Deposit', pct: 30 }, { name: 'Foundations and slab', pct: 25 }, { name: 'Walls and roof', pct: 25 }, { name: 'Completion', pct: 20 }], budget } });
  },
  /** Residential: invoice one payment stage. The last stage takes whatever is left of the contract value, so variations are never missed. */
  claimStage(db, user, { projectId, stageId, date }) {
    pmgr(user); const p = pfind(db, projectId); const s = (p.stages || []).find(x => x.id === stageId); if (!s) throw new AppError('That stage no longer exists.');
    if (s.invoiceId && db.invoices.some(i => i.id === s.invoiceId && !i.void)) throw new AppError('This stage has already been invoiced.');
    const open = p.stages.filter(x => !x.invoiceId || !db.invoices.some(i => i.id === x.invoiceId && !i.void));
    const value = projectValue(p), invoiced = projectInvoiced(db, p);
    const amount = open.length === 1 ? value - invoiced : value * s.pct / 100;
    const inv = projectInvoice(db, user, p, p.name + ': ' + s.name, s.pct + '% of the contract' + (open.length === 1 ? ', final balance including approved variations' : ''), amount, { date });
    s.invoiceId = inv.id; stamp(p, user, false); audit(db, user, 'Invoiced stage ' + s.name, p.name); return { id: inv.id };
  },
  /** Commercial: an interim valuation. Gross value of work done, less retention, less what was certified before. */
  addValuation(db, user, { projectId, pctComplete, date, note }) {
    pmgr(user); const p = pfind(db, projectId); const pct = num(pctComplete);
    if (!(pct > 0 && pct <= 100)) throw new AppError('Enter the percentage of the work complete, from 1 to 100.');
    const d = date ? dateCheck(date) : new Date().toISOString().slice(0, 10);
    const prev = (p.valuations || []).filter(v => !v.void).slice(-1)[0];
    if (prev && pct < prev.pct) throw new AppError('The last valuation was ' + prev.pct + '% complete. A new one cannot be lower.');
    const gross = r2(projectValue(p) * pct / 100), retention = r2(gross * (p.retentionPct || 0) / 100), net = r2(gross - retention);
    const before = r2((p.valuations || []).filter(v => !v.void).reduce((t, v) => t + v.thisClaim, 0));
    const thisClaim = r2(net - before), n = (p.valuations || []).length + 1;
    const inv = projectInvoice(db, user, p, p.name + ': valuation ' + n, pct + '% complete. Gross EC$' + gross.toFixed(2) + ', retention ' + (p.retentionPct || 0) + '% EC$' + retention.toFixed(2) + ', previously certified EC$' + before.toFixed(2) + '.', thisClaim, { date: d, notes: str(note, 300) });
    p.valuations = p.valuations || []; p.valuations.push({ id: newId('v'), n, date: d, pct, gross, retention, net, before, thisClaim, invoiceId: inv.id });
    stamp(p, user, false); audit(db, user, 'Valuation ' + n + ' at ' + pct + '%', p.name); return { id: inv.id };
  },
  /** Release retention: half at handover, the rest at the end of the defects period (or all at once). */
  releaseRetention(db, user, { projectId, part, date }) {
    pmgr(user); const p = pfind(db, projectId); const last = (p.valuations || []).filter(v => !v.void).slice(-1)[0];
    if (!last || !last.retention) throw new AppError('No retention is held on this project.');
    const released = r2((p.retentionReleases || []).reduce((t, x) => t + x.amount, 0)), held = r2(last.retention - released);
    if (held <= 0.009) throw new AppError('All the retention has already been released.');
    const amount = part === 'half' ? r2(Math.min(held, last.retention / 2)) : held;
    const inv = projectInvoice(db, user, p, p.name + ': retention release', (part === 'half' ? 'Half of the retention, released at handover' : 'Retention released at the end of the defects period'), amount, { date });
    p.retentionReleases = p.retentionReleases || []; p.retentionReleases.push({ id: newId('rr'), date: inv.issueDate, amount, invoiceId: inv.id });
    stamp(p, user, false); audit(db, user, 'Released retention EC$' + amount.toFixed(2), p.name); return { id: inv.id };
  },
  saveVariation(db, user, { projectId, variation }) {
    pmgr(user); const p = pfind(db, projectId), v0 = variation || {};
    const desc = str(v0.description, 300); if (!desc) throw new AppError('Describe the change.');
    let v = v0.id ? p.variations.find(x => x.id === v0.id) : null;
    if (!v) { v = { id: newId('vo'), ref: 'V' + String((p.variations || []).length + 1).padStart(2, '0') }; p.variations.push(v); }
    Object.assign(v, { date: v0.date && ISO.test(v0.date) ? v0.date : new Date().toISOString().slice(0, 10), description: desc, amount: num(v0.amount), status: ['Pending', 'Approved', 'Rejected'].includes(v0.status) ? v0.status : 'Pending' });
    stamp(p, user, false); audit(db, user, 'Variation ' + v.ref + ' ' + v.status.toLowerCase(), p.name); return { id: v.id };
  },
  saveProjectCost(db, user, { projectId, cost }) {
    if (user.role === 'driver' || user.role === 'other') throw new AppError('Your access does not include project costs.', 403);
    const p = pfind(db, projectId), c0 = cost || {};
    const amount = num(c0.amount); if (!(amount > 0)) throw new AppError('Enter the amount.');
    const heading = P_HEADINGS.includes(c0.heading) ? c0.heading : 'material';
    let c = c0.id ? p.costs.find(x => x.id === c0.id) : null;
    if (!c) { c = { id: newId('pc') }; p.costs.push(c); }
    Object.assign(c, { date: dateCheck(c0.date), heading, section: str(c0.section, 80), description: str(c0.description, 200), supplier: str(c0.supplier, 100), subId: str(c0.subId, 40), amount, method: str(c0.method, 40) });
    if (c.subId && !p.subs.some(s => s.id === c.subId)) c.subId = '';
    if (c.subId) c.heading = 'subcontract';
    stamp(c, user, !c0.id); stamp(p, user, false); audit(db, user, 'Project cost EC$' + amount.toFixed(2), p.name); return { id: c.id };
  },
  deleteProjectCost(db, user, { projectId, id }) {
    pmgr(user); const p = pfind(db, projectId), c = p.costs.find(x => x.id === id);
    if (c && c.poId) { const o = (p.orders || []).find(x => x.id === c.poId); if (o) { o.status = 'Ordered'; o.costId = ''; o.received = ''; } }
    p.costs = p.costs.filter(x => x.id !== id); audit(db, user, 'Deleted project cost', p.name); return {};
  },
  saveSub(db, user, { projectId, sub }) {
    pmgr(user); const p = pfind(db, projectId), s0 = sub || {}; const name = str(s0.name, 100); if (!name) throw new AppError('Enter the subcontractor.');
    let s = s0.id ? p.subs.find(x => x.id === s0.id) : null; if (!s) { s = { id: newId('sb') }; p.subs.push(s); }
    Object.assign(s, { name, trade: str(s0.trade, 60), phone: str(s0.phone, 40), agreed: Math.max(0, num(s0.agreed)) });
    stamp(p, user, false); audit(db, user, 'Subcontractor ' + name, p.name); return { id: s.id };
  },
  saveDiary(db, user, { projectId, entry }) {
    if (user.role === 'other') throw new AppError('Your access is view only.', 403);
    const p = pfind(db, projectId), e0 = entry || {}; const notes = str(e0.notes, 1500); if (!notes) throw new AppError('Write what happened on site.');
    let e = e0.id ? p.diary.find(x => x.id === e0.id) : null;
    if (e && user.role === 'driver' && e.createdBy !== user.name) throw new AppError('You can only change your own diary entries.', 403);
    if (!e) { e = { id: newId('dy') }; p.diary.unshift(e); }
    Object.assign(e, { date: dateCheck(e0.date), weather: str(e0.weather, 40), crew: str(e0.crew, 200), notes, issues: str(e0.issues, 600), progress: e0.progress === '' || e0.progress == null ? null : Math.max(0, Math.min(100, num(e0.progress))),
      hoursLost: Math.max(0, Math.min(24, num(e0.hoursLost))), labour: Math.max(0, Math.min(500, parseInt(e0.labour, 10) || 0)), deliveries: str(e0.deliveries, 400), visitors: str(e0.visitors, 300), plant: str(e0.plant, 300), toolbox: str(e0.toolbox, 160) });
    (Array.isArray(e0.tasks) ? e0.tasks : []).forEach(tu => { const t = (p.tasks || []).find(x => x.id === tu.id); if (t) { t.progress = Math.max(0, Math.min(100, Math.round(num(tu.progress)))); t.updated = e.date; } });
    stamp(e, user, !e0.id); p.diary.sort((a, b) => a.date < b.date ? 1 : -1); audit(db, user, 'Site diary', p.name); return { id: e.id };
  },
  saveSnag(db, user, { projectId, snag }) {
    if (user.role === 'other') throw new AppError('Your access is view only.', 403);
    const p = pfind(db, projectId), s0 = snag || {}; const text = str(s0.text, 300); if (!text) throw new AppError('Describe the defect.');
    let s = s0.id ? p.snags.find(x => x.id === s0.id) : null; if (!s) { s = { id: newId('sn'), raised: new Date().toISOString().slice(0, 10), done: '' }; p.snags.push(s); }
    Object.assign(s, { text, location: str(s0.location, 80) });
    if (s0.done != null) s.done = s0.done ? (ISO.test(s0.done) ? s0.done : new Date().toISOString().slice(0, 10)) : '';
    stamp(p, user, false); audit(db, user, s.done ? 'Snag fixed' : 'Snag raised', p.name); return { id: s.id };
  }
});
function dateCheck(d) { return date(d, 'date'); }
// ---- purchase orders and crew timesheets ----
Object.assign(actions, {
  /** A purchase order commits money before the invoice arrives; it becomes a project cost when the goods are received. */
  savePO(db, user, { projectId, order }) {
    pmgr(user); const p = pfind(db, projectId), o0 = order || {};
    const supplier = str(o0.supplier, 100); if (!supplier) throw new AppError('Enter the supplier.');
    const description = str(o0.description, 500); if (!description) throw new AppError('Say what is being ordered.');
    const amount = num(o0.amount); if (!(amount > 0)) throw new AppError('Enter the order value.');
    p.orders = p.orders || [];
    let o = o0.id ? p.orders.find(x => x.id === o0.id) : null;
    if (o0.id && !o) throw new AppError('That order no longer exists.');
    if (o && o.status !== 'Ordered') throw new AppError('This order is ' + o.status.toLowerCase() + ' and can no longer be changed.');
    if (!o) { db.nextPoNo = (db.nextPoNo || 1); o = { id: newId('po'), no: db.nextPoNo++, status: 'Ordered' }; p.orders.push(o); }
    Object.assign(o, { date: o0.date ? dateCheck(o0.date) : new Date().toISOString().slice(0, 10), needed: o0.needed && ISO.test(o0.needed) ? o0.needed : '', supplier, phone: str(o0.phone, 40),
      description, heading: P_HEADINGS.includes(o0.heading) ? o0.heading : 'material', section: str(o0.section, 80), amount });
    stamp(o, user, !o0.id); stamp(p, user, false); audit(db, user, 'Purchase order PO-' + String(o.no).padStart(4, '0') + ' EC$' + amount.toFixed(2), p.name);
    return { id: o.id, no: o.no };
  },
  receivePO(db, user, { projectId, id, date, amount }) {
    pmgr(user); const p = pfind(db, projectId), o = (p.orders || []).find(x => x.id === id); if (!o) throw new AppError('That order no longer exists.');
    if (o.status !== 'Ordered') throw new AppError('This order is already ' + o.status.toLowerCase() + '.');
    const amt = amount == null || amount === '' ? o.amount : num(amount); if (!(amt > 0)) throw new AppError('Enter the amount actually charged.');
    const c = actions.saveProjectCost(db, user, { projectId, cost: { date: date || new Date().toISOString().slice(0, 10), heading: o.heading, section: o.section, description: 'PO-' + String(o.no).padStart(4, '0') + ': ' + o.description, supplier: o.supplier, amount: amt } });
    const cost = p.costs.find(x => x.id === c.id); cost.poId = o.id;
    o.status = 'Received'; o.received = cost.date; o.costId = c.id; stamp(o, user, false); return { id: c.id };
  },
  cancelPO(db, user, { projectId, id }) {
    pmgr(user); const p = pfind(db, projectId), o = (p.orders || []).find(x => x.id === id); if (!o) throw new AppError('That order no longer exists.');
    if (o.status !== 'Ordered') throw new AppError('Only an open order can be cancelled.');
    o.status = 'Cancelled'; stamp(o, user, false); audit(db, user, 'Cancelled PO-' + String(o.no).padStart(4, '0'), p.name); return {};
  },
  /** A day's labour: one line per crew member, each becoming a labour cost on the project and counting towards what that person is owed. */
  saveTimesheet(db, user, { projectId, date: d0, rows }) {
    pmgr(user); const p = pfind(db, projectId), d = dateCheck(d0);
    const list = (Array.isArray(rows) ? rows : []).map(r => ({ driverId: str(r.driverId, 40), days: Math.max(0, Math.min(2, num(r.days))), rate: Math.max(0, num(r.rate)), note: str(r.note, 120) })).filter(r => r.days > 0);
    if (!list.length) throw new AppError('Enter the days worked for at least one person.');
    const ids = [];
    list.forEach(r => {
      const drv = (db.settings.drivers || []).find(x => x.id === r.driverId); if (!drv) throw new AppError('Choose a crew member from Business Settings.');
      if (!(r.rate > 0)) throw new AppError('Enter a day rate for ' + drv.name + '.');
      if (p.costs.some(c => c.driverId === drv.id && c.date === d && c.timesheet)) throw new AppError(drv.name + ' already has labour recorded on this project for ' + d + '.');
      const c = actions.saveProjectCost(db, user, { projectId, cost: { date: d, heading: 'labour', section: 'General', description: drv.name + ', ' + r.days + (r.days === 1 ? ' day' : ' days') + (r.note ? ' (' + r.note + ')' : ''), amount: r2(r.days * r.rate) } });
      Object.assign(p.costs.find(x => x.id === c.id), { driverId: drv.id, days: r.days, rate: r.rate, timesheet: true }); ids.push(c.id);
    });
    audit(db, user, 'Timesheet for ' + list.length + (list.length === 1 ? ' person' : ' people'), p.name); return { ids };
  }
});


// ==================== Cozy Apartments: units, tenancies, short stays, repairs ====================
// Cozy Apartments is a trading name of the same business, so rent and stays are invoices like any other,
// in the same books, tagged to the Apartments line of business. Inserted into core.mjs by convert.py.
const A_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const amgr = u => { if (u.role !== 'owner' && u.role !== 'member') throw new AppError('Only the owner or a manager can do that.', 403); };
const afind = (list, id, what) => { const x = (list || []).find(z => z.id === id); if (!x) throw new AppError('That ' + what + ' no longer exists.'); return x; };
const overlaps = (a1, a2, b1, b2) => a1 < (b2 || '9999-12-31') && b1 < (a2 || '9999-12-31');
const a2 = n => Math.round((Number(n) || 0) * 100) / 100;
function aptInvoice(db, user, { clientName, phone, email, date, due, lines, notes }) {
  const res = actions.saveInvoice(db, user, { invoice: { client: { name: clientName, phone, email }, issueDate: date, notes: notes || '', lines } });
  const inv = db.invoices.find(i => i.id === res.id); inv.brand = 'cozy'; if (due) inv.dueDate = due; return inv;
}
/** Is a unit taken between two dates by a live tenancy or a short stay (ignoring the record being edited)? */
function unitClash(db, unitId, from, to, skipId) {
  const t = db.tenancies.find(x => x.unitId === unitId && x.id !== skipId && ['Draft', 'Signed', 'Active'].includes(x.status) && overlaps(from, to, x.start, x.end || x.endDate));
  if (t) return 'it is let to ' + t.tenant.name + (t.end ? ' until ' + t.end : '');
  const s = db.stays.find(x => x.unitId === unitId && x.id !== skipId && x.status !== 'Cancelled' && overlaps(from, to, x.checkIn, x.checkOut));
  if (s) return s.guest.name + ' is staying from ' + s.checkIn + ' to ' + s.checkOut;
  return '';
}

/** Buildings. Units always belong to one; the first is created from the existing set-up when needed. */
function ensureProperties(db) {
  db.properties = db.properties || [];
  if (!db.properties.length) db.properties.push({ id: newId('pr'), name: (db.aptSettings || {}).name || 'Cozy Apartments', address: (db.aptSettings || {}).address || '', notes: '', active: true, createdAt: nowIso() });
  const first = db.properties[0];
  (db.units || []).forEach(u => { if (!u.propertyId || !db.properties.some(p => p.id === u.propertyId)) u.propertyId = first.id; });
  return db.properties;
}
function unitProperty(db, id) {
  const ps = ensureProperties(db);
  if (!id) return ps[0];
  const p = ps.find(x => x.id === id); if (!p) throw new AppError('That building no longer exists.');
  return p;
}
/** Spread a payment over a tenancy's unpaid rent, oldest first. Anything left over is held as credit for future rent. */
function applyToTenancy(db, user, t, amount, payment) {
  const open = db.invoices.filter(i => !i.void && i.tenancyId === t.id && calcBalance(i) > 0.009).sort((a, b) => a.issueDate < b.issueDate ? -1 : a.issueDate > b.issueDate ? 1 : a.no - b.no);
  let left = a2(amount); const allocations = [];
  for (const inv of open) {
    if (left <= 0.009) break;
    const part = a2(Math.min(left, calcBalance(inv)));
    const r = actions.addPayment(db, user, { invoiceId: inv.id, payment: Object.assign({}, payment, { amount: part }) });
    allocations.push({ invoiceId: inv.id, paymentId: r.id, amount: part }); left = a2(left - part);
  }
  return { allocations, left };
}

Object.assign(actions, {
  saveAptSettings(db, user, { settings }) {
    amgr(user); const s = settings || {};
    db.aptSettings = Object.assign(db.aptSettings || {}, { name: str(s.name, 80) || 'Cozy Apartments', landlord: str(s.landlord, 120), address: str(s.address, 300), phone: str(s.phone, 40), whatsapp: str(s.whatsapp, 40), email: str(s.email, 120),
      noticeDays: Math.max(0, Math.min(180, parseInt(s.noticeDays, 10) || 30)), graceDays: Math.max(0, Math.min(31, parseInt(s.graceDays, 10) || 0)), lateFee: Math.max(0, num(s.lateFee)), depositDays: Math.max(1, Math.min(90, parseInt(s.depositDays, 10) || 30)),
      checkIn: str(s.checkIn, 10) || '14:00', checkOut: str(s.checkOut, 10) || '11:00', cancelDays: Math.max(0, Math.min(60, parseInt(s.cancelDays, 10) || 0)), houseRules: str(s.houseRules, 3000), extraTerms: str(s.extraTerms, 3000) });
    audit(db, user, 'Changed apartment settings', ''); return {};
  },
  saveUnit(db, user, { unit }) {
    amgr(user); const u0 = unit || {}, name = str(u0.name, 40); if (!name) throw new AppError('Give the unit a name or number, for example Unit 4.');
    const same = db.units.find(x => x.name.toLowerCase() === name.toLowerCase() && x.id !== u0.id); if (same) throw new AppError('There is already a unit called ' + same.name + '.');
    const prop = unitProperty(db, u0.propertyId);
    let u = u0.id ? afind(db.units, u0.id, 'unit') : null; if (!u) { u = { id: newId('un') }; db.units.push(u); }
    Object.assign(u, { propertyId: prop.id, name, type: str(u0.type, 40), bedrooms: Math.max(0, parseInt(u0.bedrooms, 10) || 0), maxGuests: Math.max(1, parseInt(u0.maxGuests, 10) || 2), furnished: u0.furnished !== false,
      monthlyRent: Math.max(0, num(u0.monthlyRent)), nightlyRate: Math.max(0, num(u0.nightlyRate)), deposit: Math.max(0, num(u0.deposit)), use: ['Long-term', 'Short stays', 'Either'].includes(u0.use) ? u0.use : 'Either', notes: str(u0.notes, 500), active: u0.active !== false });
    stamp(u, user, !u0.id); audit(db, user, (u0.id ? 'Edited' : 'Added') + ' unit', name); return { id: u.id };
  },
  deleteUnit(db, user, { id }) {
    if (user.role !== 'owner') throw new AppError('Only the owner can delete a unit.', 403);
    const u = afind(db.units, id, 'unit'); if (db.tenancies.some(t => t.unitId === id) || db.stays.some(s => s.unitId === id)) throw new AppError(u.name + ' has history. Mark it out of use instead.');
    db.units = db.units.filter(x => x.id !== id); audit(db, user, 'Deleted unit', u.name); return {};
  },
  saveTenancy(db, user, { tenancy }) {
    amgr(user); const t0 = tenancy || {}, unit = afind(db.units, t0.unitId, 'unit'), tn = t0.tenant || {};
    const name = str(tn.name, 100); if (!name) throw new AppError('Enter the tenant’s full name.');
    const start = date(t0.start, 'start date'), end = t0.end ? date(t0.end, 'end date') : '';
    if (end && end <= start) throw new AppError('The end date must be after the start date.');
    const rent = num(t0.rent); if (!(rent > 0)) throw new AppError('Enter the monthly rent.');
    let t = t0.id ? afind(db.tenancies, t0.id, 'tenancy') : null;
    if (t && t.signedTenant && t.signedTenant.at) throw new AppError('This agreement has been signed. End it and start a new one to change the terms.');
    const clash = unitClash(db, unit.id, start, end, t0.id); if (clash) throw new AppError(unit.name + ' is not free: ' + clash + '.');
    const client = upsertClient(db, { name, phone: tn.phone, email: tn.email }, user);
    if (!t) { t = { id: newId('tn'), status: 'Draft', depositPaid: 0, depositReturned: null }; db.tenancies.push(t); }
    Object.assign(t, { unitId: unit.id, clientId: client.id, tenant: { name, phone: str(tn.phone, 40), email: str(tn.email, 120), idType: str(tn.idType, 40), idNumber: str(tn.idNumber, 40), occupants: str(tn.occupants, 200) },
      start, end, rent: a2(rent), dueDay: Math.max(1, Math.min(28, parseInt(t0.dueDay, 10) || 1)), deposit: Math.max(0, a2(num(t0.deposit))), included: str(t0.included, 200), maxOccupants: Math.max(1, parseInt(t0.maxOccupants, 10) || 2),
      pets: !!t0.pets, special: str(t0.special, 2000), notes: str(t0.notes, 1000) });
    stamp(t, user, !t0.id); audit(db, user, (t0.id ? 'Edited' : 'Drafted') + ' tenancy', unit.name + ', ' + name); return { id: t.id };
  },
  /** Signatures are small PNG images drawn on the phone. The agreement text is frozen at the first signature. */
  signTenancy(db, user, { id, who, signer, image, text }) {
    amgr(user); const t = afind(db.tenancies, id, 'tenancy');
    if (!['tenant', 'landlord'].includes(who)) throw new AppError('Who is signing?');
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(String(image || '')) || image.length > 60000) throw new AppError('The signature could not be read. Clear it and sign again.');
    if (!t.agreementText) { const tx = String(text || ''); if (tx.length < 500 || tx.length > 60000) throw new AppError('The agreement text is missing.'); t.agreementText = tx; t.agreementAt = nowIso(); }
    t[who === 'tenant' ? 'signedTenant' : 'signedLandlord'] = { name: str(signer, 100) || (who === 'tenant' ? t.tenant.name : user.name), image, at: nowIso(), by: user.name };
    if (t.signedTenant && t.signedLandlord && t.status === 'Draft') t.status = 'Signed';
    stamp(t, user, false); audit(db, user, (who === 'tenant' ? 'Tenant' : 'Landlord') + ' signed tenancy', t.tenant.name); return {};
  },
  setTenancyStatus(db, user, { id, status }) {
    amgr(user); const t = afind(db.tenancies, id, 'tenancy');
    if (status === 'Active') { if (t.status === 'Ended') throw new AppError('This tenancy has ended.'); t.status = 'Active'; }
    else if (status === 'Draft' && !(t.signedTenant || t.signedLandlord)) t.status = 'Draft';
    else throw new AppError('Use “End tenancy” to end it.');
    stamp(t, user, false); audit(db, user, 'Tenancy ' + status.toLowerCase(), t.tenant.name); return {};
  },
  recordDeposit(db, user, { id, amount, date: d, method }) {
    amgr(user); const t = afind(db.tenancies, id, 'tenancy'), amt = num(amount); if (!(amt > 0)) throw new AppError('Enter the deposit received.');
    t.depositPaid = a2((t.depositPaid || 0) + amt); t.depositPayments = (t.depositPayments || []).concat([{ date: date(d, 'date'), amount: a2(amt), method: str(method, 40) || 'Bank transfer', by: user.name }]);
    stamp(t, user, false); audit(db, user, 'Deposit received EC$' + amt.toFixed(2), t.tenant.name); return {};
  },
  /** Rent for one month for every live tenancy that covers it and has not been billed for it yet. */
  raiseRent(db, user, { month }) {
    amgr(user); if (!/^\d{4}-\d{2}$/.test(String(month || ''))) throw new AppError('Choose the month.');
    const [y, m] = month.split('-').map(Number), first = month + '-01', last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
    const made = [];
    db.tenancies.filter(t => ['Signed', 'Active'].includes(t.status) && t.start <= last && (!t.end || t.end >= first)).forEach(t => {
      if (db.invoices.some(i => !i.void && i.tenancyId === t.id && i.rentMonth === month)) return;
      const unit = db.units.find(u => u.id === t.unitId) || { name: 'Unit' };
      // a part month at the start or end is charged by the day
      const from = t.start > first ? t.start : first, to = t.end && t.end < last ? t.end : last, dim = Number(last.slice(8));
      const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1, part = days < dim;
      const amount = part ? a2(t.rent * days / dim) : t.rent;
      const due = month + '-' + String(t.dueDay).padStart(2, '0');
      const inv = aptInvoice(db, user, { clientName: t.tenant.name, phone: t.tenant.phone, email: t.tenant.email, date: first, due: due < from ? from : due,
        lines: [{ date: from, truck: '', route: unit.name, category: 'Long-term rent', load: '', title: 'Rent, ' + unit.name + ', ' + A_MONTHS[m - 1] + ' ' + y, detail: part ? days + ' of ' + dim + ' days (' + from + ' to ' + to + ')' : 'Monthly rent', qty: 1, price: amount, costs: {} }] });
      inv.tenancyId = t.id; inv.rentMonth = month; if (t.status === 'Signed' && t.start <= last) t.status = 'Active'; made.push(inv.id);
      if ((t.credit || 0) > 0.009) { const use = a2(Math.min(t.credit, amount)); actions.addPayment(db, user, { invoiceId: inv.id, payment: { amount: use, date: first, method: 'Paid in advance', note: 'From credit held for the tenant' } }); t.credit = a2(t.credit - use); }
    });
    audit(db, user, 'Raised rent for ' + A_MONTHS[m - 1] + ' ' + y, made.length + ' invoices'); return { ids: made };
  },
  endTenancy(db, user, { id, endDate, deductions, returned, method, note }) {
    amgr(user); const t = afind(db.tenancies, id, 'tenancy'); if (t.status === 'Ended') throw new AppError('This tenancy has already ended.');
    const d = date(endDate, 'end date'); if (d < t.start) throw new AppError('The end date is before the tenancy started.');
    const ded = Math.max(0, a2(num(deductions))), held = a2(t.depositPaid || 0);
    if (ded > held + 0.009) throw new AppError('Deductions cannot be more than the EC$' + held.toFixed(2) + ' deposit held.');
    t.status = 'Ended'; t.endDate = d; t.depositReturned = { date: d, amount: a2(held - ded), deducted: ded, method: str(method, 40) || 'Bank transfer', note: str(note, 500) };
    if (ded > 0) { // money kept from the deposit becomes income, settled by the deposit itself
      const unit = db.units.find(u => u.id === t.unitId) || { name: 'Unit' };
      const inv = aptInvoice(db, user, { clientName: t.tenant.name, phone: t.tenant.phone, date: d, lines: [{ date: d, truck: '', route: unit.name, category: 'Deposit deduction', load: '', title: 'Deductions from deposit, ' + unit.name, detail: str(note, 300) || 'See the end-of-tenancy inspection', qty: 1, price: ded, costs: {} }] });
      inv.tenancyId = t.id; actions.addPayment(db, user, { invoiceId: inv.id, payment: { date: d, amount: ded, method: 'Deposit' } });
    }
    stamp(t, user, false); audit(db, user, 'Ended tenancy', t.tenant.name); return {};
  },
  saveStay(db, user, { stay }) {
    amgr(user); const s0 = stay || {}, unit = afind(db.units, s0.unitId, 'unit'), g = s0.guest || {};
    const name = str(g.name, 100); if (!name) throw new AppError('Enter the guest’s name.');
    const ci = date(s0.checkIn, 'check-in date'), co = date(s0.checkOut, 'check-out date'); if (co <= ci) throw new AppError('Check-out must be after check-in.');
    const rate = num(s0.rate); if (!(rate > 0)) throw new AppError('Enter the nightly rate.');
    let s = s0.id ? afind(db.stays, s0.id, 'stay') : null;
    if (s && s.invoiceId && db.invoices.some(i => i.id === s.invoiceId && !i.void) && (s.checkIn !== ci || s.checkOut !== co || s.rate !== a2(rate))) throw new AppError('This stay has been invoiced. Cancel the invoice before changing dates or rate.');
    if ((s0.status || 'Booked') !== 'Cancelled') { const clash = unitClash(db, unit.id, ci, co, s0.id); if (clash) throw new AppError(unit.name + ' is not free: ' + clash + '.'); }
    upsertClient(db, { name, phone: g.phone, email: g.email }, user);
    if (!s) { s = { id: newId('sy'), invoiceId: '' }; db.stays.push(s); }
    const nights = Math.round((Date.parse(co) - Date.parse(ci)) / 864e5);
    Object.assign(s, { unitId: unit.id, guest: { name, phone: str(g.phone, 40), email: str(g.email, 120) }, guests: Math.max(1, parseInt(s0.guests, 10) || 1), checkIn: ci, checkOut: co, nights, rate: a2(rate), cleaning: Math.max(0, a2(num(s0.cleaning))),
      source: str(s0.source, 40) || 'Direct', status: ['Booked', 'Checked in', 'Checked out', 'Cancelled'].includes(s0.status) ? s0.status : 'Booked', notes: str(s0.notes, 500) });
    stamp(s, user, !s0.id); audit(db, user, (s0.id ? 'Edited' : 'Booked') + ' stay', unit.name + ', ' + name); return { id: s.id };
  },
  setStayStatus(db, user, { id, status }) {
    if (user.role === 'other') throw new AppError('Your access is view only.', 403);
    const s = afind(db.stays, id, 'stay'); if (!['Booked', 'Checked in', 'Checked out', 'Cancelled'].includes(status)) throw new AppError('Choose a valid status.');
    if (status === 'Cancelled' && user.role === 'driver') throw new AppError('Only the office can cancel a stay.', 403);
    s.status = status; stamp(s, user, false); audit(db, user, 'Stay ' + status.toLowerCase(), s.guest.name); return {};
  },
  invoiceStay(db, user, { id }) {
    amgr(user); const s = afind(db.stays, id, 'stay'); if (s.status === 'Cancelled') throw new AppError('This stay was cancelled.');
    if (s.invoiceId && db.invoices.some(i => i.id === s.invoiceId && !i.void)) throw new AppError('This stay has already been invoiced.');
    const unit = db.units.find(u => u.id === s.unitId) || { name: 'Unit' };
    const lines = [{ date: s.checkIn, truck: '', route: unit.name, category: 'Short stay', load: '', title: 'Stay, ' + unit.name, detail: s.checkIn + ' to ' + s.checkOut + ', ' + s.nights + (s.nights === 1 ? ' night' : ' nights'), qty: s.nights, price: s.rate, costs: {} }];
    if (s.cleaning) lines.push({ date: s.checkIn, truck: '', route: unit.name, category: 'Short stay', load: '', title: 'Cleaning fee', detail: '', qty: 1, price: s.cleaning, costs: {} });
    const inv = aptInvoice(db, user, { clientName: s.guest.name, phone: s.guest.phone, email: s.guest.email, date: s.checkIn < new Date().toISOString().slice(0, 10) ? s.checkIn : new Date().toISOString().slice(0, 10), due: s.checkIn, lines });
    inv.stayId = s.id; s.invoiceId = inv.id; stamp(s, user, false); return { id: inv.id };
  },
  /** Repairs on a unit. NV Construction does the work; the cost is an Apartments cost in the same books. */
  saveRepair(db, user, { repair }) {
    if (user.role === 'other') throw new AppError('Your access is view only.', 403);
    const r0 = repair || {}, unit = afind(db.units, r0.unitId, 'unit'), issue = str(r0.issue, 300); if (!issue) throw new AppError('Describe the problem.');
    let r = r0.id ? afind(db.repairs, r0.id, 'repair') : null; if (!r) { r = { id: newId('rp'), reported: new Date().toISOString().slice(0, 10) }; db.repairs.push(r); }
    const mgr = user.role === 'owner' || user.role === 'member';
    Object.assign(r, { unitId: unit.id, issue, priority: ['Urgent', 'Soon', 'When convenient'].includes(r0.priority) ? r0.priority : 'Soon', status: ['Open', 'In progress', 'Done'].includes(r0.status) ? r0.status : 'Open',
      assigned: str(r0.assigned, 60), notes: str(r0.notes, 800), done: r0.status === 'Done' ? (r0.done && ISO.test(r0.done) ? r0.done : r.done || new Date().toISOString().slice(0, 10)) : '' });
    if (mgr) { r.labour = Math.max(0, a2(num(r0.labour))); r.materials = Math.max(0, a2(num(r0.materials))); }
    stamp(r, user, !r0.id); audit(db, user, (r0.id ? 'Updated' : 'Reported') + ' repair', unit.name + ': ' + issue.slice(0, 60)); return { id: r.id };
  }
});

// ---- buildings, adding units in bulk, and taking payments ----
const PAY_METHODS = ['Cash', 'Local bank transfer', 'International transfer', 'Card', 'Cheque', 'Other'];
Object.assign(actions, {
  saveProperty(db, user, { property }) {
    amgr(user); ensureProperties(db); const p0 = property || {}, name = str(p0.name, 80);
    if (!name) throw new AppError('Give the building a name, for example Cozy Apartments, Arnos Vale.');
    const same = db.properties.find(x => x.name.toLowerCase() === name.toLowerCase() && x.id !== p0.id); if (same) throw new AppError('There is already a building called ' + same.name + '.');
    let p = p0.id ? afind(db.properties, p0.id, 'building') : null; if (!p) { p = { id: newId('pr'), createdAt: nowIso() }; db.properties.push(p); }
    Object.assign(p, { name, address: str(p0.address, 300), notes: str(p0.notes, 500), active: p0.active !== false });
    stamp(p, user, !p0.id); audit(db, user, (p0.id ? 'Edited' : 'Added') + ' building', name); return { id: p.id };
  },
  deleteProperty(db, user, { id }) {
    if (user.role !== 'owner') throw new AppError('Only the owner can delete a building.', 403);
    const p = afind(db.properties, id, 'building'); if (db.units.some(u => u.propertyId === id)) throw new AppError(p.name + ' still has units. Move or delete them first.');
    db.properties = db.properties.filter(x => x.id !== id); audit(db, user, 'Deleted building', p.name); return {};
  },
  /** Add several units at once, numbered in sequence: “Unit 25” to “Unit 36”, or “B1” to “B12”. */
  addUnits(db, user, { propertyId, count, start, prefix, template }) {
    amgr(user); const prop = unitProperty(db, propertyId), n = parseInt(count, 10), first = parseInt(start, 10);
    if (!(n >= 1 && n <= 200)) throw new AppError('Add between 1 and 200 units at a time.');
    if (!(first >= 0)) throw new AppError('Enter the first unit number.');
    const pre = String(prefix == null ? 'Unit ' : prefix).slice(0, 20), names = [];
    for (let i = 0; i < n; i++) names.push((pre + (first + i)).trim());
    const taken = names.filter(nm => db.units.some(u => u.name.toLowerCase() === nm.toLowerCase()));
    if (taken.length) throw new AppError('These names are already used: ' + taken.slice(0, 5).join(', ') + (taken.length > 5 ? ' and ' + (taken.length - 5) + ' more' : '') + '. Start the numbering higher or use a different prefix.');
    const t0 = template || {};
    const ids = names.map(nm => { const u = { id: newId('un'), propertyId: prop.id, name: nm, type: str(t0.type, 40), bedrooms: Math.max(0, parseInt(t0.bedrooms, 10) || 0), maxGuests: Math.max(1, parseInt(t0.maxGuests, 10) || 2), furnished: t0.furnished !== false,
      monthlyRent: Math.max(0, num(t0.monthlyRent)), nightlyRate: Math.max(0, num(t0.nightlyRate)), deposit: Math.max(0, num(t0.deposit)), use: ['Long-term', 'Short stays', 'Either'].includes(t0.use) ? t0.use : 'Either', notes: '', active: true }; stamp(u, user, true); db.units.push(u); return u.id; });
    audit(db, user, 'Added ' + n + (n === 1 ? ' unit' : ' units') + ' to ' + prop.name, names[0] + (n > 1 ? ' to ' + names[n - 1] : '')); return { ids };
  },
  savePaySettings(db, user, { pay }) {
    amgr(user); const p = pay || {};
    db.paySettings = { swift: str(p.swift, 20).toUpperCase(), bankAddress: str(p.bankAddress, 200), corrBank: str(p.corrBank, 120), corrSwift: str(p.corrSwift, 20).toUpperCase(), intlNote: str(p.intlNote, 300),
      cash: p.cash !== false, cashWhere: str(p.cashWhere, 200), cardLink: /^https:\/\/\S+$/i.test(String(p.cardLink || '').trim()) ? String(p.cardLink).trim().slice(0, 300) : '' };
    audit(db, user, 'Changed how customers pay', ''); return {};
  },
  /** A tenant pays: cash at the office, a local transfer or a transfer from abroad. Spread over their unpaid rent, oldest first; any extra is kept as credit. */
  recordTenantPayment(db, user, { tenancyId, amount, date: d, method, reference }) {
    amgr(user); const t = afind(db.tenancies, tenancyId, 'tenancy'), amt = a2(num(amount));
    if (!(amt > 0)) throw new AppError('Enter the amount received.');
    const m = PAY_METHODS.includes(method) ? method : 'Cash', pd = date(d, 'payment date'), ref = str(reference, 120);
    const { allocations, left } = applyToTenancy(db, user, t, amt, { date: pd, method: m, note: ref });
    if (left > 0.009) { t.credit = a2((t.credit || 0) + left); }
    t.payLog = (t.payLog || []).concat([{ id: newId('tp'), date: pd, amount: amt, method: m, reference: ref, allocations, credit: left > 0.009 ? left : 0, by: user.name, at: nowIso() }]);
    stamp(t, user, false); audit(db, user, 'Rent payment EC$' + amt.toFixed(2) + ' (' + m.toLowerCase() + ')', t.tenant.name);
    return { allocations, credit: left > 0.009 ? left : 0, creditTotal: t.credit || 0 };
  },
  recordStayPayment(db, user, { stayId, amount, date: d, method, reference }) {
    amgr(user); const s = afind(db.stays, stayId, 'stay'); if (s.status === 'Cancelled') throw new AppError('This stay was cancelled.');
    if (!s.invoiceId || !db.invoices.some(i => i.id === s.invoiceId && !i.void)) actions.invoiceStay(db, user, { id: s.id });
    const inv = db.invoices.find(i => i.id === s.invoiceId);
    const r = actions.addPayment(db, user, { invoiceId: inv.id, payment: { amount, date: d, method: PAY_METHODS.includes(method) ? method : 'Cash', note: str(reference, 120) } });
    return { invoiceId: inv.id, paymentId: r.id };
  }
});


// ==================== NV: two businesses, website requests, Airbnb and Booking.com ====================
// Each person works in NV Construction, Cozy Apartments or both. They are only sent, and can only change, the records of their business.
export const COZY_ACTIONS = ['saveAptSettings', 'saveUnit', 'deleteUnit', 'saveTenancy', 'signTenancy', 'setTenancyStatus', 'recordDeposit', 'raiseRent', 'endTenancy', 'saveStay', 'setStayStatus', 'invoiceStay', 'saveRepair', 'saveProperty', 'deleteProperty', 'addUnits', 'recordTenantPayment', 'recordStayPayment', 'saveChannels', 'recordPayout', 'acceptStayRequest', 'syncChannels', 'markCleaned', 'saveNotice', 'deleteNotice', 'confirmPayNotice', 'rejectPayNotice', 'saveOnlineBooking', 'releaseOnlineHold'];
export const NV_ACTIONS = ['saveProject', 'setProjectStatus', 'deleteProject', 'projectFromQuote', 'claimStage', 'addValuation', 'releaseRetention', 'saveVariation', 'saveProjectCost', 'deleteProjectCost', 'saveSub', 'saveDiary', 'saveSnag', 'savePO', 'receivePO', 'cancelPO', 'saveTimesheet', 'saveBin', 'deleteBin', 'saveHire', 'collectHire', 'deleteHire', 'saveHours', 'deleteHours', 'setHourPlan', 'saveBooking', 'setBookingStatus', 'deleteBooking', 'saveFuel', 'deleteFuel', 'saveQuote', 'setQuoteStatus', 'deleteQuote', 'convertQuote', 'markQuoteSent', 'saveIncident', 'deleteIncident', 'saveDriverPay', 'deleteDriverPay', 'saveTask', 'deleteTask', 'saveQuality', 'deleteQuality'];
export function bizAllowed(user, action) {
  if (user && user.role === 'tenant') return TENANT_ACTIONS.includes(action);
  if (user && user.duty === 'desk' && DESK_BLOCKED.includes(action)) return false;
  const b = (user && user.biz) || 'both'; if (b === 'both') return true;
  if (b === 'nv' && COZY_ACTIONS.includes(action)) return false;
  if (b === 'cozy' && NV_ACTIONS.includes(action)) return false;
  return true;
}
const BIZ = ['both', 'nv', 'cozy'];
export const CHANNELS = ['Airbnb', 'Booking.com'];
const SYS = { id: 'system', name: 'Booking sync', role: 'owner' };
const svgToday = () => new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10);
const addDaysIso = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const nightsOf = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
export function ensureIcalToken(u) { if (!u.icalToken) u.icalToken = crypto.randomBytes(18).toString('base64url'); return u.icalToken; }

/** Turn calendar events from Airbnb and Booking.com into stays: new ones added, moved ones updated, ones that disappear cancelled. */
export function applyChannelFeeds(db, user, feeds, today) {
  today = today || svgToday(); user = user || SYS;
  const sum = { at: nowIso(), added: 0, updated: 0, cancelled: 0, skipped: 0, invoiced: 0, results: [] };
  for (const f of feeds || []) {
    const unit = db.units.find(u => u.id === f.unitId); if (!unit) continue;
    const res = { unitId: unit.id, source: f.source, ok: !!f.ok, error: f.ok ? '' : String(f.error || 'Could not read the calendar').slice(0, 160), events: 0, added: 0 };
    sum.results.push(res);
    if (!f.ok) continue; // never cancel anything when a calendar could not be read
    const seen = new Set();
    for (const ev of f.events || []) {
      if (!ev.start || !ev.end || ev.end <= ev.start || ev.end < today) continue;
      if (/not available|blocked/i.test(ev.summary || '') && f.source === 'Airbnb') continue; // dates the host closed, not a booking
      const uid = (ev.uid || (f.source + ev.start + ev.end)).slice(0, 200); seen.add(uid); res.events++;
      const mine = db.stays.find(s => s.unitId === unit.id && s.source === f.source && s.extUid === uid);
      if (mine) {
        if (mine.status === 'Cancelled' && mine.cancelledBySync) { mine.status = 'Booked'; mine.cancelledBySync = false; sum.updated++; }
        const invoiced = mine.invoiceId && db.invoices.some(i => i.id === mine.invoiceId && !i.void);
        if ((mine.checkIn !== ev.start || mine.checkOut !== ev.end) && !invoiced) { mine.checkIn = ev.start; mine.checkOut = ev.end; mine.nights = nightsOf(ev.start, ev.end); stamp(mine, user, false); sum.updated++; }
        continue;
      }
      // Our own bookings come back to us from the other site as closed dates: skip anything that overlaps a booking we already have.
      if (unitClash(db, unit.id, ev.start, ev.end, null)) { sum.skipped++; continue; }
      const code = ((ev.description || '').match(/details\/([A-Z0-9]{6,})|code=([A-Z0-9]{6,})/) || []).slice(1).find(Boolean) || '';
      const last4 = ((ev.description || '').match(/Last 4 Digits\)?:\s*(\d{4})/i) || [])[1] || '';
      const url = ((ev.description || '').match(/https:\/\/\S+/) || [])[0] || '';
      const s = { id: newId('sy'), invoiceId: '', unitId: unit.id, guest: { name: f.source + ' guest' + (code ? ' ' + code : ''), phone: last4 ? 'ends ' + last4 : '', email: '' }, guests: 1,
        checkIn: ev.start, checkOut: ev.end, nights: nightsOf(ev.start, ev.end), rate: a2(unit.nightlyRate || 0), cleaning: 0, source: f.source, status: 'Booked',
        notes: 'Added from the ' + f.source + ' calendar on ' + today + '. The price is an estimate from the unit’s nightly rate until the payout is entered.', extUid: uid, extCode: code, extUrl: url.slice(0, 300), estimated: true, imported: today };
      stamp(s, user, true); db.stays.push(s); sum.added++; res.added++;
    }
    // Bookings that have gone from the calendar were cancelled on that site
    db.stays.filter(s => s.unitId === unit.id && s.source === f.source && s.extUid && s.status === 'Booked' && s.checkIn >= today && !seen.has(s.extUid)).forEach(s => {
      const inv = s.invoiceId && db.invoices.find(i => i.id === s.invoiceId && !i.void);
      if (inv && (inv.payments || []).length) return;
      s.status = 'Cancelled'; s.cancelledBySync = true; s.notes = (s.notes ? s.notes + ' ' : '') + 'Removed from the ' + f.source + ' calendar on ' + today + '.'; stamp(s, user, false); sum.cancelled++;
    });
  }
  sum.invoiced = settleChannelStays(db, user, today);
  db.channelSync = sum;
  return sum;
}
/** Once a site booking has started, it counts as income (estimated until the payout is entered) and its status follows the dates. */
function settleChannelStays(db, user, today) {
  let n = 0;
  db.stays.filter(s => CHANNELS.includes(s.source) && s.status !== 'Cancelled').forEach(s => {
    if (s.status === 'Booked' && s.checkIn <= today) s.status = s.checkOut <= today ? 'Checked out' : 'Checked in';
    else if (s.status === 'Checked in' && s.checkOut <= today) s.status = 'Checked out';
    if (s.checkIn > today || (s.invoiceId && db.invoices.some(i => i.id === s.invoiceId && !i.void)) || !(s.rate > 0)) return;
    try { channelInvoice(db, user, s); n++; } catch (e) { /* the office can invoice it by hand */ }
  });
  return n;
}
function channelInvoice(db, user, s, total) {
  const unit = db.units.find(u => u.id === s.unitId) || { name: 'Unit' };
  const amount = total != null ? a2(total) : a2(s.nights * s.rate);
  const inv = aptInvoice(db, user, { clientName: s.source, date: s.checkIn, due: addDaysIso(s.checkOut, 30), notes: s.source + ' booking' + (s.extCode ? ' ' + s.extCode : '') + '.',
    lines: [{ date: s.checkIn, truck: '', route: unit.name, category: 'Short stay', load: '', title: 'Stay, ' + unit.name + ' (' + s.source + ')', detail: s.checkIn + ' to ' + s.checkOut + ', ' + s.nights + (s.nights === 1 ? ' night' : ' nights'), qty: 1, price: amount, costs: {} }] });
  inv.stayId = s.id; inv.estimated = total == null; s.invoiceId = inv.id; return inv;
}

Object.assign(actions, {
  setUserBiz(db, user, { userId, biz }) {
    ownerOnly(user); const u = db.users.find(x => x.id === userId); if (!u) throw new AppError('User not found.');
    if (u.role === 'owner') throw new AppError('The owner always sees both businesses.');
    u.biz = BIZ.includes(biz) ? biz : 'both'; u.tokenVersion = (u.tokenVersion || 0) + 1;
    audit(db, user, 'Changed ' + u.name + ' to ' + ({ both: 'both businesses', nv: 'NV Construction only', cozy: 'Cozy Apartments only' }[u.biz]), ''); return {};
  },
  /** The calendar links for each unit, and what each site keeps from a booking. */
  saveChannels(db, user, { links, fees }) {
    amgr(user); db.aptSettings = db.aptSettings || {};
    (links || []).forEach(l => {
      const u = afind(db.units, l.unitId, 'unit'); u.channels = u.channels || {};
      [['airbnb', 'Airbnb'], ['booking', 'Booking.com']].forEach(([k, name]) => {
        const v = String(l[k] || '').trim();
        if (v && !/^https:\/\/[^\s]+$/i.test(v)) throw new AppError('The ' + name + ' link for ' + u.name + ' must start with https://');
        u.channels[k] = v.slice(0, 500);
      });
      ensureIcalToken(u);
    });
    if (fees) db.aptSettings.channelFees = { Airbnb: Math.max(0, Math.min(50, num(fees.Airbnb))), 'Booking.com': Math.max(0, Math.min(50, num(fees['Booking.com']))) };
    db.units.forEach(ensureIcalToken);
    audit(db, user, 'Changed booking site links', ''); return {};
  },
  /** The payout from Airbnb or Booking.com arrives: the guest’s price becomes income and the site’s cut a cost. */
  recordPayout(db, user, { stayId, guestPaid, payout, date: d }) {
    amgr(user); const s = afind(db.stays, stayId, 'stay');
    if (!CHANNELS.includes(s.source)) throw new AppError('Payouts are for Airbnb and Booking.com bookings. Record a payment instead.');
    if (s.status === 'Cancelled') throw new AppError('This booking was cancelled.');
    const gp = a2(num(guestPaid)), po = a2(num(payout)), pd = date(d, 'payout date');
    if (!(gp > 0)) throw new AppError('Enter what the guest paid for the stay.');
    if (!(po > 0) || po > gp) throw new AppError('The payout must be more than zero and no more than what the guest paid.');
    let inv = s.invoiceId && db.invoices.find(i => i.id === s.invoiceId && !i.void);
    if (inv && (inv.payments || []).length) throw new AppError('A payment is already recorded for this booking.');
    if (inv) { inv.lines[0].price = gp; inv.lines[0].qty = 1; inv.lines = inv.lines.slice(0, 1); inv.estimated = false; }
    else inv = channelInvoice(db, user, s, gp);
    s.estimated = false; s.guestPaid = gp; s.payout = po; s.commission = a2(gp - po); s.rate = a2(gp / Math.max(1, s.nights));
    actions.addPayment(db, user, { invoiceId: inv.id, payment: { amount: gp, date: pd, method: s.source + ' payout', note: 'Payout ' + po.toFixed(2) + ' after ' + (gp - po).toFixed(2) + ' kept by ' + s.source } });
    if (gp - po > 0.004) {
      const unit = db.units.find(u => u.id === s.unitId) || { name: 'Unit' };
      actions.saveExpense(db, user, { expense: { date: pd, category: 'Booking site commissions', description: s.source + ' fee, ' + unit.name + ', ' + s.checkIn + ' to ' + s.checkOut, amount: a2(gp - po), method: s.source + ' payout', paidBy: 'Business', biz: 'cozy' } });
      const e = db.expenses[db.expenses.length - 1]; if (e) e.stayId = s.id;
    }
    stamp(s, user, false); audit(db, user, s.source + ' payout EC$' + po.toFixed(2), unit_name(db, s)); return { invoiceId: inv.id };
  },
  acceptStayRequest(db, user, { id, unitId, rate, cleaning }) {
    amgr(user); const r = afind(db.requests || [], id, 'request'); if (r.kind !== 'Short stay') throw new AppError('Only stay requests can be turned into a booking.');
    const res = actions.saveStay(db, user, { stay: { unitId, guest: { name: r.name, phone: r.phone, email: r.email }, guests: parseInt(r.people, 10) || 1, checkIn: r.arrive, checkOut: r.leave, rate, cleaning, source: 'Website', notes: r.message ? 'From the website: ' + r.message : 'Booked from the website.' } });
    r.status = 'Accepted'; r.stayId = res.id; r.handledBy = user.name; r.handledAt = nowIso(); return { stayId: res.id };
  },
  setRequestStatus(db, user, { id, status }) {
    if (user.role !== 'owner' && user.role !== 'member') throw new AppError('Only the owner or a manager can do that.', 403);
    const r = afind(db.requests || [], id, 'request'); if (!['New', 'Contacted', 'Declined', 'Closed'].includes(status)) throw new AppError('Choose a valid status.');
    if (!bizAllowed(user, r.biz === 'nv' ? 'saveBooking' : 'saveStay')) throw new AppError('Your access does not include that.', 403);
    r.status = status; r.handledBy = user.name; r.handledAt = nowIso(); return {};
  }
});
function unit_name(db, s) { const u = db.units.find(x => x.id === s.unitId); return u ? u.name : ''; }

/** A booking request or enquiry sent from the website. Nothing is booked until the office accepts it. */
export function addBookingRequest(db, body, today) {
  today = today || svgToday(); const b = body || {};
  const KINDS = ['Short stay', 'Long-term rental', 'Building work', 'Skip bin or equipment hire'];
  const kind = KINDS.includes(b.kind) ? b.kind : 'Short stay';
  const name = str(b.name, 100), phone = str(b.phone, 40);
  if (!name || !phone) throw new AppError('Please give your name and a phone or WhatsApp number.');
  db.requests = db.requests || [];
  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  if (db.requests.filter(r => r.at > hourAgo).length >= 30) throw new AppError('We are receiving a lot of requests. Please WhatsApp us instead.', 429);
  const r = { id: newId('rq'), at: nowIso(), kind, biz: kind === 'Short stay' || kind === 'Long-term rental' ? 'cozy' : 'nv', status: 'New', name, phone, email: str(b.email, 120), message: str(b.message, 1000),
    people: str(b.people, 10), apartment: str(b.apartment, 40), project: str(b.project, 80), location: str(b.location, 120), hire: str(b.hire, 40), hireFrom: ISO.test(b.hire_from || '') ? b.hire_from : '',
    moveIn: ISO.test(b.move_in || '') ? b.move_in : '', length: str(b.length, 30) };
  if (kind === 'Short stay') {
    if (!ISO.test(b.arrive || '') || !ISO.test(b.leave || '')) throw new AppError('Please choose your arrival and departure dates.');
    if (b.arrive < today) throw new AppError('The arrival date has passed.');
    const n = nightsOf(b.arrive, b.leave); if (!(n >= 1 && n <= 90)) throw new AppError('Stays can be from 1 to 90 nights.');
    r.arrive = b.arrive; r.leave = b.leave; r.nights = n;
  }
  db.requests.push(r);
  if (db.requests.length > 600) db.requests = db.requests.filter(x => x.status === 'New').concat(db.requests.filter(x => x.status !== 'New').slice(-300));
  audit(db, SYS, 'Website enquiry: ' + kind, name);
  return { id: r.id };
}

/** The calendar each unit shares with Airbnb and Booking.com, so they close the nights already taken. */
export function unitCalendar(db, token, exclude) {
  const u = (db.units || []).find(x => x.icalToken && x.icalToken === token); if (!u) return null;
  const today = svgToday(), from = addDaysIso(today, -30), ev = [];
  const fmt = d => d.replace(/-/g, '');
  db.stays.filter(s => s.unitId === u.id && s.status !== 'Cancelled' && s.checkOut >= from && s.source !== exclude).forEach(s => ev.push({ uid: s.id, start: s.checkIn, end: s.checkOut }));
  db.tenancies.filter(t => t.unitId === u.id && ['Signed', 'Active'].includes(t.status)).forEach(t => { const end = t.end && t.end > today ? addDaysIso(t.end, 1) : addDaysIso(today, 365); if (end >= from) ev.push({ uid: t.id, start: t.start > from ? t.start : from, end }); });
  const stamp0 = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//NV Construction Ltd//Cozy Apartments//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:' + u.name];
  ev.forEach(e => lines.push('BEGIN:VEVENT', 'UID:' + e.uid + '@cozy-apartments', 'DTSTAMP:' + stamp0, 'DTSTART;VALUE=DATE:' + fmt(e.start), 'DTEND;VALUE=DATE:' + fmt(e.end), 'SUMMARY:Not available', 'END:VEVENT'));
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

function bizFilter(v, user, db) {
  const b = user.biz || 'both';
  v.requests = (db.requests || []).slice(-200).filter(r => b === 'both' || r.biz === b);
  if (user.role === 'driver') v.requests = [];
  v.channelSync = db.channelSync || null;
  if (b === 'nv') {
    ['units', 'tenancies', 'stays', 'repairs', 'properties'].forEach(k => { v[k] = []; });
    v.invoices = (v.invoices || []).filter(i => i.brand !== 'cozy'); v.expenses = (v.expenses || []).filter(e => e.biz !== 'cozy');
  }
  if (b === 'cozy') {
    ['bookings', 'projects', 'bins', 'hires', 'hours', 'hourPlans', 'fuel', 'incidents', 'quotes', 'driverPay'].forEach(k => { v[k] = []; });
    v.invoices = (v.invoices || []).filter(i => i.brand === 'cozy'); v.expenses = (v.expenses || []).filter(e => e.biz === 'cozy');
  }
  return v;
}
export function clientView(db, user) { if (user.role === 'tenant') return tenantView(db, user); return extraView(bizFilter(clientViewAll(db, user), user, db), user, db); }


// ==================== NV: staff duties, site programme, quality and safety, turnovers, payroll, the tenant app ====================
export const TENANT_ACTIONS = ['savePrefs', 'saveNotify', 'changePassword', 'revokeSession', 'savePushSub', 'updatePushPrefs', 'removePushSub', 'tenantRepair', 'tenantPaid'];
const DESK_BLOCKED = ['saveExpense', 'voidExpense', 'saveSettings', 'closeMonth', 'reopenMonth', 'saveStartup', 'deleteStartup', 'saveCapital', 'deleteCapital', 'savePartnerTx', 'deletePartnerTx', 'saveDriverPay', 'deleteDriverPay', 'savePayPerson', 'deletePayPerson', 'createPayRun', 'savePayLine', 'deletePayRun', 'finalisePayRun', 'savePaySettings', 'saveChannels', 'raiseRent', 'importData', 'saveOnlineBooking'];
// Each duty sits on one of the base roles, which decide what is sent and what can be changed.
export const DUTIES = { office: ['nv', 'member', 'Office and accounts'], pm: ['nv', 'member', 'Project manager'], foreman: ['nv', 'driver', 'Site foreman'], crew: ['nv', 'driver', 'Crew'],
  manager: ['cozy', 'member', 'Property manager'], desk: ['cozy', 'member', 'Front desk'], maint: ['cozy', 'driver', 'Maintenance'], cleaner: ['cozy', 'driver', 'Cleaner'] };
const mgrOnly = u => { if (u.role !== 'owner' && u.role !== 'member') throw new AppError('Only the owner or a manager can do that.', 403); };
const prj = (db, id) => { const p = db.projects.find(x => x.id === id); if (!p) throw new AppError('Project not found.'); return p; };
const isoOk = (d, what) => { if (!ISO.test(String(d || ''))) throw new AppError('Choose ' + what + '.'); return d; };

function extraView(v, user, db) {
  if (user.role === 'driver') {
    v.projects = (v.projects || []).map(p => { const full = db.projects.find(x => x.id === p.id) || {}; return Object.assign(p, { tasks: full.tasks || [], quality: full.quality || {} }); });
    v.stays = (v.stays || []).map(s => Object.assign({}, s, { clean: ((db.stays.find(x => x.id === s.id) || {}).clean) || null }));
    v.aptSettings = Object.assign({}, v.aptSettings || {}, { cleanList: (db.aptSettings || {}).cleanList || null });
  }
  if (user.duty === 'desk') { v.expenses = []; v.startup = []; v.capital = []; v.partnerTx = []; v.driverPay = []; }
  const canPay = user.role === 'owner' || (user.role === 'member' && !['desk', 'pm'].includes(user.duty || ''));
  const b = user.biz || 'both';
  v.payroll = canPay ? { settings: (db.payroll || {}).settings || {}, people: ((db.payroll || {}).people || []).filter(x => b === 'both' || x.biz === b), runs: ((db.payroll || {}).runs || []).filter(x => b === 'both' || x.biz === b).slice(-60) } : null;
  v.notices = (db.notices || []).slice(0, 30);
  v.payNotices = user.role === 'driver' || b === 'nv' ? [] : (db.payNotices || []).slice(-100);
  return v;
}

/* ---------- the tenant app: a tenant sees only their own home, money and requests ---------- */
function tenantView(db, user) {
  const t = db.tenancies.find(x => x.id === user.tenancyId) || null, s = db.settings, a = db.aptSettings || {};
  const unit = t ? db.units.find(u => u.id === t.unitId) : null;
  return {
    me: publicUser(user), tenantMode: true,
    settings: { businessName: s.businessName, phone: s.phone, whatsapp: s.whatsapp, email: s.email, bankName: s.bankName, accountName: s.accountName, accountNumber: s.accountNumber, vehicles: [], drivers: [], partners: [] },
    aptSettings: a, paySettings: db.paySettings || {}, properties: (db.properties || []).filter(p => unit && p.id === unit.propertyId),
    tenancy: t, tenancies: t ? [t] : [], units: unit ? [unit] : [],
    invoices: t ? db.invoices.filter(i => !i.void && i.tenancyId === t.id) : [],
    repairs: unit ? db.repairs.filter(r => r.unitId === unit.id && (r.reportedById === user.id || r.reportedBy === user.name)).slice(-30) : [],
    notices: (db.notices || []).slice(0, 20), payNotices: (db.payNotices || []).filter(n => t && n.tenancyId === t.id).slice(-20),
    mySessions: (user.sessions || []).map(x => ({ id: x.id, device: x.device, at: x.at, current: x.id === user._sid })),
    clients: [], expenses: [], quotes: [], bookings: [], projects: [], stays: [], users: [], audit: [], requests: [],
    pushCount: db.pushSubs.filter(p => p.userId === user.id).length
  };
}

Object.assign(actions, {
  setUserDuty(db, user, { userId, duty }) {
    ownerOnly(user); const u = db.users.find(x => x.id === userId); if (!u) throw new AppError('User not found.');
    if (u.role === 'owner' || u.role === 'tenant') throw new AppError('That account’s access cannot be changed here.');
    if (duty && !DUTIES[duty]) throw new AppError('Choose a valid duty.');
    u.duty = duty || ''; if (duty) { u.biz = DUTIES[duty][0]; u.role = DUTIES[duty][1]; }
    u.tokenVersion = (u.tokenVersion || 0) + 1; audit(db, user, 'Set ' + u.name + ' as ' + (duty ? DUTIES[duty][2] : 'no particular duty'), ''); return {};
  },
  /* ---------- programme: tasks with dates, durations and what they wait for ---------- */
  saveTask(db, user, { projectId, task }) {
    if (user.role === 'other') throw new AppError('Your access is view only.', 403);
    if (user.role === 'driver' && user.duty !== 'foreman' && !(task && task.id)) throw new AppError('Only the site foreman or the office can add tasks.', 403);
    const p = prj(db, projectId), t0 = task || {}; p.tasks = p.tasks || [];
    let t = t0.id ? p.tasks.find(x => x.id === t0.id) : null;
    if (user.role === 'driver' && user.duty !== 'foreman') { if (!t) throw new AppError('Task not found.'); t.progress = Math.max(0, Math.min(100, Math.round(num(t0.progress)))); t.updated = new Date().toISOString().slice(0, 10); stamp(t, user, false); return { id: t.id }; }
    const name = str(t0.name, 80); if (!name) throw new AppError('Name the task.');
    const days = Math.round(num(t0.days)); if (!(days >= 1 && days <= 730)) throw new AppError('Enter how many working days it takes (1 to 730).');
    if (!t) { t = { id: newId('tk') }; p.tasks.push(t); }
    const after = (Array.isArray(t0.after) ? t0.after : []).filter(id => id !== t.id && p.tasks.some(x => x.id === id)).slice(0, 6);
    Object.assign(t, { name, phase: str(t0.phase, 40), start: t0.start && ISO.test(t0.start) ? t0.start : '', days, after, progress: Math.max(0, Math.min(100, Math.round(num(t0.progress)))), who: str(t0.who, 60), milestone: !!t0.milestone });
    // a task cannot wait for itself through a chain
    const seen = new Set(), walk = id => { if (id === t.id) throw new AppError('That would make the task wait for itself.'); if (seen.has(id)) return; seen.add(id); ((p.tasks.find(x => x.id === id) || {}).after || []).forEach(walk); };
    after.forEach(walk);
    stamp(t, user, !t0.id); audit(db, user, 'Programme: ' + name, p.name); return { id: t.id };
  },
  deleteTask(db, user, { projectId, taskId }) {
    mgrOnly(user); const p = prj(db, projectId); p.tasks = (p.tasks || []).filter(x => x.id !== taskId); p.tasks.forEach(x => { x.after = (x.after || []).filter(a => a !== taskId); }); return {};
  },
  /* ---------- quality and safety: inspections, questions (RFIs), toolbox talks, near misses, permits ---------- */
  saveQuality(db, user, { projectId, kind, item }) {
    if (user.role === 'other') throw new AppError('Your access is view only.', 403);
    const p = prj(db, projectId), i0 = item || {}; p.quality = p.quality || { inspections: [], rfis: [], safety: [] };
    const list = { inspection: 'inspections', rfi: 'rfis', safety: 'safety' }[kind]; if (!list) throw new AppError('Choose what you are recording.');
    p.quality[list] = p.quality[list] || [];
    let x = i0.id ? p.quality[list].find(r => r.id === i0.id) : null;
    if (!x) { x = { id: newId('q') }; if (kind === 'rfi') x.no = 'RFI-' + String(p.quality.rfis.length + 1).padStart(2, '0'); p.quality[list].unshift(x); }
    if (kind === 'inspection') { const title = str(i0.title, 120); if (!title) throw new AppError('Say what is being inspected.'); Object.assign(x, { title, date: isoOk(i0.date, 'the date'), by: str(i0.by, 80), result: ['Booked', 'Passed', 'Failed', 'Re-inspect'].includes(i0.result) ? i0.result : 'Booked', notes: str(i0.notes, 600) }); }
    if (kind === 'rfi') { const q = str(i0.question, 600); if (!q) throw new AppError('Write the question.'); Object.assign(x, { question: q, to: str(i0.to, 80), raised: i0.raised && ISO.test(i0.raised) ? i0.raised : new Date().toISOString().slice(0, 10), due: i0.due && ISO.test(i0.due) ? i0.due : '', answer: str(i0.answer, 1000), status: str(i0.answer, 1000) ? 'Answered' : 'Open' }); }
    if (kind === 'safety') { const detail = str(i0.detail, 600); if (!detail) throw new AppError('Describe it.'); Object.assign(x, { kind: ['Toolbox talk', 'Near miss', 'Incident', 'Permit', 'Safety check'].includes(i0.kind) ? i0.kind : 'Toolbox talk', date: isoOk(i0.date, 'the date'), detail, people: Math.max(0, parseInt(i0.people, 10) || 0), expires: i0.expires && ISO.test(i0.expires) ? i0.expires : '', status: i0.status === 'Closed' ? 'Closed' : 'Open' }); }
    stamp(x, user, !i0.id); audit(db, user, { inspection: 'Inspection', rfi: 'Question', safety: 'Safety record' }[kind], p.name); return { id: x.id };
  },
  deleteQuality(db, user, { projectId, kind, id }) { mgrOnly(user); const p = prj(db, projectId), list = { inspection: 'inspections', rfi: 'rfis', safety: 'safety' }[kind]; if (p.quality && p.quality[list]) p.quality[list] = p.quality[list].filter(x => x.id !== id); return {}; },
  /* ---------- turnovers: the clean between guests ---------- */
  markCleaned(db, user, { stayId, items, note }) {
    if (user.role === 'other') throw new AppError('Your access is view only.', 403);
    const s = afind(db.stays, stayId, 'stay'), its = (Array.isArray(items) ? items : []).slice(0, 30).map(i => ({ text: str(i.text, 80), done: !!i.done }));
    s.clean = { items: its, done: its.length > 0 && its.every(i => i.done), note: str(note, 400), by: user.name, at: nowIso() };
    stamp(s, user, false); audit(db, user, s.clean.done ? 'Unit cleaned' : 'Clean started', unit_name(db, s)); return {};
  },
  /* ---------- notices to tenants, and payments tenants say they have made ---------- */
  saveNotice(db, user, { text }) { amgr(user); const t = str(text, 800); if (!t) throw new AppError('Write the notice.'); db.notices = db.notices || []; db.notices.unshift({ id: newId('nt'), date: new Date().toISOString().slice(0, 10), text: t, by: user.name }); db.notices = db.notices.slice(0, 60); return {}; },
  deleteNotice(db, user, { id }) { amgr(user); db.notices = (db.notices || []).filter(n => n.id !== id); return {}; },
  confirmPayNotice(db, user, { id }) {
    amgr(user); const n = afind(db.payNotices || [], id, 'payment'); if (n.status !== 'New') throw new AppError('This payment has already been dealt with.');
    const r = actions.recordTenantPayment(db, user, { tenancyId: n.tenancyId, amount: n.amount, date: n.date, method: n.method, reference: n.reference });
    n.status = 'Confirmed'; n.by = user.name; return r;
  },
  rejectPayNotice(db, user, { id, reason }) { amgr(user); const n = afind(db.payNotices || [], id, 'payment'); n.status = 'Not received'; n.reason = str(reason, 200); n.by = user.name; return {}; },
  tenantRepair(db, user, { issue, priority, enter }) {
    const t = db.tenancies.find(x => x.id === user.tenancyId); if (!t) throw new AppError('Your tenancy could not be found. Please contact the office.');
    const text = str(issue, 300); if (!text) throw new AppError('Tell us what is wrong.');
    const r = { id: newId('rp'), unitId: t.unitId, issue: text, priority: ['Urgent', 'Soon', 'When convenient'].includes(priority) ? priority : 'Soon', status: 'Open', assigned: '', notes: enter ? 'The tenant says the repair team can go in if they are out.' : 'Call the tenant before going in.', reported: new Date().toISOString().slice(0, 10), done: '', reportedBy: user.name, reportedById: user.id, source: 'Tenant app' };
    stamp(r, user, true); db.repairs.push(r); audit(db, user, 'Tenant reported a repair', text); return { id: r.id };
  },
  tenantPaid(db, user, { amount, date: d, method, reference }) {
    const t = db.tenancies.find(x => x.id === user.tenancyId); if (!t) throw new AppError('Your tenancy could not be found.');
    const amt = a2(num(amount)); if (!(amt > 0)) throw new AppError('Enter the amount you paid.');
    db.payNotices = db.payNotices || [];
    const n = { id: newId('pn'), tenancyId: t.id, amount: amt, date: date(d, 'payment date'), method: ['Local bank transfer', 'International transfer', 'Cash', 'Card', 'Other'].includes(method) ? method : 'Local bank transfer', reference: str(reference, 120), at: nowIso(), status: 'New', name: t.tenant.name };
    db.payNotices.push(n); audit(db, user, 'Tenant reported a payment of EC$' + amt.toFixed(2), t.tenant.name); return { id: n.id };
  },
  /* ---------- payroll: pay, NIS, PAYE, payslips and the bank file ---------- */
  savePayPerson(db, user, { person }) {
    if (user.role !== 'owner' && !(user.role === 'member' && !['desk', 'pm'].includes(user.duty || ''))) throw new AppError('Your access does not include payroll.', 403);
    db.payroll = db.payroll || { people: [], runs: [], settings: {} }; const x0 = person || {}, name = str(x0.name, 80); if (!name) throw new AppError('Enter the person’s name.');
    let x = x0.id ? db.payroll.people.find(p => p.id === x0.id) : null; if (!x) { x = { id: newId('pp') }; db.payroll.people.push(x); }
    Object.assign(x, { name, biz: x0.biz === 'cozy' ? 'cozy' : 'nv', job: str(x0.job, 60), type: x0.type === 'timesheet' ? 'timesheet' : 'wage', wage: Math.max(0, a2(num(x0.wage))), linkId: str(x0.linkId, 40),
      nisNo: str(x0.nisNo, 30), nis: x0.nis !== false, payeRate: Math.max(0, Math.min(40, num(x0.payeRate))), payeFixed: Math.max(0, a2(num(x0.payeFixed))),
      account: str(x0.account, 30).replace(/\s/g, ''), accountType: x0.accountType === 'DDA' ? 'DDA' : 'SAV', routing: str(x0.routing, 20).replace(/\s/g, ''), bank: str(x0.bank, 60), active: x0.active !== false });
    stamp(x, user, !x0.id); audit(db, user, 'Payroll details for ' + name, ''); return { id: x.id };
  },
  savePaySettingsPayroll(db, user, { settings }) {
    if (user.role !== 'owner') throw new AppError('Only the owner can change payroll settings.', 403);
    db.payroll = db.payroll || { people: [], runs: [], settings: {} }; const s0 = settings || {};
    db.payroll.settings = { routing: str(s0.routing, 20).replace(/\s/g, ''), nisEe: s0.nisEe === '' || s0.nisEe == null ? null : Math.max(0, Math.min(20, num(s0.nisEe))), nisEr: s0.nisEr === '' || s0.nisEr == null ? null : Math.max(0, Math.min(20, num(s0.nisEr))), ceiling: s0.ceiling === '' || s0.ceiling == null ? null : Math.max(0, num(s0.ceiling)) };
    return {};
  },
  createPayRun(db, user, { biz, from, to, payDate }) {
    if (user.role !== 'owner' && !(user.role === 'member' && !['desk', 'pm'].includes(user.duty || ''))) throw new AppError('Your access does not include payroll.', 403);
    db.payroll = db.payroll || { people: [], runs: [], settings: {} };
    const a = isoOk(from, 'the first day of the pay period'), z = isoOk(to, 'the last day of the pay period'), pd = isoOk(payDate, 'the pay date'); if (z < a) throw new AppError('The period ends before it starts.');
    const b = biz === 'cozy' ? 'cozy' : 'nv', people = db.payroll.people.filter(x => x.active !== false && x.biz === b);
    if (!people.length) throw new AppError('Add the people you pay first.');
    const days = Math.round((Date.parse(z) - Date.parse(a)) / 864e5) + 1, rates = nisRates(db, pd);
    const ceiling = days <= 7 ? rates.ceiling * 12 / 52 : days <= 16 ? rates.ceiling * 12 / 26 : rates.ceiling;
    const lines = people.map(x => { const gross = x.type === 'timesheet' ? earned(db, x.linkId, a, z) : x.wage; return payLine(x, a2(gross), 0, rates, ceiling); });
    const run = { id: newId('pr'), no: (db.payroll.runs.length ? Math.max(...db.payroll.runs.map(r => r.no || 0)) : 0) + 1, biz: b, from: a, to: z, payDate: pd, status: 'Draft', lines, rates: { ee: rates.ee, er: rates.er, ceiling: a2(ceiling) } };
    stamp(run, user, true); db.payroll.runs.push(run); audit(db, user, 'Payroll run ' + run.no + ' started', b); return { id: run.id };
  },
  savePayLine(db, user, { runId, personId, gross, other }) {
    const run = payRun(db, user, runId); if (run.status !== 'Draft') throw new AppError('This pay run is already paid.');
    const l = run.lines.find(x => x.personId === personId); if (!l) throw new AppError('Line not found.');
    const x = db.payroll.people.find(p => p.id === personId) || { name: l.name, nis: true, payeRate: 0, payeFixed: 0 };
    Object.assign(l, payLine(x, Math.max(0, a2(num(gross))), Math.max(0, a2(num(other))), { ee: run.rates.ee, er: run.rates.er }, run.rates.ceiling)); return {};
  },
  deletePayRun(db, user, { runId }) { const run = payRun(db, user, runId); if (run.status !== 'Draft') throw new AppError('A paid run cannot be deleted.'); db.payroll.runs = db.payroll.runs.filter(r => r.id !== runId); return {}; },
  finalisePayRun(db, user, { runId }) {
    const run = payRun(db, user, runId); if (run.status !== 'Draft') throw new AppError('This pay run is already paid.');
    const sum = k => a2(run.lines.reduce((t, l) => t + l[k], 0)), wageGross = a2(run.lines.filter(l => l.type !== 'timesheet').reduce((t, l) => t + l.gross, 0));
    const exp = e => { actions.saveExpense(db, user, { expense: Object.assign({ date: run.payDate, method: 'Bank transfer', paidBy: 'Business', biz: run.biz }, e) }); return db.expenses[db.expenses.length - 1].id; };
    run.expenseIds = [];
    if (wageGross > 0) run.expenseIds.push(exp({ category: 'Wages and salaries', description: 'Payroll ' + run.no + ', ' + run.from + ' to ' + run.to, amount: wageGross }));
    if (sum('nisEr') > 0) run.expenseIds.push(exp({ category: 'NIS (employer)', description: 'Employer NIS, payroll ' + run.no, amount: sum('nisEr') }));
    // crew paid from timesheets: their labour is already a cost on the projects, so the pay run settles what they are owed
    run.lines.filter(l => l.type === 'timesheet' && l.linkId && l.gross > 0).forEach(l => {
      try { actions.saveDriverPay(db, user, { pay: { driverId: l.linkId, amount: l.gross, date: run.payDate, method: l.account ? 'Bank transfer' : 'Cash', notes: 'Payroll ' + run.no + ': net ' + l.net.toFixed(2) + ' paid, NIS ' + l.nisEe.toFixed(2) + ' and PAYE ' + l.paye.toFixed(2) + ' withheld' } }); } catch (e) {}
    });
    run.status = 'Paid'; run.paidAt = nowIso(); run.paidBy = user.name; audit(db, user, 'Payroll run ' + run.no + ' paid', 'Net EC$' + sum('net').toFixed(2)); return {};
  }
});
function payRun(db, user, id) {
  if (user.role !== 'owner' && !(user.role === 'member' && !['desk', 'pm'].includes(user.duty || ''))) throw new AppError('Your access does not include payroll.', 403);
  const r = ((db.payroll || {}).runs || []).find(x => x.id === id); if (!r) throw new AppError('Pay run not found.'); return r;
}
/** NIS rates in St Vincent and the Grenadines: 14% (6.5% employee, 7.5% employer) in 2026, 15% (7% and 8%) from 1 January 2027, on earnings up to EC$5,200 a month. Owner can override. */
function nisRates(db, payDate) {
  const s = (db.payroll || {}).settings || {}, y27 = payDate >= '2027-01-01';
  return { ee: s.nisEe != null ? s.nisEe : (y27 ? 7 : 6.5), er: s.nisEr != null ? s.nisEr : (y27 ? 8 : 7.5), ceiling: s.ceiling != null ? s.ceiling : 5200 };
}
function payLine(x, gross, other, rates, ceiling) {
  const base = x.nis === false ? 0 : Math.min(gross, ceiling);
  const nisEe = a2(base * rates.ee / 100), nisEr = a2(base * rates.er / 100), paye = a2((x.payeFixed || 0) + gross * (x.payeRate || 0) / 100);
  return { personId: x.id, name: x.name, type: x.type, linkId: x.linkId || '', account: x.account || '', accountType: x.accountType || 'SAV', routing: x.routing || '', gross, nisEe, nisEr, paye, other, net: a2(Math.max(0, gross - nisEe - paye - other)) };
}
/** What a crew member earned in a period: labour logged on projects and driver fees on jobs. */
function earned(db, driverId, a, z) {
  if (!driverId) return 0; let t = 0;
  (db.projects || []).forEach(p => (p.costs || []).forEach(c => { if (c.driverId === driverId && c.date >= a && c.date <= z) t += Number(c.amount) || 0; }));
  (db.invoices || []).forEach(i => { if (i.void) return; (i.lines || []).forEach(l => { if (l.driverId === driverId && l.date >= a && l.date <= z) t += Number((l.costs || {}).labour) || 0; }); });
  return t;
}

// ==================== NV: booking and paying for a stay on the website ====================
// The website asks what is free, the guest reserves, the apartment is held while they pay, and unpaid holds are released.
const WEB = { id: 'website', name: 'Website booking', role: 'owner' };
const TYPE_ORDER = ['One bedroom', 'Two bedroom', 'Three bedroom', 'Studio'];
export function typeKey(t) { const s = String(t || '').toLowerCase(); if (/studio/.test(s)) return 'Studio'; if (/(^|\D)1(\D|$)|one/.test(s)) return 'One bedroom'; if (/(^|\D)2(\D|$)|two/.test(s)) return 'Two bedroom'; if (/(^|\D)3(\D|$)|three/.test(s)) return 'Three bedroom'; return t ? String(t) : 'Apartment'; }
function online(db) { const o = (db.aptSettings || {}).online || {}; return { on: o.on !== false, holdHours: o.holdHours || 24, depositPct: o.depositPct || 100, cleaning: o.cleaning != null ? o.cleaning : 0, minNights: o.minNights || 1, maxNights: 60 }; }
function webToday() { return new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10); }
function sellable(db) { return db.units.filter(u => u.active !== false && u.use !== 'Long-term' && (u.nightlyRate || 0) > 0); }
function freeUnits(db, type, a, z, guests) { return sellable(db).filter(u => typeKey(u.type) === type && (u.maxGuests || 2) >= guests && !unitClash(db, u.id, a, z, null)).sort((x, y) => x.nightlyRate - y.nightlyRate); }
function checkDates(db, b) {
  const o = online(db); if (!o.on) throw new AppError('Online booking is switched off at the moment. Please send us an enquiry or WhatsApp us.');
  const a = b.arrive, z = b.leave, today = webToday();
  if (!ISO.test(a || '') || !ISO.test(z || '')) throw new AppError('Please choose your arrival and leaving dates.');
  if (a < today) throw new AppError('The arrival date has passed.');
  const n = Math.round((Date.parse(z) - Date.parse(a)) / 864e5);
  if (n < o.minNights) throw new AppError('The shortest stay we take online is ' + o.minNights + (o.minNights === 1 ? ' night.' : ' nights.'));
  if (n > o.maxNights) throw new AppError('For stays of more than ' + o.maxNights + ' nights, please send us an enquiry.');
  const g = Math.max(1, Math.min(12, parseInt(b.guests, 10) || 1));
  return { a, z, n, g, o };
}
/** Unpaid holds past their time are cancelled and their invoices withdrawn, so the nights can be sold again. */
export function releaseHolds(db, nowMs) {
  nowMs = nowMs || Date.now(); let n = 0;
  (db.stays || []).forEach(s => {
    if (!s.hold || s.hold.paid || s.status === 'Cancelled' || Date.parse(s.hold.until) > nowMs) return;
    const inv = s.invoiceId && db.invoices.find(i => i.id === s.invoiceId && !i.void);
    if (inv && (inv.payments || []).length) return;
    s.status = 'Cancelled'; s.hold.released = new Date(nowMs).toISOString(); s.notes = (s.notes ? s.notes + ' ' : '') + 'Released: not paid in time.';
    if (inv) { inv.void = true; inv.voidReason = 'Online booking not paid in time'; }
    n++;
  });
  return n;
}
export function publicAvailability(db, b) {
  releaseHolds(db);
  const { a, z, n, g, o } = checkDates(db, b || {});
  const types = [...new Set(sellable(db).map(u => typeKey(u.type)))].sort((x, y) => (TYPE_ORDER.indexOf(x) + 99) % 99 - (TYPE_ORDER.indexOf(y) + 99) % 99);
  const options = types.map(t => {
    const all = sellable(db).filter(u => typeKey(u.type) === t), f = freeUnits(db, t, a, z, g);
    const rate = f.length ? f[0].nightlyRate : Math.min(...all.map(u => u.nightlyRate));
    return { type: t, free: f.length, rate, cleaning: o.cleaning, total: a2(rate * n + o.cleaning), maxGuests: Math.max(...all.map(u => u.maxGuests || 2)) };
  });
  return { nights: n, depositPct: o.depositPct, holdHours: o.holdHours, options };
}
function webPayLines(db, ref) {
  const st = db.settings, p = db.paySettings || {}, out = [];
  if (st.bankName && st.accountNumber) out.push('From a bank in St Vincent and the Grenadines: transfer to ' + (st.accountName || st.businessName) + ', ' + st.bankName + ', account ' + st.accountNumber + ', quoting ' + ref + '.');
  if (p.swift) out.push('From abroad: an international transfer to the same account. SWIFT/BIC ' + p.swift + (p.bankAddress ? ', ' + p.bankAddress : '') + (p.corrBank ? '. For US dollars, the correspondent bank is ' + p.corrBank + (p.corrSwift ? ' (SWIFT ' + p.corrSwift + ')' : '') : '') + '. Quote ' + ref + '.');
  if (!out.length) out.push('We will send you our bank details on WhatsApp. Quote ' + ref + ' when you pay.');
  return out;
}
export function publicBook(db, b) {
  releaseHolds(db);
  const { a, z, n, g, o } = checkDates(db, b || {});
  const name = str(b.name, 100), phone = str(b.phone, 40), digits = phone.replace(/\D/g, '');
  if (!name || digits.length < 7) throw new AppError('Please give your name and a phone or WhatsApp number.');
  const hourAgo = new Date(Date.now() - 3600000).toISOString();
  if (db.stays.filter(s => s.hold && s.hold.at > hourAgo).length >= 20) throw new AppError('We are taking a lot of bookings right now. Please WhatsApp us.', 429);
  if (db.stays.some(s => s.hold && !s.hold.paid && s.status !== 'Cancelled' && (s.guest.phone || '').replace(/\D/g, '') === digits)) throw new AppError('You already have a booking waiting for payment. Pay for it, or WhatsApp us to change it.');
  const type = String(b.type || ''), u = freeUnits(db, type, a, z, g)[0];
  if (!u) throw new AppError('Sorry, that apartment has just been taken for those dates. Please check again.');
  let ref; do { ref = 'CZ-' + crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6); } while (db.stays.some(s => s.hold && s.hold.ref === ref));
  const total = a2(u.nightlyRate * n + o.cleaning), due = a2(total * o.depositPct / 100), until = new Date(Date.now() + o.holdHours * 3600000).toISOString();
  const s = { id: newId('sy'), invoiceId: '', unitId: u.id, guest: { name, phone, email: str(b.email, 120) }, guests: g, checkIn: a, checkOut: z, nights: n, rate: a2(u.nightlyRate), cleaning: a2(o.cleaning), source: 'Website', status: 'Booked',
    notes: 'Booked on the website, ' + type + (b.message ? '. Guest says: ' + str(b.message, 300) : '.'), hold: { ref, at: nowIso(), until, due, paid: false } };
  stamp(s, WEB, true); db.stays.push(s);
  try { actions.invoiceStay(db, WEB, { id: s.id }); const inv = db.invoices.find(i => i.id === s.invoiceId); if (inv) inv.notes = 'Website booking ' + ref + '.'; } catch (e) { /* the office can invoice it */ }
  audit(db, WEB, 'Website booking ' + ref + ' held until ' + until.slice(0, 16).replace('T', ' '), name + ', ' + type);
  return { ref, total, due, holdUntil: until, holdHours: o.holdHours, pay: { lines: webPayLines(db, ref), cardLink: (db.paySettings || {}).cardLink || '' } };
}
export function publicPaid(db, b) {
  const ref = String((b || {}).ref || '').toUpperCase(), digits = String((b || {}).phone || '').replace(/\D/g, '');
  const s = db.stays.find(x => x.hold && x.hold.ref === ref && (x.guest.phone || '').replace(/\D/g, '') === digits);
  if (!s) throw new AppError('We could not find that booking. Please WhatsApp us.');
  s.hold.guestSaysPaid = { method: str(b.method, 40), reference: str(b.reference, 120), at: nowIso() };
  audit(db, WEB, 'Guest says booking ' + ref + ' is paid', s.guest.name); return {};
}
Object.assign(actions, {
  saveOnlineBooking(db, user, { online: o0 }) {
    amgr(user); const o = o0 || {}; db.aptSettings = db.aptSettings || {};
    db.aptSettings.online = { on: o.on !== false, holdHours: Math.max(1, Math.min(72, parseInt(o.holdHours, 10) || 24)), depositPct: Math.max(10, Math.min(100, parseInt(o.depositPct, 10) || 100)), cleaning: Math.max(0, a2(num(o.cleaning))), minNights: Math.max(1, Math.min(30, parseInt(o.minNights, 10) || 1)) };
    audit(db, user, 'Changed online booking settings', ''); return {};
  },
  releaseOnlineHold(db, user, { stayId }) {
    amgr(user); const s = afind(db.stays, stayId, 'stay'); if (!s.hold) throw new AppError('This is not a website booking.');
    const inv = s.invoiceId && db.invoices.find(i => i.id === s.invoiceId && !i.void); if (inv && (inv.payments || []).length) throw new AppError('A payment is already recorded. Cancel it from the invoice first.');
    s.status = 'Cancelled'; s.hold.released = nowIso(); if (inv) { inv.void = true; inv.voidReason = 'Online booking released'; }
    audit(db, user, 'Released website booking ' + s.hold.ref, s.guest.name); return {};
  }
});
// a payment recorded against a website booking confirms it once what was asked for is in
const nvRecordStayPayment = actions.recordStayPayment;
actions.recordStayPayment = function (db, user, p) {
  const r = nvRecordStayPayment(db, user, p), s = db.stays.find(x => x.id === p.stayId);
  if (s && s.hold && !s.hold.paid) { const inv = db.invoices.find(i => i.id === r.invoiceId); const paid = (inv.payments || []).reduce((t, x) => t + x.amount, 0); if (paid + 0.009 >= s.hold.due) { s.hold.paid = true; s.hold.paidAt = nowIso(); } }
  return r;
};

export const OTHER_ACTIONS = ['savePrefs', 'saveNotify', 'revokeSession', 'changePassword', 'savePushSub', 'updatePushPrefs', 'removePushSub'];
export const DRIVER_ACTIONS = ['savePrefs', 'saveNotify', 'revokeSession', 'saveIncident', 'addAttachment', 'saveBooking', 'setBookingStatus', 'saveFuel', 'deleteFuel', 'changePassword', 'savePushSub', 'updatePushPrefs', 'removePushSub', 'markSent', 'saveHire', 'collectHire', 'saveHours', 'deleteHours', 'saveDiary', 'saveSnag', 'saveRepair', 'setStayStatus', 'saveTask', 'saveQuality', 'markCleaned'];
function ownerOnly(user) { if (user.role !== 'owner') throw new AppError('Your access does not include that.', 403); }

/** What the app receives: everything except password data. */
function clientViewAll(db, user) {
  if (user.role === 'driver') {
    const s = db.settings;
    return {
      me: publicUser(user),
      settings: { businessName: s.businessName, phone: s.phone, partners: [], defaultPrice: 0, paymentDays: s.paymentDays, vehicles: s.vehicles, drivers: (s.drivers || []).map(d => ({ id: d.id, name: d.name })) },
      clients: db.clients.map(c => ({ id: c.id, name: c.name, phone: c.phone || '' })),
      bookings: db.bookings.map(b => { const { price, qty, costs, category, ...rest } = b; return Object.assign(rest, { costs: costs ? { fuel: costs.fuel || 0, subcontract: costs.subcontract || 0 } : {} }); }),
      bins: db.bins, hires: db.hires, hours: db.hours, hourPlans: db.hourPlans,
      properties: (db.properties || []).map(p => ({ id: p.id, name: p.name })), units: db.units, aptSettings: { name: (db.aptSettings || {}).name, checkIn: (db.aptSettings || {}).checkIn, checkOut: (db.aptSettings || {}).checkOut },
      stays: db.stays.filter(s => s.status !== 'Cancelled').map(s => ({ id: s.id, unitId: s.unitId, guest: { name: s.guest.name, phone: s.guest.phone }, guests: s.guests, checkIn: s.checkIn, checkOut: s.checkOut, nights: s.nights, status: s.status, source: s.source, notes: s.notes })),
      repairs: db.repairs.map(r => ({ id: r.id, unitId: r.unitId, issue: r.issue, priority: r.priority, status: r.status, assigned: r.assigned, notes: r.notes, reported: r.reported, done: r.done })), tenancies: [],
      projects: db.projects.filter(p => ['Won', 'On site', 'Handed over', 'Defects period'].includes(p.status)).map(p => ({ id: p.id, name: p.name, client: p.client, site: p.site, area: p.area, sector: p.sector, type: p.type, status: p.status, start: p.start, finish: p.finish, stages: [], valuations: (p.valuations || []).map(v => ({ pct: v.pct })), diary: p.diary, snags: p.snags, attachments: p.attachments, budget: [], costs: [], variations: [] })),
      fuel: db.fuel, reminders: db.reminders, incidents: db.incidents, mySessions: (db.users.find(u => u.id === user.id).sessions || []).map(x => ({ id: x.id, device: x.device, at: x.at, current: x.id === user._sid })),
      invoices: [], expenses: [], startup: [], quotes: [], capital: [], users: [], audit: [],
      nextInvoiceNo: 0, nextQuoteNo: 0, pushCount: db.pushSubs.filter(p => p.userId === user.id).length
    };
  }
  return {
    bookings: db.bookings,
    fuel: db.fuel,
    bins: db.bins,
    hires: db.hires,
    hours: db.hours,
    hourPlans: db.hourPlans,
    projects: db.projects,
    properties: db.properties || [],
    paySettings: db.paySettings || {},
    units: db.units,
    tenancies: db.tenancies,
    stays: db.stays,
    repairs: db.repairs,
    aptSettings: db.aptSettings,
    pushCount: db.pushSubs.filter(p => p.userId === user.id).length,
    me: publicUser(user),
    settings: db.settings,
    nextInvoiceNo: db.nextInvoiceNo,
    clients: db.clients,
    invoices: db.invoices,
    expenses: db.expenses,
    startup: db.startup,
    quotes: db.quotes,
    nextQuoteNo: db.nextQuoteNo,
    reminders: db.reminders,
    capital: db.capital,
    partnerTx: db.partnerTx,
    driverPay: db.driverPay,
    incidents: db.incidents,
    invites: user.role === 'owner' ? db.invites.filter(i => !i.usedAt && Date.parse(i.expires) > Date.now()).map(i => ({ id: i.id, name: i.name, role: i.role, expires: i.expires, createdBy: i.createdBy })) : [],
    mySessions: (db.users.find(u => u.id === user.id).sessions || []).map(x => ({ id: x.id, device: x.device, at: x.at, current: x.id === user._sid })),
    users: user.role === 'owner' ? db.users.map(publicUser) : [],
    audit: db.audit.slice(0, 200)
  };
}
