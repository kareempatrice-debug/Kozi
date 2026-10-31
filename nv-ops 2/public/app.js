/* NV Ops: NV Construction Ltd operations app (built from NV Ops) */
(function () {
'use strict';

/* ==================== state & helpers ==================== */
var S = {
  token: null, data: null, view: 'dashboard', param: null,
  period: { type: 'month', anchor: null, from: null, to: null },
  invFilter: 'open', invSearch: '', logFilter: 'all', logSearch: '', logTruck: 'all',
  charts: [], logo: null, lastLoad: 0
};
try { S.token = localStorage.getItem('nv_token') || null; } catch (e) {}

var ROUTE_GROUPS = [
  ['Kingstown and the south', ['Kingstown', 'Arnosvale', 'Cane Hall', 'Calliaqua', 'Campden Park']],
  ['Leeward', ['Layou', 'Barrouallie', 'Chateaubelair']],
  ['Windward', ['Georgetown', 'Biabou']]
];
var ROUTES = ROUTE_GROUPS.reduce(function (a, g) { return a.concat(g[1]); }, []);
/** Route dropdown: every route and its return, plus Other with a box to type it in. */
function routeSelect(attrs, value) {
  var sel = !value ? '' : ROUTES.indexOf(value) >= 0 ? value : 'Other';
  return '<select ' + attrs + '><option value=""' + (sel ? '' : ' selected') + '>Choose an area</option>' +
    ROUTE_GROUPS.map(function (g) { return '<optgroup label="' + g[0] + '">' + g[1].map(function (r) { return '<option' + (r === sel ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</optgroup>'; }).join('') +
    '<option value="Other"' + (sel === 'Other' ? ' selected' : '') + '>Other (type it in)</option></select>';
}
function routeOther(attrs, value) {
  var other = value && ROUTES.indexOf(value) < 0;
  return '<label class="f' + (other ? '' : ' hidden') + '" data-other-wrap><span>Other area</span><input ' + attrs + ' value="' + (other ? esc(value) : '') + '" placeholder="e.g. Mesopotamia"></label>';
}
function routeTitle(route) { return ''; }
var WORK_TYPES = ['Long-term rent', 'Short stay', 'New home construction', 'Renovations and extensions', 'Commercial construction', 'Concrete and masonry', 'Roofing and repairs', 'Skip bin rental', 'Haulage', 'Equipment hire', 'Other'];
/** NV's three lines of business; every type of work belongs to one. */
var BUSINESS_LINES = ['Construction', 'Skip bins', 'Equipment and haulage', 'Apartments'];
function lineOf(category) { return ['Long-term rent', 'Short stay', 'Deposit deduction', 'Apartments maintenance'].indexOf(category) >= 0 ? 'Apartments' : category === 'Skip bin rental' ? 'Skip bins' : (category === 'Haulage' || category === 'Equipment hire') ? 'Equipment and haulage' : 'Construction'; }
var LOADS = ['Construction waste', 'Demolition debris', 'Yard waste', 'Cleanout', 'Storm debris', 'Sand', 'Gravel', 'Top Soil', 'Blocks', 'Cement', 'Steel', 'Lumber', 'Roofing sheets'];
/** Tidies older spellings so the same material is counted together. */
function normalizeLoad(v) {
  v = String(v || '').trim();
  if (!v) return '';
  if (/pre[\s-]?mix/i.test(v)) return 'Premix';
  if (/^(garbage|waste)$/i.test(v)) return 'Construction waste';
  if (/household|clean-?out/i.test(v)) return 'Cleanout';
  if (/top\s?soil/i.test(v)) return 'Top Soil';
  var m = LOADS.find(function (x) { return x.toLowerCase() === v.toLowerCase(); });
  return m || v;
}
/** Load dropdown with Other and a box to type it in. */
function loadSelect(attrs, value) {
  var n = normalizeLoad(value), sel = !n ? '' : LOADS.indexOf(n) >= 0 ? n : 'Other';
  return '<select ' + attrs + '><option value=""' + (sel ? '' : ' selected') + '>Choose a load</option>' +
    LOADS.map(function (x) { return '<option' + (x === sel ? ' selected' : '') + '>' + x + '</option>'; }).join('') +
    '<option value="Other"' + (sel === 'Other' ? ' selected' : '') + '>Other (type it in)</option></select>';
}
function loadOther(attrs, value) {
  var n = normalizeLoad(value), other = n && LOADS.indexOf(n) < 0;
  return '<label class="f' + (other ? '' : ' hidden') + '" data-load-wrap><span>Other load</span><input ' + attrs + ' value="' + (other ? esc(n) : '') + '" placeholder="e.g. Tiles, fittings"></label>';
}
var EXPENSE_TYPES = ['Fuel', 'Maintenance', 'Repairs', 'Tyres', 'Insurance', 'Licensing', 'Tools and small equipment', 'Yard and site costs', 'Office and admin', 'Wages (not job-specific)', 'Other'];
var MAINT = ['Maintenance', 'Repairs', 'Tyres'];
var STARTUP_TYPES = ['Truck', 'Excavator', 'Skip bins', 'Machinery', 'Tools', 'Shipping and duties', 'Other'];
var METHODS = ['Cash', 'Local bank transfer', 'International transfer', 'Card', 'Cheque', 'Other'];
var TRUCKS = ['Skip truck', 'Tipper 1', 'Tipper 2', 'Excavator'];
/** Vehicle register: ids stay as stored on jobs ("Tipper 1"); nicknames and details come from Business Settings. */
function vehicles() { return ((S.data && S.data.settings && S.data.settings.vehicles) || []); }
function syncVehicles() { var v = vehicles().filter(function (x) { return x.active !== false; }).map(function (x) { return x.id; }); if (v.length) TRUCKS = v; }
function truckName(id) { var v = vehicles().find(function (x) { return x.id === id; }); return v && v.nickname ? id + ' · ' + v.nickname : (id || ''); }
function truckOptsCompat(extra, sel) { return truckOpts(sel, extra); }
function truckOpts(sel, extra) {
  var list = TRUCKS.concat(extra || []); if (sel && list.indexOf(sel) < 0) list.push(sel);
  return list.map(function (t) { return '<option value="' + esc(t) + '"' + (t === sel ? ' selected' : '') + '>' + esc(truckName(t)) + '</option>'; }).join('');
}
function drivers() { return ((S.data && S.data.settings && S.data.settings.drivers) || []); }
function driverName(id) { var d = drivers().find(function (x) { return x.id === id; }); return d ? d.name : ''; }
function driverOpts(sel) { return '<option value="">Not specified</option>' + drivers().filter(function (d) { return d.active !== false || d.id === sel; }).map(function (d) { return '<option value="' + esc(d.id) + '"' + (d.id === sel ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join(''); }
var DRIVER_RULE_FROM = '2026-10-16';

function $(id) { return document.getElementById(id); }
function qa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
var F0 = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
var F2 = new Intl.NumberFormat('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function ec(n) { n = n || 0; return (n < 0 ? '-' : '') + 'EC$' + F0.format(Math.abs(Math.round(n))); }
function ec2(n) { n = n || 0; return (n < 0 ? '-' : '') + 'EC$' + F2.format(Math.abs(n)); }
function pct(n) { return isFinite(n) ? (n * 100).toFixed(1) + '%' : '–'; }
function round2(n) { return Math.round(n * 100) / 100; }
function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; }
function pad3(n) { return String(n).padStart(3, '0'); }
function invNo(inv) { return '#' + pad3(inv.no); }

/* Dates are kept as YYYY-MM-DD text everywhere. */
function isoOf(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function today() { return isoOf(new Date()); }
function parseIso(s) { var p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
function addDays(s, n) { var d = parseIso(s); d.setDate(d.getDate() + n); return isoOf(d); }
function monthName(iso) { var d = parseIso(iso); return MONTH[d.getMonth()] + ' ' + d.getFullYear(); }
function addMonths(s, n) { var d = parseIso(s); d.setDate(1); d.setMonth(d.getMonth() + n); return isoOf(d); }
function daysBetween(a, b) { return Math.round((parseIso(b) - parseIso(a)) / 86400000); }
var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function nice(s) { if (!s) return ''; var d = parseIso(s); return d.getDate() + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear(); }
function niceShort(s) { var d = parseIso(s); return d.getDate() + ' ' + MON[d.getMonth()]; }
function longDate(s) { var d = parseIso(s); return d.getDate() + ' ' + MONTH[d.getMonth()] + ' ' + d.getFullYear(); }

function toast(msg, err) {
  var t = $('toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : '');
  clearTimeout(toast.t); toast.t = setTimeout(function () { t.classList.add('hidden'); }, err ? 6000 : 2600);
}
function busy(msg) { if (msg) { $('busy-text').textContent = msg; $('busy').classList.remove('hidden'); } else $('busy').classList.add('hidden'); }

/* ---- offline support: records saved without signal wait on the phone and are sent later ---- */
var QUEUEABLE = ['saveInvoice', 'addPayment', 'saveExpense', 'saveStartup', 'saveClient', 'saveQuote', 'saveReminder', 'completeReminder', 'markSent', 'saveCapital'];
function lsGet(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function queue() { return lsGet('nv_queue', []); }
function isNetErr(m) { return /Failed to fetch|Load failed|NetworkError|network/i.test(m || ''); }
var flushing = false;
function flushQueue(quiet) {
  var q = queue();
  if (!q.length || flushing || !S.token || !navigator.onLine) return Promise.resolve(0);
  flushing = true; var sent = 0;
  function next() {
    var item = queue()[0];
    if (!item) return Promise.resolve();
    return rawApi(item.action, item.payload).then(function (res) {
      if (!res.ok && res.error === 'SIGNED_OUT') throw new Error('signed out');
      if (!res.ok) item.error = res.error; else { sent++; if (res.data) { setData(res.data); cacheData(); } }
      var rest = queue().slice(1); if (!res.ok) rest.push(item); lsSet('nv_queue', rest.length ? rest : null);
      if (!res.ok && rest.length === 1) return; // only failing items left
      return next();
    });
  }
  return next().catch(function () {}).then(function () {
    flushing = false;
    if (sent && !quiet) toast(sent + (sent === 1 ? ' record' : ' records') + ' sent from this phone.');
    if (sent) render();
    return sent;
  });
}
function cacheData() { lsSet('nv_cache', S.full || S.data); }
function rawApi(action, payload) {
  var body = Object.assign({ action: action, token: S.token }, payload || {});
  return fetch('/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'The server sent an unexpected reply (' + r.status + ').' }; }); });
}
window.addEventListener('online', function () { flushQueue(); });

S.tap = { el: null, at: 0 };
document.addEventListener('pointerdown', function (e) {
  var b = e.target.closest && e.target.closest('button, .btn');
  if (!b || b.disabled) return;
  S.tap = { el: b, at: Date.now() };
  if (b.classList.contains('btn')) {
    var r = b.getBoundingClientRect(), d = Math.max(r.width, r.height), sp = document.createElement('span');
    sp.className = 'ripple'; sp.style.width = sp.style.height = d + 'px';
    sp.style.left = (e.clientX - r.left - d / 2) + 'px'; sp.style.top = (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(sp); setTimeout(function () { sp.remove(); }, 550);
    if (navigator.vibrate) { try { navigator.vibrate(8); } catch (x) {} }
  }
}, { passive: true });
function tapBusy(on, ok) {
  var b = S.tap.el;
  if (!b || !document.contains(b) || Date.now() - S.tap.at > 4000 || !(b.classList.contains('btn') || b.parentNode && b.parentNode.classList.contains('sheet-head'))) return;
  if (on) { b.classList.add('is-busy'); b.setAttribute('aria-busy', 'true'); }
  else { b.classList.remove('is-busy'); b.removeAttribute('aria-busy'); if (ok) { b.classList.add('is-done'); setTimeout(function () { b.classList.remove('is-done'); }, 900); } S.tap.el = null; }
}
function api(action, payload, busyMsg) {
  var slow = null;
  if (busyMsg) { tapBusy(true); slow = setTimeout(function () { busy(busyMsg); }, 650); }
  var done = function (ok) { if (slow) { clearTimeout(slow); slow = null; } if (busyMsg) tapBusy(false, ok); };
  var body = Object.assign({ action: action, token: S.token }, payload || {});
  if (!navigator.onLine && QUEUEABLE.indexOf(action) >= 0) return Promise.resolve(queueIt());
  function queueIt() {
    done(true); busy(null);
    var q = queue(); q.push({ action: action, payload: payload, at: new Date().toISOString() }); lsSet('nv_queue', q);
    setTimeout(function () { toast('No signal. Saved on this phone and will send automatically when you are back online.'); }, 60);
    setTimeout(render, 50);
    return { ok: true, queued: true, result: {} };
  }
  return fetch('/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    .then(function (r) { return r.json().catch(function () { return { ok: false, error: 'The server sent an unexpected reply (' + r.status + ').' }; }); })
    .then(function (res) {
      done(res.ok); busy(null);
      if (!res.ok) {
        if (res.error === 'SIGNED_OUT') { signOutLocal(); throw new Error('Please sign in again.'); }
        throw new Error(res.error || 'Something went wrong.');
      }
      if (res.data) { setData(res.data); S.lastLoad = Date.now(); cacheData(); }
      return res;
    })
    .catch(function (err) {
      done(false); busy(null);
      var m = err && err.message || String(err);
      if (isNetErr(m) && QUEUEABLE.indexOf(action) >= 0) return queueIt();
      if (/Failed to fetch|Load failed|NetworkError/i.test(m)) m = 'No connection. Check your signal and try again.';
      toast(m, true);
      throw err;
    });
}

/* ==================== derived figures ==================== */
function clientOf(inv) { return (S.data.clients.find(function (c) { return c.id === inv.clientId; }) || { name: 'Unknown customer' }); }
/* All money figures come from the shared calculation layer (calc.js), the same code the server uses for PDFs and emails. */
var COST_TYPES = Calc.COST_TYPES, COST_KEYS = Calc.COST_KEYS;
function lineAmount(l) { return Calc.lineAmount(l); }
function lineCosts(l) { return Calc.lineCosts(l); }
function invTotal(inv) { return Calc.invTotal(inv); }
function invPaid(inv) { return Calc.invPaid(inv); }
function invBalance(inv) { return Calc.invBalance(inv); }
function invStatus(inv) { return Calc.invStatus(inv, today()); }
function liveInvoices() { return Calc.liveInvoices(S.data); }

/** Every job line and expense as dated entries. */
function facts() { return Calc.facts(S.data, function (j) { j.loadN = normalizeLoad(j.load) || 'Not set'; }); }
function within(d, a, b) { return Calc.within(d, a, b); }
function summarise(f, a, b) { return Calc.summarise(f, a, b); }
function startupTotal() { return Calc.startupTotal(S.data); }

/* ==================== periods ==================== */
function periodRange(p) {
  var t = p.type, a = p.anchor || today(), d = parseIso(a);
  if (t === 'week') { var dow = (d.getDay() + 6) % 7; var s = addDays(a, -dow); return { from: s, to: addDays(s, 6) }; }
  if (t === 'month') { var m1 = new Date(d.getFullYear(), d.getMonth(), 1); return { from: isoOf(m1), to: isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0)) }; }
  if (t === 'quarter') { var q = Math.floor(d.getMonth() / 3) * 3; return { from: isoOf(new Date(d.getFullYear(), q, 1)), to: isoOf(new Date(d.getFullYear(), q + 3, 0)) }; }
  if (t === 'year') return { from: d.getFullYear() + '-01-01', to: d.getFullYear() + '-12-31' };
  if (t === 'custom') return { from: p.from || addDays(today(), -29), to: p.to || today() };
  return { from: null, to: null };
}
function shiftPeriod(p, dir) {
  var a = p.anchor || today();
  if (p.type === 'week') p.anchor = addDays(a, 7 * dir);
  else if (p.type === 'month') p.anchor = addMonths(a, dir);
  else if (p.type === 'quarter') p.anchor = addMonths(a, 3 * dir);
  else if (p.type === 'year') p.anchor = addMonths(a, 12 * dir);
}
function previousRange(p) {
  if (p.type === 'all') return null;
  if (p.type === 'custom') { var r = periodRange(p), len = daysBetween(r.from, r.to); return { from: addDays(r.from, -len - 1), to: addDays(r.from, -1) }; }
  var q = { type: p.type, anchor: p.anchor || today() }; shiftPeriod(q, -1); return periodRange(q);
}
function periodLabel(p) {
  var r = periodRange(p);
  if (p.type === 'all') return 'All time';
  if (p.type === 'week') return niceShort(r.from) + ' – ' + nice(r.to);
  if (p.type === 'month') { var d = parseIso(r.from); return MONTH[d.getMonth()] + ' ' + d.getFullYear(); }
  if (p.type === 'quarter') { var q = parseIso(r.from); return 'Q' + (Math.floor(q.getMonth() / 3) + 1) + ' ' + q.getFullYear(); }
  if (p.type === 'year') return r.from.slice(0, 4);
  return nice(r.from) + ' – ' + nice(r.to);
}
function prevLabel(p) {
  if (p.type === 'all') return '';
  if (p.type === 'custom') return 'Previous ' + (daysBetween(periodRange(p).from, periodRange(p).to) + 1) + ' days';
  return { week: 'Last week', month: 'Last month', quarter: 'Last quarter', year: 'Last year' }[p.type];
}
/** Buckets for charts within a range. */
function buckets(r, f) {
  var from = r.from, to = r.to;
  if (!from) {
    var dates = f.jobs.map(function (j) { return j.date; }).concat(f.expenses.map(function (e) { return e.date; })).sort();
    if (!dates.length) return [];
    from = dates[0].slice(0, 8) + '01'; to = today();
  }
  var span = daysBetween(from, to), out = [];
  if (span <= 10) {
    for (var d = from; d <= to; d = addDays(d, 1)) out.push({ from: d, to: d, label: niceShort(d) });
  } else if (span <= 62) {
    var s = from;
    while (s <= to) { var e = addDays(s, 6); if (e > to) e = to; out.push({ from: s, to: e, label: niceShort(s) }); s = addDays(e, 1); }
  } else {
    var m = from.slice(0, 8) + '01';
    while (m <= to) {
      var md = parseIso(m), end = isoOf(new Date(md.getFullYear(), md.getMonth() + 1, 0));
      out.push({ from: m < from ? from : m, to: end > to ? to : end, label: MON[md.getMonth()] + (span > 366 ? ' ' + String(md.getFullYear()).slice(2) : '') });
      m = addMonths(m, 1);
    }
  }
  return out;
}

/* ==================== shell, auth, routing ==================== */
var ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V5.5a1.5 1.5 0 0 1 1.5-1.5h8A1.5 1.5 0 0 1 15 5.5V21M15 10h3.5a1.5 1.5 0 0 1 1.5 1.5V21M2.5 21h19"/><path d="M8 8h3M8 12h3M8 16h3M17.5 14v.01M17.5 17.5v.01"/></svg>',
  invoices: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h8"/></svg>',
  reports: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',
  bookings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  fuel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M7 8h5"/><path d="M15 10h2a2 2 0 0 1 2 2v5a1.5 1.5 0 0 0 3 0V9l-3-3"/></svg>'
};
var TITLES = { monthend: 'Month-End', opcosts: 'Operating Costs', vehicle: 'Vehicle', dashboard: 'Home', invoices: 'Invoices', invoice: 'Invoice', quote: 'Quote', log: 'Transaction Ledger', more: 'Manage', clients: 'Customers', client: 'Customer',
  insights: 'Insights', driverpay: 'Crew & Pay', bookings: 'Bookings & Jobs', fuel: 'Fuel & Mileage', notify: 'Notifications', cashflow: 'Cash Flow Forecast', yearend: 'Financial Reports', passkeys: 'Face ID & Passkeys',
  reports: 'Reports', loads: 'Load Performance', monthly: 'Financial Overview', month: 'Month', routes: 'Area Performance', custreport: 'Customer Performance', trucks: 'Fleet Performance', capital: 'Partner Capital & Distributions', reminders: 'Maintenance & Compliance',
  startup: 'Equipment & Investment', partners: 'Partner Split', exportx: 'Export to Excel', settings: 'Business Settings', users: 'Team & Permissions',
  importx: 'Import from Excel', backups: 'Backups', activity: 'Activity Log', password: 'Change Password', fleet: 'Fleet Management', data: 'Data Management', security: 'Account & Security', appearance: 'Appearance' };
var TOP_TABS = ['dashboard', 'invoices', 'reports', 'more', 'bookings', 'fuel'];
function isDriver() { return S.data && S.data.me && S.data.me.role === 'driver'; }
function isViewOnly() { return S.data && S.data.me && S.data.me.role === 'other'; }
function topTabs() { return isDriver() ? ['bookings', 'fuel', 'more'] : ['dashboard', 'invoices', 'reports', 'more']; }
var DRIVER_VIEWS = ['bookings', 'fuel', 'more', 'password', 'notify', 'reminders', 'passkeys', 'security', 'appearance'];
TITLES.paysettings = 'How Customers Pay';
var REPORT_VIEWS = ['projreport', 'opcosts', 'insights', 'cashflow', 'yearend', 'loads', 'monthly', 'month', 'routes', 'custreport', 'trucks', 'capital', 'partners', 'log'];

function shell() {
  $('root').innerHTML =
    '<header class="topbar"><div class="row"><button class="back hidden" id="back" aria-label="Back">‹</button>' + bizLogo() + '' +
    '<h1 id="title"></h1><button class="eye-btn hidden" id="eyeBtn" aria-label="Hide amounts" aria-pressed="false"></button><button class="who" id="who" aria-label="Menu" aria-haspopup="true"><span id="whoName"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button></div></header><main id="view"></main>' +
    '<nav class="tabbar" aria-label="Sections">' +
    bizTabs() + '</nav>';
  qa('[data-tab]').forEach(function (b) { b.onclick = function () { go(b.dataset.tab); }; });
  $('plus').onclick = newMenu;
  $('back').onclick = function () { history.back(); };
  $('whoName').innerHTML = esc(S.data.me.name) + (bizChoices().length > 1 ? '<span class="biz-tag">' + BIZ_NAME[S.biz] + '</span>' : '');
  $('who').onclick = function (ev) { ev.stopPropagation(); toggleMenu(); };
  $('eyeBtn').onclick = function () { S.mask = !S.mask; document.body.classList.toggle('mask', S.mask); drawEye(); };
}
function toggleMenu(force) {
  var open = $('menuPop');
  if (open || force === false) { if (open) open.remove(); return; }
  var me = S.data.me, drv = isDriver();
  var quick = drv ? [['bookings', 'calendar', 'Jobs'], ['fuel', 'fuel', 'Fuel'], ['reminders', 'alarm', 'Reminders']]
    : [['bookings', 'calendar', 'Bookings'], ['clients', 'user', 'Customers'], ['fleet', 'truck', 'Fleet']];
  quick = bizQuick(quick, drv);
  var acct = [['security', 'shield', 'Account & Security'], ['notify', 'bell', 'Notifications'], ['appearance', 'sliders', 'Appearance']];
  var last = S.lastLoad ? new Date(S.lastLoad).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
  var pop = document.createElement('div');
  pop.id = 'menuPop'; pop.className = 'menu-pop'; pop.setAttribute('role', 'menu');
  pop.innerHTML = '<div class="mp-user"><span class="mp-avatar">' + esc((me.name || '?').charAt(0).toUpperCase()) + '</span><span><b>' + esc(me.name) + '</b><br><span class="small muted">' + roleLabel(me.role) + ' · @' + esc(me.username) + '</span></span></div>' +
    bizSwitchHtml() + '<div class="mp-label">Quick Access</div><div class="mp-quick">' + quick.map(function (q) { return '<button data-mgo="' + q[0] + '">' + icon(q[1], 'gi-menu') + '<span>' + q[2] + '</span></button>'; }).join('') + '</div>' +
    '<div class="mp-label">My Account</div>' + acct.map(function (i) { return '<button role="menuitem" data-mgo="' + i[0] + '">' + icon(i[1], 'gi-menu') + '<span>' + i[2] + '</span><span class="chev">›</span></button>'; }).join('') +
    '<div class="mp-sep"></div>' + (drv ? '' : '<button role="menuitem" data-mgo="more">' + icon('sliders', 'gi-menu') + '<span><b>Manage Business</b></span><span class="chev">›</span></button><div class="mp-sep"></div>') +
    '<button role="menuitem" id="mpRefresh">' + icon('history', 'gi-menu') + '<span>Data Sync<br><span class="small muted">' + (S.offline ? 'Offline · will sync when connected' : last ? 'Last updated ' + last : 'Tap to update') + '</span></span></button>' +
    '<button role="menuitem" id="mpOut" class="danger">' + icon('upload', 'gi-menu') + '<span>Sign Out</span></button>';
  document.body.appendChild(pop);
  qa('[data-mgo]', pop).forEach(function (b) { b.onclick = function () { toggleMenu(false); go(b.dataset.mgo); }; });
  $('mpRefresh').onclick = function () { toggleMenu(false); api('load', {}, 'Syncing…').then(function () { S.lastLoad = Date.now(); toast('Up to date.'); }).catch(function () {}); };
  $('mpOut').onclick = function () { toggleMenu(false); signOutLocal(); };
}
document.addEventListener('click', function (e) { var p = $('menuPop'); if (p && !p.contains(e.target)) p.remove(); });
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') toggleMenu(false); });
window.addEventListener('hashchange', function () { toggleMenu(false); });

function tab(id, label) { return '<button data-tab="' + id + '">' + ICONS[id] + '<span>' + label + '</span></button>'; }

function go(view, param, replace) {
  if (view === 'settings' && S.view !== 'settings') S.setCat = null;
  var hash = '#/' + view + (param ? '/' + encodeURIComponent(param) : '');
  if (location.hash !== hash) { if (replace) history.replaceState(null, '', hash); else history.pushState(null, '', hash); }
  route();
}
function route() {
  var parts = (location.hash || '#/dashboard').slice(2).split('/');
  S.view = parts[0] || (isDriver() ? 'bookings' : 'dashboard'); S.param = parts[1] ? decodeURIComponent(parts[1]) : null;
  if (!VIEWS[S.view]) S.view = isDriver() ? 'bookings' : 'dashboard';
  if (isDriver() && DRIVER_VIEWS.indexOf(S.view) < 0) S.view = 'bookings';
  if (S.data && S.data.me && S.data.me.role !== 'owner' && ['settings', 'users', 'importx', 'backups'].indexOf(S.view) >= 0) S.view = isDriver() ? 'bookings' : 'more';
  render();
}
window.addEventListener('popstate', function () { if (S.data) { closeSheet(); route(); } });

var EYE_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
var EYE_SHUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.6 7 10 7a9.9 9.9 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
function drawEye() { var b = $('eyeBtn'); if (!b) return; b.innerHTML = S.mask ? EYE_SHUT : EYE_OPEN; b.setAttribute('aria-pressed', S.mask ? 'true' : 'false'); b.setAttribute('aria-label', S.mask ? 'Show amounts' : 'Hide amounts'); }
function render() {
  syncVehicles();
  if (S.data && S.data.me) applyPrefs();
  if ($('eyeBtn')) { $('eyeBtn').classList.toggle('hidden', S.view !== 'dashboard' || isDriver()); drawEye(); }
  if (!S.data) return;
  if (!$('view')) shell();
  S.charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); S.charts = [];
  var top = topTabs().indexOf(S.view) >= 0;
  document.body.classList.toggle('readonly', !!isViewOnly());
  $('back').classList.toggle('hidden', top);
  qa('[data-tab]').forEach(function (b) {
    var grp = top ? S.view : (S.view === 'invoice' || S.view === 'quote') ? 'invoices' : REPORT_VIEWS.indexOf(S.view) >= 0 ? 'reports' : 'more';
    if (isDriver() && ['bookings', 'fuel'].indexOf(S.view) < 0) grp = 'more';
    var on = b.dataset.tab === grp;
    if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  $('title').textContent = TITLES[S.view] || '';
  setTimeout(function () { if (typeof updateTop === 'function') updateTop(); }, 0);
  try { VIEWS[S.view](); } catch (err) {
    console.error(err);
    $('view').innerHTML = '<div class="alert err"><b>This screen could not be shown.</b><br>' + esc(err.message) + '</div>';
  }
}

function skeletonScreen() {
  var blk = function (w, h, mt) { return '<div class="sk" style="width:' + w + ';height:' + h + 'px;margin-top:' + (mt || 0) + 'px"></div>'; };
  var card = function () { return '<div class="card">' + blk('38%', 11) + blk('62%', 26, 10) + blk('84%', 11, 10) + '</div>'; };
  $('root').innerHTML = '<header class="topbar"><div class="row"><img src="/logo.jpg" alt=""><h1>&nbsp;</h1></div></header>' +
    '<main class="sk-main" aria-busy="true" aria-label="Loading">' + card() + card() + card() + '<div class="card">' + blk('50%', 12) + blk('100%', 120, 12) + '</div></main>';
}
function start() {
  var ivm = location.hash.match(/^#\/invite\/([a-f0-9]{48})$/); if (ivm) { inviteScreen(ivm[1]); return; }
  if (!S.token) return authScreen();
  var cached = lsGet('nv_cache', null), shownFromCache = false;
  if (!S.data && cached && cached.me) {
    // Show the figures saved on this phone straight away, then update them in the background.
    setData(cached); shownFromCache = true;
    if (!location.hash) history.replaceState(null, '', isDriver() ? '#/bookings' : '#/dashboard');
    shell(); route();
  } else if (!S.data) skeletonScreen();
  rawApi('load', {}).then(function (res) {
    if (!res.ok) { if (res.error === 'SIGNED_OUT') { signOutLocal(); return; } throw new Error(res.error); }
    var roleWas = S.data && S.data.me && S.data.me.role;
    setData(res.data); S.lastLoad = Date.now(); cacheData(); S.offline = false;
    if (S.data.me.mustChange) return forcePassword();
    if (!location.hash) history.replaceState(null, '', isDriver() ? '#/bookings' : '#/dashboard');
    if (!$('view') || roleWas !== S.data.me.role) shell();
    if ($('sheet-wrap') && !$('sheet-wrap').classList.contains('hidden')) { flushQueue(); return; } // do not disturb an open form
    route(); flushQueue();
  }).catch(function (err) {
    if (cached) {
      setData(S.full || S.data || cached); S.offline = true;
      if (!location.hash) history.replaceState(null, '', '#/dashboard');
      if (!$('view')) shell(); route(); toast('Offline: showing the figures saved on this phone.');
    } else { toast((err && err.message) || 'Cannot reach the server.', true); if (!S.data) authScreen(); }
  });
}
function signOutLocal() {
  if (queue().length && !confirm('There are records on this phone that have not been sent yet. Signing out deletes them. Sign out anyway?')) return;
  S.token = null; setData(null); lsSet('nv_token', null); lsSet('nv_cache', null); lsSet('nv_queue', null);
  try { localStorage.removeItem('nv_token'); } catch (e) {} closeSheet(); authScreen();
}
function syncBanner() {
  var q = queue();
  if (!q.length && !S.offline) return '';
  return '<div class="alert">' + (S.offline ? '<b>Offline.</b> Showing figures saved on this phone. ' : '') +
    (q.length ? '<b>' + q.length + (q.length === 1 ? ' record is' : ' records are') + ' waiting to send</b>' + (q.some(function (x) { return x.error; }) ? ' (one or more need attention: ' + esc(q.filter(function (x) { return x.error; })[0].error) + ')' : '') + '. ' : '') +
    '<button class="btn link" id="syncNow">Try now</button></div>';
}
function bindSync() { if ($('syncNow')) $('syncNow').onclick = function () { start(); }; }

function authScreen() {
  $('root').innerHTML = '<div class="auth duo">' + authBrand('Operations for both businesses · private access') + '<div class="lane"></div><div class="form" id="authForm"><p class="sub">Checking…</p></div></div>';
  fetch('/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'status' }) })
    .then(function (r) { return r.json(); })
    .then(function (res) {
      if (!res.ok) { $('authForm').innerHTML = '<div class="alert err">' + esc(res.error) + '</div>'; return; }
      res.setUp ? loginForm() : setupForm();
    })
    .catch(function () { $('authForm').innerHTML = '<div class="alert err">Cannot reach the server. Check your connection.</div>'; });
}
function loginForm() {
  $('authForm').innerHTML =
    '<form id="lf" autocomplete="on"><label class="f"><span>Username</span><input id="lu" name="username" autocomplete="username" autocapitalize="none" required></label>' +
    '<label class="f"><span>Password</span><input id="lp" name="password" type="password" autocomplete="current-password" required></label>' +
    '<button class="btn gold block" type="submit">Sign in</button></form>' +
    (passkeysSupported() ? '<div style="height:12px"></div><button class="btn quiet block" id="pkLogin">' + icon('faceid', 'gi-inline') + ' Sign in with Face ID or fingerprint</button>' : '');
  if ($('pkLogin')) $('pkLogin').onclick = function () {
    passkeySignIn().then(function (res) { S.token = res.token; try { localStorage.setItem('nv_token', res.token); } catch (e) {} start(); }).catch(pkError);
  };
  $('lf').onsubmit = function (ev) {
    ev.preventDefault();
    api('login', { username: $('lu').value, password: $('lp').value }, 'Signing in…').then(function (res) {
      S.token = res.token; try { localStorage.setItem('nv_token', res.token); } catch (e) {}
      start();
    }).catch(function () {});
  };
}
function setupForm() {
  $('authForm').innerHTML =
    '<div class="alert">First-time setup. Create the main account. You will need the SETUP_CODE you added in Netlify.</div>' +
    '<form id="sf"><label class="f"><span>Setup code</span><input id="sc" autocomplete="off" required></label>' +
    '<label class="f"><span>Your name</span><input id="sn" value="" required></label>' +
    '<label class="f"><span>Username</span><input id="su" value="kareem" autocapitalize="none" autocomplete="username" required></label>' +
    '<label class="f"><span>Password (at least 10 characters)</span><input id="sp" type="password" autocomplete="new-password" required></label>' +
    '<button class="btn gold block" type="submit">Create account</button></form>';
  $('sf').onsubmit = function (ev) {
    ev.preventDefault();
    api('setup', { setupCode: $('sc').value, name: $('sn').value, username: $('su').value, password: $('sp').value }, 'Setting up…').then(function (res) {
      S.token = res.token; try { localStorage.setItem('nv_token', res.token); } catch (e) {}
      start();
    }).catch(function (e) {
      if (!/already set up/i.test(String((e && e.message) || e || ''))) return;
      api('login', { username: $('su').value, password: $('sp').value }, 'Signing in…').then(function (r) {
        S.token = r.token; try { localStorage.setItem('nv_token', r.token); } catch (x) {}
        start();
      }).catch(function () { setTimeout(function () { location.reload(); }, 1500); });
    });
  };
}
function forcePassword() {
  $('root').innerHTML = '<div class="auth duo">' + authBrand('Welcome, ' + esc(S.data.me.name) + '. Choose your own password to finish signing in.') + '<div class="lane"></div>' +
    '<form class="form" id="fp"><label class="f"><span>Temporary password</span><input id="fc" type="password" autocomplete="current-password" required></label>' +
    '<label class="f"><span>New password (at least 10 characters)</span><input id="fn" type="password" autocomplete="new-password" required></label>' +
    '<button class="btn gold block" type="submit">Save password</button></form></div>';
  $('fp').onsubmit = function (ev) {
    ev.preventDefault();
    api('changePassword', { current: $('fc').value, password: $('fn').value }, 'Saving…').then(function () { toast('Password saved.'); history.replaceState(null, '', '#/dashboard'); shell(); route(); }).catch(function () {});
  };
}

/* ---- line icons (replace emojis; colour comes from CSS) ---- */
var GLYPHS = {
  palette: '<path d="M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-.9.8-1.7 1.7-1.7H16a5 5 0 0 0 5-5c0-4-4-7.2-9-7.2z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7.3" r="1.2"/><circle cx="14.5" cy="7.3" r="1.2"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
  signout: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2V17h5v-1.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/>',
  clip: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 12l2 2 4-4"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17V11M13 17V7M18 17v-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
  money: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9.5v5M18 9.5v5"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  arrin: '<path d="M17 7 7 17M7 9v8h8"/>', arrout: '<path d="M7 17 17 7M9 7h8v8"/>',
  calendar: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
  calplus: '<rect x="3" y="4.5" width="18" height="16.5" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M12 13v5M9.5 15.5h5"/>',
  route: '<circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/><path d="M7 19h8.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H17"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3a6.5 6.5 0 0 1 3.5 5.7"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  truck: '<path d="M2 5.5h11v11H2zM13 9h4.2l3.8 4v3.5h-8"/><circle cx="6.5" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/>',
  pie: '<path d="M11 3.1A9 9 0 1 0 20.9 13H11z"/><path d="M14 2.5A8 8 0 0 1 21.5 10H14z"/>',
  receipt: '<path d="M5.5 2.5h13v19l-3.2-2-3.3 2-3.3-2-3.2 2z"/><path d="M9 7.5h6M9 11.5h6M9 15.5h3.5"/>',
  package: '<path d="M3 7.5l9-4.5 9 4.5v9l-9 4.5-9-4.5z"/><path d="M3 7.5l9 4.5 9-4.5M12 12v9"/>',
  alarm: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M5 3 2.5 5.5M19 3l2.5 2.5"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v16M3 21h13M7 8h5"/><path d="M15 10h2a2 2 0 0 1 2 2v4.5a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 2H4.2z"/><path d="M10 21.5h4"/>',
  upload: '<path d="M12 15V3.5M7 8.5l5-5 5 5"/><path d="M4 14.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4.5"/>',
  download: '<path d="M12 3.5V15M7 10l5 5 5-5"/><path d="M4 14.5V19a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4.5"/>',
  history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 3.5V8h4.5M12 7.5V12l3 2"/>',
  key: '<circle cx="8" cy="15.5" r="4.5"/><path d="M11.2 12.3 20 3.5M16.5 7l3 3M14.5 9l2 2"/>',
  sliders: '<path d="M4 6h9M18 6h2M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15.5" cy="6" r="2.2"/><circle cx="9" cy="12" r="2.2"/><circle cx="17" cy="18" r="2.2"/>',
  shield: '<path d="M12 2.5 20 5.5v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10v-6z"/><path d="M8.8 12l2.2 2.2 4.3-4.4"/>',
  archive: '<rect x="2.5" y="3.5" width="19" height="5" rx="1.2"/><path d="M4.5 8.5V19a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8.5M10 12.5h4"/>',
  invoice: '<path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5M8.5 13h7M8.5 17h4.5"/>',
  quote: '<rect x="4.5" y="4" width="15" height="17.5" rx="2"/><path d="M9 2.5h6v3.5H9zM8.5 11.5h7M8.5 15.5h4.5"/>',
  wallet: '<path d="M19 7V5.5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5"/><circle cx="16.5" cy="14" r="1.2"/>',
  checkc: '<circle cx="12" cy="12" r="9"/><path d="M8 12.2l2.8 2.8 5.2-5.5"/>',
  camera: '<path d="M3 8.5h3.5L8.5 5.5h7l2 3H21V19H3z"/><circle cx="12" cy="13.5" r="3.5"/>',
  file: '<path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"/><path d="M14 2.5V8h5.5"/>',
  ferry: '<path d="M3 16.5 5 20h14l2-3.5H3zM6 16.5V11h12v5.5M9 11V7.5h6V11M12 4.5v3"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
  faceid: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/><path d="M9 9v1.2M15 9v1.2M12 9v4h-1M9.3 16a3.8 3.8 0 0 0 5.4 0"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2.5"/>',
  book: '<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H19v15H5.5A1.5 1.5 0 0 0 4 19.5z"/><path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H19v-3M8 7.5h7M8 11h5"/>'
};
function icon(name, cls) {
  return '<svg class="' + (cls || 'gi') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (GLYPHS[name] || GLYPHS.file) + '</svg>';
}
function tileIcon(name) { return '<span class="ico">' + icon(name) + '</span>'; }

/* ==================== sheets (editors) ==================== */
/* ---- back-to-top arrow: appears once you scroll down a page or an editor ---- */
var toTop = document.createElement('button');
toTop.className = 'to-top'; toTop.type = 'button'; toTop.setAttribute('aria-label', 'Back to top');
toTop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
document.body.appendChild(toTop);
function sheetIsOpen() { return !$('sheet-wrap').classList.contains('hidden'); }
function updateTop() {
  var y = sheetIsOpen() ? $('sheet').scrollTop : (window.scrollY || document.documentElement.scrollTop);
  toTop.classList.toggle('show', y > 450);
  document.body.classList.toggle('sheet-open', sheetIsOpen());
}
toTop.onclick = function () {
  var smooth = !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var opts = { top: 0, behavior: smooth ? 'smooth' : 'auto' };
  if (sheetIsOpen()) $('sheet').scrollTo(opts); else window.scrollTo(opts);
};
window.addEventListener('scroll', updateTop, { passive: true });
$('sheet').addEventListener('scroll', updateTop, { passive: true });

function openSheet(title, html, actionLabel) {
  $('sheet').innerHTML = '<div class="sheet-head"><button data-close>Cancel</button><h3>' + esc(title) + '</h3>' +
    (actionLabel ? '<button id="sheetGo">' + esc(actionLabel) + '</button>' : '<span style="width:52px"></span>') + '</div>' + html;
  $('sheet-wrap').classList.remove('hidden'); document.body.style.overflow = 'hidden'; $('sheet').scrollTop = 0; updateTop();
  qa('[data-close]', $('sheet')).forEach(function (b) { b.onclick = closeSheet; });
}
function closeSheet() { $('sheet-wrap').classList.add('hidden'); $('sheet').innerHTML = ''; document.body.style.overflow = ''; if (typeof updateTop === 'function') updateTop(); }
$('sheet-wrap').addEventListener('click', function (ev) { if (ev.target === this) closeSheet(); });

function newMenu() {
  if (isDriver()) {
    openSheet('Add new', '<ul class="list card flush menu">' + menuItem('mJob', 'checkc', 'Report a finished job', 'A job that was not booked in the app') +
      menuItem('mBk', 'calplus', 'Book a job', 'Something coming up') + menuItem('mFuel', 'fuel', 'Fuel fill-up', 'Litres, cost and odometer') + '</ul>');
    $('mJob').onclick = function () { bookingEditor({ status: 'Done', date: today() }); };
    $('mBk').onclick = function () { bookingEditor(); };
    $('mFuel').onclick = function () { fuelEditor(); };
    return;
  }
  openSheet('Add new', '<ul class="list card flush menu">' +
    menuItem('mBk', 'calplus', 'Booking', 'A job coming up, before it is invoiced') +
    menuItem('mTen', 'file', 'Tenancy', 'A long-term tenant and their agreement') +
    menuItem('mStay', 'key', 'Short stay', 'A guest booking in one of the units') +
    menuItem('mRep', 'alarm', 'Apartment repair', 'Something to fix in a unit') +
    menuItem('mPj', 'calendar', 'Building project', 'A residential or commercial build') +
    menuItem('mBin', 'package', 'Skip bin out', 'A bin delivered to a site') +
    menuItem('mInv', 'invoice', 'Invoice for a job', 'Logs the job and creates the invoice') +
    menuItem('mQuo', 'quote', 'Quote', 'Price a job before it is confirmed') +
    menuItem('mExp', 'wallet', 'Running expense', 'Fuel, repairs, insurance, tools…') +
    menuItem('mRem', 'alarm', 'Vehicle reminder', 'Insurance, licences, servicing') +
    menuItem('mFuel', 'fuel', 'Fuel fill-up', 'Litres, cost and odometer for mileage tracking') +
    menuItem('mSu', 'truck', 'Equipment purchase', 'A truck, machine or skip bin') +
    menuItem('mCl', 'user', 'Customer', 'Save contact details') + '</ul>');
  $('mInv').onclick = function () { invoiceEditor(); };
  $('mPj').onclick = function () { closeSheet(); projectEditor(); };
  $('mTen').onclick = function () { closeSheet(); tenancyEditor(); };
  $('mStay').onclick = function () { closeSheet(); stayEditor(); };
  $('mRep').onclick = function () { closeSheet(); repairEditor(); };
  $('mBin').onclick = function () { closeSheet(); if (!(S.data.bins || []).length) { S.binTab = 'reg'; go('bins'); toast('Add your skip bins first.'); } else hireEditor(); };
  $('mExp').onclick = function () { expenseEditor(); };
  $('mQuo').onclick = function () { invoiceEditor(null, null, 'quote'); };
  $('mRem').onclick = function () { reminderEditor(); };
  $('mBk').onclick = function () { bookingEditor(); };
  $('mFuel').onclick = function () { fuelEditor(); };
  $('mSu').onclick = function () { startupEditor(); };
  $('mCl').onclick = function () { clientEditor(); };
}
function menuItem(id, ico, t, m) {
  return '<li><button class="row-btn" id="' + id + '">' + tileIcon(ico) + '<span><span class="t">' + t + '</span><br><span class="m">' + m + '</span></span><span class="chev">›</span></button></li>';
}
function opts(list, sel) {
  var l = list.slice(); if (sel && l.indexOf(sel) < 0) l.push(sel);
  return l.map(function (o) { return '<option' + (o === sel ? ' selected' : '') + '>' + esc(o) + '</option>'; }).join('');
}
function datalist(id, list) { return '<datalist id="' + id + '">' + list.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('') + '</datalist>'; }
function v(x) { return x === 0 || x == null ? '' : esc(x); }
function uniq(arr) { var s = {}; return arr.filter(function (x) { if (!x || s[x]) return false; s[x] = 1; return true; }); }

/* ==================== period control ==================== */
function periodControl(onChange) {
  var p = S.period;
  var types = [['week', 'Week'], ['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year'], ['all', 'All'], ['custom', 'Custom']];
  var r = periodRange(p);
  var html = '<div class="period"><div class="seg">' + types.map(function (t) {
    return '<button data-pt="' + t[0] + '" aria-pressed="' + (p.type === t[0]) + '">' + t[1] + '</button>'; }).join('') + '</div>';
  if (p.type === 'custom') html += '<div class="custom-range"><input type="date" id="pf" value="' + r.from + '"><input type="date" id="pt" value="' + r.to + '"></div>';
  else html += '<div class="period-nav"><button id="pprev" aria-label="Previous"' + (p.type === 'all' ? ' disabled' : '') + '>‹</button><span class="label">' + esc(periodLabel(p)) +
    '</span><button id="pnext" aria-label="Next"' + (p.type === 'all' || (r.to && r.to >= today()) ? ' disabled' : '') + '>›</button></div>';
  html += '</div>';
  setTimeout(function () {
    qa('[data-pt]').forEach(function (b) { b.onclick = function () { p.type = b.dataset.pt; if (p.type !== 'custom') p.anchor = today(); onChange(); }; });
    if ($('pprev')) $('pprev').onclick = function () { shiftPeriod(p, -1); onChange(); };
    if ($('pnext')) $('pnext').onclick = function () { shiftPeriod(p, 1); onChange(); };
    if ($('pf')) $('pf').onchange = function () { p.from = this.value; onChange(); };
    if ($('pt')) $('pt').onchange = function () { p.to = this.value; onChange(); };
  });
  return html;
}

/* ==================== dashboard ==================== */
var COLORS = { navy: '#141414', gold: '#c5a35a', ocean: '#1a6fa8', green: '#2d7a2d', grey: '#b8c3d6', red: '#d63c3c',
  palette: ['#141414', '#1a6fa8', '#c5a35a', '#2d7a2d', '#7d8db0', '#d97a2b', '#4fb0e0', '#9b5fc0', '#c94f4f', '#5c6f8f'] };

function isDark() { var t = document.documentElement.dataset.theme; return t === 'dark' || (t !== 'light' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
function themeColours() {
  var d = isDark();
  COLORS.navy = d ? '#8fa9e3' : '#141414'; COLORS.grey = d ? '#3a4a6b' : '#b8c3d6';
  COLORS.palette[0] = COLORS.navy;
}
function applyTheme(t) {
  t = t || lsGet('nv_theme', 'auto');
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', isDark() ? '#070d1a' : '#141414');
  themeColours();
}
applyTheme();
if (window.matchMedia) { var mq = window.matchMedia('(prefers-color-scheme: dark)'); var onMq = function () { applyTheme(); if (S.data) render(); }; if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq); }
function themeControl() {
  var t = lsGet('nv_theme', 'auto');
  return '<div class="card"><h2>Appearance</h2><div class="seg" id="themeSeg">' + [['auto', 'Match Device'], ['light', 'Light'], ['dark', 'Dark']].map(function (o) { return '<button data-theme-set="' + o[0] + '" aria-pressed="' + (t === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
}
function bindTheme() { qa('[data-theme-set]').forEach(function (b) { b.onclick = function () { lsSet('nv_theme', b.dataset.themeSet); applyTheme(b.dataset.themeSet); render(); }; }); }
function chart(id, cfg) {
  if (!window.Chart) return;
  var el = $(id); if (!el) return;
  Chart.defaults.font.family = '"Source Sans 3", Arial, sans-serif';
  Chart.defaults.color = isDark() ? '#9aa6bd' : '#66728a';
  Chart.defaults.borderColor = isDark() ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';
  S.charts.push(new Chart(el, cfg));
}
function moneyTicks() { return { callback: function (v) { return Math.abs(v) >= 1000 ? (v / 1000) + 'k' : v; } }; }
function moneyTip() { return { callbacks: { label: function (c) { return (c.dataset.label ? c.dataset.label + ': ' : '') + ec(c.parsed.y != null && c.chart.config.options.indexAxis !== 'y' ? c.parsed.y : (c.parsed.x != null ? c.parsed.x : c.parsed)); } } }; }

function roadCard() {
  var inv = startupTotal(), f = facts(), all = summarise(f, null, null), rec = all.net;
  var p = inv ? Math.max(0, Math.min(1, rec / inv)) : 0;
  var head = !inv ? 'Add equipment costs to track recovery.' : rec >= inv
    ? 'Equipment costs <b>fully recovered</b>, with ' + ec(rec - inv) + ' surplus.'
    : '<b>' + pct(rec / inv) + '</b> of equipment costs recovered. ' + ec(inv - rec) + ' to go.';
  return '<div class="road-card"><div class="kicker">Capital recovery · all time</div><div class="headline">' + head + '</div>' +
    '<div class="road" role="img" aria-label="' + pct(p) + ' recovered"><div class="done" style="width:' + (p * 100) + '%"></div>' +
    '<svg viewBox="0 0 64 34" style="left:clamp(24px,' + (p * 100) + '%,calc(100% - 24px))" aria-hidden="true"><rect x="2" y="6" width="38" height="18" rx="2" fill="#e9eef7"/><path d="M40 10h12l8 8v6H40z" fill="#2d7a2d"/><rect x="44" y="12" width="7" height="5" fill="#141414"/><circle cx="13" cy="27" r="5" fill="#111" stroke="#e9eef7" stroke-width="2"/><circle cx="50" cy="27" r="5" fill="#111" stroke="#e9eef7" stroke-width="2"/></svg>' +
    '<div class="flag"></div></div><div class="road-foot"><span>Invested ' + ec(inv) + '</span><span>Profit to date ' + ec(rec) + '</span></div></div>';
}

function changeCell(cur, prev, isPct, invert) {
  if (!isFinite(cur) || !isFinite(prev)) return '<td class="n muted">–</td>';
  var d = cur - prev;
  var good = invert ? d < 0 : d > 0;
  var txt = isPct ? (d >= 0 ? '+' : '') + (d * 100).toFixed(1) + ' pts' : (d >= 0 ? '+' : '-') + ec(Math.abs(d)).replace('-', '');
  var rel = !isPct && prev ? '<span class="chg">' + (d >= 0 ? '+' : '') + (d / Math.abs(prev) * 100).toFixed(0) + '%</span>' : '';
  return '<td class="n ' + (Math.abs(d) < 0.005 ? 'muted' : good ? 'pos' : 'neg') + '">' + txt + rel + '</td>';
}

VIEWS = {};
var VIEWS;
/* ==================== Home: configurable sections ==================== */
var HOME_SECTIONS = [
  ['needs', 'Needs Attention', 'Overdue money, jobs to invoice and fleet issues', true],
  ['quick', 'Quick Actions', 'Your shortcuts in a two-column panel', true],
  ['summary', 'Financial Summary', 'Operating profit, revenue, jobs and money owed for the period', true],
  ['ops', 'Bookings & Operations', 'Today\'s jobs and each truck\'s status', true],
  ['cash', 'Next 30 Days', 'Money expected in and out', true],
  ['capital', 'Equipment Payback', 'Cumulative profit against what the equipment cost', true],
  ['compare', 'Period Comparison', 'This period against the one before', true],
  ['charts', 'Detailed Charts', 'Revenue, costs and operating profit over time', true],
  ['money', 'Where the Money Goes', 'Direct job costs by type', true],
  ['routes', 'Income by Area', 'Revenue by area for the period', true],
  ['customers', 'Top Customers', 'Revenue by customer for the period', true],
  ['trips', 'Jobs by Area', 'How many jobs each area had', true],
  ['receivables', 'Receivables', 'Who owes what, by how late', true],
    ['highlights', 'Business Highlights', 'Best area, top customer and busiest truck', false]
];
var QUICK_ACTIONS = [
  ['inv', 'invoice', 'New Invoice'], ['bk', 'calplus', 'New Booking'], ['exp', 'wallet', 'Record Expense'],
  ['pay', 'checkc', 'Record Payment'], ['fuel', 'fuel', 'Log Fuel'], ['quote', 'quote', 'New Quote']
];
var PREF_DEFAULTS = { homeOrder: HOME_SECTIONS.map(function (x) { return x[0]; }), homeOff: HOME_SECTIONS.filter(function (x) { return !x[3]; }).map(function (x) { return x[0]; }),
  quick: QUICK_ACTIONS.map(function (q) { return q[0]; }), hideAmounts: false, density: 'comfortable', reduceMotion: false, theme: 'auto' };
function prefs() {
  var p = Object.assign({}, PREF_DEFAULTS, (S.data && S.data.me && S.data.me.prefs) || {});
  var known = HOME_SECTIONS.map(function (x) { return x[0]; });
  p.homeOrder = (p.homeOrder || []).filter(function (k) { return known.indexOf(k) >= 0; });
  known.forEach(function (k) { if (p.homeOrder.indexOf(k) < 0) p.homeOrder.push(k); }); // new sections appear at the end
  return p;
}
function savePrefs(patch) {
  var p = Object.assign(prefs(), patch);
  S.data.me.prefs = p; cacheData(); applyPrefs();
  return api('savePrefs', { prefs: p }).catch(function () {});
}
function applyPrefs() {
  var p = prefs();
  document.body.classList.toggle('compact', p.density === 'compact');
  document.body.classList.toggle('reduce-motion', !!p.reduceMotion);
  if (S.mask === undefined) S.mask = !!p.hideAmounts;
  document.body.classList.toggle('mask', !!S.mask);
  if (p.theme && p.theme !== lsGet('nv_theme', 'auto')) { lsSet('nv_theme', p.theme); applyTheme(p.theme); }
}
/** Money on Home is wrapped so the eye button can hide it without changing any figure. */
function mny(x, cls) { return '<span class="money' + (cls ? ' ' + cls : '') + '">' + ec(x) + '</span>'; }
function sec(id, title, body, link) {
  return '<section class="hsec" data-sec="' + id + '"><div class="card-head"><h2 style="margin:0">' + title + '</h2>' + (link ? '<button class="btn link" data-go="' + link[0] + '">' + link[1] + ' ›</button>' : '') + '</div>' + body + '</section>';
}
function needsAttention() {
  var t = today(), items = [];
  var od = liveInvoices().filter(function (i) { return invStatus(i) === 'Overdue'; });
  if (od.length) items.push(['money', 'danger', od.length + (od.length === 1 ? ' overdue invoice' : ' overdue invoices'), mny(od.reduce(function (a, i) { return a + invBalance(i); }, 0)) + ' past due · oldest ' + daysBetween(od.map(function (i) { return i.dueDate; }).sort()[0], t) + ' days', 'odinv']);
  var toInv = (S.data.bookings || []).filter(function (b) { return b.status === 'Done' || (b.status === 'Booked' && b.date < t); });
  if (toInv.length) items.push(['calendar', 'warn', toInv.length + (toInv.length === 1 ? ' job to invoice' : ' jobs to invoice'), 'Finished or past bookings without an invoice', 'bookings']);
  var rem = remindersDue(14), late = rem.filter(function (r) { return r.due && r.due < t; });
  if (rem.length) items.push(['alarm', late.length ? 'danger' : 'warn', rem.length + ' truck ' + (rem.length === 1 ? 'item' : 'items') + ' due', late.length ? late.length + ' overdue · ' + esc(late[0].type) + ' (' + esc(late[0].truck) + ')' : esc(rem[0].type) + ' (' + esc(rem[0].truck) + ')', 'reminders']);
  var f = facts(), recent = summarise(f, addDays(t, -29), t);
  TRUCKS.forEach(function (tr) { if (!recent.jobs.some(function (j) { return j.truck === tr; })) items.push(['truck', 'warn', truckName(tr) + ': activity review', 'No jobs recorded in the last 30 days', 'fleet']); });
  var oldQ = (S.data.quotes || []).filter(function (q) { return q.status === 'Open' && daysBetween(q.issueDate, t) >= 5; });
  if (oldQ.length) items.push(['quote', 'info', oldQ.length + (oldQ.length === 1 ? ' quote' : ' quotes') + ' awaiting an answer', 'Open for 5 days or more', 'quotes']);
  return items;
}
VIEWS.dashboard = function () {
  applyPrefs();
  var p = prefs(), off = p.homeOff || [];
  var f = facts(), r = periodRange(S.period), pr = previousRange(S.period);
  var cur = summarise(f, r.from, r.to), prev = pr ? summarise(f, pr.from, pr.to) : null;
  var open = liveInvoices().filter(function (i) { return invBalance(i) > 0.009; });
  var owed = open.reduce(function (t, i) { return t + invBalance(i); }, 0), overdue = open.filter(function (i) { return invStatus(i) === 'Overdue'; });
  var charts = [], html = {};
  html.needs = function () {
    var items = needsAttention();
    return '<section class="hsec needs" data-sec="needs"><div class="card-head"><h2 style="margin:0">' + icon('alarm', 'gi-inline') + ' Needs Attention</h2><span class="kicker">' + (items.length ? items.length + ' to review' : 'All clear') + '</span></div>' +
      (items.length ? '<div class="needs-list">' + items.map(function (it) { return '<button class="need ' + it[1] + '" data-need="' + it[4] + '">' + icon(it[0], 'gi-need') + '<span><b>' + it[2] + '</b><br><span class="small">' + it[3] + '</span></span><span class="chev">›</span></button>'; }).join('') + '</div>'
        : '<p class="small muted" style="margin:6px 0 0">Nothing overdue, no jobs waiting to be invoiced and no truck admin due.</p>') + '</section>';
  };
  html.quick = function () {
    var q = QUICK_ACTIONS.filter(function (a) { return p.quick.indexOf(a[0]) >= 0; });
    if (!q.length || isViewOnly()) return '';
    return sec('quick', 'Quick Actions', '<div class="qa-grid">' + q.map(function (a) { return '<button class="qa-btn" data-qa="' + a[0] + '">' + icon(a[1], 'gi-qa') + '<span>' + a[2] + '</span></button>'; }).join('') + '</div>', ['appearance', 'Edit']);
  };
  html.summary = function () {
    return '<section class="hsec" data-sec="summary">' + periodControl(render) + '<div class="tiles">' +
      '<div class="tile accent"><div class="label">Operating profit</div><div class="fig ' + (cur.net < 0 ? 'neg' : '') + '">' + mny(cur.net) + '</div>' + (prev ? '<div class="small muted">' + deltaTxt(cur.net, prev.net) + '</div>' : '') + '</div>' +
      '<div class="tile"><div class="label">Revenue</div><div class="fig">' + mny(cur.income) + '</div>' + (prev ? '<div class="small muted">' + deltaTxt(cur.income, prev.income, true) + '</div>' : '') + '</div>' +
      '<div class="tile"><div class="label">Completed jobs</div><div class="fig">' + cur.trips + '</div>' + (prev ? '<div class="small muted">' + (cur.trips - prev.trips >= 0 ? '+' : '') + (cur.trips - prev.trips) + ' vs before</div>' : '') + '</div>' +
      '<button class="tile" id="owedTile"><div class="label">Owed</div><div class="fig">' + mny(owed) + '</div><div class="small ' + (overdue.length ? 'neg' : 'muted') + '">' + open.length + ' open' + (overdue.length ? ', ' + overdue.length + ' overdue' : '') + '</div></button></div>' +
      (S.data.settings.monthlyTarget ? targetTile() : '') + '</section>';
  };
  html.ops = function () {
    var t = today(), bk = S.data.bookings || [];
    var rows = TRUCKS.map(function (tr) {
      var todays = bk.filter(function (b) { return b.truck === tr && b.date === t && b.status !== 'Cancelled'; });
      var next = bk.filter(function (b) { return b.truck === tr && b.date > t && b.status === 'Booked'; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
      var active = summarise(f, addDays(t, -29), t).jobs.some(function (j) { return j.truck === tr; });
      var st = todays.length ? ['Scheduled today', 'Unpaid'] : active ? ['No job today', 'Paid'] : ['Review activity', 'Overdue'];
      return '<div class="ops-truck"><div><b>' + esc(truckName(tr)) + '</b><div class="small muted">' + (todays.length ? todays.map(function (b) { return (b.time ? esc(b.time) + ' ' : '') + esc(b.route || b.client); }).join(', ') : next ? 'Next: ' + niceShort(next.date) + ' · ' + esc(next.route || next.client) : 'Nothing booked') + '</div></div><span class="pill ' + st[1] + '">' + st[0] + '</span></div>';
    }).join('');
    var soon = bk.filter(function (b) { return b.status === 'Booked' && b.date >= t && b.date <= addDays(t, 6); }).length;
    return sec('ops', 'Bookings & Operations', '<div class="ops-grid">' + rows + '</div><p class="small muted" style="margin:8px 0 0">' + soon + (soon === 1 ? ' job' : ' jobs') + ' booked in the next 7 days. Status comes from bookings and recorded jobs.</p>', ['bookings', 'Bookings']);
  };
  html.cash = function () { var c = cashCard(); return c ? '<section class="hsec bare" data-sec="cash">' + c.replace(/EC\$[\d,.\-]+/g, function (m) { return '<span class="money">' + m + '</span>'; }) + '</section>' : ''; };
  html.capital = function () {
    var inv = startupTotal(); if (!inv) return '';
    var cum = summarise(f, null, null).net, pc = cum / inv;
    return '<section class="hsec cap" data-sec="capital"><div class="kicker">Equipment payback · all time</div><div class="cap-row"><div><span class="small">Invested</span><b>' + mny(inv) + '</b></div><div><span class="small">Cumulative profit</span><b>' + mny(cum) + '</b></div><div><span class="small">Profit / investment</span><b>' + pct(pc) + '</b></div></div>' +
      '<div class="meter"><span style="width:' + Math.max(0, Math.min(100, pc * 100)) + '%"></span></div><p class="small" style="margin:8px 0 0;opacity:.8">Accounting profit compared with the cost of the trucks, machines and bins in the equipment register.</p></section>';
  };
  html.compare = function () {
    if (!prev) return '';
    var rows = [['Revenue', 'income'], ['Costs', 'costs', false, true], ['Operating profit', 'net'], ['Margin', 'margin', true], ['Jobs', 'trips', 'count']];
    return sec('compare', 'Period Comparison', '<div class="scroll-x"><table class="kpi-table"><thead><tr><th>Metric</th><th class="n">' + esc(periodLabel(S.period)) + '</th><th class="n">' + esc(prevLabel(S.period)) + '</th><th class="n">Change</th></tr></thead><tbody>' +
      rows.map(function (row) { var k = row[1], fmt = row[2] === true ? pct : row[2] === 'count' ? String : function (x) { return mny(x); };
        return '<tr><td>' + row[0] + '</td><td class="n"><b>' + fmt(cur[k]) + '</b></td><td class="n muted">' + fmt(prev[k]) + '</td>' + (row[2] === 'count' ? changeCountCell(cur[k], prev[k]) : changeCell(cur[k], prev[k], row[2] === true, row[3])) + '</tr>'; }).join('') +
      '</tbody></table></div>' + (prev.net < 0 && cur.net > 0 ? '<p class="small muted">Profit improved from a loss, so the EC$ change is more meaningful than a percentage.</p>' : ''));
  };
  html.charts = function () { if (!cur.trips && !cur.exps.length) return ''; charts.push('trend'); return sec('charts', 'Revenue, Costs and Profit', '<div class="chart-box tall"><canvas id="cTrend"></canvas></div>'); };
  html.money = function () { if (!cur.trips) return ''; charts.push('money'); return sec('money', 'Where the Money Goes', '<p class="small muted" style="margin:0 0 6px">Direct job costs by type. Labour, materials and the other direct costs recorded on each job.</p><div class="chart-box"><canvas id="cCosts"></canvas></div>'); };
  html.routes = function () { if (!cur.trips) return ''; charts.push('routes'); return sec('routes', 'Income by Area', '<div class="chart-box"><canvas id="cRoutes"></canvas></div>', ['routes', 'Details']); };
  html.customers = function () { if (!cur.trips) return ''; charts.push('cust'); return sec('customers', 'Top Customers', '<div class="chart-box"><canvas id="cCust"></canvas></div>', ['custreport', 'Details']); };
  html.trips = function () { if (!cur.trips) return ''; charts.push('trips'); return sec('trips', 'Jobs by Area', '<div class="chart-box"><canvas id="cTripsR"></canvas></div>'); };
  html.receivables = function () {
    if (!open.length) return sec('receivables', 'Receivables', '<p class="small muted">Nothing is owed right now.</p>');
    var t = today(), age = { a: 0, b: 0, c: 0, d: 0 };
    open.forEach(function (i) { var od = daysBetween(i.dueDate, t), v = invBalance(i); if (od <= 0) age.a += v; else if (od <= 30) age.b += v; else if (od <= 60) age.c += v; else age.d += v; });
    return sec('receivables', 'Who Owes What', '<div class="big-fig">' + mny(owed) + ' <span class="small ' + (overdue.length ? 'neg' : 'muted') + '">' + overdue.length + ' overdue</span></div>' +
      vStack([{ label: 'Not yet due', value: age.a, color: 'var(--ocean)' }, { label: '1–30 days late', value: age.b, color: 'var(--gold)' }, { label: '31–60 days', value: age.c, color: '#e07a2b' }, { label: 'Over 60 days', value: age.d, color: 'var(--danger)' }]).replace(/EC\$[\d,.\-]+/g, function (m) { return '<span class="money">' + m + '</span>'; }) +
      '<p class="small muted" style="margin:0">All outstanding invoices today, not filtered by the period above.</p>', ['invoices', 'Invoices']);
  };
  html.partner = function () {
    var ps = S.data.settings.partners || []; if (!ps.length) return '';
    return sec('partner', 'Partner Split', '<div class="ps-grid">' + ps.map(function (x) { return '<div class="ps"><span class="small muted">' + esc(x.name) + ' · ' + x.share + '%</span><b>' + mny(cur.net * x.share / 100) + '</b></div>'; }).join('') + '</div>' +
      '<p class="small muted" style="margin:6px 0 0">Each partner\'s share of this period\'s operating profit, for information. It is not an amount owed; transfers are recorded on paid invoices.</p>');
  };
  html.highlights = function () {
    if (!cur.trips) return '';
    var rt = groupStats(cur.jobs, 'route')[0], cu = groupStats(cur.jobs, 'client').sort(function (a, b) { return b.income - a.income; })[0], tk = groupStats(cur.jobs, 'truck').sort(function (a, b) { return b.trips - a.trips; })[0];
    return sec('highlights', 'Business Highlights', '<ul class="hl">' + (rt ? '<li>Best area by contribution: <b>' + esc(rt.name) + '</b>, ' + mny(rt.net) + ' from ' + rt.trips + (rt.trips === 1 ? ' job' : ' jobs') + '.</li>' : '') +
      (cu ? '<li>Top customer: <b>' + esc(cu.name) + '</b>, ' + mny(cu.income) + ' revenue.</li>' : '') + (tk ? '<li>Busiest truck: <b>' + esc(truckName(tk.name)) + '</b>, ' + tk.trips + ' jobs.</li>' : '') + '</ul>');
  };
  var h = syncBanner() + faceIdHint();
  p.homeOrder.forEach(function (k) { if (off.indexOf(k) >= 0 || !html[k]) return; h += html[k](); });
  if (h.replace(/\s/g, '') === (syncBanner() + faceIdHint()).replace(/\s/g, '')) h += '<div class="card empty">Every Home section is switched off. Turn some on under Appearance.</div>';
  $('view').innerHTML = '<div class="home">' + h + '</div>';
  bindOwed(); bindSync(); bindFaceIdHint(); bindGo(); bindReminders();
  if ($('cashCard')) $('cashCard').onclick = function () { go('cashflow'); };
  qa('[data-need]').forEach(function (b) { b.onclick = function () { var n = b.dataset.need; if (n === 'odinv') { S.invFilter = 'overdue'; go('invoices'); } else if (n === 'bookings') { S.bkFilter = 'toinvoice'; go('bookings'); } else if (n === 'quotes') { S.invMode = 'quotes'; go('invoices'); } else go(n); }; });
  qa('[data-qa]').forEach(function (b) { b.onclick = function () { quickAction(b.dataset.qa); }; });
  if (charts.indexOf('trend') >= 0) {
    var bs = buckets(r, f), bd = bs.map(function (b) { return summarise(f, b.from, b.to); });
    chart('cTrend', { data: { labels: bs.map(function (b) { return b.label; }), datasets: [
      { type: 'bar', label: 'Revenue', data: bd.map(function (x) { return round2(x.income); }), backgroundColor: COLORS.navy, borderRadius: 4, order: 2 },
      { type: 'bar', label: 'Costs', data: bd.map(function (x) { return round2(x.costs); }), backgroundColor: COLORS.grey, borderRadius: 4, order: 3 },
      { type: 'line', label: 'Operating profit', data: bd.map(function (x) { return round2(x.net); }), borderColor: COLORS.gold, backgroundColor: COLORS.gold, borderWidth: 3, pointRadius: 3, tension: 0, order: 1 }] },
      options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: moneyTip() },
        scales: { y: { ticks: moneyTicks() }, x: { grid: { display: false } } } } });
  }
  if (charts.indexOf('money') >= 0) { var cp = {}, cs0 = Calc.costSplit(cur.jobs); COST_TYPES.forEach(function (c) { if (cs0[c[0]]) cp[c[1]] = cs0[c[0]]; }); doughnut('cCosts', cp); }
  if (charts.indexOf('routes') >= 0) hbar('cRoutes', groupSum(cur.jobs, 'route'), COLORS.ocean);
  if (charts.indexOf('cust') >= 0) hbar('cCust', groupSum(cur.jobs, 'client', 8), COLORS.navy);
  if (charts.indexOf('trips') >= 0) { var tc = {}; cur.jobs.forEach(function (j) { var k = (j.route || 'Not set').trim(); tc[k] = (tc[k] || 0) + 1; });
    var tp = Object.keys(tc).map(function (k) { return [k, tc[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
    var el = $('cTripsR'); if (el) el.parentNode.style.height = Math.max(160, 34 * tp.length + 40) + 'px';
    chart('cTripsR', { type: 'bar', data: { labels: tp.map(function (x) { return x[0]; }), datasets: [{ data: tp.map(function (x) { return x[1]; }), backgroundColor: COLORS.gold, borderRadius: 4 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { precision: 0 } }, y: { grid: { display: false } } } } }); }
};
function deltaTxt(c, p, rel) {
  if (!isFinite(c) || !isFinite(p)) return '';
  var d = c - p; return (d >= 0 ? '+' : '−') + ec(Math.abs(d)) + (rel && p ? ' (' + (d >= 0 ? '+' : '') + Math.round(d / Math.abs(p) * 100) + '%)' : '') + ' vs before';
}
function quickAction(k) {
  if (k === 'inv') invoiceEditor(); else if (k === 'bk') bookingEditor(); else if (k === 'exp') expenseEditor(); else if (k === 'fuel') fuelEditor(); else if (k === 'quote') invoiceEditor(null, null, 'quote');
  else if (k === 'pay') {
    var un = liveInvoices().filter(function (i) { return invBalance(i) > 0.009; }).sort(function (a, b) { return a.issueDate < b.issueDate ? -1 : 1; });
    openSheet('Record a payment', un.length ? '<p class="small muted">Choose the invoice that was paid.</p><ul class="list">' + un.map(function (i) { return '<li><button class="row-btn" data-payinv="' + i.id + '"><span class="t">' + esc(clientOf(i).name) + '</span><span class="a">' + ec2(invBalance(i)) + '</span><span class="m">' + invNo(i) + ' · issued ' + nice(i.issueDate) + '</span><span><span class="pill ' + invStatus(i) + '">' + invStatus(i) + '</span></span></button></li>'; }).join('') + '</ul>' : '<p class="muted">No unpaid invoices.</p>');
    qa('[data-payinv]').forEach(function (b) { b.onclick = function () { paymentEditor(S.data.invoices.find(function (x) { return x.id === b.dataset.payinv; })); }; });
  }
}
function bindDashExtras() {
  if ($('dashRem')) $('dashRem').onclick = function () { go('reminders'); };
  if ($('dashBk')) $('dashBk').onclick = function () { S.bkFilter = 'upcoming'; go('bookings'); };
  qa('[data-bkgo]').forEach(function (b) { b.onclick = function () { S.bkFilter = 'upcoming'; go('bookings'); }; });
}
function changeCountCell(c, p) { var d = c - p; return '<td class="n ' + (d > 0 ? 'pos' : d < 0 ? 'neg' : 'muted') + '">' + (d > 0 ? '+' : '') + d + '</td>'; }
function bindOwed() { if ($('owedTile')) $('owedTile').onclick = function () { S.invFilter = 'open'; go('invoices'); }; }
function groupSum(list, key, top) {
  var m = {}; list.forEach(function (j) { var k = (j[key] || 'Not set').trim(); m[k] = (m[k] || 0) + j.amount; });
  var arr = Object.keys(m).map(function (k) { return [k, round2(m[k])]; }).sort(function (a, b) { return b[1] - a[1]; });
  return top ? arr.slice(0, top) : arr;
}
function hbar(id, pairs, color) {
  var el = $(id); if (el) el.parentNode.style.height = Math.max(160, 34 * pairs.length + 40) + 'px';
  chart(id, { type: 'bar', data: { labels: pairs.map(function (p) { return p[0]; }), datasets: [{ data: pairs.map(function (p) { return p[1]; }), backgroundColor: color, borderRadius: 4 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ec(c.parsed.x); } } } },
      scales: { x: { ticks: moneyTicks(), grid: { color: '#eef1f6' } }, y: { grid: { display: false } } } } });
}
function doughnut(id, obj) {
  var keys = Object.keys(obj).filter(function (k) { return obj[k] > 0; }).sort(function (a, b) { return obj[b] - obj[a]; });
  chart(id, { type: 'doughnut', data: { labels: keys, datasets: [{ data: keys.map(function (k) { return round2(obj[k]); }), backgroundColor: COLORS.palette, borderWidth: 2, borderColor: '#fff' }] },
    options: { maintainAspectRatio: false, cutout: '58%', plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 12 } } },
      tooltip: { callbacks: { label: function (c) { var t = c.dataset.data.reduce(function (a, b) { return a + b; }, 0); return c.label + ': ' + ec(c.parsed) + ' (' + pct(c.parsed / t) + ')'; } } } } } });
}
function partnerTable(net) {
  var ps = S.data.settings.partners || [];
  return '<table><tbody>' + ps.map(function (p) {
    return '<tr><td>' + esc(p.name) + ' <span class="muted small">' + p.share + '%</span></td><td class="n ' + (net < 0 ? 'neg' : '') + '"><b>' + ec2(net * p.share / 100) + '</b></td></tr>'; }).join('') +
    '<tr class="total"><td>Net profit</td><td class="n">' + ec2(net) + '</td></tr></tbody></table>';
}

/* ==================== invoices ==================== */
function invoiceRow(inv, showAge) {
  var st = invStatus(inv), bal = invBalance(inv), total = invTotal(inv);
  var meta = invNo(inv) + ' · ' + nice(inv.issueDate);
  if (!inv.void && bal > 0.009) { var age = daysBetween(inv.issueDate, today()), late = inv.dueDate ? daysBetween(inv.dueDate, today()) : 0; meta += ' · ' + age + (age === 1 ? ' day' : ' days') + ' since issue' + (late > 0 ? ' · <b class="neg">' + late + (late === 1 ? ' day' : ' days') + ' past due</b>' : ' · due ' + niceShort(inv.dueDate)); }
  var acts = !inv.void && bal > 0.009 && !isViewOnly() ? '<button class="sw-rem" data-sw="remind" data-id="' + inv.id + '">' + icon('bell', 'gi-sw') + 'Remind</button>' +
    '<button class="sw-pay" data-sw="pay" data-id="' + inv.id + '">' + icon('checkc', 'gi-sw') + 'Paid</button>' : '';
  return '<li' + (acts ? ' class="srow"' : '') + '>' + (acts ? '<div class="sw-acts">' + acts + '</div>' : '') + '<button class="row-btn" data-inv="' + inv.id + '"><span class="t">' + esc(clientOf(inv).name) + '</span><span class="a">' +
    ec2(st === 'Paid' || inv.void ? total : bal) + '</span><span class="m">' + meta + '</span><span><span class="pill ' + st + '">' + st + '</span></span></button></li>';
}
function bindInvRows() { qa('[data-inv]').forEach(function (b) { b.onclick = function () { if (b._swiped) { b._swiped = false; return; } go('invoice', b.dataset.inv); }; }); bindSwipes(); }
/** Rows with hidden actions: drag left to reveal them, tap an action, or tap the row as normal. */
function bindSwipes() {
  if (isViewOnly()) return;
  var rows = qa('.srow').filter(function (r) { return !r._sw; });
  rows.forEach(function (row) {
    row._sw = true;
    var c = row.querySelector('.row-btn'), acts = row.querySelector('.sw-acts'), w = function () { return acts.offsetWidth; };
    var x0 = 0, y0 = 0, dx = 0, base = 0, active = false, horiz = null;
    function set(v, anim) { c.style.transition = anim ? 'transform .25s ease' : 'none'; c.style.transform = v ? 'translateX(' + v + 'px)' : ''; }
    function closeOthers() { qa('.srow.open').forEach(function (o) { if (o !== row) { o.classList.remove('open'); var oc = o.querySelector('.row-btn'); oc.style.transition = 'transform .25s ease'; oc.style.transform = ''; } }); }
    c.addEventListener('pointerdown', function (e) { if (e.pointerType === 'mouse' && e.button !== 0) return; active = true; horiz = null; x0 = e.clientX; y0 = e.clientY; base = row.classList.contains('open') ? -w() : 0; dx = base; });
    c.addEventListener('pointermove', function (e) {
      if (!active) return;
      var mx = e.clientX - x0, my = e.clientY - y0;
      if (horiz === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) { horiz = Math.abs(mx) > Math.abs(my); if (horiz) { try { c.setPointerCapture(e.pointerId); } catch (x) {} closeOthers(); } }
      if (!horiz) return;
      dx = Math.max(-w() - 24, Math.min(0, base + mx)); set(dx);
    });
    function end() {
      if (!active) return; active = false;
      if (horiz) { c._swiped = true; setTimeout(function () { c._swiped = false; }, 350); var open = dx < -w() / 2.5; row.classList.toggle('open', open); set(open ? -w() : 0, true); }
    }
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
  });
  qa('[data-sw]').forEach(function (b) { if (b._b) return; b._b = true; b.onclick = function (e) {
    e.stopPropagation(); var row = b.closest('.srow'); row.classList.remove('open'); var rc = row.querySelector('.row-btn'); rc.style.transition = 'transform .25s ease'; rc.style.transform = '';
    var inv = S.data.invoices.find(function (x) { return x.id === b.dataset.id; });
    if (b.dataset.sw === 'pay' && inv) paymentEditor(inv);
    if (b.dataset.sw === 'remind' && inv) sendReminder(inv);
    if (b.dataset.sw === 'done') api('setBookingStatus', { id: b.dataset.id, status: 'Done' }, 'Saving…').then(function () { toast('Job marked done.'); render(); }).catch(function () {});
  }; });
  // Show new users once that rows can be swiped.
  if (rows.length && !lsGet('nv_swipe_hint', 0) && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    lsSet('nv_swipe_hint', 1); var first = rows[0].querySelector('.row-btn');
    setTimeout(function () { first.style.transition = 'transform .35s ease'; first.style.transform = 'translateX(-64px)'; setTimeout(function () { first.style.transform = ''; }, 650); }, 700);
  }
}

S.invMode = 'invoices';
function docSeg() {
  return '<div class="seg" style="margin-bottom:12px"><button data-mode="invoices" aria-pressed="' + (S.invMode === 'invoices') + '">Invoices</button><button data-mode="quotes" aria-pressed="' + (S.invMode === 'quotes') + '">Quotes</button></div>';
}
function bindDocSeg() { qa('[data-mode]').forEach(function (b) { b.onclick = function () { S.invMode = b.dataset.mode; render(); }; }); }
VIEWS.quotes = function () {
  var qs = (S.data.quotes || []).slice().sort(function (a, b) { return b.no - a.no; });
  var open = qs.filter(function (q) { return quoteStatus(q) === 'Open'; });
  $('view').innerHTML = docSeg() + '<div class="toolbar"><button class="btn gold" id="newQ">+ New quote</button></div>' +
    '<p class="muted small">' + open.length + ' open ' + (open.length === 1 ? 'quote' : 'quotes') + ' worth ' + ec2(open.reduce(function (t, q) { return t + quoteTotal(q); }, 0)) + '. Accepted quotes become invoices with one tap.</p>' +
    '<div class="card flush"><ul class="list">' + (qs.length ? qs.map(quoteRow).join('') : '<li class="empty">No quotes yet.</li>') + '</ul></div>';
  bindDocSeg();
  $('newQ').onclick = function () { invoiceEditor(null, null, 'quote'); };
  qa('[data-quote]').forEach(function (b) { b.onclick = function () { go('quote', b.dataset.quote); }; });
};
VIEWS.invoices = function () {
  if (S.invMode === 'quotes') return VIEWS.quotes();
  var q = S.invSearch.toLowerCase();
  var list = S.data.invoices.filter(function (i) {
    var st = invStatus(i);
    if (S.invFilter === 'open' && !(invBalance(i) > 0.009)) return false;
    if (S.invFilter === 'overdue' && st !== 'Overdue') return false;
    if (S.invFilter === 'paid' && st !== 'Paid') return false;
    if (S.invFilter === 'void' && !i.void) return false;
    if (S.invFilter !== 'void' && S.invFilter !== 'all' && i.void) return false;
    if (!q) return true;
    var c = clientOf(i);
    return (invNo(i) + ' ' + c.name + ' ' + (c.phone || '') + ' ' + i.lines.map(function (l) { return l.title + ' ' + l.route + ' ' + l.load; }).join(' ')).toLowerCase().indexOf(q) >= 0;
  }).sort(function (a, b) { return S.invFilter === 'open' || S.invFilter === 'overdue' ? (a.issueDate < b.issueDate ? -1 : 1) : (b.no - a.no || (b.issueDate > a.issueDate ? 1 : -1)); });
  var total = list.reduce(function (t, i) { return t + (S.invFilter === 'open' || S.invFilter === 'overdue' ? invBalance(i) : invTotal(i)); }, 0);
  var chips = [['all', 'All'], ['open', 'Owed'], ['overdue', 'Overdue'], ['paid', 'Paid'], ['void', 'Cancelled']];
  var byCust = '';
  if (S.invFilter === 'open' && !q) {
    var m = {}; liveInvoices().forEach(function (i) { var b = invBalance(i); if (b > 0.009) { var g = m[i.clientId] || (m[i.clientId] = { id: i.clientId, n: 0, owed: 0, oldest: i.issueDate }); g.n++; g.owed += b; if (i.issueDate < g.oldest) g.oldest = i.issueDate; } });
    var gs = Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.owed - a.owed; });
    if (gs.length) byCust = '<div class="card"><h2>Who owes what</h2><ul class="list">' + gs.map(function (g) {
      var c = S.data.clients.find(function (x) { return x.id === g.id; }) || { name: '?' };
      return '<li><button class="row-btn" data-c="' + g.id + '"><span class="t">' + esc(c.name) + '</span><span class="a neg">' + ec2(g.owed) + '</span><span class="m">' + g.n + (g.n === 1 ? ' invoice' : ' invoices') + ', oldest ' + daysBetween(g.oldest, today()) + ' days</span><span class="m">Statement ›</span></button></li>'; }).join('') + '</ul></div>';
  }
  var openAll = liveInvoices().filter(function (i) { return invBalance(i) > 0.009; }), odAll = openAll.filter(function (i) { return invStatus(i) === 'Overdue'; });
  var owedAll = openAll.reduce(function (a, i) { return a + invBalance(i); }, 0), odAmt = odAll.reduce(function (a, i) { return a + invBalance(i); }, 0);
  var recv = '<div class="card"><div class="mgrid"><div class="mcard"><span class="ml">Total outstanding</span><b>' + ec(owedAll) + '</b><span class="ms">' + openAll.length + (openAll.length === 1 ? ' invoice' : ' invoices') + '</span></div>' +
    '<div class="mcard"><span class="ml">Overdue amount</span><b class="' + (odAmt ? 'neg' : '') + '">' + ec(odAmt) + '</b><span class="ms">' + odAll.length + ' overdue, from due dates</span></div></div>' +
    '<p class="small muted" style="margin:8px 0 0">Invoiced is not the same as collected: these are balances still unpaid today.</p></div>';
  if (byCust) byCust = byCust.replace('<h2>Who owes what</h2><ul class="list">', '<h2>Outstanding by Customer</h2><ul class="list clip" id="obcList">').replace(/<li><button class="row-btn" data-c=/g, function (m, off) { return m; });
  $('view').innerHTML = docSeg() + recv + byCust + '<div class="toolbar"><input type="search" id="iq" placeholder="Search customer, invoice number, route" value="' + esc(S.invSearch) + '">' +
    '<button class="btn gold" id="newInv">+ New invoice</button></div><div class="toolbar">' +
    chips.map(function (c) { return '<button class="chip" data-f="' + c[0] + '" aria-pressed="' + (S.invFilter === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>' +
    '<p class="muted small">' + list.length + (list.length === 1 ? ' invoice' : ' invoices') + ', ' + ec2(total) + (S.invFilter === 'open' || S.invFilter === 'overdue' ? ' outstanding, oldest first' : '') + '</p>' +
    '<div class="card flush"><ul class="list">' + (list.length ? list.slice(0, 300).map(function (i) { return invoiceRow(i, S.invFilter === 'open' || S.invFilter === 'overdue'); }).join('') : '<li class="empty">No invoices here.</li>') + '</ul></div>';
  bindInvRows(); bindDocSeg();
  var ol = $('obcList'); if (ol) { var lis = qa('li', ol); lis.forEach(function (li, k) { if (k >= 3) li.classList.add('xrow'); }); if (lis.length > 3) ol.insertAdjacentHTML('afterend', '<div style="padding:0 2px">' + moreBtn('obcList', lis.length, 3, 'customer balances') + '</div>'); bindMore(); }
  qa('[data-c]').forEach(function (b) { b.onclick = function () { go('client', b.dataset.c); }; });
  $('newInv').onclick = function () { invoiceEditor(); };
  $('iq').oninput = function () { S.invSearch = this.value; var pos = this.selectionStart; VIEWS.invoices(); var el = $('iq'); el.focus(); el.setSelectionRange(pos, pos); };
  qa('[data-f]').forEach(function (b) { b.onclick = function () { S.invFilter = b.dataset.f; VIEWS.invoices(); }; });
};

VIEWS.invoice = function () {
  var inv = S.data.invoices.find(function (i) { return i.id === S.param; });
  if (!inv) { $('view').innerHTML = '<div class="card empty">Invoice not found.</div>'; return; }
  var c = clientOf(inv), st = invStatus(inv), total = invTotal(inv), paid = invPaid(inv), bal = invBalance(inv);
  var costs = inv.lines.reduce(function (t, l) { return t + lineCosts(l); }, 0);
  $('title').textContent = 'Invoice ' + invNo(inv);
  var h = '<div class="inv-hero"><div class="inv-top"><div class="no">' + invNo(inv) + '</div><span class="pill ' + st + '">' + st + '</span></div>' +
    '<div class="client">' + esc(c.name) + '</div><div class="meta">Issued ' + nice(inv.issueDate) + ' · Due ' + nice(inv.dueDate) + '</div>' +
    '<div class="bal"><span class="meta">Balance due</span><span class="fig">' + ec2(inv.void ? 0 : bal) + '</span></div></div>';
  var locked = [inv.issueDate].concat(inv.lines.map(function (l) { return l.date; })).some(isLocked);
  if (locked) h += '<div class="alert">' + icon('lock', 'gi-inline') + ' This invoice is in a closed month (' + esc(uniq([inv.issueDate].concat(inv.lines.map(function (l) { return l.date; })).filter(isLocked).map(function (d) { return ymName(d.slice(0, 7)); })).join(', ')) + '), so it can no longer be edited or cancelled. Payments can still be recorded.' + (S.data.me.role === 'owner' ? ' <button class="btn link" data-go="monthend">Month-End ›</button>' : '') + '</div>';
  if (inv.void) h += '<div class="alert err">Cancelled ' + nice(inv.void.at.slice(0, 10)) + ' by ' + esc(inv.void.by) + ': ' + esc(inv.void.reason) + '. It no longer counts towards any totals.</div>';
  if (!inv.void) h += '<div class="btn-row"><button class="btn gold" id="aSend">Send PDF</button><button class="btn" id="aPay"' + (bal <= 0.009 ? ' disabled' : '') + '>Record payment</button></div>';
  h += transferCard(inv);

  h += '<div class="card"><h2>Work</h2><ul class="list lines">' +
    inv.lines.map(function (l) {
      var meta = [nice(l.date), l.truck, l.route, l.load && l.load !== l.detail ? l.load : ''].filter(Boolean).join(' · ');
      return '<li><div class="ln"><div><b>' + esc(l.title) + '</b><div class="small muted">' + esc(meta) + '</div>' + (l.detail ? '<div class="small">' + esc(l.detail) + '</div>' : '') +
        (l.qty !== 1 ? '<div class="small muted">' + l.qty + ' × ' + ec2(l.price) + '</div>' : '') + '</div><div class="num"><b>' + ec2(lineAmount(l)) + '</b></div></div></li>'; }).join('') +
    '</ul><div class="ln total-ln"><b>Total</b><b class="num">' + ec2(total) + '</b></div>' +
    '<p class="small muted" style="margin:10px 0 0">Your costs on this job: ' + ec2(costs) + '. Net after costs: <b>' + ec2(total - costs) + '</b>. Costs never appear on the invoice.</p></div>';

  h += '<div class="card"><h2>Payments</h2>' + (inv.payments.length ? '<table><tbody>' + inv.payments.map(function (p) {
    return '<tr><td>' + nice(p.date) + '<br><span class="small muted">' + esc(p.method) + (p.note ? ' · ' + esc(p.note) : '') + ' · recorded by ' + esc(p.by) + '</span></td><td class="n">' + ec2(p.amount) +
      (inv.void ? '' : '<br><button class="btn link small" data-receipt="' + p.id + '">Receipt</button>' + (isLocked(p.date) ? '' : ' <button class="btn link small" data-delpay="' + p.id + '">Remove</button>')) + '</td></tr>'; }).join('') +
    '<tr class="total"><td>Received</td><td class="n">' + ec2(paid) + '</td></tr></tbody></table>' : '<p class="muted">No payments recorded yet.</p>') + '</div>';

  h += '<div class="card"><h2>Customer</h2><p style="margin:0">' + esc(c.name) + '<br><span class="muted">' + esc([c.phone, c.email, c.address].filter(Boolean).join(' · ') || 'No contact details saved') + '</span></p>' +
    (inv.internalNotes ? '<p class="small"><b>Private notes:</b> ' + esc(inv.internalNotes) + '</p>' : '') +
    (inv.notes ? '<p class="small"><b>Printed note:</b> ' + esc(inv.notes) + '</p>' : '') +
    (inv.sent.length ? '<p class="small muted">Sent: ' + inv.sent.map(function (s) { return nice(s.at.slice(0, 10)) + ' (' + esc(s.via) + ', ' + esc(s.by) + ')'; }).join('; ') + '</p>' : '') +
    '<button class="btn link" id="aClient">Customer account and statement ›</button></div>' + attachmentsCard('Photos and documents', inv.attachments, !inv.void);

  h += '<div class="stack"><button class="btn quiet block" id="aDl">Download PDF</button>' +
    (!inv.void && bal > 0.009 && !isViewOnly() ? '<button class="btn quiet block" id="aRemind">' + icon('bell', 'gi-inline') + ' Send Reminder</button>' : '') +
    (c.phone && !inv.void && bal <= 0.009 ? '<button class="btn quiet block" id="aWa">Open WhatsApp chat with ' + esc(c.name.split(' ')[0]) + '</button>' : '') +
    (!inv.void && !locked ? '<button class="btn quiet block" id="aEdit">Edit invoice</button>' : '') +
    '<button class="btn quiet block" id="aDup">Copy as new invoice</button>' +
    (!inv.void && !locked ? '<button class="btn danger block" id="aVoid">Cancel invoice</button>' : '') +
    (S.data.me.role === 'owner' && !locked ? '<button class="btn link block" id="aDel" style="color:var(--danger)">Delete permanently</button>' : '') + '</div>' +
    '<p class="small muted">Created by ' + esc(inv.createdBy || '') + ' · last changed by ' + esc(inv.updatedBy || '') + ' on ' + nice((inv.updatedAt || '').slice(0, 10)) + '</p>';
  $('view').innerHTML = h;

  if ($('aSend')) $('aSend').onclick = function () { sendPdf(inv); };
  if ($('aPay')) $('aPay').onclick = function () { paymentEditor(inv); };
  $('aDl').onclick = function () { makePdf(inv).then(function (file) { var url = URL.createObjectURL(file); var a = document.createElement('a'); a.href = url; a.download = file.name; a.target = '_blank'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 30000); }); };
  if ($('aWa')) $('aWa').onclick = function () {
    var phone = (c.phone || '').replace(/[^0-9]/g, '');
    var msg = 'Good day ' + c.name.split(' ')[0] + ', this is ' + S.data.settings.businessName + '. Invoice ' + invNo(inv) + ' for ' + ec2(bal) + ' is attached. Thank you.';
    window.open('https://wa.me/' + phone + '?text=' + encodeURIComponent(msg), '_blank');
  };
  if ($('aRemind')) $('aRemind').onclick = function () { sendReminder(inv); };
  $('aClient').onclick = function () { go('client', c.id); };
  qa('[data-ptnew]').forEach(function (b) { b.onclick = function () { partnerTxEditor({ to: b.dataset.ptnew, from: holder(), invoiceId: inv.id }, inv); }; });
  bindFunds(inv); qa('[data-go="monthend"]').forEach(function (b) { b.onclick = function () { go('monthend'); }; });
  qa('[data-ptx]').forEach(function (b) { b.onclick = function () { partnerTxEditor((S.data.partnerTx || []).find(function (t) { return t.id === b.dataset.ptx; }), inv); }; });
  bindAttachments({ kind: 'invoice', id: inv.id }, inv.attachments);
  qa('[data-receipt]').forEach(function (b) { b.onclick = function () {
    var p = inv.payments.find(function (x) { return x.id === b.dataset.receipt; });
    pdfSheet('Receipt for ' + invNo(inv), function () { return receiptPdf(inv, p); }, c);
  }; });
  if ($('aEdit')) $('aEdit').onclick = function () { invoiceEditor(inv); };
  $('aDup').onclick = function () {
    var copy = JSON.parse(JSON.stringify(inv)); delete copy.id; copy.issueDate = today(); copy.dueDate = '';
    copy.lines.forEach(function (l) { delete l.id; l.date = today(); });
    invoiceEditor(copy);
  };
  if ($('aDel')) $('aDel').onclick = function () { deleteInvoicePrompt(inv); };
  if ($('aVoid')) $('aVoid').onclick = function () { reasonPrompt('Cancel invoice ' + invNo(inv), 'The invoice stays on record, marked cancelled, and stops counting towards totals.', function (why) {
    return api('voidInvoice', { invoiceId: inv.id, reason: why }, 'Saving…').then(function () { toast('Invoice cancelled.'); render(); }); }); };
  qa('[data-delpay]').forEach(function (b) { b.onclick = function () {
    if (!confirm('Remove this payment?')) return;
    api('deletePayment', { invoiceId: inv.id, paymentId: b.dataset.delpay }, 'Saving…').then(function () { toast('Payment removed.'); render(); }); }; });
};

function deleteInvoicePrompt(inv) {
  var paid = inv.payments.length, sent = inv.sent.length;
  openSheet('Delete ' + invNo(inv) + ' permanently',
    '<div class="alert err">This removes the invoice completely. It cannot be undone and it will not appear in any report or backup made from now on. Use it only for test invoices or ones created by mistake. For a real invoice, use Cancel instead.</div>' +
    (paid ? '<p><b>This invoice has ' + paid + (paid === 1 ? ' payment' : ' payments') + ' recorded.</b> Remove the payments first, then delete it.</p>' : '') +
    (sent ? '<p class="small">It was shared ' + sent + (sent === 1 ? ' time' : ' times') + ', most recently on ' + nice(inv.sent[inv.sent.length - 1].at.slice(0, 10)) + '. Make sure the customer has not been asked to pay it.</p>' : '') +
    '<p class="small muted">If it is the latest invoice, its number is freed up, so the next invoice uses it again.</p>' +
    '<label class="f"><span>Type ' + pad3(inv.no) + ' to confirm</span><input id="delNo" inputmode="numeric" autocomplete="off"></label>' +
    '<button class="btn danger block" id="delGo"' + (paid ? ' disabled' : '') + '>Delete invoice ' + invNo(inv) + '</button>');
  $('delGo').onclick = function () {
    api('deleteInvoice', { invoiceId: inv.id, confirm: $('delNo').value }, 'Deleting…').then(function (res) {
      closeSheet(); toast('Invoice ' + invNo(inv) + ' deleted. The next invoice will be #' + pad3(res.result.nextInvoiceNo) + '.'); go('invoices', null, true);
    }).catch(function () {});
  };
}
function reasonPrompt(title, note, fn) {
  openSheet(title, '<p class="muted">' + esc(note) + '</p><label class="f"><span>Reason</span><input id="why" placeholder="For example: entered twice"></label>' +
    '<button class="btn danger block" id="whyGo">Confirm</button>');
  $('whyGo').onclick = function () { fn($('why').value).then(closeSheet).catch(function () {}); };
}

function partners() { return (S.data.settings.partners || []); }
/** Who paid: the business account or one of the partners personally. */
function payerOpts(sel) { return opts(['', 'Business'].concat(partners().map(function (p) { return p.name; })), sel || ''); }
function holder() { var h = S.data.settings.accountHolder || ''; return partners().some(function (p) { return p.name === h; }) ? h : (partners()[1] || partners()[0] || {}).name; }
function invTransfers(inv) { return (S.data.partnerTx || []).filter(function (t) { return t.invoiceId === inv.id; }); }
function transferCard(inv) {
  if (isViewOnly() || invStatus(inv) !== 'Paid' || partners().length < 2) return '';
  var from = holder(), others = partners().filter(function (p) { return p.name !== from; }), done = invTransfers(inv), U = Calc.fundsUse(inv, S.data);
  var exById = {}; S.data.expenses.forEach(function (e) { exById[e.id] = e; });
  var rows = done.map(function (t) { return '<li><button class="row-btn" data-ptx="' + t.id + '"><span class="t">' + esc(t.from) + ' → ' + esc(t.to) + '</span><span class="a">' + ec2(t.amount) + '</span><span class="m">' + nice(t.date) + ' · ' + esc(t.method) + (t.reference ? ' · ' + esc(t.reference) : '') + '</span><span></span></button></li>'; }).join('');
  var dueAll = others.reduce(function (a, p) { return a + Calc.transferDue(inv, S.data, p.share || 50); }, 0), none = dueAll <= 0.004;
  var opt = function (k, ic, t, sub) { return '<button class="fu-opt' + (U.mode === k ? ' on' : '') + '" data-fu="' + k + '">' + icon(ic, 'gi-inline') + '<span><b>' + t + '</b><br><span class="small muted">' + sub + '</span></span></button>'; };
  return '<div class="card share-card"><div class="card-head"><h2 style="margin:0">Partner share</h2><span class="pill ' + (done.length ? 'Paid' : none ? 'muted' : 'Unpaid') + '">' + (done.length ? 'Transferred' : none ? 'Kept in business' : 'To transfer') + '</span></div>' +
    '<table class="share-tbl"><tbody><tr><td>Invoice paid</td><td class="n">' + ec2(invTotal(inv)) + '</td></tr><tr><td>Less job costs</td><td class="n">−' + ec2(Calc.invCosts(inv)) + '</td></tr>' +
    '<tr class="total"><td>Job profit</td><td class="n">' + ec2(U.profit) + '</td></tr></tbody></table>' +
    '<div class="small" style="font-weight:600;margin:4px 0 8px">How was this money used?</div>' +
    opt('full', 'trend', 'Share it as normal', 'Each partner gets their share of the job profit') +
    opt('part', 'receipt', 'Some paid business costs', 'Link the expenses it covered; the rest is shared') +
    opt('all', 'archive', 'All kept for business costs', 'No transfer for this invoice') +
    (U.mode !== 'full' ? '<div class="fu-links">' + (U.links.length ? '<div class="small" style="font-weight:600;margin:6px 0 2px">Expenses paid from this invoice</div><ul class="list">' + U.links.map(function (l) { var e = exById[l.expenseId];
        return '<li><button class="row-btn" data-fuexp="' + e.id + '"><span class="t">' + esc(e.description || e.category) + '</span><span class="a">' + ec2(l.amount) + '</span><span class="m">' + esc(e.truck || '') + ' · ' + nice(e.date) + ' · ' + esc(e.category) + (l.amount < e.amount - 0.005 ? ' · part of ' + ec2(e.amount) : '') + '</span><span></span></button></li>'; }).join('') + '</ul>' : '<p class="small muted" style="margin:6px 0">No expenses linked yet.</p>') +
      '<div class="btn-row" style="margin-top:8px"><button class="btn quiet" id="fuLink">' + icon('receipt', 'gi-inline') + ' Link expenses</button><button class="btn quiet" id="fuNew">+ New expense</button></div></div>' : '') +
    '<div class="share-sum">' + (U.mode !== 'full' ? '<div class="share-line"><span>Used for business costs</span><span>−' + ec2(U.used) + (U.mode === 'all' && U.linked < U.used - 0.005 ? '<br><span class="small muted">' + ec2(U.used - U.linked) + ' kept in the account</span>' : '') + '</span></div><div class="share-line" style="font-weight:700"><span>Profit left to share</span><span>' + ec2(U.left) + '</span></div>' : '') +
    others.map(function (p) { var amt = Calc.transferDue(inv, S.data, p.share || 50), sent = done.filter(function (t) { return t.to === p.name; }), sentAmt = sent.reduce(function (a, t) { return a + t.amount; }, 0);
      return '<div class="share-due"><span>' + (amt > 0.004 ? esc(p.name) + '\'s share (' + (p.share || 50) + '%)' + (sent.length ? ', transferred' : ', to transfer') : 'No transfer due for this invoice') + '</span><b>' + ec2(amt) + '</b></div>' +
        (sent.length && Math.abs(sentAmt - amt) > 0.005 ? '<div class="alert">' + ec2(sentAmt) + ' was recorded as transferred, but the share is now ' + ec2(amt) + '. Open the transfer below to correct it.</div>' : '') +
        (!sent.length && amt > 0.004 ? '<button class="btn gold block" data-ptnew="' + esc(p.name) + '">Record transfer to ' + esc(p.name) + '</button>' : ''); }).join('') + '</div>' +
    (rows ? '<ul class="list" style="margin-top:6px">' + rows + '</ul>' : '') + '</div>';
}
function bindFunds(inv) {
  var U = Calc.fundsUse(inv, S.data), save = function (mode, links, msg) {
    return api('setInvoiceFunds', { invoiceId: inv.id, mode: mode, links: links }, 'Saving…').then(function () { if (msg) toast(msg); render(); });
  };
  qa('[data-fu]').forEach(function (b) { b.onclick = function () { var m = b.dataset.fu; if (m === U.mode) return; save(m, m === 'full' ? [] : U.links, m === 'full' ? 'Shared as normal.' : m === 'all' ? 'Kept for business costs.' : null).then(function () { if (m === 'part' && !U.links.length) linkPicker(inv); }).catch(function () {}); }; });
  qa('[data-fuexp]').forEach(function (b) { b.onclick = function () { var e = S.data.expenses.find(function (x) { return x.id === b.dataset.fuexp; }); if (e) (MAINT.indexOf(e.category) >= 0 && TRUCKS.indexOf(e.truck) >= 0 ? serviceEditor(e.truck, e) : expenseEditor(e)); }; });
  if ($('fuLink')) $('fuLink').onclick = function () { linkPicker(inv); };
  if ($('fuNew')) $('fuNew').onclick = function () {
    expenseEditor({ paidBy: 'Business' }, function (newId) {
      var e = S.data.expenses.find(function (x) { return x.id === newId; }); if (!e) return;
      var room = Math.max(0, U.profit - U.linked), amt = Math.min(e.amount, room);
      if (amt <= 0) return toast('Expense saved, but this invoice has no profit left to cover it.', true);
      save(U.mode, U.links.concat([{ expenseId: newId, amount: amt }]), 'Expense saved and linked to ' + invNo(inv) + '.').catch(function () {});
    });
  };
}
/** Choose which expenses this invoice paid for, and how much of each. */
function linkPicker(inv) {
  var U = Calc.fundsUse(inv, S.data), cur = {}; U.links.forEach(function (l) { cur[l.expenseId] = l.amount; });
  var list = S.data.expenses.filter(function (e) { return !e.void; }).map(function (e) { var other = Calc.expenseFunding(S.data, e.id, inv.id); return { e: e, room: round2(e.amount - other.total), other: other }; })
    .filter(function (x) { return x.room > 0.004 || cur[x.e.id]; }).sort(function (a, b) { return a.e.date < b.e.date ? 1 : -1; });
  openSheet('Expenses paid from ' + invNo(inv),
    '<p class="small muted" style="margin-top:0">Tick each expense this invoice paid for. Change the amount if it only covered part of a bill. Job profit available: <b>' + ec2(U.profit) + '</b>.</p>' +
    '<input type="search" id="lpQ" placeholder="Search expenses" style="margin-bottom:8px">' +
    '<div id="lpList">' + (list.length ? list.map(function (x) { var on = !!cur[x.e.id];
      return '<div class="lp-row" data-lp="' + x.e.id + '" data-text="' + esc((x.e.description + ' ' + x.e.category + ' ' + (x.e.truck || '')).toLowerCase()) + '"><label class="lp-main"><input type="checkbox"' + (on ? ' checked' : '') + '><span><b>' + esc(x.e.description || x.e.category) + '</b><br><span class="small muted">' + nice(x.e.date) + ' · ' + esc(x.e.category) + (x.e.truck ? ' · ' + esc(x.e.truck) : '') + ' · ' + ec2(x.e.amount) + (x.other.total ? ' · ' + ec2(x.other.total) + ' already paid from ' + x.other.from.map(function (o) { return invNo(o.inv); }).join(', ') : '') + '</span></span></label>' +
        '<label class="lp-amt"><span class="small muted">Paid from this invoice</span><input inputmode="decimal" value="' + (on ? cur[x.e.id] : '') + '" data-max="' + x.room + '" placeholder="' + x.room.toFixed(2) + '"></label></div>'; }).join('') : '<p class="muted">No expenses to link. Record the expense first.</p>') + '</div>' +
    '<div class="share-line" style="font-weight:700;margin-top:10px"><span>Total linked</span><span id="lpTot">EC$0.00</span></div><div id="lpErr" class="small neg"></div>', 'Save');
  var tot = function () {
    var t = 0, err = '';
    qa('.lp-row').forEach(function (r) { var c = r.querySelector('input[type=checkbox]'), a = r.querySelector('.lp-amt input'); r.classList.toggle('on', c.checked);
      if (c.checked) { if (!a.value) a.value = Math.min(+a.dataset.max, Math.max(0, U.profit - t)).toFixed(2); var v = num(a.value); if (v > +a.dataset.max + 0.005) err = 'An amount is more than is left of that expense.'; t += v; } });
    if (t > U.profit + 0.005) err = 'The total is more than this invoice\'s job profit (' + ec2(U.profit) + ').';
    $('lpTot').textContent = ec2(t); $('lpErr').textContent = err; return err;
  };
  qa('.lp-row input').forEach(function (el) { el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', tot); });
  $('lpQ').oninput = function () { var q = this.value.toLowerCase(); qa('.lp-row').forEach(function (r) { r.style.display = r.dataset.text.indexOf(q) >= 0 ? '' : 'none'; }); };
  tot();
  $('sheetGo').onclick = function () {
    if (tot()) return toast($('lpErr').textContent, true);
    var links = qa('.lp-row').filter(function (r) { return r.querySelector('input[type=checkbox]').checked; }).map(function (r) { return { expenseId: r.dataset.lp, amount: num(r.querySelector('.lp-amt input').value) }; }).filter(function (l) { return l.amount > 0; });
    api('setInvoiceFunds', { invoiceId: inv.id, mode: U.mode === 'full' ? 'part' : U.mode, links: links }, 'Saving…').then(function () { closeSheet(); toast(links.length ? links.length + (links.length === 1 ? ' expense linked.' : ' expenses linked.') : 'Links cleared.'); render(); }).catch(function () {});
  };
}
function partnerTxEditor(t, inv) {
  var editing = !!(t && t.id); t = t || {};
  var share = inv ? Calc.transferDue(inv, S.data, (partners().find(function (p) { return p.name === t.to; }) || {}).share || 50) : 0, U0 = inv ? Calc.fundsUse(inv, S.data) : null;
  var names = partners().map(function (p) { return p.name; });
  openSheet(editing ? 'Partner transfer' : (inv ? 'Transfer to ' + t.to : 'Record a partner transaction'),
    (inv ? '<div class="paybox"><span class="small muted">' + esc(t.to) + '\'s share of ' + invNo(inv) + ' (' + ((partners().find(function (p) { return p.name === t.to; }) || {}).share || 50) + '% of ' + (U0 && U0.used ? 'profit left after business costs, ' + ec2(U0.left) : 'job profit ' + ec2(Calc.invJobProfit(inv))) + ')</span><b>' + ec2(share) + '</b></div>' : '') +
    '<div class="cols"><label class="f"><span>From</span><select id="txF">' + opts(names, t.from || holder()) + '</select></label><label class="f"><span>To</span><select id="txT">' + opts(names, t.to || names.filter(function (n) { return n !== holder(); })[0]) + '</select></label></div>' +
    '<div class="cols"><label class="f"><span>Amount (EC$)</span><input id="txA" inputmode="decimal" value="' + v(t.amount || share || '') + '"></label><label class="f"><span>Date</span><input id="txD" type="date" value="' + v(t.date || today()) + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Type</span><select id="txY">' + opts(['Profit share', 'Expense settlement', 'Other'], t.type || (inv ? 'Profit share' : 'Expense settlement')) + '</select></label><label class="f"><span>Method</span><select id="txM">' + opts(['Bank transfer', 'Cash', 'Cheque', 'Other'], t.method || 'Bank transfer') + '</select></label></div>' +
    '<label class="f"><span>Bank reference (optional)</span><input id="txR" value="' + v(t.reference) + '"></label>' +
    '<label class="f"><span>Note (optional)</span><input id="txN" value="' + v(t.note) + '" placeholder=""></label>' +
    '<p class="small muted">Partner transfers are kept separate from business expenses, so they never change profit.</p>' +
    (editing && S.data.me.role === 'owner' ? '<button class="btn link block" id="txDel" style="color:var(--danger)">Delete this record</button>' : ''), 'Save');
  $('sheetGo').onclick = function () {
    api('savePartnerTx', { tx: { id: t.id, invoiceId: t.invoiceId || (inv && inv.id) || '', from: $('txF').value, to: $('txT').value, amount: $('txA').value, date: $('txD').value, type: $('txY').value, method: $('txM').value, reference: $('txR').value, note: $('txN').value } }, 'Saving…')
      .then(function () { closeSheet(); toast('Transfer recorded.'); render(); }).catch(function () {});
  };
  if ($('txDel')) $('txDel').onclick = function () { if (confirm('Delete this transfer record?')) api('deletePartnerTx', { id: t.id }, 'Deleting…').then(function () { closeSheet(); render(); }).catch(function () {}); };
}
function paymentEditor(inv) {
  var bal = invBalance(inv);
  openSheet('Payment for ' + invNo(inv),
    '<p class="muted">' + esc(clientOf(inv).name) + ' · balance ' + ec2(bal) + '</p>' +
    '<label class="f"><span>Amount received (EC$)</span><input id="pa" inputmode="decimal" value="' + bal.toFixed(2) + '"></label><p class="small muted" style="margin-top:-4px">The full balance is filled in. Change it for a deposit or part-payment.</p>' +
    '<label class="f"><span>Date received</span><input id="pd" type="date" value="' + today() + '"></label>' +
    '<label class="f"><span>Paid by</span><select id="pm">' + opts(METHODS, 'Local bank transfer') + '</select></label>' +
    '<label class="f"><span>Note (cheque number, reference…)</span><input id="pn"></label>', 'Save');
  $('sheetGo').onclick = function () {
    api('addPayment', { invoiceId: inv.id, payment: { amount: $('pa').value, date: $('pd').value, method: $('pm').value, note: $('pn').value } }, 'Saving…')
      .then(function (res) {
        closeSheet(); render();
        if (res.queued) return;
        var fresh = S.data.invoices.find(function (x) { return x.id === inv.id; }), p = fresh && fresh.payments[fresh.payments.length - 1];
        if (!p) return toast('Payment recorded.');
        var cleared = invBalance(fresh) <= 0.009;
        if (cleared) celebrate(bal);
        setTimeout(function () { receiptOffer(fresh, p); }, cleared ? 1500 : 0);
      }).catch(function () {});
  };
}
function celebrate(fromAmount) {
  var reduce = (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || document.body.classList.contains('reduce-motion');
  var host = document.createElement('div'); host.className = 'celebrate' + (reduce ? ' still' : ''); host.setAttribute('aria-hidden', 'true');
  var sparks = ''; for (var k = 0; k < 14; k++) { var a = k / 14 * Math.PI * 2, d = 90 + (k % 3) * 24; sparks += '<i style="--x:' + Math.round(Math.cos(a) * d) + 'px;--y:' + Math.round(Math.sin(a) * d) + 'px;' + (k % 2 ? 'background:#fff' : '') + '"></i>'; }
  host.innerHTML = '<div class="cel-in"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="46"/><path d="M38 61 L54 77 L84 45"/></svg>' + sparks + '<b>Paid in full</b></div>';
  document.body.appendChild(host);
  if (navigator.vibrate) { try { navigator.vibrate([20, 40, 30]); } catch (x) {} }
  var fig = document.querySelector('.inv-hero .fig');
  if (fig && fromAmount > 0 && !reduce) { var t0 = performance.now(); (function step(t) { var q = Math.min(1, (t - t0) / 700); fig.textContent = ec2(fromAmount * (1 - q)); if (q < 1) requestAnimationFrame(step); })(t0); }
  setTimeout(function () { host.classList.add('out'); setTimeout(function () { host.remove(); }, 300); }, 1300);
}
function receiptOffer(fresh, p) {
        openSheet('Payment recorded', '<p>' + ec2(p.amount) + ' received from ' + esc(clientOf(fresh).name) + '. Balance now ' + ec2(invBalance(fresh)) + '.</p>' +
          '<button class="btn gold block" id="sendRcpt">Send a receipt</button><div style="height:10px"></div><button class="btn quiet block" data-close>Not now</button>');
        qa('[data-close]', $('sheet')).forEach(function (b) { b.onclick = closeSheet; });
        $('sendRcpt').onclick = function () { pdfSheet('Receipt for ' + invNo(fresh), function () { return receiptPdf(fresh, p); }, clientOf(fresh)); };
}

/* ---- invoice editor ---- */
function invoiceEditor(inv, presetClient, mode) {
  inv = inv ? JSON.parse(JSON.stringify(inv)) : { issueDate: today(), lines: [] };
  var editing = !!inv.id;
  var origIds = editing ? inv.lines.map(function (l) { return l.id; }) : [];
  var c = inv.clientId ? clientOf(inv) : (presetClient || {});
  if (!inv.lines.length) inv.lines.push(blankLine());
  var allRoutes = uniq(ROUTES.concat(S.data.invoices.reduce(function (a, i) { return a.concat(i.lines.map(function (l) { return l.route; })); }, [])));
  var allLoads = uniq(LOADS.concat(S.data.invoices.reduce(function (a, i) { return a.concat(i.lines.map(function (l) { return l.load; })); }, [])));
  var clients = S.data.clients.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });

  var h = '<div class="card"><h2>Customer</h2><label class="f"><span>Name</span><input id="cName" list="cl" value="' + v(c.name) + '" autocomplete="off"></label>' +
    datalist('cl', clients.map(function (x) { return x.name; })) +
    '<div class="cols"><label class="f"><span>Phone / WhatsApp</span><input id="cPhone" type="tel" value="' + v(c.phone) + '"></label>' +
    '<label class="f"><span>Email</span><input id="cEmail" type="email" value="' + v(c.email) + '"></label></div>' +
    '<label class="f"><span>Address</span><input id="cAddr" value="' + v(c.address) + '"></label></div>' +
    (mode === 'quote'
      ? '<div class="card"><h2>Quote</h2><div class="cols"><label class="f"><span>Quote date</span><input id="iDate" type="date" value="' + inv.issueDate + '"></label>' +
        '<label class="f"><span>Valid until</span><input id="iDue" type="date" value="' + v(inv.validUntil) + '"></label></div>' +
        '<p class="small muted" style="margin-top:-4px">' + (editing ? 'Quote ' + quoteNo(inv) : 'This will be quote Q' + pad3(S.data.nextQuoteNo)) + '. Leave "valid until" blank for ' + (S.data.settings.quoteDays || 30) + ' days. Job dates are set when it becomes an invoice.</p></div>'
      : '<div class="card"><h2>Invoice</h2><div class="cols"><label class="f"><span>Invoice date</span><input id="iDate" type="date" value="' + inv.issueDate + '"></label>' +
        '<label class="f"><span>Payment due</span><input id="iDue" type="date" value="' + v(inv.dueDate) + '"></label></div>' +
        '<p class="small muted" style="margin-top:-4px">' + (editing ? 'Invoice ' + invNo(inv) : 'This will be invoice #' + pad3(S.data.nextInvoiceNo)) + '. Leave the due date blank for ' + S.data.settings.paymentDays + ' days.</p>' +
        (!editing && S.data.me.role === 'owner' ? '<label class="f" style="margin-top:6px"><span>Invoice number (only to record a past invoice)</span><input id="iNo" inputmode="numeric" placeholder="Leave blank for #' + pad3(S.data.nextInvoiceNo) + '"></label>' : '') + '</div>') +
    '<div id="lines"></div><button class="btn quiet block" id="addLine">+ Add another job</button>' +
    '<label class="f" style="margin-top:14px"><span>Note printed on the invoice (optional)</span><textarea id="iNotes">' + v(inv.notes) + '</textarea></label>' +
    '<label class="f"><span>Private notes (never printed)</span><textarea id="iPriv">' + v(inv.internalNotes) + '</textarea></label>' +
    '<div class="sbar"><div><span class="small muted">' + (mode === 'quote' ? 'Quote' : 'Invoice') + ' total</span><b class="fig" id="iTotal"></b></div><button class="btn gold" id="sheetGo2">Save ' + (mode === 'quote' ? 'quote' : 'invoice') + '</button></div>' +
    datalist('routes', allRoutes) + datalist('loads', allLoads);
  openSheet(mode === 'quote' ? (editing ? 'Edit ' + quoteNo(inv) : 'New quote') : (editing ? 'Edit ' + invNo(inv) : 'New invoice'), h, 'Save');

  function receiptPick(l, i) {
    return l._fuelFile
      ? '<div class="rc-pick done">' + (l._fuelThumb ? '<img src="' + l._fuelThumb + '" alt="">' : icon('camera', 'gi-inline')) + '<span>Fuel receipt photo added</span><button type="button" class="btn link" data-rcrm="' + i + '" style="color:var(--danger)">Remove</button></div>'
      : '<label class="rc-pick">' + icon('camera', 'gi-inline') + '<span>Add fuel receipt photo</span><input type="file" accept="image/*" capture="environment" data-rcf="' + i + '" hidden></label>';
  }
  function costBox(l, i) {
    var cs = l.costs || {}; l._open = l._open || {};
    var legacy = l.id && l.date && l.date < DRIVER_RULE_FROM && origIds.indexOf(l.id) >= 0;
    var shown = COST_TYPES.slice(1).filter(function (c) { return num(cs[c[0]]) > 0 || l._open[c[0]]; });
    var hidden = COST_TYPES.slice(1).filter(function (c) { return shown.indexOf(c) < 0; });
    return '<div class="costbox"><div class="grp">Job costs · private, never printed</div>' +
      '<div class="cols"><label class="f"><span>Labour (EC$)</span><input data-c="labour" inputmode="decimal" value="' + v(cs.labour) + '"' + (l.id || cs.labour ? '' : ' data-auto="1"') + '></label>' +
      (drivers().length ? '<label class="f"><span>Crew member</span><select data-k="driverId">' + driverOpts(l.driverId) + '</select></label>' : '<span></span>') + '</div>' +
      shown.map(function (c) { return '<div class="copt"><label class="f"><span>' + c[1] + ' (EC$)</span><input data-c="' + c[0] + '" inputmode="decimal" value="' + v(cs[c[0]]) + '"></label><button type="button" class="btn link copt-rm" data-crm="' + c[0] + '" data-li="' + i + '" aria-label="Remove ' + c[1] + '">Remove</button></div>' +
        (c[0] === 'fuel' && mode !== 'quote' ? receiptPick(l, i) : ''); }).join('') +
      (hidden.length ? '<div class="cadd"><span class="small muted">Add a cost only if the business paid it:</span><div class="chips">' + hidden.map(function (c) { return '<button type="button" class="chip" data-cadd="' + c[0] + '" data-li="' + i + '">+ ' + c[1] + '</button>'; }).join('') + '</div></div>' : '') +
      '<label class="f"><span>Cost note (optional)</span><input data-k="costNote" value="' + v(l.costNote) + '" placeholder="e.g. customer supplied the blocks"></label>' +
      '<div class="contrib"><span>Job contribution after these costs</span><b data-contrib="' + i + '"></b></div></div>';
  }
  function drawLines() {
    $('lines').innerHTML = inv.lines.map(function (l, i) {
      var cs = l.costs || {};
      return '<div class="line-card" data-i="' + i + '"><div class="line-head"><b class="kicker">Job ' + (i + 1) + '</b>' +
        (inv.lines.length > 1 ? '<button class="btn link" data-rm="' + i + '">Remove</button>' : '') + '</div>' +
        '<div class="grp">When and where</div><div class="cols"><label class="f"><span>Job date</span><input type="date" data-k="date" value="' + v(l.date) + '"></label>' +
        '<label class="f"><span>Truck</span><select data-k="truck">' + truckOpts(l.truck || TRUCKS[0], ['Other']) + '</select></label></div>' +
        '<label class="f"><span>Area</span>' + routeSelect('data-route="sel"', l.route) + '</label>' + routeOther('data-route="other"', l.route) +
        '<label class="check' + (garbageLabel(rateFor(l.route)) ? '' : ' hidden') + '" data-garb-wrap><input type="checkbox" data-garb' + (l.garbage ? ' checked' : '') + '> <span data-garb-label>' + esc(garbageLabel(rateFor(l.route))) + '</span></label>' +
        '<div class="cols"><label class="f"><span>Type of work</span><select data-k="category">' + opts(WORK_TYPES, l.category || WORK_TYPES[0]) + '</select></label>' +
        '<label class="f"><span>Load</span>' + loadSelect('data-load="sel"', l.load) + '</label></div>' + loadOther('data-load="other"', l.load) +
        '<div class="grp">Wording on the ' + (mode === 'quote' ? 'quote' : 'invoice') + '</div><label class="f"><span>Line on ' + (mode === 'quote' ? 'quote' : 'invoice') + '</span><input data-k="title" value="' + v(l.title) + '" placeholder="e.g. Renovation, stage 2"></label>' +
        '<label class="f"><span>Extra detail on invoice (optional)</span><input data-k="detail" value="' + v(l.detail) + '" placeholder="e.g. Kitchen and two bathrooms"></label>' +
        '<div class="grp">Price</div><div class="cols"><label class="f"><span>Quantity</span><input data-k="qty" inputmode="decimal" value="' + v(l.qty || 1) + '"></label>' +
        '<label class="f"><span>Price each (EC$)</span><input data-k="price" inputmode="decimal" value="' + v(l.price) + '"' + (l.id ? '' : ' data-auto="1"') + '></label></div>' +
        costBox(l, i) + '</div>';
    }).join('');
    qa('[data-rm]', $('lines')).forEach(function (b) { b.onclick = function () { readLines(); inv.lines.splice(+b.dataset.rm, 1); drawLines(); }; });
    qa('[data-cadd]', $('lines')).forEach(function (b) { b.onclick = function () { readLines(); var l = inv.lines[+b.dataset.li]; l._open = l._open || {}; l._open[b.dataset.cadd] = true; drawLines(); var el = $('lines').querySelector('.line-card[data-i="' + b.dataset.li + '"] [data-c="' + b.dataset.cadd + '"]'); if (el) el.focus(); }; });
    qa('[data-crm]', $('lines')).forEach(function (b) { b.onclick = function () { readLines(); var l = inv.lines[+b.dataset.li]; l.costs[b.dataset.crm] = 0; if (l._open) delete l._open[b.dataset.crm]; if (b.dataset.crm === 'fuel') { delete l._fuelFile; delete l._fuelThumb; } drawLines(); }; });
    qa('[data-rcf]', $('lines')).forEach(function (inp) { inp.onchange = function () { var fl = inp.files[0]; if (!fl) return; if (fl.size > 15 * 1048576) return toast('That photo is too large.', true);
      readLines(); var l = inv.lines[+inp.dataset.rcf]; l._fuelFile = fl; shrinkImage(fl).then(function (d) { l._fuelThumb = d; drawLines(); }).catch(function () { drawLines(); }); }; });
    qa('[data-rcrm]', $('lines')).forEach(function (b) { b.onclick = function () { readLines(); var l = inv.lines[+b.dataset.rcrm]; delete l._fuelFile; delete l._fuelThumb; drawLines(); }; });
    qa('input,select', $('lines')).forEach(function (el) { el.addEventListener('input', function () { readLines(); total(); }); });
    qa('[data-k="price"], [data-c="driver"]', $('lines')).forEach(function (el) { el.addEventListener('input', function () { delete el.dataset.auto; }); });
    qa('[data-garb]', $('lines')).forEach(function (el) { el.addEventListener('change', function () {
      var card = el.closest('.line-card'), pr = card.querySelector('[data-k="price"]');
      pr.dataset.auto = '1';
      applyRate(card.querySelector('[data-route="sel"]').value, pr, null, el);
      readLines(); total();
    }); });
    qa('[data-route="sel"]', $('lines')).forEach(function (el) { el.addEventListener('change', function () {
      var card = el.closest('.line-card'), t = card.querySelector('[data-k="title"]');
      card.querySelector('[data-other-wrap]').classList.toggle('hidden', el.value !== 'Other');
      var gw = card.querySelector('[data-garb-wrap]'), gb = card.querySelector('[data-garb]'), gl = garbageLabel(rateFor(el.value));
      gw.classList.toggle('hidden', !gl); card.querySelector('[data-garb-label]').textContent = gl; if (!gl) gb.checked = false;
      applyRate(el.value, card.querySelector('[data-k="price"]'), card.querySelector('[data-c="driver"]'), gb);
      if (rateFor(el.value)) { var det = card.querySelector('details.costs'); if (det) det.open = true; }
      total();
      if (el.value === 'Other') card.querySelector('[data-route="other"]').focus();
      if (!t.value && el.value !== 'Other') t.value = routeTitle(el.value);
      readLines();
    }); });
    qa('[data-load="sel"]', $('lines')).forEach(function (el) { el.addEventListener('change', function () {
      var card = el.closest('.line-card');
      card.querySelector('[data-load-wrap]').classList.toggle('hidden', el.value !== 'Other');
      if (el.value === 'Other') card.querySelector('[data-load="other"]').focus();
      readLines();
    }); });
    qa('[data-route="other"]', $('lines')).forEach(function (el) { el.addEventListener('change', function () {
      var t = el.closest('.line-card').querySelector('[data-k="title"]');
      if (!t.value) t.value = routeTitle(el.value);
      readLines();
    }); });
    total();
  }
  function readLines() {
    qa('.line-card', $('lines')).forEach(function (card) {
      var l = inv.lines[+card.dataset.i]; l.costs = l.costs || {};
      qa('[data-k]', card).forEach(function (el) { l[el.dataset.k] = el.value; });
      qa('[data-c]', card).forEach(function (el) { l.costs[el.dataset.c] = el.value; });
      var rs = card.querySelector('[data-route="sel"]'), ro = card.querySelector('[data-route="other"]');
      if (rs) l.route = rs.value === 'Other' ? ro.value.trim() : rs.value;
      var gbx = card.querySelector('[data-garb]'); if (gbx) l.garbage = gbx.checked;
      var ls = card.querySelector('[data-load="sel"]'), lo = card.querySelector('[data-load="other"]');
      if (ls) l.load = ls.value === 'Other' ? lo.value.trim() : ls.value;
    });
  }
  function total() {
    $('iTotal').textContent = ec2(inv.lines.reduce(function (t, l) { return t + num(l.qty || 1) * num(l.price); }, 0));
    inv.lines.forEach(function (l, i) { var el = $('lines').querySelector('[data-contrib="' + i + '"]'); if (!el) return;
      var rev = num(l.qty || 1) * num(l.price), cost = COST_KEYS.reduce(function (t, k) { return t + num((l.costs || {})[k]); }, 0), c = rev - cost;
      el.textContent = ec2(c) + (rev ? '  (' + Math.round(c / rev * 100) + '%)' : ''); el.className = c < 0 ? 'neg' : ''; });
  }
  drawLines();
  $('sheetGo2').onclick = function () { S.tap = { el: $('sheetGo2'), at: Date.now() }; $('sheetGo').onclick(); };
  $('addLine').onclick = function () { readLines(); var last = inv.lines[inv.lines.length - 1]; var nl = blankLine(); nl.date = last.date; nl.truck = last.truck; inv.lines.push(nl); drawLines(); };
  $('cName').onchange = function () {
    var m = S.data.clients.find(function (x) { return x.name.toLowerCase() === this.value.trim().toLowerCase(); }, this);
    if (m) { if (!$('cPhone').value) $('cPhone').value = m.phone || ''; if (!$('cEmail').value) $('cEmail').value = m.email || ''; if (!$('cAddr').value) $('cAddr').value = m.address || ''; }
  };
  $('sheetGo').onclick = function () {
    readLines();
    var name = $('cName').value.trim();
    var match = S.data.clients.find(function (x) { return x.name.toLowerCase() === name.toLowerCase(); });
    var payload = { id: inv.id || null, no: $('iNo') ? $('iNo').value : '', bookingId: inv.bookingId || null, hireId: inv.hireId || null, issueDate: $('iDate').value, dueDate: $('iDue').value, notes: $('iNotes').value, internalNotes: $('iPriv').value,
      client: { id: match ? match.id : (editing && c.name && c.name.toLowerCase() === name.toLowerCase() ? c.id : undefined), name: name, phone: $('cPhone').value, email: $('cEmail').value, address: $('cAddr').value },
      lines: inv.lines.map(function (l) { return { id: l.id, date: l.date, truck: l.truck, route: l.route, category: l.category, load: l.load, title: l.title, detail: l.detail, qty: l.qty, price: l.price, costs: l.costs, costNote: l.costNote, driverId: l.driverId || '', garbage: l.garbage }; }) };
    var missing = -1;
    inv.lines.forEach(function (l, i) { var legacy = l.id && l.date && l.date < DRIVER_RULE_FROM && origIds.indexOf(l.id) >= 0; /* NV: no compulsory job cost */ });
    if (missing >= 0) {
      var din = $('lines').querySelector('.line-card[data-i="' + missing + '"] [data-c="driver"]');
      if (din) { din.classList.add('invalid'); din.scrollIntoView({ block: 'center', behavior: 'smooth' }); din.focus(); }
      toast('Enter the labour cost' + (inv.lines.length > 1 ? ' for job ' + (missing + 1) : '') + '. Every job has a labour cost.', true); return;
    }
    var action = mode === 'quote' ? 'saveQuote' : 'saveInvoice';
    var body = mode === 'quote' ? { quote: Object.assign(payload, { validUntil: payload.dueDate }) } : { invoice: payload };
    api(action, body, 'Saving…').then(function (res) {
      closeSheet();
      if (res.queued) { go(mode === 'quote' ? 'invoices' : 'dashboard'); return; }
      if (mode === 'quote') { toast(editing ? 'Quote updated.' : 'Quote Q' + pad3(res.result.no) + ' created.'); go('quote', res.result.id, editing); return; }
      var pics = inv.lines.map(function (l, k) { return { l: l, k: k }; }).filter(function (x) { return x.l._fuelFile && num((x.l.costs || {}).fuel) > 0; });
      var done = function (n) { toast((editing ? 'Invoice updated' : 'Invoice #' + pad3(res.result.no) + ' created') + (n ? ' with ' + n + ' fuel receipt' + (n === 1 ? '' : 's') + '.' : '.')); go('invoice', res.result.id, editing); };
      if (!pics.length || window.PREVIEW) return done(0);
      pics.reduce(function (p, x) { return p.then(function (n) {
        return (x.l._fuelThumb ? Promise.resolve(x.l._fuelThumb) : shrinkImage(x.l._fuelFile)).then(function (data) {
          return api('uploadFile', { target: { kind: 'invoice', id: res.result.id }, file: { name: 'Fuel receipt ' + (x.l.date || today()) + (pics.length > 1 ? ' job ' + (x.k + 1) : '') + '.jpg', type: 'image/jpeg', data: data, docType: 'Fuel receipt' } }, 'Saving receipt…');
        }).then(function () { return n + 1; });
      }); }, Promise.resolve(0)).then(done).catch(function () { toast('Invoice saved, but a receipt photo did not upload. Add it from the invoice.', true); go('invoice', res.result.id, editing); });
    }).catch(function () {});
  };
}
/* ---- standard route prices ---- */
function rateFor(route) { return ((S.data.settings && S.data.settings.routeRates) || []).find(function (r) { return r.route === route; }) || null; }
function garbageLabel(r) { return r && r.garbagePrice ? 'Return with garbage (EC$' + F0.format(r.garbagePrice) + ')' : ''; }
/** Fill price and driver fee from the rate card, unless someone has typed their own figure. */
function applyRate(route, priceEl, driverEl, garbageEl) {
  var r = rateFor(route);
  if (!r) {
    // No standard price for this route: clear figures the app filled in, so they get typed in.
    if (priceEl && priceEl.dataset.auto === '1') priceEl.value = '';
    if (driverEl && driverEl.dataset.auto === '1') driverEl.value = '';
    return;
  }
  var price = garbageEl && garbageEl.checked && r.garbagePrice ? r.garbagePrice : r.price;
  if (priceEl && price && (priceEl.dataset.auto === '1' || !priceEl.value)) { priceEl.value = price; priceEl.dataset.auto = '1'; }
  if (driverEl && r.labour && (driverEl.dataset.auto === '1' || !driverEl.value)) { driverEl.value = r.labour; driverEl.dataset.auto = '1'; }
}
function blankLine() { return { date: today(), truck: 'Skip truck', route: '', category: WORK_TYPES[0], load: '', title: '', detail: '', qty: 1, price: S.data.settings.defaultPrice || '', costs: {} }; }

/* ---- PDFs: invoice, quote, receipt, statement ---- */
function logoData() {
  if (S.logo) return Promise.resolve(S.logo);
  return fetch('/logo-soft.png').then(function (r) { return r.blob(); }).then(function (b) {
    return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { S.logo = fr.result; res(S.logo); }; fr.readAsDataURL(b); });
  });
}
function safeName(t) { return String(t).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
/**
 * o = { title, number, meta:[lines], stamp, to:{name, lines}, rows:[{title, sub, qty, price, amount}], cols:[4 headings],
 *       totals:[[label, value, strong]], sections:[[heading, [lines]]], filename }
 */
function buildPdf(o) {
  if (!window.jspdf) { toast('The PDF tool is still loading. Try again in a moment.', true); return Promise.reject(new Error('jspdf missing')); }
  return logoData().then(function (logo) {
    var s = o.brand === 'cozy' ? cozyDocSettings() : S.data.settings;
    var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
    var clean = function (t) { return String(t == null ? '' : t).replace(/→/g, 'to').replace(/·/g, '|').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x00-\xFF]/g, ''); };
    var rawText = doc.text.bind(doc), rawSplit = doc.splitTextToSize.bind(doc);
    doc.text = function (t, x, y, op) { return rawText(Array.isArray(t) ? t.map(clean) : clean(t), x, y, op); };
    doc.splitTextToSize = function (t, w2) { return rawSplit(clean(t), w2); };
    var W = 595.28, H = 841.89, M = 46;
    var NAVY = o.brand === 'cozy' ? [1, 45, 35] : [20, 20, 20], GOLD = o.brand === 'cozy' ? [212, 169, 75] : [197, 163, 90], INK = [27, 35, 51], MUTED = [107, 117, 136], RULE = [221, 226, 234], TINT = [244, 246, 250];
    var fill = function (c) { doc.setFillColor(c[0], c[1], c[2]); }, color = function (c) { doc.setTextColor(c[0], c[1], c[2]); };
    fill(NAVY); doc.rect(0, 0, W, 150, 'F'); fill(GOLD); doc.rect(0, 150, W, 4, 'F');
    if (o.brand === 'cozy' && typeof COZY_LOGO === 'string' && COZY_LOGO) doc.addImage(COZY_LOGO, 'PNG', M - 6, 10, 134, 134);
    else if (o.brand === 'cozy') { doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(255, 255, 255); doc.text(String(s.businessName).toUpperCase(), M, 70); doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(212, 169, 75); doc.text('Apartments for long and short stays', M, 90); }
    else if (S.data.settings.docShowLogo !== false) doc.addImage(logo, 'PNG', M - 6, 10, 134, 134);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(o.title.length > 9 ? 24 : 30); doc.setTextColor(255, 255, 255); doc.text(o.title, W - M, 72, { align: 'right' });
    doc.setFontSize(12); color(GOLD); if (o.number) doc.text(o.number, W - M, 94, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(201, 210, 227);
    (o.meta || []).forEach(function (m, i) { doc.text(m, W - M, 112 + i * 14, { align: 'right' }); });
    if (o.stamp) { doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 140, 140); doc.text(o.stamp, W - M, 145, { align: 'right' }); }
    var y = 196;
    function block(x, label, name, lines) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); color(MUTED); doc.text(label, x, y);
      doc.setFontSize(12.5); color(INK); doc.text(name, x, y + 20);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
      var yy = y + 38; lines.forEach(function (l) { doc.splitTextToSize(l, 230).forEach(function (t) { doc.text(t, x, yy); yy += 14; }); });
      return yy;
    }
    var fromLines = [s.phone, s.whatsapp ? s.whatsapp + ' (WhatsApp)' : '', s.email, s.website ? String(s.website).replace(/^https?:\/\//, '').replace(/\/$/, '') : ''].concat((s.address || '').split('\n')).filter(Boolean);
    var y1 = block(M, 'FROM', s.businessName, fromLines), y2 = block(W / 2 + 10, o.toLabel || 'BILL TO', o.to.name, o.to.lines.filter(Boolean));
    y = Math.max(y1, y2) + 22;
    var cols = o.cols || ['Description', 'Qty', 'Price (XCD)', 'Amount (XCD)'];
    var cQty = W - M - 215, cPrice = W - M - 85, cAmt = W - M;
    function tableHead() {
      fill(NAVY); doc.rect(M, y, W - 2 * M, 26, 'F'); doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
      doc.text(cols[0], M + 12, y + 17); if (cols[1]) doc.text(cols[1], cQty - 10, y + 17, { align: 'right' });
      if (cols[2]) doc.text(cols[2], cPrice - 10, y + 17, { align: 'right' }); doc.text(cols[3], cAmt - 12, y + 17, { align: 'right' }); y += 26;
    }
    tableHead();
    o.rows.forEach(function (r) {
      var subLines = r.sub ? doc.splitTextToSize(r.sub, cQty - M - 40) : [];
      var hgt = 30 + subLines.length * 13;
      if (y + hgt > H - 200) { doc.addPage(); y = 60; tableHead(); }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); color(INK); doc.text(doc.splitTextToSize(r.title, cQty - M - 40)[0], M + 12, y + 20);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); color(MUTED); if (subLines.length) doc.text(subLines, M + 12, y + 35);
      doc.setFontSize(10); color(INK);
      if (r.qty != null) doc.text(String(r.qty), cQty - 10, y + 20, { align: 'right' });
      if (r.price != null) doc.text(r.price, cPrice - 10, y + 20, { align: 'right' });
      doc.text(r.amount, cAmt - 12, y + 20, { align: 'right' });
      y += hgt; doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.8); doc.line(M, y, W - M, y);
    });
    if (y > H - 230) { doc.addPage(); y = 60; }
    var tx = W - M - 215; y += 26;
    o.totals.forEach(function (t, i) {
      var last = i === o.totals.length - 1;
      if (last) {
        fill(TINT); doc.rect(tx - 10, y - 13, W - M - tx + 10, 32, 'F'); fill(GOLD); doc.rect(tx - 10, y - 13, 3, 32, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); color(NAVY); doc.text(t[0], tx, y + 6); doc.text(t[1], W - M - 12, y + 6, { align: 'right' }); y += 40;
      } else { doc.setFont('helvetica', 'normal'); doc.setFontSize(10); color(t[2] ? INK : MUTED); doc.text(t[0], tx, y); doc.text(t[1], W - M - 12, y, { align: 'right' }); y += 20; }
    });
    y += 20;
    (o.sections || []).forEach(function (sec) {
      if (y > H - 120) { doc.addPage(); y = 60; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8); color(MUTED); doc.text(sec[0], M, y); y += 18;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); color(INK);
      sec[1].filter(Boolean).forEach(function (t) { doc.splitTextToSize(t, W - 2 * M).forEach(function (ln) { doc.text(ln, M, y); y += 14; }); });
      y += 10;
    });
    if (s.invoiceNote && o.smallPrint !== false) { doc.setFontSize(8.5); color(MUTED); doc.text(doc.splitTextToSize(s.invoiceNote, W - 2 * M), M, y); }
    var pages = doc.getNumberOfPages();
    for (var p = 1; p <= pages; p++) {
      doc.setPage(p); doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.line(M, H - 58, W - M, H - 58);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); color(MUTED);
      // Footer: the reference and page number on the right; the footer line and website on the left, wrapped so they never run into it
      var ref = (o.footerRef || '') + '   ' + p + ' of ' + pages, refW = doc.getTextWidth(ref), room = W - 2 * M - refW - 28;
      var site = s.website ? String(s.website).replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
      var left = (s.tagline ? doc.splitTextToSize(s.tagline, room) : []).concat(site ? [site] : []);
      doc.text(ref, W - M, H - 44, { align: 'right' });
      left.forEach(function (ln, k) { doc.text(ln, M, H - 44 + k * 11); });
    }
    return new File([doc.output('blob')], o.filename, { type: 'application/pdf' });
  });
}
function cozyDocSettings() { var b = S.data.settings, c = aS(); return Object.assign({}, b, { businessName: c.name, phone: c.phone, whatsapp: c.whatsapp, email: c.email, address: c.address || b.address, website: '' }); }
function payLines(ref) {
  var s = S.data.settings;
  return ['Bank: ' + s.bankName, 'Account name: ' + s.accountName, 'Account number: ' + s.accountNumber, ref ? 'Please use ' + ref + ' as the payment reference.' : ''];
}
function lineRows(lines) {
  return lines.map(function (l) {
    return { title: l.title, sub: [l.detail, (['Long-term rent', 'Short stay', 'Deposit deduction'].indexOf(l.category) >= 0 ? 'Date ' : 'Job date ') + longDate(l.date)].filter(Boolean).join('\n'), qty: l.qty, price: '$' + F2.format(l.price), amount: '$' + F2.format(lineAmount(l)) };
  });
}
function contactLines(c) { return [c.phone, c.email].concat((c.address || '').split('\n')); }
function makePdf(inv) {
  var c = clientOf(inv), total = invTotal(inv), paid = invPaid(inv), bal = invBalance(inv);
  var st0 = S.data.settings;
  return buildPdf({ brand: isCozyInv(inv) ? 'cozy' : '', title: 'INVOICE', number: invNo(inv), meta: ['Issued ' + longDate(inv.issueDate)].concat(st0.docShowTerms !== false ? ['Due ' + longDate(inv.dueDate)] : []), stamp: inv.void ? 'CANCELLED' : (bal <= 0.009 ? 'PAID' : ''),
    to: { name: c.name, lines: contactLines(c) }, rows: lineRows(inv.lines),
    totals: [['Subtotal', '$' + F2.format(total), true], ['Paid', '$' + F2.format(paid)], ['Balance due', 'EC$' + F2.format(inv.void ? 0 : bal)]],
    sections: (st0.docShowBank !== false ? [['PAYMENT INSTRUCTIONS', payLines('invoice number ' + invNo(inv))]] : []).concat(inv.notes ? [['NOTES', [inv.notes]]] : []),
    footerRef: 'Inv. ' + invNo(inv), filename: 'Invoice-' + pad3(inv.no) + '-' + safeName(c.name) + '.pdf' });
}
function quoteNo(q) { return 'Q' + pad3(q.no); }
function quoteTotal(q) { return round2(q.lines.reduce(function (t, l) { return t + lineAmount(l); }, 0)); }
function quotePdf(q) {
  var c = clientOf(q);
  return buildPdf({ title: 'QUOTE', number: quoteNo(q), meta: ['Issued ' + longDate(q.issueDate), 'Valid until ' + longDate(q.validUntil)], toLabel: 'PREPARED FOR',
    to: { name: c.name, lines: contactLines(c) }, rows: q.lines.map(function (l) { return { title: l.title, sub: l.detail, qty: l.qty, price: '$' + F2.format(l.price), amount: '$' + F2.format(lineAmount(l)) }; }),
    totals: [['Quoted total', 'EC$' + F2.format(quoteTotal(q))]],
    sections: [['ABOUT THIS QUOTE', ['Prices are in Eastern Caribbean Dollars and are valid until ' + longDate(q.validUntil) + '.', 'Subcontractors and the cost of materials are not included unless listed above.', 'To accept, reply to this message or call ' + S.data.settings.phone + '.']]].concat(q.notes ? [['NOTES', [q.notes]]] : []),
    footerRef: 'Quote ' + quoteNo(q), filename: 'Quote-' + pad3(q.no) + '-' + safeName(c.name) + '.pdf' });
}
function receiptPdf(inv, p) {
  var c = clientOf(inv), bal = invBalance(inv);
  return buildPdf({ brand: isCozyInv(inv) ? 'cozy' : '', title: 'RECEIPT', number: invNo(inv), meta: ['Payment received ' + longDate(p.date), 'Method: ' + p.method], toLabel: 'RECEIVED FROM',
    to: { name: c.name, lines: contactLines(c) }, cols: ['Description', '', '', 'Amount (XCD)'],
    rows: [{ title: 'Payment towards invoice ' + invNo(inv), sub: [p.note, 'Invoice total ' + ec2(invTotal(inv))].filter(Boolean).join('\n'), amount: '$' + F2.format(p.amount) }],
    totals: [['Amount received', '$' + F2.format(p.amount), true], ['Balance remaining', 'EC$' + F2.format(bal)]],
    sections: [['THANK YOU', [bal <= 0.009 ? 'Invoice ' + invNo(inv) + ' is now paid in full.' : 'The remaining balance on invoice ' + invNo(inv) + ' is ' + ec2(bal) + '.']]], smallPrint: false,
    footerRef: 'Receipt ' + invNo(inv), filename: 'Receipt-' + pad3(inv.no) + '-' + p.date + '.pdf' });
}
function openInvoicesFor(clientId) {
  return liveInvoices().filter(function (i) { return i.clientId === clientId && invBalance(i) > 0.009; }).sort(function (a, b) { return a.issueDate < b.issueDate ? -1 : 1; });
}
function statementPdf(c) {
  var open = openInvoicesFor(c.id), total = open.reduce(function (t, i) { return t + invBalance(i); }, 0);
  var aged = { '0-30 days': 0, '31-60 days': 0, '61-90 days': 0, 'Over 90 days': 0 };
  open.forEach(function (i) { var d = daysBetween(i.issueDate, today()); aged[d <= 30 ? '0-30 days' : d <= 60 ? '31-60 days' : d <= 90 ? '61-90 days' : 'Over 90 days'] += invBalance(i); });
  return buildPdf({ title: 'STATEMENT', number: c.name.length > 26 ? '' : '', meta: ['As at ' + longDate(today()), open.length + ' open ' + (open.length === 1 ? 'invoice' : 'invoices')],
    to: { name: c.name, lines: contactLines(c) }, toLabel: 'ACCOUNT', cols: ['Invoice', 'Days', 'Total', 'Balance (XCD)'],
    rows: open.map(function (i) { return { title: 'Invoice ' + invNo(i) + ' - ' + longDate(i.issueDate), sub: i.lines.map(function (l) { return l.title; }).join(', ') + (invPaid(i) ? '\nPaid so far ' + ec2(invPaid(i)) : ''),
      qty: daysBetween(i.issueDate, today()), price: '$' + F2.format(invTotal(i)), amount: '$' + F2.format(invBalance(i)) }; }),
    totals: Object.keys(aged).filter(function (k) { return aged[k] > 0; }).map(function (k) { return [k, '$' + F2.format(aged[k])]; }).concat([['Total owed', 'EC$' + F2.format(total)]]),
    sections: [['PAYMENT INSTRUCTIONS', payLines('the invoice numbers')]], footerRef: 'Statement ' + safeName(c.name),
    filename: 'Statement-' + safeName(c.name) + '-' + today() + '.pdf' });
}
/** Share a file through the phone's share sheet (WhatsApp, Mail, Outlook…), with a fallback. */
function shareFile(file, title, onShared) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    return navigator.share({ files: [file], title: title }).then(function () { if (onShared) onShared(); }).catch(function () {});
  }
  var url = URL.createObjectURL(file); var a = document.createElement('a'); a.href = url; a.download = file.name; a.target = '_blank';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 30000);
  toast('Sharing is not available here, so the file was downloaded instead.');
}
function pdfSheet(title, maker, contact, onShared) {
  busy('Preparing PDF…');
  maker().then(function (file) {
    busy(null);
    openSheet(title, '<p class="muted">Tap below, then choose WhatsApp, Mail or Outlook. The PDF is attached for you.</p>' +
      (contact && contact.phone ? '<p>WhatsApp: <b>' + esc(contact.phone) + '</b></p>' : '') +
      (contact && contact.email ? '<p>Email: <b>' + esc(contact.email) + '</b> <button class="btn link" id="cpEmail">Copy</button></p>' : '') +
      '<button class="btn gold block" id="shareNow">Share PDF</button>');
    if ($('cpEmail')) $('cpEmail').onclick = function () { navigator.clipboard && navigator.clipboard.writeText(contact.email).then(function () { toast('Email address copied.'); }); };
    $('shareNow').onclick = function () { shareFile(file, title, function () { closeSheet(); if (onShared) onShared(); }); };
  }).catch(function (e) { busy(null); if (e && e.message !== 'jspdf missing') toast('Could not create the PDF.', true); });
}
function sendPdf(inv) {
  pdfSheet('Send ' + invNo(inv), function () { return makePdf(inv); }, clientOf(inv), function () {
    api('markSent', { invoiceId: inv.id, via: 'Shared PDF' }).then(function () { render(); }).catch(function () {});
  });
}
/** Send Reminder: choose WhatsApp or Email, preview and edit the message. Logged as prepared, never as delivered. */
function sendReminder(inv) {
  var c = clientOf(inv), ch = c.phone ? 'wa' : c.email ? 'mail' : 'wa';
  var draw = function () {
    var need = ch === 'wa' ? !c.phone : !c.email;
    openSheet('Send Reminder · ' + invNo(inv),
      '<p class="small muted" style="margin-top:0">' + esc(c.name) + ' · ' + ec2(invBalance(inv)) + ' outstanding</p>' +
      '<div class="seg" style="margin-bottom:10px"><button data-rch="wa" aria-pressed="' + (ch === 'wa') + '">WhatsApp</button><button data-rch="mail" aria-pressed="' + (ch === 'mail') + '">Email</button></div>' +
      (need ? '<div class="alert">No ' + (ch === 'wa' ? 'phone number' : 'email address') + ' is saved for ' + esc(c.name) + '. Add it here and it is saved to the customer.</div><label class="f"><span>' + (ch === 'wa' ? 'WhatsApp number (with country code)' : 'Email address') + '</span><input id="rcC" ' + (ch === 'wa' ? 'inputmode="tel" placeholder="+1 784 …"' : 'type="email"') + '></label>'
        : '<p class="small">To: <b>' + esc(ch === 'wa' ? c.phone : c.email) + '</b></p>') +
      '<label class="f"><span>Message preview (you can edit it)</span><textarea id="rcT" rows="9">' + esc(reminderText(inv)) + '</textarea></label>' +
      '<p class="small muted">This opens ' + (ch === 'wa' ? 'WhatsApp' : 'your email app') + ' with the message ready. The invoice records that a reminder was prepared; the app cannot confirm it was delivered.</p>', ch === 'wa' ? 'Open WhatsApp' : 'Open email');
    qa('[data-rch]').forEach(function (b) { b.onclick = function () { ch = b.dataset.rch; draw(); }; });
    $('sheetGo').onclick = function () {
      var txt = $('rcT').value, go2 = function () {
        if (ch === 'wa') window.open(waLink(c.phone, txt), '_blank');
        else window.location.href = 'mailto:' + encodeURIComponent(c.email) + '?subject=' + encodeURIComponent('Payment reminder: invoice ' + invNo(inv)) + '&body=' + encodeURIComponent(txt);
        api('markSent', { invoiceId: inv.id, via: 'Reminder prepared (' + (ch === 'wa' ? 'WhatsApp' : 'Email') + ')' }).then(function () { closeSheet(); toast('Reminder prepared and logged.'); render(); }).catch(function () {});
      };
      if (need) { var v = $('rcC').value.trim(); if (!v) return toast('Enter the ' + (ch === 'wa' ? 'number' : 'email address') + '.', true);
        var upd = { id: c.id, name: c.name, phone: ch === 'wa' ? v : c.phone, email: ch === 'mail' ? v : c.email, address: c.address, notes: c.notes };
        api('saveClient', { client: upd }, 'Saving contact…').then(function () { c = clientOf(inv); go2(); }).catch(function () {}); }
      else go2();
    };
  };
  draw();
}
function waLink(phone, text) { return 'https://wa.me/' + String(phone || '').replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(text); }
function reminderText(inv) {
  var c = clientOf(inv), s = S.data.settings, bal = invBalance(inv), days = daysBetween(inv.dueDate, today());
  return 'Good day ' + c.name.split(' ')[0] + ', this is ' + s.businessName + '. A friendly reminder that invoice ' + invNo(inv) + ' (' + nice(inv.issueDate) + ') has ' + ec2(bal) + ' outstanding' +
    (days > 0 ? ', ' + days + (days === 1 ? ' day' : ' days') + ' past its due date' : ', due ' + nice(inv.dueDate)) + '.\n\nPayment details:\n' + s.bankName + '\nAccount name: ' + s.accountName + '\nAccount number: ' + s.accountNumber +
    '\nReference: ' + invNo(inv) + '\n\nThank you.';
}
function statementText(c) {
  var open = openInvoicesFor(c.id), total = open.reduce(function (t, i) { return t + invBalance(i); }, 0), s = S.data.settings;
  return 'Good day ' + c.name.split(' ')[0] + ', this is ' + s.businessName + '. Our records show ' + open.length + (open.length === 1 ? ' invoice' : ' invoices') + ' open on your account, totalling ' + ec2(total) + ':\n' +
    open.map(function (i) { return invNo(i) + ' (' + nice(i.issueDate) + '): ' + ec2(invBalance(i)); }).join('\n') +
    '\n\nPayment details:\n' + s.bankName + '\nAccount name: ' + s.accountName + '\nAccount number: ' + s.accountNumber + '\n\nA statement PDF can be sent on request. Thank you.';
}

/* ==================== log (all jobs and expenses) ==================== */
VIEWS.log = function () {
  var f = facts(), r = periodRange(S.period), q = S.logSearch.toLowerCase();
  var items = [];
  if (S.logFilter !== 'expenses') f.jobs.forEach(function (j) { items.push({ kind: 'job', date: j.date, t: j.title || j.route, m: j.client + ' · ' + [j.route, j.load, j.truck].filter(Boolean).join(' · '), amount: j.amount, net: j.amount - j.cost, truck: j.truck, ref: j.inv.id }); });
  if (S.logFilter !== 'jobs') S.data.expenses.forEach(function (e) { items.push({ kind: 'exp', date: e.date, t: e.description, m: e.category + ' · ' + (e.truck || ''), amount: -e.amount, truck: e.truck, ref: e.id, void: !!e.void }); });
  items = items.filter(function (i) {
    if (!within(i.date, r.from, r.to)) return false;
    if (S.logTruck !== 'all' && i.truck !== S.logTruck) return false;
    return !q || (i.t + ' ' + i.m).toLowerCase().indexOf(q) >= 0;
  }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  var s = summarise(f, r.from, r.to);
  var h = periodControl(render) +
    '<div class="tiles"><div class="tile"><div class="label">Income</div><div class="fig">' + ec(s.income) + '</div></div><div class="tile"><div class="label">Job costs</div><div class="fig">' + ec(s.jobCosts) + '</div></div>' +
    '<div class="tile"><div class="label">Running expenses</div><div class="fig">' + ec(s.overheads) + '</div></div><div class="tile accent"><div class="label">Net profit</div><div class="fig ' + (s.net < 0 ? 'neg' : '') + '">' + ec(s.net) + '</div></div></div>' +
    '<div class="toolbar"><input type="search" id="lq" placeholder="Search" value="' + esc(S.logSearch) + '"><select id="lt" style="width:auto">' +
    [['all', 'Both trucks']].concat(TRUCKS.map(function (t) { return [t, t]; })).map(function (o) { return '<option value="' + o[0] + '"' + (S.logTruck === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
    '<div class="toolbar">' + [['all', 'Everything'], ['jobs', 'Jobs'], ['expenses', 'Expenses']].map(function (c) { return '<button class="chip" data-lf="' + c[0] + '" aria-pressed="' + (S.logFilter === c[0]) + '">' + c[1] + '</button>'; }).join('') +
    '<button class="chip" id="addExp">+ Expense</button></div>' +
    '<div class="card flush"><ul class="list">' + (items.length ? items.slice(0, 400).map(function (i) {
      return '<li><button class="row-btn" data-kind="' + i.kind + '" data-ref="' + i.ref + '"><span class="t">' + esc(i.t) + (i.void ? ' <span class="pill Cancelled">Cancelled</span>' : '') + '</span>' +
        '<span class="a ' + (i.amount < 0 ? 'neg' : '') + '">' + (i.amount < 0 ? '−' : '+') + ec2(Math.abs(i.amount)).replace('-', '') + '</span>' +
        '<span class="m">' + nice(i.date) + ' · ' + esc(i.m) + '</span><span class="m">' + (i.kind === 'job' ? 'net ' + ec(i.net) : 'expense') + '</span></button></li>'; }).join('') : '<li class="empty">Nothing recorded in this period.</li>') + '</ul></div>';
  $('view').innerHTML = h;
  qa('[data-lf]').forEach(function (b) { b.onclick = function () { S.logFilter = b.dataset.lf; render(); }; });
  $('lt').onchange = function () { S.logTruck = this.value; render(); };
  $('lq').oninput = function () { S.logSearch = this.value; var pos = this.selectionStart; render(); var el = $('lq'); el.focus(); el.setSelectionRange(pos, pos); };
  $('addExp').onclick = function () { expenseEditor(); };
  qa('[data-kind]').forEach(function (b) { b.onclick = function () {
    if (b.dataset.kind === 'job') go('invoice', b.dataset.ref);
    else { var e = S.data.expenses.find(function (x) { return x.id === b.dataset.ref; }); if (e && !e.void) expenseEditor(e); }
  }; });
};

function expenseCats() { var c = S.data.settings.expenseCategories; return c && c.length ? c : EXPENSE_TYPES; }
function expenseEditor(e, onSaved) {
  var epf = pendingFiles('ePF');
  var editing = !!(e && e.id); e = Object.assign({ date: today(), truck: TRUCKS[0], category: 'Fuel', method: 'Cash' }, e || {});
  var elocked = editing && isLocked(e.date);
  openSheet(editing ? 'Edit expense' : 'New expense',
    (elocked ? '<div class="alert">' + icon('lock', 'gi-inline') + ' This expense is in ' + esc(ymName(e.date.slice(0, 7))) + ', which is closed, so it can no longer be changed. Reopen the month under Manage, Month-End if a correction is needed.</div>' : '') +
    '<div class="cols"><label class="f"><span>Date</span><input id="ed" type="date" value="' + v(e.date) + '"></label>' +
    '<label class="f"><span>Truck</span><select id="et">' + truckOpts(e.truck, ['Both trucks']) + '</select></label></div>' +
    '<label class="f"><span>Type of cost</span><select id="ec">' + opts(expenseCats(), e.category) + '</select></label>' +
    '<label class="f"><span>What was it for?</span><input id="ex" value="' + v(e.description) + '" placeholder="Brake discs, 6-month insurance…"></label>' +
    '<label class="f' + (MAINT.indexOf(e.category) >= 0 ? '' : ' hidden') + '" id="eDw"><span>Days the truck was off the road (optional)</span><input id="eD" inputmode="numeric" value="' + v(e.daysOff || '') + '" placeholder="0"></label>' +
    '<div class="cols"><label class="f"><span>Amount (EC$)</span><input id="ea" inputmode="decimal" value="' + v(e.amount) + '"></label>' +
    '<label class="f"><span>Paid by</span><select id="em">' + opts(METHODS, e.method) + '</select></label></div>' +
    '<label class="f"><span>Who paid</span><select id="ep">' + payerOpts(e.paidBy) + '</select></label>' +
    '<label class="f"><span>Notes</span><textarea id="en">' + v(e.notes) + '</textarea></label>' +
    '<p class="small muted">One-off purchases for setting up a truck belong under Equipment costs, so they count towards recovery instead of monthly profit.</p>' +
    fundedFrom(e) + (editing ? attachmentsCard('Receipts and photos', e.attachments, !elocked) + (elocked ? '' : '<button class="btn danger block" id="eVoid">Cancel this expense</button>') : epf.html), 'Save');
  epf.bind(); bindFunded();
  if (editing) bindAttachments({ kind: 'expense', id: e.id }, e.attachments);
  $('ec').addEventListener('change', function () { $('eDw').classList.toggle('hidden', MAINT.indexOf(this.value) < 0); });
  if (elocked) { $('sheetGo').remove(); return; }
  $('sheetGo').onclick = function () {
    api('saveExpense', { expense: { biz: e.biz || (S.biz === 'cozy' ? 'cozy' : 'nv'), id: e.id, date: $('ed').value, truck: $('et').value, category: $('ec').value, description: $('ex').value, amount: $('ea').value, method: $('em').value, paidBy: $('ep').value, daysOff: $('eD') ? $('eD').value : 0, notes: $('en').value } }, 'Saving…')
      .then(function (res) { var id = e.id || (res && res.result && res.result.id);
        return (id ? epf.upload({ kind: 'expense', id: id }) : Promise.resolve(0)).then(function (n) { closeSheet(); if (onSaved && id && !e.id) return onSaved(id); toast('Expense saved' + (n ? ' with ' + n + (n === 1 ? ' file' : ' files') : '') + '.'); render(); })
          .catch(function () { closeSheet(); toast('Expense saved, but a file did not upload. Open the expense to add it.', true); render(); }); }).catch(function () {});
  };
  if ($('eVoid')) $('eVoid').onclick = function () { reasonPrompt('Cancel expense', 'It stays on record, marked cancelled, and stops counting towards totals.', function (why) {
    return api('voidExpense', { id: e.id, reason: why }, 'Saving…').then(function () { toast('Expense cancelled.'); render(); }); }); };
}

/* ==================== more ==================== */
VIEWS.more = function () {
  var owner = S.data.me.role === 'owner', drv = isDriver(), viewOnly = isViewOnly();
  var groups = drv ? [
    { title: 'Operations', sub: 'Jobs and the trucks', items: [
      ['bookings', 'calendar', 'Jobs', 'Booked and finished jobs'], ['fuel', 'fuel', 'Fuel & Mileage', 'Fill-ups and odometer'], ['projects', 'calendar', 'Projects', 'Site diary, photos and snags'], ['stays', 'key', 'Apartment Stays', 'Arrivals, departures and cleaning'], ['repairs', 'alarm', 'Apartment Repairs', 'Problems reported in the units'], ['bins', 'package', 'Skip Bins', 'Bins out, deliveries and collections'], ['hours', 'alarm', 'Engine Hours', 'Excavator hour meter and services'], ['reminders', 'alarm', 'Maintenance & Compliance', 'What is due on each truck']] }
  ] : [
    { title: 'Cozy Apartments', sub: 'Units, tenants, short stays and repairs', items: [
      ['apts', 'key', 'Apartments Overview', 'Who is in each unit, rent this month, arrears and deposits'],
      ['tenancies', 'file', 'Tenancies & Agreements', 'Long-term tenants, signed agreements and rent'],
      ['stays', 'calendar', 'Short Stays', 'Bookings, arrivals, departures and the two-week calendar'],
      ['repairs', 'alarm', 'Repairs', 'Problems reported in the units, fixed by NV Construction'],
      ['requests', 'user', 'Website Requests', 'Stay bookings and rental enquiries sent from the website'],
      ['channels', 'calendar', 'Booking Sites', 'Airbnb and Booking.com calendar links and payouts'],
      ['turnovers', 'checkc', 'Turnovers and Cleaning', 'Cleans between guests, with checklists'],
      ['notices', 'bell', 'Tenants and Notices', 'Payments tenants report, notices to all tenants, tenant app access'],
      ['payroll', 'wallet', 'Payroll', 'Cozy Apartments staff: pay, NIS, payslips and the bank file'],
      ['invoices', 'invoice', 'Rent and Stay Invoices', 'Everything billed by Cozy Apartments'],
      ['paysettings', 'money', 'How Customers Pay', 'Bank details for local and overseas payments, and cash'],
      ['aptsettings', 'sliders', 'Apartment Settings', 'Agreement terms, house rules, check-in times']] },
    { title: 'NV Construction', sub: 'Building, skip bins, equipment hire and the fleet', items: [
      ['bookings', 'calendar', 'Bookings & Jobs', 'Upcoming jobs and jobs reported by crew'],
      ['invoices', 'invoice', 'Invoices & Quotes', 'Everything billed by NV Construction'],
      ['requests', 'user', 'Website Enquiries', 'Building, skip bin and hire enquiries from the website'],
      ['payroll', 'wallet', 'Payroll', 'Crew and staff: pay, NIS, payslips and the BOSVG bank file'],
      ['projects', 'calendar', 'Building Projects', 'Residential and commercial builds: billing, costs, site diary'],
      ['bins', 'package', 'Skip Bins', 'Bins out, days on hire, collections due'],
      ['fleet', 'truck', 'Fleet Management', 'Vehicles, servicing, fuel and mileage'],
      ['hours', 'alarm', 'Engine Hours', 'Excavator hour meter and services due by hours'],
      ['driverpay', 'users', 'Crew & Pay', 'Labour earned, payments and what is owed']] },
    { title: 'Business Administration', sub: 'Capital, settings, people and records', items: [
      ['startup', 'pie', 'Equipment & Investment', 'What the trucks, machines and bins cost, and payback']]
      .concat(owner ? [['monthend', 'lock', 'Month-End', 'Check and close each month; reopen one if a correction is needed']] : [])
      .concat(owner ? [['settings', 'sliders', 'Business Settings', 'Company details, invoicing, areas and payment information'], ['users', 'shield', 'Team & Permissions', 'User accounts, roles and access rights'], ['access', 'users', 'Business Access', 'Who works in NV Construction, Cozy Apartments or both']] : [])
      .concat(viewOnly ? [] : [['data', 'archive', 'Data Management', owner ? 'Backups, import and export' : 'Export your records']])
      .concat([['activity', 'history', 'Activity Log', 'Business changes and who made them']]) }
  ];
  var acct = '<section class="mgroup acct"><div class="mg-head"><h2>Account &amp; Preferences</h2></div><ul class="list">' +
    [['notify', 'bell', 'Notifications', 'Reminders and alert preferences'], ['security', 'lock', 'Security', 'Face ID, password and account protection'], ['appearance', 'palette', 'Appearance', 'System, light and dark theme']].map(function (i) {
      return '<li><button class="row-btn" data-go="' + i[0] + '">' + tileIcon(i[1]) + '<span><span class="t">' + i[2] + '</span><br><span class="m">' + i[3] + '</span></span><span class="chev">›</span></button></li>'; }).join('') + '</ul>' +
    '<button class="acct-sync" id="syncStat">' + icon('sync', 'gi-inline') + '<span>Data sync status</span><span class="muted">View status</span></button>' +
    '<button class="acct-out" id="mOut">' + icon('signout', 'gi-inline') + ' Sign out</button></section>';
  $('view').innerHTML = groupMenu(groups) + acct;
  bindGo();
  $('mOut').onclick = function () { if (confirm('Sign out of NV Ops on this device?')) signOutLocal(); };
  $('syncStat').onclick = syncStatusSheet;
};

/* ---- hubs: Fleet Management, Data Management, Account & Security, Appearance ---- */
/** Connection and sync state, with a manual sync. */
function syncStatusSheet() {
  var q = lsGet('nv_queue', []) || [], last = S.lastLoad ? new Date(S.lastLoad) : null;
  openSheet('Data sync status',
    '<table><tbody><tr><td>Connection</td><td class="n">' + (S.offline || !navigator.onLine ? '<span class="neg">Offline</span>' : '<span class="pos">Online</span>') + '</td></tr>' +
    '<tr><td>Last updated</td><td class="n">' + (last ? last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ' at ' + last.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : 'This session') + '</td></tr>' +
    '<tr><td>Waiting to send</td><td class="n">' + (q.length ? '<b class="neg">' + q.length + (q.length === 1 ? ' record' : ' records') + '</b>' : 'Nothing') + '</td></tr></tbody></table>' +
    '<p class="small muted">Records saved while offline are kept on this device and sent automatically when the connection returns.</p>', 'Sync now');
  $('sheetGo').onclick = function () { api('load', {}, 'Syncing…').then(function () { S.lastLoad = Date.now(); closeSheet(); toast('Up to date.'); }).catch(function () {}); };
}
/* ==================== Fleet Management (N1 to N6) ==================== */
var DOC_TYPES = ['Insurance certificate', 'Vehicle licence', 'Registration certificate', 'Service invoice', 'Inspection report', 'Other'];
var SERVICE_TYPES = [['Service', 'Maintenance'], ['Repair', 'Repairs'], ['Tyres', 'Tyres'], ['Inspection', 'Maintenance'], ['Other work', 'Maintenance']];
function nextService(truck) {
  var odo = odometerOf(truck), rs = (S.data.reminders || []).filter(function (r) { return r.truck === truck && r.dueKm; }).sort(function (a, b) { return a.dueKm - b.dueKm; });
  return rs.length && odo ? { r: rs[0], left: rs[0].dueKm - odo } : null;
}
function fleetAttention(truck) {
  var t = today(), rem = (S.data.reminders || []).filter(function (r) { return r.truck === truck && ((r.due && r.due <= addDays(t, 14)) || (r.dueKm && odometerOf(truck) && r.dueKm - odometerOf(truck) <= 500)); });
  var inc = (S.data.incidents || []).filter(function (x) { return x.truck === truck && x.status !== 'Resolved'; });
  return rem.length + inc.length;
}
VIEWS.fleet = function () {
  var vs = vehicles().filter(function (v) { return v.active !== false; }), t = today(), m0 = t.slice(0, 8) + '01';
  var offN = vs.filter(function (v) { return unavailableOn(v.id, t); }).length, att = vs.filter(function (v) { return fleetAttention(v.id); }).length;
  var h = '<div class="mgrid" style="margin-bottom:12px"><div class="mcard"><span class="ml">Total trucks</span><b>' + vs.length + '</b></div><div class="mcard"><span class="ml">Available today</span><b class="pos">' + (vs.length - offN) + '</b></div>' +
    '<div class="mcard"><span class="ml">Off the road</span><b class="' + (offN ? 'neg' : '') + '">' + offN + '</b><span class="ms">Repairs or incidents</span></div><div class="mcard"><span class="ml">Attention needed</span><b class="' + (att ? 'neg' : '') + '">' + att + '</b><span class="ms">Admin due or open incidents</span></div></div>';
  h += '<div class="veh-grid">' + vs.map(function (v) {
    var off = unavailableOn(v.id, t), odo = odometerOf(v.id), ns = nextService(v.id), fuelM = (S.data.fuel || []).filter(function (x) { return x.truck === v.id && x.date >= m0; }).reduce(function (a, x) { return a + (x.cost || 0); }, 0);
    return '<button class="card veh-card" data-veh="' + esc(v.id) + '"><div class="veh-h"><div class="veh-ic">' + icon('truck', 'gi') + '</div><div><b>' + esc(v.id) + '</b><div class="small muted">' + esc(v.nickname || '') + (v.plate ? ' · ' + esc(v.plate) : '') + '</div></div><span class="pill ' + (off ? 'Overdue' : 'Paid') + '">' + (off ? 'Off the road' : 'Available') + '</span></div>' +
      '<div class="rt-c-row"><div><span class="small muted">Odometer</span><b>' + (odo ? F0.format(odo) + ' km' : '–') + '</b></div><div><span class="small muted">Fuel this month</span><b>' + ec(fuelM) + '</b></div><div><span class="small muted">Next service</span><b class="' + (ns && ns.left <= 500 ? 'neg' : '') + '">' + (ns ? F0.format(ns.left) + ' km' : 'Not set') + '</b></div></div>' +
      (fleetAttention(v.id) ? '<span class="small neg">' + fleetAttention(v.id) + ' item(s) need attention</span>' : '<span class="small muted">Nothing due in the next 14 days</span>') + '</button>'; }).join('') + '</div>';
  h += groupMenu([{ title: 'Fleet', sub: 'Keep the trucks legal, serviced and efficient', items: [
      ['reminders', 'alarm', 'Maintenance & Compliance', 'Renewals by date and services by mileage'],
      ['fuel', 'fuel', 'Fuel & Mileage', 'Fill-ups, receipts, fuel efficiency and odometer'],
      ['trucks', 'chart', 'Fleet Performance', 'Earnings, costs, utilisation and efficiency']] }]);
  // monthly fleet report (N6)
  var a0 = m0, a1 = t, rows = vs.map(function (v) { var km = kmIn(v.id, a0, a1), f = facts(), sm = summarise(f, a0, a1), jobs = sm.jobs.filter(function (j) { return j.truck === v.id; });
      var fuel = (S.data.fuel || []).filter(function (x) { return x.truck === v.id && x.date >= a0 && x.date <= a1; }).reduce(function (a, x) { return a + (x.cost || 0); }, 0);
      var maint = sm.exps.filter(function (e) { return e.truck === v.id && MAINT.indexOf(e.category) >= 0; }).reduce(function (a, e) { return a + e.amount; }, 0), down = 0;
      for (var d = a0; d <= a1; d = addDays(d, 1)) if (unavailableOn(v.id, d)) down++;
      return { v: v, km: km, fuel: fuel, maint: maint, trips: jobs.length, rev: jobs.reduce(function (a, j) { return a + j.amount; }, 0), down: down }; });
  h += '<div class="card"><h2>Fleet Report · ' + MONTH[parseIso(t).getMonth()] + ' so far</h2><div class="scroll-x"><table><thead><tr><th>Metric</th>' + rows.map(function (x) { return '<th class="n">' + esc(x.v.id) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    [['Distance', function (x) { return x.km ? F0.format(x.km) + ' km' : 'Unknown'; }], ['Fuel expenditure', function (x) { return ec(x.fuel); }], ['Maintenance', function (x) { return ec(x.maint); }], ['Completed jobs', function (x) { return x.trips; }],
     ['Revenue attributed', function (x) { return ec(x.rev); }], ['Fuel cost / km', function (x) { return x.km ? ec(x.fuel / x.km) : 'Unknown'; }], ['Downtime', function (x) { return x.down + ' days'; }]].map(function (m) { return '<tr><td>' + m[0] + '</td>' + rows.map(function (x) { return '<td class="n">' + m[1](x) + '</td>'; }).join('') + '</tr>'; }).join('') +
    '</tbody></table></div><p class="small muted">Costs come from the same fuel log and expense records used in the financial reports, so nothing is counted twice. Distance needs at least two odometer readings in the month.</p></div>';
  $('view').innerHTML = h; bindGo();
  qa('[data-veh]').forEach(function (b) { b.onclick = function () { go('vehicle', b.dataset.veh); }; });
};
S.vTab = 'overview';
VIEWS.vehicle = function () {
  var v = vehicles().find(function (x) { return x.id === S.param; });
  if (!v) { $('view').innerHTML = '<div class="card empty">Vehicle not found.</div>'; return; }
  $('title').textContent = v.id;
  var t = today(), odo = odometerOf(v.id), off = unavailableOn(v.id, t), ro = isViewOnly(), tab = S.vTab, f = facts();
  var h = '<div class="card"><div class="veh-h"><div class="veh-ic">' + icon('truck', 'gi') + '</div><div><b style="font-size:1.15rem">' + esc(truckName(v.id)) + '</b><div class="small muted">' + esc([v.make, v.model, v.year].filter(Boolean).join(' ') || '') + '</div></div><span class="pill ' + (off ? 'Overdue' : 'Paid') + '">' + (off ? 'Off the road' : 'Available') + '</span></div>' +
    '<div class="ins-chips tabs-row" style="margin-top:12px">' + [['overview', 'Overview'], ['service', 'Service'], ['docs', 'Documents'], ['incidents', 'Incidents'], ['jobs', 'Jobs & Costs']].map(function (o) { return '<button class="chip" data-vt="' + o[0] + '" aria-pressed="' + (tab === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
  if (tab === 'overview') {
    var days = []; for (var k = 0; k < 14; k++) days.push(addDays(t, k));
    var ns = nextService(v.id);
    h += '<div class="card"><h2>Identification</h2><table><tbody>' + [['Registration', v.plate || 'To be recorded'], ['Manufacturer', v.make || 'To be recorded'], ['Model', v.model || 'To be recorded'], ['Year', v.year || 'To be recorded'], ['VIN / chassis', v.vin || 'To be recorded'], ['Current odometer', odo ? F0.format(odo) + ' km (latest fuel entry)' : 'Not recorded'], ['Next service', ns ? F0.format(ns.r.dueKm) + ' km · ' + F0.format(ns.left) + ' km to go' : 'Not set']].map(function (r) { return '<tr><td>' + r[0] + '</td><td class="n">' + esc(String(r[1])) + '</td></tr>'; }).join('') + '</tbody></table>' +
      (S.data.me.role === 'owner' ? '<p class="small muted">Edit these under Business Settings → Vehicles.</p>' : '') + '</div>' +
      '<div class="card"><h2>Availability · next 14 days</h2><div class="avail">' + days.map(function (d) { var bk = (S.data.bookings || []).filter(function (b) { return b.truck === v.id && b.date === d && bkActive(b); }), u = unavailableOn(v.id, d);
        return '<span class="av av-' + (u ? 'off' : bk.length ? 'busy' : 'free') + '" title="' + nice(d) + '"><b>' + parseIso(d).getDate() + '</b><i>' + (u ? 'Off' : bk.length ? bk.length + ' job' : 'Free') + '</i></span>'; }).join('') + '</div><p class="small muted">From bookings, incidents and repair downtime; not from live tracking.</p></div>' +
      (ro ? '' : '<div class="qa-grid"><button class="qa-btn" id="vSvc">' + icon('sliders', 'gi-qa') + '<span>Add service record</span></button><button class="qa-btn" id="vInc">' + icon('alarm', 'gi-qa') + '<span>Report incident</span></button><button class="qa-btn" id="vFuel">' + icon('fuel', 'gi-qa') + '<span>Log fuel</span></button><button class="qa-btn" id="vDoc">' + icon('file', 'gi-qa') + '<span>Upload document</span></button></div>');
  } else if (tab === 'service') {
    var svc = S.data.expenses.filter(function (e) { return !e.void && e.truck === v.id && MAINT.indexOf(e.category) >= 0; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    h += (ro ? '' : '<button class="btn gold block" id="vSvc" style="margin-bottom:12px">+ Add service record</button>') + (svc.length ? svc.map(function (e) {
      return '<button class="card svc" data-exp="' + e.id + '"><div class="cu-top"><b>' + esc(e.jobType || e.category) + '</b><b>' + ec2(e.amount) + '</b></div><span class="small muted">' + nice(e.date) + (e.workshop ? ' · ' + esc(e.workshop) : '') + (e.odometer ? ' · ' + F0.format(e.odometer) + ' km' : '') + '</span>' +
        '<span class="small">' + esc(e.description) + '</span><span class="small muted">' + (e.parts || e.labour || e.other ? 'Parts ' + ec(e.parts) + ' · labour ' + ec(e.labour) + (e.other ? ' · other ' + ec(e.other) : '') + ' · ' : '') + (e.offFrom ? 'off the road ' + niceShort(e.offFrom.slice(0, 10)) + (e.offTo ? ' to ' + niceShort(e.offTo.slice(0, 10)) + ' (' + F0.format(e.downtimeHours || 0) + ' hours)' : ', still off') + ' · ' : (e.daysOff ? e.daysOff + ' days off the road · ' : '')) + ((e.attachments || []).length ? (e.attachments.length + ' file(s)') : 'no receipt attached') + (Calc.expenseFunding(S.data, e.id).from.length ? ' · paid from ' + Calc.expenseFunding(S.data, e.id).from.map(function (o) { return invNo(o.inv); }).join(', ') : '') + '</span></button>'; }).join('')
      : '<div class="card empty">No service history recorded yet.</div>') + '<p class="small muted">Service records are ordinary expenses with extra details, so they appear once in the Transaction Ledger and every report.</p>';
  } else if (tab === 'docs') {
    var docs = (v.attachments || []).slice().sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    h += (ro ? '' : '<button class="btn gold block" id="vDoc" style="margin-bottom:12px">+ Upload document</button>') + '<div class="card"><h2>Documents</h2><ul class="list">' + DOC_TYPES.slice(0, 5).map(function (dt) {
      var ds = docs.filter(function (d) { return (d.docType || 'Other') === dt; }), cur = ds[0], st = !cur ? ['Missing', 'Overdue'] : cur.expires && cur.expires < t ? ['Expired', 'Overdue'] : cur.expires && cur.expires <= addDays(t, 30) ? ['Expires soon', 'Unpaid'] : ['Current', 'Paid'];
      return '<li><div class="row-btn" style="cursor:default"><span class="t">' + dt + '</span><span class="a"><span class="pill ' + st[1] + '">' + st[0] + '</span></span><span class="m">' + (cur ? esc(cur.name) + (cur.expires ? ' · expires ' + nice(cur.expires) : '') + (ds.length > 1 ? ' · ' + (ds.length - 1) + ' earlier version(s) kept' : '') : 'Not uploaded') + '</span><span class="m">' + ds.map(function (d) { return '<button class="btn link" data-viewfile="' + d.id + '">' + esc(d.at.slice(0, 10)) + '</button>'; }).join(' ') + '</span></div></li>'; }).join('') + '</ul>' +
      (docs.filter(function (d) { return !d.docType || d.docType === 'Other'; }).length ? '<h3 class="rep-h">Other files</h3><ul class="list">' + docs.filter(function (d) { return !d.docType || d.docType === 'Other'; }).map(function (d) { return '<li><button class="row-btn" data-viewfile="' + d.id + '"><span class="t">' + esc(d.name) + '</span><span class="m">' + nice(d.at.slice(0, 10)) + '</span></button></li>'; }).join('') + '</ul>' : '') +
      '<p class="small muted">Uploading a newer certificate keeps the earlier versions for the record.</p></div>';
  } else if (tab === 'incidents') {
    var incs = (S.data.incidents || []).filter(function (x) { return x.truck === v.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    h += (ro ? '' : '<button class="btn gold block" id="vInc" style="margin-bottom:12px">+ Report incident or breakdown</button>') + (incs.length ? '<div class="card flush"><ul class="list">' + incs.map(function (x) { return '<li><button class="row-btn" data-inc="' + x.id + '"><span class="t">' + esc(x.type) + ': ' + esc(x.description.slice(0, 60)) + '</span><span class="a"><span class="pill ' + (x.status === 'Resolved' ? 'Paid' : 'Overdue') + '">' + esc(x.status) + '</span></span><span class="m">' + nice(x.date) + (x.location ? ' · ' + esc(x.location) : '') + (x.estimate ? ' · estimate ' + ec(x.estimate) : '') + (x.offFrom ? ' · off the road ' + niceShort(x.offFrom) + (x.offTo ? ' to ' + niceShort(x.offTo) : ' onwards') : '') + '</span><span></span></button></li>'; }).join('') + '</ul></div>' : '<div class="card empty">No incidents recorded.</div>') +
      '<p class="small muted">' + incs.length + (incs.length === 1 ? ' incident' : ' incidents') + ' recorded in total. While an incident has off-the-road dates, the truck shows as Unavailable on the bookings calendar.</p>';
  } else {
    var js = f.jobs.filter(function (j) { return j.truck === v.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }), ex = S.data.expenses.filter(function (e) { return !e.void && e.truck === v.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var byDrv = {}; js.forEach(function (j) { var n = driverName(j.driverId) || 'Crew member not recorded'; byDrv[n] = (byDrv[n] || 0) + (Number(j.costs.labour) || 0); });
    h += '<div class="card"><h2>Labour on this truck</h2><table><tbody>' + Object.keys(byDrv).map(function (n) { return '<tr><td>' + esc(n) + '</td><td class="n">' + ec2(byDrv[n]) + '</td></tr>'; }).join('') + '</tbody></table><p class="small muted">Payments actually made to each crew member are in Crew & Pay.</p></div>' +
      '<div class="card flush"><h2 style="padding:14px 14px 0">Recent jobs</h2><ul class="list clip" id="vJobs">' + js.map(function (j, k) { return '<li class="' + (k >= 5 ? 'xrow' : '') + '"><button class="row-btn" data-dinv="' + j.inv.id + '"><span class="t">' + esc(j.client) + '</span><span class="a">' + ec(j.amount) + '</span><span class="m">' + nice(j.date) + ' · ' + esc(j.route || '') + '</span><span class="m">Costs ' + ec(j.cost) + '</span></button></li>'; }).join('') + '</ul><div style="padding:0 14px 10px">' + moreBtn('vJobs', js.length, 5, 'jobs') + '</div></div>' +
      '<div class="card flush"><h2 style="padding:14px 14px 0">Expenses</h2><ul class="list clip" id="vExp">' + ex.map(function (e, k) { return '<li class="' + (k >= 5 ? 'xrow' : '') + '"><button class="row-btn" data-exp="' + e.id + '"><span class="t">' + esc(e.category) + '</span><span class="a">' + ec(e.amount) + '</span><span class="m">' + nice(e.date) + ' · ' + esc(e.description) + '</span><span></span></button></li>'; }).join('') + '</ul><div style="padding:0 14px 10px">' + moreBtn('vExp', ex.length, 5, 'expenses') + '</div></div>';
  }
  $('view').innerHTML = h; bindMore(); bindAttachments({ kind: 'vehicle', id: v.id }, v.attachments);
  qa('[data-vt]').forEach(function (b) { b.onclick = function () { S.vTab = b.dataset.vt; render(); }; });
  qa('[data-dinv]').forEach(function (b) { b.onclick = function () { go('invoice', b.dataset.dinv); }; });
  qa('[data-exp]').forEach(function (b) { b.onclick = function () { var e = S.data.expenses.find(function (x) { return x.id === b.dataset.exp; }); if (e) (MAINT.indexOf(e.category) >= 0 ? serviceEditor(v.id, e) : expenseEditor(e)); }; });
  qa('[data-inc]').forEach(function (b) { b.onclick = function () { incidentEditor(v.id, S.data.incidents.find(function (x) { return x.id === b.dataset.inc; })); }; });
  if ($('vSvc')) $('vSvc').onclick = function () { serviceEditor(v.id); };
  if ($('vInc')) $('vInc').onclick = function () { incidentEditor(v.id); };
  if ($('vFuel')) $('vFuel').onclick = function () { fuelEditor({ truck: v.id }); };
  if ($('vDoc')) $('vDoc').onclick = function () { docUpload({ kind: 'vehicle', id: v.id }); };
};
function docUpload(target) {
  openSheet('Upload document', '<label class="f"><span>Document type</span><select id="dT">' + opts(DOC_TYPES, 'Insurance certificate') + '</select></label><label class="f"><span>Expiry date (if it has one)</span><input type="date" id="dX"></label>' +
    '<label class="f"><span>File (photo or PDF)</span><input type="file" id="dF" accept="image/*,application/pdf"></label><p class="small muted">Earlier versions stay on record.</p>', 'Upload');
  $('sheetGo').onclick = function () {
    var fl = $('dF').files[0]; if (!fl) return toast('Choose the file.', true); if (fl.size > 8 * 1048576) return toast('Keep files under 8 MB.', true);
    var img = /^image\//.test(fl.type);
    (img ? shrinkImage(fl) : readAsDataUrl(fl)).then(function (data) {
      return api('uploadFile', { target: target, file: { name: img ? $('dT').value + '.jpg' : fl.name, type: img ? 'image/jpeg' : fl.type, data: data, docType: $('dT').value, expires: $('dX').value } }, 'Uploading…');
    }).then(function () { closeSheet(); toast('Document saved.'); render(); }).catch(function () {});
  };
}
function serviceEditor(truck, e) {
  var spf = pendingFiles('sPF');
  e = e || {};
  // Older records only had a number of days; show them as dates from the record's date
  var offStart = e.offFrom || (e.daysOff ? (e.date || today()) + 'T08:00' : ''), offEnd = e.offTo || (e.daysOff ? addDays(e.date || today(), e.daysOff) + 'T08:00' : '');
  e = e || {}; var editing = !!e.id, rems = (S.data.reminders || []).filter(function (r) { return r.truck === truck && r.everyKm; });
  openSheet(editing ? 'Service record' : 'Add service record · ' + truck,
    '<div class="cols"><label class="f"><span>Date</span><input type="date" id="sD" value="' + v(e.date || today()) + '"></label><label class="f"><span>Type of work</span><select id="sJ">' + opts(SERVICE_TYPES.map(function (x) { return x[0]; }), e.jobType || 'Service') + '</select></label></div>' +
    '<label class="f"><span>Workshop</span><input id="sW" value="' + v(e.workshop) + '" placeholder="e.g. Kingstown Diesel"></label>' +
    '<label class="f"><span>What was done</span><input id="sDesc" value="' + v(e.description) + '" placeholder="Engine oil and filter service"></label>' +
    '<div class="cols"><label class="f"><span>Parts (EC$)</span><input id="sP" inputmode="decimal" value="' + v(e.parts || '') + '"></label><label class="f"><span>Labour (EC$)</span><input id="sL" inputmode="decimal" value="' + v(e.labour || '') + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Other (EC$)</span><input id="sOt" inputmode="decimal" value="' + v(e.other || '') + '" placeholder="e.g. towing, transport"></label><label class="f"><span>Total cost (EC$)</span><input id="sT" inputmode="decimal" value="' + v(e.amount || '') + '"></label></div>' +
    '<p class="small muted" style="margin-top:-6px">The total adds up parts, labour and other automatically. It is the amount counted in every report.</p>' +
    '<div class="cols"><label class="f"><span>Off the road from</span><input type="datetime-local" id="sOF" value="' + v(offStart) + '"></label><label class="f"><span>Back on the road</span><input type="datetime-local" id="sOB" value="' + v(offEnd) + '"></label></div>' +
    '<div class="downtime" id="sDT"></div>' +
    '<div class="cols"><label class="f"><span>Paid by</span><select id="sPB">' + payerOpts(e.paidBy || 'Business') + '</select></label><label class="f"><span>Paid with</span><select id="sM">' + opts(METHODS, e.method || 'Cash') + '</select></label></div>' +
    (!editing && rems.length && odometerOf(truck) ? '<label class="check"><input type="checkbox" id="sNext"> Update the next service reminder from the latest fuel-log reading, ' + F0.format(odometerOf(truck)) + ' km (' + rems.map(function (r) { return esc(r.type) + ' every ' + F0.format(r.everyKm) + ' km'; }).join(', ') + ')</label>' : '') +
    fundedFrom(e) + (editing ? attachmentsCard('Workshop invoice, receipts and photos', e.attachments, !isLocked(e.date)) : '<h3 class="rep-h" style="margin:6px 0">Workshop invoice and photos</h3>' + spf.html) +
    '<p class="small muted">Saved once as a vehicle expense, so it appears in the Transaction Ledger and reports without being counted twice.</p>', 'Save');
  spf.bind(); bindFunded(); if (editing) bindAttachments({ kind: 'expense', id: e.id }, e.attachments);
  var parts = function () { return round2(num($('sP').value) + num($('sL').value) + num($('sOt').value)); };
  if (editing && e.amount && Math.abs(e.amount - parts()) > 0.005) $('sT').dataset.touched = '1';
  var sum = function () { if (!$('sT').dataset.touched) $('sT').value = parts() || ''; };
  $('sP').oninput = sum; $('sL').oninput = sum; $('sOt').oninput = sum; $('sT').oninput = function () { this.dataset.touched = this.value ? '1' : ''; };
  var dt = { hours: 0, days: 0, bad: false };
  var calcDown = function () {
    var a = $('sOF').value, b = $('sOB').value, box = $('sDT'); dt = { hours: 0, days: 0, bad: false };
    if (!a) { box.innerHTML = '<span class="muted">Leave both blank if the truck kept working.</span>'; return; }
    if (!b) { box.innerHTML = '<b>Still off the road</b><span class="muted">Add the date it went back to work when it does.</span>'; dt.days = 0; return; }
    var h = (new Date(b) - new Date(a)) / 3600000;
    if (!(h >= 0)) { dt.bad = true; box.innerHTML = '<b class="neg">Back on the road is before it went off.</b>'; return; }
    dt.hours = Math.round(h); dt.days = Math.ceil(h / 24);
    var d = Math.floor(h / 24), r = Math.round(h - d * 24);
    box.innerHTML = '<b>Downtime: ' + F0.format(dt.hours) + (dt.hours === 1 ? ' hour' : ' hours') + '</b><span class="muted">' + (d ? d + (d === 1 ? ' day' : ' days') + (r ? ' ' + r + (r === 1 ? ' hour' : ' hours') : '') : r + (r === 1 ? ' hour' : ' hours')) + ' off the road, worked out from the two dates</span>';
  };
  $('sOF').oninput = calcDown; $('sOB').oninput = calcDown; calcDown();
  $('sheetGo').onclick = function () {
    if (dt.bad) return toast('Check the off-the-road dates.', true);
    var br = parts(), tot = num($('sT').value);
    if (!tot && br) { tot = br; $('sT').value = br; }
    if (!tot) return toast('Enter the cost.', true);
    if (br && Math.abs(tot - br) > 0.005 && !confirm('The total (' + ec2(tot) + ') is not the same as parts + labour + other (' + ec2(br) + '). Save the total as entered?')) return;
    var cat = (SERVICE_TYPES.find(function (x) { return x[0] === $('sJ').value; }) || ['', 'Maintenance'])[1];
    api('saveExpense', { expense: { biz: e.biz || (S.biz === 'cozy' ? 'cozy' : 'nv'), id: e.id, date: $('sD').value, truck: truck, category: cat, description: $('sDesc').value || $('sJ').value, amount: tot, method: $('sM').value, paidBy: $('sPB').value, notes: e.notes || '',
      workshop: $('sW').value, jobType: $('sJ').value, parts: $('sP').value, labour: $('sL').value, other: $('sOt').value, odometer: e.odometer || '',
      offFrom: $('sOF').value, offTo: $('sOB').value, downtimeHours: dt.hours, daysOff: dt.days } }, 'Saving…')
      .then(function (res) {
        var upd = $('sNext') && $('sNext').checked ? rems.map(function (r) { return api('saveReminder', { reminder: Object.assign({}, r, { dueKm: odometerOf(truck) + r.everyKm }) }); }) : [];
        var id = e.id || (res && res.result && res.result.id);
        return Promise.all(upd).then(function () { return id ? spf.upload({ kind: 'expense', id: id }) : 0; })
          .then(function (n) { closeSheet(); toast((upd.length ? 'Service saved; next service updated' : 'Service record saved') + (n ? ' with ' + n + (n === 1 ? ' file' : ' files') : '') + '.'); render(); })
          .catch(function () { closeSheet(); toast('Service saved, but a file did not upload. Open the record to add it.', true); render(); });
      }).catch(function () {});
  };
}
function incidentEditor(truck, x) {
  x = x || {}; var editing = !!x.id;
  openSheet(editing ? 'Incident · ' + truck : 'Report incident · ' + truck,
    '<div class="cols"><label class="f"><span>Date</span><input type="date" id="nD" value="' + v(x.date || today()) + '"></label><label class="f"><span>Type</span><select id="nT">' + opts(['Mechanical breakdown', 'Accident', 'Tyre damage', 'Electrical fault', 'Other'], x.type || 'Mechanical breakdown') + '</select></label></div>' +
    '<label class="f"><span>Location</span><input id="nL" value="' + v(x.location) + '" placeholder="Kingstown"></label><label class="f"><span>What happened</span><textarea id="nX">' + v(x.description) + '</textarea></label>' +
    '<div class="cols"><label class="f"><span>Repair estimate (EC$)</span><input id="nE" inputmode="decimal" value="' + v(x.estimate || '') + '"></label><label class="f"><span>Status</span><select id="nS">' + opts(['Open', 'Awaiting repair', 'Resolved'], x.status || 'Open') + '</select></label></div>' +
    '<div class="cols"><label class="f"><span>Off the road from</span><input type="date" id="nF" value="' + v(x.offFrom || '') + '"></label><label class="f"><span>Back on the road</span><input type="date" id="nB" value="' + v(x.offTo || '') + '"></label></div>' +
    '<p class="small muted">Off-the-road dates mark the truck Unavailable on the bookings calendar and count as downtime. Record the repair bill as a service record when it is paid, so the cost is counted once.</p>' +
    (editing ? attachmentsCard('Photos', x.attachments, true) : ''), 'Save');
  if (editing) bindAttachments({ kind: 'incident', id: x.id }, x.attachments);
  $('sheetGo').onclick = function () {
    api('saveIncident', { incident: { id: x.id, truck: truck, date: $('nD').value, type: $('nT').value, location: $('nL').value, description: $('nX').value, estimate: $('nE').value, status: $('nS').value, offFrom: $('nF').value, offTo: $('nB').value } }, 'Saving…')
      .then(function () { closeSheet(); toast('Incident saved.'); render(); }).catch(function () {});
  };
}
/* ==================== Data Management (P2) ==================== */
S.dmTab = 'overview';
function dataQuality() {
  var out = [], t = today();
  var g = {}; S.data.clients.forEach(function (c) { var k = normName(c.name); if (k) (g[k] = g[k] || []).push(c); });
  Object.keys(g).filter(function (k) { return g[k].length > 1; }).forEach(function (k) { out.push(['warn', 'Possible duplicate customers', g[k].map(function (c) { return c.name; }).join(' / ') + '. Not merged automatically. Open one, go to Invoices & Quotes and tap Merge into another customer.', 'client:' + g[k][0].id]); });
  var noFee = []; liveInvoices().forEach(function (i) { i.lines.forEach(function (l) { if (l.date >= DRIVER_RULE_FROM && !(Number((l.costs || {}).labour) > 0)) noFee.push(i); }); });
  if (noFee.length) out.push(['neg', noFee.length + ' recent jobs with no labour cost', 'Profit is overstated until the fee is added.', 'inv:' + noFee[0].id]);
  var noContact = S.data.clients.filter(function (c) { return !c.phone && !c.email && liveInvoices().some(function (i) { return i.clientId === c.id && invBalance(i) > 0.009; }); });
  if (noContact.length) out.push(['warn', noContact.length + ' customers who owe money have no phone or email', noContact.map(function (c) { return c.name; }).slice(0, 4).join(', '), 'client:' + noContact[0].id]);
  var noDue = liveInvoices().filter(function (i) { return !i.dueDate; }); if (noDue.length) out.push(['warn', noDue.length + ' invoices without a due date', 'They cannot become overdue or appear in the cash forecast correctly.', 'inv:' + noDue[0].id]);
  var noRoute = facts().jobs.filter(function (j) { return !j.route; }).length; if (noRoute) out.push(['info', noRoute + ' jobs without a area', 'They show as "Not set" in Area Performance.', 'go:log']);
  var noTruckExp = S.data.expenses.filter(function (e) { return !e.void && MAINT.indexOf(e.category) >= 0 && TRUCKS.indexOf(e.truck) < 0; }).length; if (noTruckExp) out.push(['info', noTruckExp + ' repair costs not linked to a truck', 'They are left out of per-truck figures.', 'go:log']);
  var contrib = (S.data.capital || []).filter(function (k) { return k.type === 'contribution'; }).reduce(function (a, k) { return a + k.amount; }, 0), inv = startupTotal();
  if ((S.data.capital || []).length && Math.abs(contrib - inv) > 1) out.push(['info', 'Capital records differ by ' + ec2(Math.abs(contrib - inv)), 'Partner contributions and equipment costs come from separate historical tables; shown as recorded until reviewed.', 'go:startup']);
  vehicles().filter(function (v) { return !v.plate; }).forEach(function (v) { out.push(['info', v.id + ': registration not recorded', 'Add plate, model and year in Business Settings.', 'go:settings']); });
  return out;
}
VIEWS.data = function () {
  var owner = S.data.me.role === 'owner', tab = S.dmTab, d = S.data, chk = d.settings.lastBackupCheck;
  var tabs = [['overview', 'Overview']].concat(owner ? [['backups', 'Backups']] : []).concat([['io', 'Import & Export'], ['quality', 'Data Quality']]).concat(owner ? [['recovery', 'Recovery & History']] : []);
  if (!tabs.some(function (x) { return x[0] === tab; })) tab = S.dmTab = 'overview';
  var h = '<div class="ins-chips tabs-row" style="margin-bottom:12px">' + tabs.map(function (o) { return '<button class="chip" data-dm="' + o[0] + '" aria-pressed="' + (tab === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  if (tab === 'overview') {
    var q = dataQuality();
    h += '<div class="card"><h2>Your Records</h2><div class="mgrid">' + [['Invoices', d.invoices.length], ['Customers', d.clients.length], ['Expenses', d.expenses.length], ['Bookings', (d.bookings || []).length], ['Fuel entries', (d.fuel || []).length], ['Quotes', (d.quotes || []).length]].map(function (x) { return '<div class="mcard"><span class="ml">' + x[0] + '</span><b>' + x[1] + '</b></div>'; }).join('') + '</div></div>' +
      '<div class="card"><h2>Backup Protection</h2><table class="wrap"><tbody><tr><td>Daily copies</td><td>Automatic, kept 180 days</td></tr><tr><td>Monthly copy</td><td>Google Drive on the 1st (email if Drive is not connected)</td></tr>' +
      '<tr><td>Last restore test</td><td>' + (chk ? (chk.ok ? '<span class="pos">Passed</span>' : '<span class="neg">Failed</span>') + ' · ' + nice(chk.at.slice(0, 10)) : '<span class="neg">Not verified</span>') + '</td></tr></tbody></table>' +
      '<p class="small muted">A successful backup and a tested restore are different: the restore test opens the latest copy and checks every record type is readable.</p>' + (owner ? '<button class="btn quiet block" data-dm="recovery">Run a restore test</button>' : '') + '</div>' +
      '<div class="card"><h2>Data Quality</h2><p style="margin:0">' + (q.length ? q.length + ' items to review' : 'No issues found') + '</p><button class="btn link" data-dm="quality">Review ›</button></div>';
  } else if (tab === 'quality') {
    var qs = dataQuality();
    h += '<div class="card"><h2>Data Quality Checks</h2><ul class="obs">' + (qs.length ? qs.map(function (x) { return '<li class="' + x[0] + '">' + icon(x[0] === 'neg' ? 'alarm' : x[0] === 'warn' ? 'clip' : 'info', 'gi-obs') + '<div><b>' + esc(x[1]) + '</b><p>' + esc(x[2]) + '</p><button class="btn link pl-link" data-dq="' + esc(x[3]) + '">Open ›</button></div></li>'; }).join('') : '<li class="pos">' + icon('checkc', 'gi-obs') + '<div><b>All clear</b><p>No duplicates, missing labour costs or missing contact details found.</p></div></li>') + '</ul><p class="small muted">Nothing here is changed automatically.</p></div>';
  } else if (tab === 'io') {
    h += groupMenu([{ title: 'Import & Export', sub: 'Move records in and out', items: [['exportx', 'upload', 'Export to Excel', 'Any period; matches the figures in the app']].concat([['yearend', 'book', 'Report PDF, Excel and CSV', 'From Financial Reports, for any quarter or year']]) }]);
  } else if (tab === 'backups') { VIEWS.backups(); $('view').insertAdjacentHTML('afterbegin', h); bindDm(); return; }
  else if (tab === 'recovery') {
    h += '<div class="card"><h2>Restore Test</h2><p class="small muted" style="margin-top:0">Opens the most recent daily copy and checks that every type of record can be read, without changing anything.</p>' +
      (chk ? '<table><tbody><tr><td>Last test</td><td class="n">' + nice(chk.at.slice(0, 10)) + ' · ' + (chk.ok ? '<span class="pos">Passed</span>' : '<span class="neg">Failed</span>') + '</td></tr>' + Object.keys(chk.counts || {}).map(function (k) { return '<tr><td>' + k + '</td><td class="n">' + chk.counts[k] + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="neg">Not verified yet.</p>') +
      '<button class="btn gold block" id="rtTest">Run restore test now</button></div>' +
      '<div class="card"><h2>Recovery</h2><p class="small muted" style="margin-top:0">To go back to an earlier copy, open Backups and choose a day. A copy of the current records is kept first.</p><button class="btn quiet block" data-dm="backups">Open backups</button><button class="btn quiet block" style="margin-top:8px" data-go2="activity">Activity Log</button></div>';
  }
  $('view').innerHTML = h; bindDm(); bindGo();
  qa('[data-dq]').forEach(function (b) { b.onclick = function () { var p = b.dataset.dq.split(':'); if (p[0] === 'client') go('client', p[1]); else if (p[0] === 'inv') go('invoice', p[1]); else go(p[1]); }; });
  qa('[data-go2]').forEach(function (b) { b.onclick = function () { go(b.dataset.go2); }; });
  if ($('rtTest')) $('rtTest').onclick = function () { if (window.PREVIEW) return toast('The restore test runs on the server, so it is not available in this preview.', true); api('verifyBackup', {}, 'Testing the latest backup…').then(function (r) { toast(r.result.ok ? 'Restore test passed.' : 'Restore test failed. See details.', !r.result.ok); render(); }).catch(function () {}); };
};
function bindDm() { qa('[data-dm]').forEach(function (b) { b.onclick = function () { S.dmTab = b.dataset.dm; render(); }; }); }
VIEWS.security = function () {
  var me = S.data.me, ss = S.data.mySessions || [], acts = (S.data.audit || []).filter(function (a) { return a.by === me.name && /Signed in|password|Face ID|Signed out|passkey/i.test(a.what); }).slice(0, 8);
  var h = '<div class="card"><div class="cu-top"><div><b style="font-size:1.1rem">' + esc(me.name) + '</b><div class="small muted">@' + esc(me.username) + ' · ' + roleLabel(me.role) + '</div></div><span class="pill ' + (me.passkeys ? 'Paid' : 'Unpaid') + '">' + (me.passkeys ? 'Face ID on' : 'Password only') + '</span></div></div>' +
    groupMenu([{ title: 'Sign-in Methods', sub: 'How you sign in to NV Ops', items: [['passkeys', 'faceid', 'Face ID & Passkeys', me.passkeys + ' device' + (me.passkeys === 1 ? '' : 's') + ' registered'], ['password', 'key', 'Change Password', 'Choose a new password']] }]) +
    '<div class="card"><h2>Signed-in Devices</h2><ul class="list">' + (ss.length ? ss.map(function (x) { return '<li><div class="row-btn" style="cursor:default"><span class="t">' + esc(x.device) + (x.current ? ' <span class="pill Paid">This device</span>' : '') + '</span><span class="a">' + (x.current ? '' : '<button class="btn link" data-sout="' + x.id + '" style="color:var(--danger)">Sign out</button>') + '</span><span class="m">Signed in ' + nice(x.at.slice(0, 10)) + '</span><span></span></div></li>'; }).join('') : '<li class="empty">Devices appear here from your next sign-in.</li>') + '</ul>' +
    (ss.length > 1 || !ss.some(function (x) { return x.current; }) ? '<button class="btn danger block" id="soutAll">Sign out every other device</button>' : '') +
    '<p class="small muted">Signing a device out ends its session straight away. Removing a Face ID passkey only stops future Face ID sign-ins; it does not sign that device out.</p></div>' +
    '<div class="card"><h2>Security Activity</h2><ul class="list">' + (acts.length ? acts.map(function (a) { return '<li><div class="row-btn" style="cursor:default"><span class="t">' + esc(a.what) + '</span><span class="m">' + esc((a.at || '').slice(0, 16).replace('T', ' ')) + '</span><span></span><span></span></div></li>'; }).join('') : '<li class="empty">No recent sign-in activity recorded.</li>') + '</ul>' +
    '<p class="small muted">Sensitive actions (bank details, closing months, permanent deletes, team access) stay limited to the account owner and are checked on the server.</p></div>';
  $('view').innerHTML = h; bindGo();
  qa('[data-sout]').forEach(function (b) { b.onclick = function () { if (confirm('Sign that device out?')) api('revokeSession', { id: b.dataset.sout }, 'Signing out…').then(function () { toast('Device signed out.'); render(); }).catch(function () {}); }; });
  if ($('soutAll')) $('soutAll').onclick = function () { if (confirm('Sign out every device except this one?')) api('revokeSession', { others: true }, 'Signing out…').then(function () { toast('Other devices signed out.'); render(); }).catch(function () {}); };
};
VIEWS.appearance = function () {
  var p = prefs(), t = lsGet('nv_theme', 'auto'), drv = isDriver();
  var themeTile = function (k, lbl, ic) { return '<button class="th-tile' + (t === k ? ' on' : '') + '" data-theme-set="' + k + '"><span class="th-prev th-' + k + '"><i></i><i></i><i></i></span><span>' + ic + ' ' + lbl + '</span></button>'; };
  var h = '<div class="card"><h2>Colour Theme</h2><div class="th-grid">' + themeTile('auto', 'System', '') + themeTile('light', 'Light', '') + themeTile('dark', 'Dark', '') + '</div><p class="small muted" style="margin:8px 0 0">System follows your device\'s light or dark setting.</p></div>' +
    '<div class="card"><h2>Display Density</h2>' + [['comfortable', 'Comfortable', 'More spacing'], ['compact', 'Compact', 'More information visible']].map(function (d) { return '<label class="radio"><input type="radio" name="dens" value="' + d[0] + '"' + (p.density === d[0] ? ' checked' : '') + '> <b>' + d[1] + '</b> <span class="muted">· ' + d[2] + '</span></label>'; }).join('') +
    '<label class="switch-row"><span><b>Reduce Motion</b><br><span class="small muted">Turn off animations such as the payment celebration.</span></span><input type="checkbox" class="switch" id="rmo"' + (p.reduceMotion ? ' checked' : '') + '></label></div>';
  if (!drv) {
    h += '<div class="card"><h2>Home Sections</h2><p class="small muted" style="margin-top:0">Turn sections on or off and use the arrows to change their order. Changes appear on Home straight away.</p><ul class="sec-list">' +
      p.homeOrder.map(function (k, i) { var d = HOME_SECTIONS.find(function (x) { return x[0] === k; }); return '<li><span><b>' + d[1] + '</b><br><span class="small muted">' + d[2] + '</span></span>' +
        '<button class="arr" data-mv="' + k + '" data-dir="-1" aria-label="Move ' + d[1] + ' up"' + (i === 0 ? ' disabled' : '') + '>↑</button><button class="arr" data-mv="' + k + '" data-dir="1" aria-label="Move ' + d[1] + ' down"' + (i === p.homeOrder.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '<input type="checkbox" class="switch" data-sec-on="' + k + '"' + (p.homeOff.indexOf(k) < 0 ? ' checked' : '') + ' aria-label="Show ' + d[1] + '"></li>'; }).join('') + '</ul></div>' +
      '<div class="card"><h2>Quick Actions</h2><p class="small muted" style="margin-top:0">Shortcuts shown in the two-column Quick Actions panel on Home.</p><ul class="sec-list">' +
      QUICK_ACTIONS.map(function (q) { return '<li><span>' + icon(q[1], 'gi-inline') + ' <b>' + q[2] + '</b></span><input type="checkbox" class="switch" data-qa-on="' + q[0] + '"' + (p.quick.indexOf(q[0]) >= 0 ? ' checked' : '') + ' aria-label="Show ' + q[2] + '"></li>'; }).join('') + '</ul></div>' +
      '<div class="card"><h2>Privacy</h2><label class="switch-row"><span><b>Hide financial amounts by default</b><br><span class="small muted">Amounts on Home start blurred; tap the eye at the top to show them.</span></span><input type="checkbox" class="switch" id="hideDef"' + (p.hideAmounts ? ' checked' : '') + '></label></div>' +
      '<div class="btn-row"><button class="btn gold" id="viewHome">View my Home →</button><button class="btn quiet" id="resetPrefs">Restore defaults</button></div>';
  }
  h += '<p class="small muted">Saved to your account, so the same setup follows you on your phone and Mac.</p>';
  $('view').innerHTML = h;
  qa('[data-theme-set]').forEach(function (b) { b.onclick = function () { lsSet('nv_theme', b.dataset.themeSet); applyTheme(b.dataset.themeSet); savePrefs({ theme: b.dataset.themeSet }); render(); }; });
  qa('input[name="dens"]').forEach(function (r) { r.onchange = function () { savePrefs({ density: r.value }); }; });
  $('rmo').onchange = function () { savePrefs({ reduceMotion: this.checked }); };
  qa('[data-mv]').forEach(function (b) { b.onclick = function () { var o = prefs().homeOrder.slice(), i = o.indexOf(b.dataset.mv), j = i + (+b.dataset.dir); if (j < 0 || j >= o.length) return; o.splice(j, 0, o.splice(i, 1)[0]); savePrefs({ homeOrder: o }); render(); }; });
  qa('[data-sec-on]').forEach(function (c) { c.onchange = function () { var off = prefs().homeOff.filter(function (k) { return k !== c.dataset.secOn; }); if (!c.checked) off.push(c.dataset.secOn); savePrefs({ homeOff: off }); }; });
  qa('[data-qa-on]').forEach(function (c) { c.onchange = function () { var q = prefs().quick.filter(function (k) { return k !== c.dataset.qaOn; }); if (c.checked) q = QUICK_ACTIONS.map(function (x) { return x[0]; }).filter(function (k) { return k === c.dataset.qaOn || q.indexOf(k) >= 0; }); savePrefs({ quick: q }); }; });
  if ($('hideDef')) $('hideDef').onchange = function () { S.mask = this.checked; savePrefs({ hideAmounts: this.checked }); };
  if ($('viewHome')) $('viewHome').onclick = function () { go('dashboard'); };
  if ($('resetPrefs')) $('resetPrefs').onclick = function () { if (!confirm('Restore the default Home layout and settings?')) return; S.mask = false; savePrefs(JSON.parse(JSON.stringify(PREF_DEFAULTS))); lsSet('nv_theme', 'auto'); applyTheme('auto'); render(); };
};

/* ---- loads ---- */
/* ==================== Load Performance (F1 to F3) ==================== */
S.ldMetric = 'contrib'; S.ldOpen = {}; S.ldSort = 'contrib'; S.ldDir = -1;
VIEWS.loads = function () {
  var f = facts(), r = periodRange(S.period), s = summarise(f, r.from, r.to), gs = groupStats(s.jobs, 'loadN');
  var h = periodControl(render);
  if (!gs.length) { $('view').innerHTML = h + '<div class="card empty">No completed jobs in this period, so there are no averages to show.</div>'; return; }
  var contrib = s.income - s.jobCosts, margin = s.income ? contrib / s.income : NaN;
  var kc = function (lbl, val, sub) { return '<div class="mcard"><span class="ml">' + lbl + '</span><b>' + val + '</b><span class="ms">' + sub + '</span></div>'; };
  h += '<div class="card"><div class="fo-head"><h2 style="margin:0">Load Performance</h2><span class="muted">' + s.trips + ' jobs · ' + esc(periodLabel(S.period)) + '</span></div><div class="mgrid" style="margin-top:12px">' +
    kc('Total revenue', ec(s.income), 'Across all load types') + kc('Direct job costs', ec(s.jobCosts), pct(s.jobCosts / s.income) + ' of revenue') +
    kc('Contribution', ec(contrib), 'After direct job costs') + kc('Contribution margin', pct(margin), 'Combined load margin') +
    kc('Average revenue / job', ec(s.income / s.trips), s.trips + ' completed jobs') + kc('Average contribution / job', ec(contrib / s.trips), 'Before business overhead') + '</div></div>';
  var byTot = gs.slice().sort(function (a, b) { return b.net - a.net; })[0], byMar = gs.slice().sort(function (a, b) { return b.margin - a.margin; })[0], byFreq = gs.slice().sort(function (a, b) { return b.trips - a.trips; })[0];
  var tr = function (n) { return n + (n === 1 ? ' job' : ' jobs'); };
  h += '<div class="lead-grid"><div class="card lead"><span class="small muted">Highest total contribution</span><b>' + esc(byTot.name) + '</b><span>' + ec(byTot.net) + '</span><span class="small muted">' + tr(byTot.trips) + ' · ' + pct(byTot.margin) + ' margin</span></div>' +
    '<div class="card lead"><span class="small muted">Highest margin</span><b>' + esc(byMar.name) + '</b><span>' + pct(byMar.margin) + '</span><span class="small muted">' + ec(byMar.net) + ' from ' + tr(byMar.trips) + (byMar.trips < 3 ? ' · small sample' : '') + '</span></div>' +
    '<div class="card lead"><span class="small muted">Most frequently transported</span><b>' + esc(byFreq.name) + '</b><span>' + byFreq.trips + ' of ' + s.trips + ' jobs</span><span class="small muted">' + pct(byFreq.trips / s.trips) + ' of activity</span></div></div>' +
    (byMar.trips < 3 && byMar !== byTot ? '<p class="small muted" style="margin:-4px 4px 12px">' + esc(byMar.name) + ' leads on margin from only ' + tr(byMar.trips) + ', which does not show it is consistently better.</p>' : '');
  var ms = S.ldMetric, ranked = gs.slice().sort(function (a, b) { return rtVal(b, ms) - rtVal(a, ms); }), maxV = Math.max.apply(null, ranked.map(function (g) { return Math.abs(rtVal(g, ms)); }).concat([1]));
  var chartPane = '<div class="chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' + [['contrib', 'Contribution'], ['income', 'Revenue'], ['cost', 'Direct costs'], ['margin', 'Margin %'], ['per', 'Per job']].map(function (m) { return '<button class="chip" data-ldm="' + m[0] + '" aria-pressed="' + (ms === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div>' +
    '<div class="rt-bars">' + ranked.map(function (g) { var v = rtVal(g, ms); return '<button class="rt-bar plain" data-ldjobs="' + esc(g.name) + '"><div class="rt-bl"><span>' + esc(g.name) + ' <span class="small muted">· ' + tr(g.trips) + '</span></span><b>' + rtFmt(v, ms) + '</b></div><div class="rt-track"><i class="' + (v < 0 ? 'neg' : '') + '" style="width:' + Math.max(2, Math.abs(v) / maxV * 100) + '%"></i></div></button>'; }).join('') + '</div><p class="small muted">Tap a load to see its jobs.</p>';
  var sk = S.ldSort, sorted = gs.slice().sort(function (a, b) { var va = sk === 'name' ? a.name : sk === 'trips' ? a.trips : sk === 'share' ? a.income : rtVal(a, sk), vb = sk === 'name' ? b.name : sk === 'trips' ? b.trips : sk === 'share' ? b.income : rtVal(b, sk); return (va < vb ? -1 : va > vb ? 1 : 0) * S.ldDir; });
  var th = function (k, l) { return '<th class="' + (k === 'name' ? '' : 'n') + '"><button class="sort-th" data-lds="' + k + '">' + l + (sk === k ? (S.ldDir < 0 ? ' ▾' : ' ▴') : '') + '</button></th>'; };
  var tablePane = '<div class="scroll-x"><table><thead><tr>' + th('name', 'Load') + th('trips', 'Jobs') + th('income', 'Revenue') + th('cost', 'Direct costs') + th('contrib', 'Contribution') + th('margin', 'Margin') + th('per', 'Avg contrib.') + th('share', 'Revenue share') + '</tr></thead><tbody>' +
    sorted.map(function (g) { return '<tr><td>' + esc(g.name) + '</td><td class="n">' + g.trips + '</td><td class="n">' + F0.format(g.income) + '</td><td class="n">' + F0.format(g.cost) + '</td><td class="n">' + F0.format(g.net) + '</td><td class="n">' + pct(g.margin) + '</td><td class="n">' + F0.format(g.net / g.trips) + '</td><td class="n">' + pct(g.income / s.income) + '</td></tr>'; }).join('') +
    '<tr class="total"><td>Total</td><td class="n">' + s.trips + '</td><td class="n">' + F0.format(s.income) + '</td><td class="n">' + F0.format(s.jobCosts) + '</td><td class="n">' + F0.format(contrib) + '</td><td class="n">' + pct(margin) + '</td><td class="n">' + F0.format(contrib / s.trips) + '</td><td class="n">100%</td></tr></tbody></table></div><p class="small muted">Full detail table (best on a wider screen). Amounts in EC$.</p>';
  h += swipe('ldSwipe', [['Performance by Load Type', chartPane], ['Detailed Table', tablePane]]);
  h += '<h3 class="rep-h" style="margin:18px 4px 8px">Loads</h3>' + ranked.map(function (g) {
    var o = !!S.ldOpen[g.name];
    return '<div class="card rt-card"><div class="rt-c-head"><div><b class="rt-name">' + esc(g.name) + '</b><span class="small muted">' + tr(g.trips) + ' · ' + pct(g.margin) + ' margin</span></div><div style="text-align:right"><b class="rt-big pos">' + ec(g.net) + '</b><span class="small muted">Contribution</span></div></div>' +
      '<div class="rt-c-row"><div><span class="small muted">Revenue</span><b>' + ec(g.income) + '</b></div><div><span class="small muted">Direct costs</span><b>' + ec(g.cost) + '</b></div><div><span class="small muted">Contrib. / job</span><b>' + ec(g.net / g.trips) + '</b></div></div>' +
      '<button class="btn quiet block rt-tog" data-ldo="' + esc(g.name) + '" aria-expanded="' + o + '">' + (o ? 'Hide cost breakdown ▴' : 'Show cost breakdown ▾') + '</button>' +
      (o ? '<table class="rt-costs"><tbody>' + COST_TYPES.map(function (c) { return '<tr><td>' + c[1] + '</td><td class="n">' + ec(g[c[0]]) + '</td><td class="n small muted">' + (g.trips ? ec(g[c[0]] / g.trips) + ' / job' : '') + '</td></tr>'; }).join('') + '<tr class="total"><td>Total direct costs</td><td class="n">' + ec(g.cost) + '</td><td class="n small muted">' + ec(g.cost / g.trips) + ' / job</td></tr></tbody></table>' : '') +
      '<button class="btn link block" data-ldjobs="' + esc(g.name) + '">View job breakdown →</button></div>'; }).join('');
  $('view').innerHTML = h; bindSwipe('ldSwipe');
  qa('[data-ldm]').forEach(function (b) { b.onclick = function () { S.ldMetric = b.dataset.ldm; render(); }; });
  qa('[data-lds]').forEach(function (b) { b.onclick = function () { var k = b.dataset.lds; if (S.ldSort === k) S.ldDir *= -1; else { S.ldSort = k; S.ldDir = k === 'name' ? 1 : -1; } render(); setTimeout(function () { var t2 = $('ldSwipe') && $('ldSwipe').querySelector('.swp-track'); if (t2) t2.scrollLeft = t2.clientWidth; }, 0); }; });
  qa('[data-ldo]').forEach(function (b) { b.onclick = function () { S.ldOpen[b.dataset.ldo] = !S.ldOpen[b.dataset.ldo]; render(); }; });
  qa('[data-ldjobs]').forEach(function (b) { b.onclick = function () { drill(b.dataset.ldjobs + ' · ' + periodLabel(S.period), s.jobs.filter(function (j) { return j.loadN === b.dataset.ldjobs; }), [], 'Each job shows its revenue and direct costs.'); }; });
};

/* ---- customers ---- */
/* ==================== Customers (H1 to H5) ==================== */
function normName(n) { return String(n || '').toLowerCase().replace(/\b(ltd|limited|inc|co|company|investments?|enterprises?)\b/g, '').replace(/[^a-z0-9]/g, ''); }
/** Everything known about a customer, from the shared records (no separate customer ledger). */
/** Merge one customer record into another, after showing exactly what moves. */
function mergeSheet(from, preset) {
  var others = S.data.clients.filter(function (c) { return c.id !== from.id; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
  var count = function (id, nm) { return { inv: S.data.invoices.filter(function (i) { return i.clientId === id; }).length, q: (S.data.quotes || []).filter(function (x) { return x.clientId === id; }).length, bk: (S.data.bookings || []).filter(function (b) { return (b.client || '').trim().toLowerCase() === nm.trim().toLowerCase(); }).length }; };
  var n = count(from.id, from.name);
  openSheet('Merge ' + from.name,
    '<p>Use this when two records are the same customer. Everything on <b>' + esc(from.name) + '</b> moves to the customer you choose, and the <b>' + esc(from.name) + '</b> record is removed.</p>' +
    '<label class="f"><span>Keep this customer (its name is used everywhere)</span><select id="mgTo">' + others.map(function (c) { return '<option value="' + c.id + '"' + (preset && c.id === preset ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>' +
    '<div class="paybox"><span class="small muted">Moving from ' + esc(from.name) + '</span><b style="font-size:1.1rem">' + n.inv + (n.inv === 1 ? ' invoice' : ' invoices') + ', ' + n.q + (n.q === 1 ? ' quote' : ' quotes') + ', ' + n.bk + (n.bk === 1 ? ' booking' : ' bookings') + '</b></div>' +
    '<p class="small muted">Amounts, dates and payments do not change, including in closed months. Contact details are kept where the chosen customer has none. Invoices downloaded again will show the kept name. The merge is recorded in the Activity Log.</p>', 'Merge');
  $('sheetGo').onclick = function () { var to = S.data.clients.find(function (c) { return c.id === $('mgTo').value; });
    if (!confirm('Merge ' + from.name + ' into ' + to.name + '? This cannot be undone.')) return;
    api('mergeClients', { fromId: from.id, intoId: to.id }, 'Merging…').then(function (r) { closeSheet(); toast(from.name + ' merged into ' + to.name + ' (' + r.result.invoices + ' invoices).'); go('client', to.id, true); }).catch(function () {}); };
}
function custStats(c, f) {
  f = f || facts();
  var invs = S.data.invoices.filter(function (i) { return i.clientId === c.id; }), live = invs.filter(function (i) { return !i.void; });
  var jobs = f.jobs.filter(function (j) { return j.clientId === c.id; }), t = today();
  var billed = live.reduce(function (a, i) { return a + invTotal(i); }, 0), paid = live.reduce(function (a, i) { return a + invPaid(i); }, 0), owed = live.reduce(function (a, i) { return a + invBalance(i); }, 0);
  var od = live.filter(function (i) { return invStatus(i) === 'Overdue'; }), odAmt = od.reduce(function (a, i) { return a + invBalance(i); }, 0);
  var rev = jobs.reduce(function (a, j) { return a + j.amount; }, 0), cost = jobs.reduce(function (a, j) { return a + j.cost; }, 0);
  var last = jobs.map(function (j) { return j.date; }).sort().pop() || '';
  var timely = [], ds = [];
  live.forEach(function (i) { if (invBalance(i) > 0.009 || !i.payments.length || i.payments.some(function (p) { return /Imported as paid/.test(p.note || ''); })) return;
    var pd = i.payments.map(function (p) { return p.date; }).sort().pop(); ds.push(daysBetween(i.issueDate, pd)); timely.push(!i.dueDate || pd <= i.dueDate); });
  var onTime = timely.length ? timely.filter(Boolean).length / timely.length : null;
  // Attention band, from documented indicators only; never a credit score
  var band = 'Strong', why = [];
  if (odAmt > 0 && od.some(function (i) { return daysBetween(i.dueDate, t) > 60; })) { band = 'At Risk'; why.push('an invoice more than 60 days past due'); }
  else if (odAmt > 0) { band = 'Watch'; why.push(od.length + ' overdue ' + (od.length === 1 ? 'invoice' : 'invoices')); }
  if (onTime != null && timely.length >= 3 && onTime < 0.5) { band = band === 'Strong' ? 'Watch' : band; why.push('paid on time ' + pct(onTime) + ' of the time'); }
  if (rev && (rev - cost) / rev < 0.2) { band = band === 'Strong' ? 'Watch' : band; why.push('low contribution margin'); }
  if (last && daysBetween(last, t) > 120) why.push('no job for ' + daysBetween(last, t) + ' days');
  return { c: c, invs: invs, live: live, jobs: jobs, billed: billed, paid: paid, owed: owed, od: od, odAmt: odAmt, rev: rev, cost: cost, contrib: rev - cost, margin: rev ? (rev - cost) / rev : NaN,
    trips: jobs.length, last: last, avgDays: ds.length ? ds.reduce(function (a, b) { return a + b; }, 0) / ds.length : null, onTime: onTime, sample: timely.length, band: band, why: why,
    active: !!last && daysBetween(last, t) <= 90 };
}
S.cuQ = ''; S.cuF = 'all'; S.cuSort = 'billed';
VIEWS.clients = function () {
  var f = facts(), all = S.data.clients.map(function (c) { return custStats(c, f); });
  var q = S.cuQ.toLowerCase();
  var list = all.filter(function (x) {
    if (S.cuF === 'outstanding' && !(x.owed > 0.009)) return false; if (S.cuF === 'overdue' && !x.odAmt) return false;
    if (S.cuF === 'active' && !x.active) return false; if (S.cuF === 'inactive' && x.active) return false;
    return !q || (x.c.name + ' ' + (x.c.phone || '') + ' ' + (x.c.email || '') + ' ' + x.c.id).toLowerCase().indexOf(q) >= 0;
  }).sort(function (a, b) { var k = S.cuSort; return k === 'name' ? a.c.name.localeCompare(b.c.name) : k === 'owed' ? b.owed - a.owed : k === 'last' ? (b.last > a.last ? 1 : -1) : k === 'count' ? b.live.length - a.live.length : b.billed - a.billed; });
  var groups = {}; all.forEach(function (x) { var k = normName(x.c.name); if (!k) return; (groups[k] = groups[k] || []).push(x.c.name); });
  var dups = Object.keys(groups).filter(function (k) { return groups[k].length > 1; }).map(function (k) { return groups[k]; });
  var h = '<div class="mgrid" style="margin-bottom:12px">' +
    '<div class="mcard"><span class="ml">Customers</span><b>' + all.length + '</b><span class="ms">' + all.filter(function (x) { return x.active; }).length + ' active in 90 days</span></div>' +
    '<div class="mcard"><span class="ml">Total invoiced</span><b>' + ec(all.reduce(function (a, x) { return a + x.billed; }, 0)) + '</b><span class="ms">All time, not cash</span></div>' +
    '<div class="mcard"><span class="ml">Outstanding</span><b>' + ec(all.reduce(function (a, x) { return a + x.owed; }, 0)) + '</b><span class="ms">Unpaid today</span></div>' +
    '<div class="mcard"><span class="ml">Overdue</span><b class="neg">' + ec(all.reduce(function (a, x) { return a + x.odAmt; }, 0)) + '</b><span class="ms">' + all.filter(function (x) { return x.odAmt; }).length + ' customers</span></div></div>' +
    (dups.length ? '<div class="alert">Possible duplicate customers, not merged automatically: ' + dups.map(function (d) { return esc(d.join(' / ')); }).join('; ') + '. Check whether these are the same account.' + (S.data.me.role === 'owner' ? ' Open the one to remove and tap <b>Merge into another customer</b>.' : '') + '</div>' : '') +
    '<div class="toolbar"><input type="search" id="cuq" placeholder="Search name, phone, email or reference" value="' + esc(S.cuQ) + '">' + (isViewOnly() ? '' : '<button class="btn gold" id="addC">+ New</button>') + '</div>' +
    '<div class="toolbar">' + [['all', 'All'], ['outstanding', 'Outstanding'], ['overdue', 'Overdue'], ['active', 'Active'], ['inactive', 'Inactive']].map(function (o) { return '<button class="chip" data-cuf="' + o[0] + '" aria-pressed="' + (S.cuF === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
    '<label class="f" style="max-width:280px"><span>Sort by</span><select id="cus">' + [['billed', 'Total invoiced'], ['owed', 'Outstanding'], ['last', 'Last job'], ['count', 'Invoice count'], ['name', 'Alphabetical']].map(function (o) { return '<option value="' + o[0] + '"' + (S.cuSort === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>' +
    '<div class="cu-grid">' + (list.length ? list.map(function (x) {
      return '<button class="card cu-card" data-c="' + x.c.id + '"><div class="cu-top"><b>' + esc(x.c.name) + '</b><span class="pill ' + (x.band === 'Strong' ? 'Paid' : x.band === 'Watch' ? 'Unpaid' : 'Overdue') + '">' + x.band + '</span></div>' +
        '<div class="cu-row"><div><span class="small muted">Total invoiced</span><b>' + ec(x.billed) + '</b></div><div><span class="small muted">Outstanding</span><b class="' + (x.odAmt ? 'neg' : '') + '">' + ec(x.owed) + '</b></div><div><span class="small muted">Last job</span><b>' + (x.last ? niceShort(x.last) : '–') + '</b></div></div>' +
        '<span class="small muted">' + x.live.length + (x.live.length === 1 ? ' invoice' : ' invoices') + ' · ' + x.trips + ' jobs' + (x.c.phone ? ' · ' + esc(x.c.phone) : ' · no phone saved') + '</span></button>'; }).join('') : '<div class="card empty">No customers match.</div>') + '</div>';
  $('view').innerHTML = h;
  if ($('addC')) $('addC').onclick = function () { clientEditor(); };
  qa('[data-c]').forEach(function (b) { b.onclick = function () { go('client', b.dataset.c); }; });
  qa('[data-cuf]').forEach(function (b) { b.onclick = function () { S.cuF = b.dataset.cuf; render(); }; });
  $('cus').onchange = function () { S.cuSort = this.value; render(); };
  $('cuq').oninput = function () { S.cuQ = this.value; var p = this.selectionStart; render(); var el = $('cuq'); el.focus(); el.setSelectionRange(p, p); };
};
S.c360 = 'overview';
VIEWS.client = function () {
  var c = S.data.clients.find(function (x) { return x.id === S.param; });
  if (!c) { $('view').innerHTML = '<div class="card empty">Customer not found.</div>'; return; }
  var x = custStats(c), tab = S.c360, ro = isViewOnly();
  $('title').textContent = c.name;
  var bookings = (S.data.bookings || []).filter(function (b) { return b.client === c.name; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var quotes = (S.data.quotes || []).filter(function (q) { return q.clientId === c.id; }).sort(function (a, b) { return b.no - a.no; });
  var h = '<div class="card c360"><div class="cu-top"><div><h2 style="margin:0">' + esc(c.name) + '</h2><span class="small muted">Customer account' + (x.jobs.length ? ' · since ' + nice(x.jobs.map(function (j) { return j.date; }).sort()[0]) : '') + '</span></div><span class="pill ' + (x.band === 'Strong' ? 'Paid' : x.band === 'Watch' ? 'Unpaid' : 'Overdue') + '">' + x.band + '</span></div>' +
    '<div class="mgrid" style="margin-top:12px"><div class="mcard"><span class="ml">Total invoiced</span><b>' + ec(x.billed) + '</b><span class="ms">Lifetime</span></div><div class="mcard"><span class="ml">Outstanding</span><b class="' + (x.odAmt ? 'neg' : '') + '">' + ec(x.owed) + '</b><span class="ms">' + (x.odAmt ? ec(x.odAmt) + ' overdue' : 'Nothing overdue') + '</span></div>' +
    '<div class="mcard"><span class="ml">Completed jobs</span><b>' + x.trips + '</b><span class="ms">' + (x.last ? 'Last ' + nice(x.last) : 'None yet') + '</span></div><div class="mcard"><span class="ml">Direct margin</span><b>' + (isNaN(x.margin) ? '–' : pct(x.margin)) + '</b><span class="ms">' + ec(x.contrib) + ' direct profit</span></div></div>' +
    '<div class="ins-chips tabs-row" style="margin-top:12px">' + [['overview', 'Overview'], ['trips', 'Jobs'], ['money', 'Financials'], ['docs', 'Invoices & Quotes']].map(function (o) { return '<button class="chip" data-c3="' + o[0] + '" aria-pressed="' + (tab === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>';
  if (tab === 'overview') {
    h += '<div class="card"><h2>Contact Information</h2><p style="margin:0">' + esc([c.phone, c.email, c.address].filter(Boolean).join(' · ') || 'No contact details saved') + '</p>' + (c.notes ? '<p class="muted small">' + esc(c.notes) + '</p>' : '') +
      (ro ? '' : '<div class="btn-row"><button class="btn quiet" id="editC">Edit details</button><button class="btn gold" id="invC">New invoice</button></div><button class="btn link" id="quoteC">New quote for ' + esc(c.name.split(' ')[0]) + '</button>') + '</div>' +
      '<div class="card"><h2>Account Insights</h2><ul class="obs">' +
      '<li class="' + (x.band === 'Strong' ? 'pos' : x.band === 'Watch' ? 'warn' : 'neg') + '">' + icon('shield', 'gi-obs') + '<div><b>Payment health: ' + x.band + '</b><p>' + (x.why.length ? 'Because of ' + x.why.join(', ') + '.' : 'No overdue balances, and margin is healthy.') + '</p><span class="small muted">Based on overdue balances, on-time payment (' + (x.sample ? x.sample + ' recorded payments' : 'no recorded payments yet') + '), activity and contribution margin. This is an internal attention flag, not a credit score.</span></div></li>' +
      (x.avgDays != null ? '<li class="info">' + icon('calendar', 'gi-obs') + '<div><b>Pays in ' + Math.round(x.avgDays) + ' days on average</b><p>On time ' + pct(x.onTime) + ' of the time.</p><span class="small muted">From ' + x.sample + ' payments recorded in the app.</span></div></li>' : '<li class="info">' + icon('info', 'gi-obs') + '<div><b>Payment timing</b><p>Insufficient data: payment speed appears once payments are recorded in the app.</p></div></li>') +
      '</ul></div>' +
      (bookings.length ? '<div class="card"><h2>Bookings</h2><ul class="list">' + bookings.slice(0, 5).map(function (b) { return '<li><button class="row-btn" data-bkgo="1"><span class="t">' + nice(b.date) + (b.time ? ' ' + esc(b.time) : '') + '</span><span class="a">' + (b.price ? ec(b.price * (b.qty || 1)) : '') + '</span><span class="m">' + esc(b.route || '') + ' · ' + esc(truckName(b.truck)) + '</span><span><span class="pill">' + bkStatusLabel(b.status) + '</span></span></button></li>'; }).join('') + '</ul></div>' : '');
  } else if (tab === 'trips') {
    var js = x.jobs.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    h += '<div class="card flush"><ul class="list clip" id="c3trips">' + (js.length ? js.map(function (j, k) { return '<li class="' + (k >= 8 ? 'xrow' : '') + '"><button class="row-btn" data-dinv="' + j.inv.id + '"><span class="t">' + esc(j.route || j.title) + '</span><span class="a">' + ec(j.amount) + '</span><span class="m">' + nice(j.date) + ' · ' + esc(truckName(j.truck)) + ' · ' + esc(j.load || '') + '</span><span class="m">' + (j.amount ? pct((j.amount - j.cost) / j.amount) + ' margin' : '') + '</span></button></li>'; }).join('') : '<li class="empty">No jobs yet.</li>') + '</ul><div style="padding:0 14px 10px">' + moreBtn('c3trips', js.length, 8, 'trips') + '</div></div>';
  } else if (tab === 'money') {
    h += '<div class="card"><h2>Account Financial Summary</h2><table><tbody><tr><td>Total invoiced</td><td class="n">' + ec2(x.billed) + '</td></tr><tr><td>Total payments received</td><td class="n">' + ec2(x.paid) + '</td></tr><tr class="total"><td>Outstanding balance</td><td class="n">' + ec2(x.owed) + '</td></tr>' +
      '<tr><td>Revenue from completed jobs</td><td class="n">' + ec2(x.rev) + '</td></tr><tr><td>Direct job costs</td><td class="n">' + ec2(-x.cost) + '</td></tr><tr class="total"><td>Direct profit</td><td class="n">' + ec2(x.contrib) + '</td></tr>' +
      '<tr><td>Average days to pay</td><td class="n">' + (x.avgDays != null ? Math.round(x.avgDays) + ' days' : 'Insufficient data') + '</td></tr></tbody></table>' +
      (openInvoicesFor(c.id).length && !ro ? '<div class="btn-row"><button class="btn" id="stmtC">Statement PDF</button>' + (c.phone ? '<button class="btn quiet" id="chaseC">WhatsApp balance</button>' : '<span></span>') + '</div>' : '') + '</div>';
  } else {
    h += '<div class="card flush"><h2 style="padding:14px 14px 0">Invoices</h2><ul class="list">' + (x.invs.length ? x.invs.slice().sort(function (a, b) { return b.issueDate > a.issueDate ? 1 : -1; }).map(function (i) { return invoiceRow(i, true); }).join('') : '<li class="empty">No invoices yet.</li>') + '</ul></div>' +
      '<div class="card flush"><h2 style="padding:14px 14px 0">Quotes</h2><ul class="list">' + (quotes.length ? quotes.map(quoteRow).join('') : '<li class="empty">No quotes.</li>') + '</ul></div>' +
      (S.data.me.role === 'owner' ? '<button class="btn quiet block" id="mergeC">Merge into another customer…</button><button class="btn link block" id="delC" style="color:var(--danger)">Delete customer</button>' + (x.invs.length ? '<p class="small muted" style="text-align:center;margin-top:-4px">Only possible once the customer has no invoices or quotes.</p>' : '') : '');
  }
  $('view').innerHTML = h; bindInvRows(); bindMore();
  qa('[data-c3]').forEach(function (b) { b.onclick = function () { S.c360 = b.dataset.c3; render(); }; });
  qa('[data-dinv]').forEach(function (b) { b.onclick = function () { go('invoice', b.dataset.dinv); }; });
  qa('[data-quote]').forEach(function (b) { b.onclick = function () { go('quote', b.dataset.quote); }; });
  qa('[data-bkgo]').forEach(function (b) { b.onclick = function () { go('bookings'); }; });
  if ($('editC')) $('editC').onclick = function () { clientEditor(c); };
  if ($('invC')) $('invC').onclick = function () { invoiceEditor(null, c); };
  if ($('quoteC')) $('quoteC').onclick = function () { invoiceEditor(null, c, 'quote'); };
  if ($('stmtC')) $('stmtC').onclick = function () { pdfSheet('Statement for ' + c.name, function () { return statementPdf(c); }, c); };
  if ($('chaseC')) $('chaseC').onclick = function () { window.open(waLink(c.phone, statementText(c)), '_blank'); };
  if ($('mergeC')) $('mergeC').onclick = function () { var twin = S.data.clients.find(function (o) { return o.id !== c.id && normName(o.name) === normName(c.name); }); mergeSheet(c, twin && twin.id); };
  if ($('delC')) $('delC').onclick = function () {
    if (!confirm('Delete ' + c.name + ' permanently? This cannot be undone.')) return;
    api('deleteClient', { clientId: c.id }, 'Deleting…').then(function () { toast(c.name + ' deleted.'); go('clients', null, true); }).catch(function () {});
  };
};
function clientEditor(c) {
  c = c || {};
  openSheet(c.id ? 'Edit customer' : 'New customer',
    '<label class="f"><span>Name</span><input id="kn" value="' + v(c.name) + '"></label><div class="cols"><label class="f"><span>Phone / WhatsApp</span><input id="kp" type="tel" value="' + v(c.phone) + '"></label>' +
    '<label class="f"><span>Email</span><input id="ke" type="email" value="' + v(c.email) + '"></label></div><label class="f"><span>Address</span><input id="ka" value="' + v(c.address) + '"></label>' +
    '<label class="f"><span>Notes</span><textarea id="kx">' + v(c.notes) + '</textarea></label>', 'Save');
  $('sheetGo').onclick = function () {
    api('saveClient', { client: { id: c.id, name: $('kn').value, phone: $('kp').value, email: $('ke').value, address: $('ka').value, notes: $('kx').value } }, 'Saving…')
      .then(function (res) { closeSheet(); toast('Customer saved.'); if (res.queued) return; if (S.view === 'client' || !c.id) go('client', res.result.id, S.view === 'client'); else render(); }).catch(function () {});
  };
}

/* ---- start-up costs ---- */
/* ==================== Capital & Investment (I1 to I3) ==================== */
S.ciTab = 'overview'; S.ciGrain = 'month'; S.ciQ = ''; S.ciTruck = 'all'; S.ciCat = 'all'; S.ciSort = 'date'; S.ciScen = null;
VIEWS.startup = function () {
  var tab = S.ciTab, items = S.data.startup || [], inv = startupTotal(), f = facts(), all = summarise(f, null, null), t = today();
  var ro = isViewOnly();
  var cum = all.net, transfers = (S.data.partnerTx || []).filter(function (x) { return x.type === 'Profit share'; }).reduce(function (a, x) { return a + x.amount; }, 0);
  var contribTotal = (S.data.capital || []).filter(function (k) { return k.type === 'contribution'; }).reduce(function (a, k) { return a + k.amount; }, 0);
  var h = '<div class="seg" style="margin-bottom:12px">' + [['overview', 'Overview'], ['assets', 'Assets'], ['tx', 'Transactions']].map(function (o) { return '<button data-ci="' + o[0] + '" aria-pressed="' + (tab === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  if (tab === 'overview') {
    var s90 = summarise(f, addDays(t, -89), t), pace = s90.net / (90 / 30.44), sc = S.ciScen == null ? Math.max(0, Math.round(pace / 500) * 500) : S.ciScen, left = inv - cum;
    h += '<div class="card cap-hero"><div class="kicker">Equipment &amp; Investment · all time</div><div class="mgrid" style="margin-top:8px">' +
      '<div class="mcard"><span class="ml">Total initial investment</span><b>' + ec(inv) + '</b><span class="ms">Recorded capital expenditure</span></div>' +
      '<div class="mcard"><span class="ml">Cumulative operating profit</span><b>' + ec(cum) + '</b><span class="ms">Accounting profit, all time</span></div>' +
      '<div class="mcard"><span class="ml">Profit / investment</span><b>' + (inv ? pct(cum / inv) : '–') + '</b><span class="ms">Not a measure of cash returned</span></div>' +
      '<div class="mcard"><span class="ml">Left to recover</span><b>' + ec(Math.max(0, inv - cum)) + '</b><span class="ms">Investment not yet matched by profit</span></div></div>' +
      '<p class="small muted" style="margin:8px 0 0">Cumulative profit is compared with what the trucks, machines and bins cost, for planning only. It is accounting profit, not cash in the bank.</p></div>';
    if ((S.data.capital || []).length && Math.abs(contribTotal - inv) > 1) h += '<div class="alert">Partner contributions total ' + ec2(contribTotal) + ', but equipment costs total ' + ec2(inv) + ': a difference of ' + ec2(Math.abs(contribTotal - inv)) + '. The two come from separate tables in the old workbook and are shown as recorded, not corrected, until the history is reviewed.</div>';
    h += '<div class="card"><div class="card-head"><h2 style="margin:0">Cumulative Profit against Investment</h2></div><div class="seg mini" style="margin:8px 0">' + [['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year']].map(function (g) { return '<button data-cig="' + g[0] + '" aria-pressed="' + (S.ciGrain === g[0]) + '">' + g[1] + '</button>'; }).join('') + '</div><div class="chart-box"><canvas id="cCum"></canvas></div></div>';
    var months = sc > 0 && left > 0 ? Math.ceil(left / sc) : null;
    h += '<div class="card"><h2>Profit-Equivalence Scenario</h2><p class="small muted" style="margin-top:0">How long until cumulative operating profit equals the initial investment, if every future month made the profit below. This is a planning scenario, not a cash payback forecast or a guarantee.</p>' +
      '<label class="f"><span>Assumed monthly operating profit: <b id="ciVal">' + ec(sc) + '</b></span><input type="range" id="ciR" min="0" max="25000" step="500" value="' + sc + '"></label>' +
      '<p class="small muted" style="margin-top:-6px">Recent pace: ' + ec(pace) + ' a month (last 90 days).</p>' +
      '<div class="mcard"><span class="ml">Time until cumulative profit equals initial investment</span><b id="ciOut">' + (left <= 0 ? 'Already reached' : months ? months + ' months (' + MONTH[parseIso(addMonths(t, months)).getMonth()] + ' ' + parseIso(addMonths(t, months)).getFullYear() + ')' : 'Not reached at this level') + '</b></div>' +
      '<p class="small muted">Assumes constant monthly profit, no further investment and no change in the accounting basis. Actual cash payback depends on cash actually taken out of the business, future capital spending and any resale value, none of which is assumed here.</p></div>';
  } else if (tab === 'assets') {
    h += TRUCKS.concat(uniq(items.map(function (x) { return x.truck; })).filter(function (x) { return TRUCKS.indexOf(x) < 0; })).map(function (tr) {
      var its = items.filter(function (x) { return x.truck === tr; }), capex = its.reduce(function (a, x) { return a + x.amount; }, 0);
      var js = f.jobs.filter(function (j) { return j.truck === tr; }), rev = js.reduce(function (a, j) { return a + j.amount; }, 0), dir = js.reduce(function (a, j) { return a + j.cost; }, 0), run = f.expenses.filter(function (e) { return e.truck === tr; }).reduce(function (a, e) { return a + e.amount; }, 0);
      var op = rev - dir - run, open = !!(S.ciOpen || {})[tr], byCat = {}; its.forEach(function (x) { byCat[x.category] = (byCat[x.category] || 0) + x.amount; });
      if (!capex && !rev) return '';
      return '<div class="card rt-card"><div class="rt-c-head"><div><b class="rt-name">' + esc(truckName(tr)) + '</b><span class="small muted">' + its.length + ' capital items · ' + (inv ? pct(capex / inv) : '–') + ' of investment</span></div><div style="text-align:right"><b class="rt-big">' + ec(capex) + '</b><span class="small muted">Recorded investment</span></div></div>' +
        '<div class="rt-c-row"><div><span class="small muted">Revenue</span><b>' + ec(rev) + '</b></div><div><span class="small muted">Operating profit</span><b class="' + (op < 0 ? 'neg' : '') + '">' + ec(op) + '</b></div><div><span class="small muted">Profit / cost</span><b>' + (capex ? pct(op / capex) : '–') + '</b></div></div>' +
        '<span class="small muted">Operating profit uses only this truck\'s own jobs and expenses, not an ownership split. Book value and resale estimates are not recorded.</span>' +
        '<button class="btn quiet block rt-tog" data-cio="' + esc(tr) + '">' + (open ? 'Hide capital breakdown ▴' : 'Show capital breakdown ▾') + '</button>' +
        (open ? '<table class="rt-costs"><tbody>' + Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; }).map(function (k) { return '<tr><td>' + esc(k) + '</td><td class="n">' + ec2(byCat[k]) + '</td></tr>'; }).join('') + '<tr class="total"><td>Total</td><td class="n">' + ec2(capex) + '</td></tr></tbody></table>' : '') + '</div>'; }).join('');
    h += '<div class="card"><h2>Investment by Vehicle</h2><div class="chart-box short"><canvas id="cInv"></canvas></div></div>';
  } else {
    var cats = uniq(items.map(function (x) { return x.category; })).sort(), q = S.ciQ.toLowerCase();
    var list = items.filter(function (x) { return (S.ciTruck === 'all' || x.truck === S.ciTruck) && (S.ciCat === 'all' || x.category === S.ciCat) && (!q || (x.category + ' ' + (x.description || '') + ' ' + (x.paidBy || '') + ' ' + (x.original || '')).toLowerCase().indexOf(q) >= 0); })
      .sort(function (a, b) { return S.ciSort === 'amount' ? b.amount - a.amount : S.ciSort === 'cat' ? a.category.localeCompare(b.category) : ((b.date || '') > (a.date || '') ? 1 : -1); });
    h += '<div class="toolbar"><input type="search" id="ciq" placeholder="Search capital expenses" value="' + esc(S.ciQ) + '">' + (ro ? '' : '<button class="btn gold" id="addS">+ Add</button>') + '</div>' +
      '<div class="cols"><label class="f"><span>Vehicle</span><select id="ciT"><option value="all">All trucks</option>' + uniq(items.map(function (x) { return x.truck; })).map(function (tr) { return '<option value="' + esc(tr) + '"' + (S.ciTruck === tr ? ' selected' : '') + '>' + esc(tr) + '</option>'; }).join('') + '</select></label>' +
      '<label class="f"><span>Category</span><select id="ciC"><option value="all">All categories</option>' + cats.map(function (c) { return '<option' + (S.ciCat === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="seg mini" style="margin-bottom:10px">' + [['date', 'Newest first'], ['amount', 'Largest first'], ['cat', 'By category']].map(function (o) { return '<button data-cis="' + o[0] + '" aria-pressed="' + (S.ciSort === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
      '<p class="small muted">' + list.length + ' items · ' + ec2(list.reduce(function (a, x) { return a + x.amount; }, 0)) + '</p>' +
      '<div class="card flush"><ul class="list">' + list.map(function (x) { return '<li><button class="row-btn" data-s="' + x.id + '"><span class="t">' + esc(x.category) + '</span><span class="a">' + ec2(x.amount) + '</span><span class="m">' + esc(x.truck) + (x.paidBy ? ' · paid by ' + esc(x.paidBy) : '') + (x.date ? ' · ' + nice(x.date) : '') + '</span><span class="m">' + (x.gbp ? '£' + F0.format(x.gbp) + ' original' + (x.rate ? ' at ' + x.rate : '') : x.original ? esc(x.original) : '') + (x.description ? ' · ' + esc(x.description) : '') + '</span></button></li>'; }).join('') + '</ul></div>' +
      '<p class="small muted">Original currency and amounts are kept as recorded. Any correction is logged in the Activity Log.</p>';
  }
  $('view').innerHTML = h;
  qa('[data-ci]').forEach(function (b) { b.onclick = function () { S.ciTab = b.dataset.ci; render(); }; });
  qa('[data-cig]').forEach(function (b) { b.onclick = function () { S.ciGrain = b.dataset.cig; render(); }; });
  qa('[data-cio]').forEach(function (b) { b.onclick = function () { S.ciOpen = S.ciOpen || {}; S.ciOpen[b.dataset.cio] = !S.ciOpen[b.dataset.cio]; render(); }; });
  qa('[data-cis]').forEach(function (b) { b.onclick = function () { S.ciSort = b.dataset.cis; render(); }; });
  if ($('ciq')) $('ciq').oninput = function () { S.ciQ = this.value; var p = this.selectionStart; render(); var el = $('ciq'); el.focus(); el.setSelectionRange(p, p); };
  if ($('ciT')) $('ciT').onchange = function () { S.ciTruck = this.value; render(); };
  if ($('ciC')) $('ciC').onchange = function () { S.ciCat = this.value; render(); };
  if ($('addS')) $('addS').onclick = function () { startupEditor(); };
  qa('[data-s]').forEach(function (b) { b.onclick = function () { if (!isViewOnly()) startupEditor(S.data.startup.find(function (x) { return x.id === b.dataset.s; })); }; });
  if ($('ciR')) $('ciR').oninput = function () { S.ciScen = +this.value; var m = this.value > 0 && left > 0 ? Math.ceil(left / this.value) : null;
    $('ciVal').textContent = ec(+this.value); $('ciOut').textContent = left <= 0 ? 'Already reached' : m ? m + ' months (' + MONTH[parseIso(addMonths(t, m)).getMonth()] + ' ' + parseIso(addMonths(t, m)).getFullYear() + ')' : 'Not reached at this level'; };
  if ($('cCum')) { var bs = grainBuckets(f, S.ciGrain === 'month' ? 'all' : S.ciGrain === 'quarter' ? 'qall' : 'year', null), run0 = 0;
    if (S.ciGrain === 'quarter') { bs = []; var ys = yearsWithData(); ys.forEach(function (y) { grainBuckets(f, 'quarter', y).forEach(function (b) { b.label = b.label + ' ' + String(y).slice(2); bs.push(b); }); }); }
    var cumS = bs.map(function (b) { run0 += b.net; return round2(run0); });
    chart('cCum', { data: { labels: bs.map(function (b) { return b.label; }), datasets: [{ type: 'line', label: 'Cumulative operating profit', data: cumS, borderColor: COLORS.gold, backgroundColor: COLORS.gold, tension: 0, pointRadius: 2, borderWidth: 2.5 }, { type: 'line', label: 'Initial investment', data: bs.map(function () { return round2(inv); }), borderColor: COLORS.navy, borderDash: [6, 4], pointRadius: 0, borderWidth: 2 }] },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: moneyTip() }, scales: { y: { ticks: moneyTicks(), title: { display: true, text: 'EC$' } }, x: { grid: { display: false } } } } }); }
  if ($('cInv')) { var tv = uniq(items.map(function (x) { return x.truck; })); chart('cInv', { type: 'bar', data: { labels: tv, datasets: [{ data: tv.map(function (tr) { return round2(items.filter(function (x) { return x.truck === tr; }).reduce(function (a, x) { return a + x.amount; }, 0)); }), backgroundColor: [COLORS.navy, COLORS.gold, COLORS.ocean], borderRadius: 4 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ec(c.parsed.x) + ' (' + pct(c.parsed.x / inv) + ')'; } } } }, scales: { x: { ticks: moneyTicks() }, y: { grid: { display: false } } } } }); }
};
function startupEditor(s) {
  var editing = !!(s && s.id); s = s || { truck: 'Skip truck', category: 'Incidentals' };
  openSheet(editing ? 'Edit equipment costs' : 'New equipment costs',
    '<div class="cols"><label class="f"><span>Truck</span><select id="st">' + opts(TRUCKS.concat(['Both trucks']), s.truck) + '</select></label>' +
    '<label class="f"><span>Type</span><select id="sc">' + opts(STARTUP_TYPES, s.category) + '</select></label></div>' +
    '<label class="f"><span>Description</span><input id="sx" value="' + v(s.description) + '"></label>' +
    '<div class="cols"><label class="f"><span>Amount in EC$</span><input id="sa" inputmode="decimal" value="' + v(s.amount) + '"></label>' +
    '<label class="f"><span>Original amount (e.g. £1,720)</span><input id="so" value="' + v(s.original) + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Who paid</span><select id="sp">' + payerOpts(s.paidBy) + '</select></label>' +
    '<label class="f"><span>Date (optional)</span><input id="sd" type="date" value="' + v(s.date) + '"></label></div>' +
    '<label class="f"><span>Notes</span><textarea id="sn">' + v(s.notes) + '</textarea></label>' +
    (editing ? '<button class="btn danger block" id="sDel">Delete this item</button>' : ''), 'Save');
  $('sheetGo').onclick = function () {
    api('saveStartup', { item: { id: s.id, truck: $('st').value, category: $('sc').value, description: $('sx').value, amount: $('sa').value, original: $('so').value, paidBy: $('sp').value, date: $('sd').value, notes: $('sn').value } }, 'Saving…')
      .then(function () { closeSheet(); toast('Saved.'); render(); }).catch(function () {});
  };
  if ($('sDel')) $('sDel').onclick = function () { if (confirm('Delete this equipment costs?')) api('deleteStartup', { id: s.id }, 'Saving…').then(function () { closeSheet(); toast('Deleted.'); render(); }); };
}

/* ---- partner split ---- */
VIEWS.partners = function () {
  var f = facts(), r = periodRange(S.period), ps = S.data.settings.partners || [];
  var bs = buckets(r.from ? r : { from: null, to: null }, f).map(function (b) { var x = summarise(f, b.from, b.to); x.label = b.label + (b.from.slice(0, 4) !== today().slice(0, 4) && S.period.type !== 'year' ? '' : ''); x.from = b.from; return x; });
  var tot = summarise(f, r.from, r.to);
  $('view').innerHTML = periodControl(render) + '<div class="card"><h2>' + esc(periodLabel(S.period)) + '</h2><div class="scroll-x"><table><thead><tr><th>Period</th><th class="n">Net profit</th>' +
    ps.map(function (p) { return '<th class="n">' + esc(p.name) + ' (' + p.share + '%)</th>'; }).join('') + '</tr></thead><tbody>' +
    bs.filter(function (b) { return b.income || b.costs; }).map(function (b) { return '<tr><td>' + esc(b.label) + '</td><td class="n ' + (b.net < 0 ? 'neg' : '') + '">' + ec2(b.net) + '</td>' +
      ps.map(function (p) { return '<td class="n">' + ec2(b.net * p.share / 100) + '</td>'; }).join('') + '</tr>'; }).join('') +
    '<tr class="total"><td>Total</td><td class="n">' + ec2(tot.net) + '</td>' + ps.map(function (p) { return '<td class="n">' + ec2(tot.net * p.share / 100) + '</td>'; }).join('') + '</tr></tbody></table></div></div>' +
    '<p class="small muted">Shares come from Business settings. Net profit is income minus every job cost and running expense.</p>';
};

/* ---- Excel export ---- */
function loadSheetJs() {
  if (window.XLSX) return Promise.resolve();
  return new Promise(function (res, rej) {
    var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = res; s.onerror = function () { rej(new Error('Could not load the Excel tool. Check your connection.')); }; document.head.appendChild(s);
  });
}
VIEWS.exportx = function () {
  $('view').innerHTML = periodControl(render) + '<div class="card"><h2>Download ' + esc(periodLabel(S.period)) + '</h2>' +
    '<p class="muted">An Excel workbook with sheets for monthly summary, jobs, invoices, payments, expenses, equipment costs and customers.</p>' +
    '<button class="btn gold block" id="doExport">Create Excel file</button></div>';
  $('doExport').onclick = function () {
    busy('Building workbook…');
    loadSheetJs().then(function () {
      var f = facts(), r = periodRange(S.period), X = window.XLSX, wb = X.utils.book_new();
      var add = function (name, rows) { X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No records in this period' }]), name); };
      add('Monthly summary', buckets(r.from ? r : { from: null, to: null }, f).map(function (b) { var s = summarise(f, b.from, b.to);
        return { From: b.from, To: b.to, Trips: s.trips, Income: round2(s.income), 'Job costs': round2(s.jobCosts), 'Running expenses': round2(s.overheads), 'Net profit': round2(s.net) }; }));
      add('Jobs', f.jobs.filter(function (j) { return within(j.date, r.from, r.to); }).map(function (j) { return { Date: j.date, Invoice: invNo(j.inv), Customer: j.client, Truck: j.truck, Route: j.route,
        'Type of work': j.category, Load: j.load, Description: j.title, Amount: j.amount, Labour: j.costs.labour || 0, 'Fuel & transport': j.costs.fuel || 0, Subcontractors: j.costs.subcontract || 0, Materials: j.costs.material || 0, Net: round2(j.amount - j.cost) }; }));
      add('Invoices', S.data.invoices.filter(function (i) { return within(i.issueDate, r.from, r.to); }).map(function (i) { return { Invoice: invNo(i), Issued: i.issueDate, Due: i.dueDate, Customer: clientOf(i).name,
        Total: invTotal(i), Paid: invPaid(i), Balance: invBalance(i), Status: invStatus(i), 'Cancelled reason': i.void ? i.void.reason : '' }; }));
      var pays = []; S.data.invoices.forEach(function (i) { i.payments.forEach(function (p) { if (within(p.date, r.from, r.to)) pays.push({ Date: p.date, Invoice: invNo(i), Customer: clientOf(i).name, Amount: p.amount, Method: p.method, Note: p.note, 'Recorded by': p.by }); }); });
      add('Payments', pays);
      add('Expenses', S.data.expenses.filter(function (e) { return within(e.date, r.from, r.to); }).map(function (e) { return { Date: e.date, Truck: e.truck, Type: e.category, Description: e.description,
        Amount: e.amount, Workshop: e.workshop || '', Parts: e.parts || 0, Labour: e.labour || 0, 'Other cost': e.other || 0, Method: e.method, 'Who paid': e.paidBy, Notes: e.notes, Cancelled: e.void ? e.void.reason : '' }; }));
      add('Equipment costs', S.data.startup.map(function (s) { return { Truck: s.truck, Type: s.category, Description: s.description, 'Amount EC$': s.amount, Original: s.original, 'Who paid': s.paidBy, Notes: s.notes }; }));
      add('Customers', S.data.clients.map(function (c) { return { Name: c.name, Phone: c.phone, Email: c.email, Address: c.address }; }));
      var out = X.write(wb, { type: 'array', bookType: 'xlsx' });
      var file = new File([out], 'NV-' + (r.from ? r.from + '-to-' + r.to : 'all-time') + '.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      busy(null);
      if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], title: file.name }).catch(function () {});
      else { var url = URL.createObjectURL(file); var a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); }
    }).catch(function (e) { busy(null); toast(e.message, true); });
  };
};

/* ---- Excel import (owner) ---- */
function serialIso(n) { return typeof n === 'number' ? new Date(Date.UTC(1899, 11, 30) + Math.round(n * 86400000)).toISOString().slice(0, 10) : ''; }
function parseWorkbook(X, wb) {
  var log = wb.Sheets['Transaction Log'];
  if (!log) throw new Error('This workbook has no "Transaction Log" sheet.');
  var rows = X.utils.sheet_to_json(log, { header: 1, raw: true, defval: '' });
  var groups = {}, order = [], expenses = [];
  for (var i = 3; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[0]).trim().toUpperCase() === 'TOTALS') break;
    var date = serialIso(r[0]), type = String(r[5]).trim(), amount = num(r[10]);
    if (!date || !amount) continue;
    if (type === 'Income') {
      var entry = String(r[1]).trim(), client = String(r[7]).trim() || 'Unknown customer', key = entry + '|' + client.toLowerCase();
      var route = String(r[3]).trim(), dest = route.split('→').pop().trim(), cat = String(r[6]).trim();
      var title = route.indexOf('→') > 0 && !/^SVG$/i.test(dest) ? 'Delivery to ' + dest : (/waste|garbage/i.test(cat) ? 'Waste removal to St Vincent' : 'Delivery to St Vincent');
      var boat = r[14], boatNote = typeof boat === 'string' && boat.trim() ? boat.trim() : '';
      if (!groups[key]) { groups[key] = { no: parseInt(entry.replace(/\D/g, ''), 10) || 0, client: client, lines: [], paid: /^paid$/i.test(String(r[9]).trim()), method: String(r[16]).trim(), notes: [] }; order.push(key); }
      var g = groups[key];
      g.lines.push({ date: date, truck: String(r[2]).trim(), route: route, category: cat, load: String(r[8]).trim(), title: title, detail: String(r[8]).trim(), qty: 1, price: amount,
        costs: { material: num(r[11]), driver: num(r[12]), fuel: num(r[13]), boat: typeof boat === 'number' ? boat : 0 }, costNote: boatNote ? 'Subcontractors: ' + boatNote : '' });
      if (String(r[18]).trim()) g.notes.push(String(r[18]).trim());
      if (!/^paid$/i.test(String(r[9]).trim())) g.paid = false;
    } else if (type === 'Expense') {
      expenses.push({ date: date, truck: String(r[2]).trim(), category: String(r[6]).trim(), description: String(r[8]).trim() || String(r[6]).trim(), amount: amount, method: String(r[16]).trim(), notes: String(r[18]).trim() });
    }
  }
  var invoices = order.map(function (k) {
    var g = groups[k], dates = g.lines.map(function (l) { return l.date; }).sort(), total = g.lines.reduce(function (t, l) { return t + l.price; }, 0);
    return { no: g.no, client: g.client, issueDate: dates[0], lines: g.lines, internalNotes: g.notes.join(' | '),
      payments: g.paid ? [{ date: dates[dates.length - 1], amount: total, method: g.method || 'Cheque', note: 'Imported as paid (payment date assumed)' }] : [] };
  });
  var startup = [], su = wb.Sheets['Start-Up Costs'];
  if (su) {
    var srows = X.utils.sheet_to_json(su, { header: 1, raw: true, defval: '' });
    for (var j = 6; j < srows.length; j++) {
      var s = srows[j], item = String(s[0]).trim();
      if (!item || /^TOTAL/i.test(item)) break;
      [[2, 1, 'Skip truck'], [4, 3, 'Tipper 1']].forEach(function (c) {
        var amt = num(s[c[0]]); if (amt > 0) startup.push({ truck: c[2], category: item, description: item + ' (' + c[2] + ')', amount: amt, original: String(s[c[1]]), notes: String(s[7]).trim() });
      });
    }
  }
  var capital = [], gbpRate = 0;
  if (su) {
    var crows = X.utils.sheet_to_json(su, { header: 1, raw: true, defval: '' }), partner = '';
    var rateRow = crows[3] || []; gbpRate = num(rateRow[2]);
    for (var k = 0; k < crows.length; k++) {
      var cr = crows[k], a = String(cr[0]).trim();
      if (/^CONTRIBUTION SUMMARY/i.test(a)) break;
      if (/^KAREEM$/i.test(a)) partner = 'Owner';
      else if (/^RAYDON/i.test(a)) partner = 'Raydon';
      else if (partner && /^DAF\s*\d/i.test(String(cr[1]).trim()) && num(cr[4]) > 0) {
        capital.push({ partner: partner, truck: 'DAF Truck ' + String(cr[1]).replace(/\D/g, ''), item: a, original: String(cr[2]).trim(), gbp: num(cr[3]), amount: num(cr[4]), notes: String(cr[6]).trim() });
      }
    }
  }
  var check = {};
  var dashName = wb.SheetNames.find(function (n) { return /Dashboard/i.test(n); });
  if (dashName) { var d = wb.Sheets[dashName]; check = { income: d.A5 && d.A5.v, expenses: d.E5 && d.E5.v, net: d.I5 && d.I5.v, invested: d.A16 && d.A16.v }; }
  return { invoices: invoices, expenses: expenses, startup: startup, capital: capital, gbpRate: gbpRate, check: check };
}
VIEWS.importx = function () {
  var has = S.data.invoices.length || S.data.expenses.length;
  $('view').innerHTML = '<div class="card"><h2>Import your workbook</h2><p class="muted">Choose "NV Construction V1.1.xlsx". The app reads the Transaction Log and Start-Up Costs sheets, shows you the totals, and only imports when you confirm.</p>' +
    (has ? '<div class="alert">The app already holds records. Importing will replace all invoices, expenses, customers and equipment costs with the workbook\'s contents.</div>' : '') +
    '<input type="file" id="xf" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></div><div id="preview"></div>';
  $('xf').onchange = function () {
    var file = this.files[0]; if (!file) return;
    busy('Reading workbook…');
    loadSheetJs().then(function () { return file.arrayBuffer(); }).then(function (buf) {
      var p = parseWorkbook(window.XLSX, window.XLSX.read(buf, { type: 'array' }));
      busy(null);
      var inc = 0, jc = 0; p.invoices.forEach(function (i) { i.lines.forEach(function (l) { inc += l.price; jc += Calc.lineCosts(l); }); });
      var ex = p.expenses.reduce(function (t, e) { return t + e.amount; }, 0), su = p.startup.reduce(function (t, s) { return t + s.amount; }, 0);
      var cmp = function (label, mine, theirs) { var ok = theirs == null || Math.abs(mine - theirs) < 0.05;
        return '<tr><td>' + label + '</td><td class="n">' + ec2(mine) + '</td><td class="n">' + (theirs == null ? '–' : ec2(theirs)) + '</td><td class="n ' + (ok ? 'pos' : 'neg') + '">' + (ok ? '✓' : '✗') + '</td></tr>'; };
      $('preview').innerHTML = '<div class="card"><h2>What was found</h2><p>' + p.invoices.length + ' invoices (' + p.invoices.reduce(function (t, i) { return t + i.lines.length; }, 0) + ' jobs), ' +
        p.expenses.length + ' expenses, ' + p.startup.length + ' equipment items, ' + p.capital.length + ' partner contributions (' + ec2(p.capital.reduce(function (t, k) { return t + k.amount; }, 0)) + ').</p><div class="scroll-x"><table><thead><tr><th></th><th class="n">Read</th><th class="n">Workbook dashboard</th><th></th></tr></thead><tbody>' +
        cmp('Income', inc, p.check.income) + cmp('Costs (all-in)', jc + ex, p.check.expenses) + cmp('Net profit', inc - jc - ex, p.check.net) + cmp('Equipment invested', su, p.check.invested) +
        '</tbody></table></div>' + (has ? '<label class="check"><input type="checkbox" id="xr"> Replace existing records</label>' : '') +
        '<button class="btn gold block" id="xgo">Import these records</button></div>';
      $('xgo').onclick = function () {
        api('importData', { payload: p, replace: has ? $('xr').checked : false }, 'Importing…').then(function (res) {
          toast('Imported ' + res.result.invoices + ' invoices and ' + res.result.expenses + ' expenses.'); go('dashboard');
        }).catch(function () {});
      };
    }).catch(function (e) { busy(null); toast(e.message || 'Could not read that file.', true); });
  };
};

/* ---- settings (owner) ---- */
/* ==================== Business Settings (O1 to O3) ==================== */
var SET_CATS = [['profile', 'user', 'Business Profile', 'Company details, contact and invoice footer'], ['bank', 'wallet', 'Banking & Payments', 'Bank details and payment terms'],
  ['routes', 'route', 'Pricing by Area', 'Standard prices by area, mainly for skip bin hire'], ['docs', 'invoice', 'Invoices & Quotes', 'Numbering, quote validity and document appearance'],
  ['fin', 'chart', 'Financial Settings', 'Targets, expense categories and closing months'], ['reports', 'bell', 'Reports & Notifications', 'Report emails, test email and backup alerts'],
  ['veh', 'truck', 'Vehicles & Machines', 'Trucks, excavator: registration, model and nicknames'], ['drivers', 'users', 'Crew', 'Crew chosen on jobs and paid through Crew & Pay']];
S.setCat = null;
function settingsLanding() {
  $('view').innerHTML = '<p class="small muted" style="margin-top:0">Manage your company information, financial rules and system preferences.</p>' +
    groupMenu([{ title: 'Business Settings', sub: '', items: SET_CATS.map(function (c) { return ['set:' + c[0], c[1], c[2], c[3]]; }) }]);
  qa('[data-go]').forEach(function (b) { b.onclick = function () { S.setCat = b.dataset.go.slice(4); window.scrollTo(0, 0); render(); }; });
}
function allRouteNames() { return uniq(ROUTES.concat(((S.data.settings.routeRates) || []).map(function (r) { return r.route; }))); }
function routeCard(rt, isNew) {
  var r = rateFor(rt) || {}, f2 = function (k, l) { return '<label class="f"><span>' + l + '</span><input data-rk="' + k + '" inputmode="decimal" value="' + esc(r[k] || '') + '" placeholder="–"></label>'; };
  var exp = (r.price || 0) - ['labour', 'material', 'subcontract', 'plant', 'fuel', 'tipping'].reduce(function (a, k) { return a + (r[k] || 0); }, 0);
  return '<div class="card rt-edit" data-route="' + esc(rt) + '">' + (isNew ? '<label class="f"><span>Area name</span><input data-rname placeholder="Mesopotamia"></label>' : '<div class="cu-top"><b>' + esc(rt) + '</b><span class="pill ' + (r.price ? 'Paid' : 'muted') + '">' + (r.price ? 'Active' : 'No standard price') + '</span></div>') +
    '<div class="cols">' + f2('price', 'Standard price (EC$)') + f2('labour', 'Usual labour cost') + '</div>' +
    '<details><summary class="small">Suggested optional costs, only when the business pays them</summary><div class="cols">' + f2('fuel', 'Fuel & transport') + f2('tipping', 'Tipping fees') + '</div><div class="cols">' + f2('material', 'Materials') + f2('plant', 'Equipment hire') + '</div></details>' +
    (r.price ? '<p class="small muted" style="margin:4px 0 0">Expected contribution after the usual costs' + (exp !== r.price - (r.labour || 0) ? ' and suggested costs' : '') + ': <b>' + ec(exp) + '</b> (' + pct(exp / r.price) + ')</p>' : '') + '</div>';
}
VIEWS.settings = function () {
  var s = S.data.settings;
  var fld = function (id, label, val, type) { return '<label class="f"><span>' + label + '</span><input id="' + id + '" ' + (type ? 'type="' + type + '" ' : '') + 'value="' + esc(val == null ? '' : val) + '"></label>'; };
  var cat = S.setCat;
  if (!cat) { settingsLanding(); return; }
  $('view').innerHTML = '<button class="btn link" id="setBack" style="margin:-6px 0 8px">‹ All settings</button><div class="card" data-cat="profile"><h2>Business Profile</h2><p class="small muted" style="margin-top:0">Shown on invoices, quotes and reports. The logo is already in use on every document.</p>' + fld('bn', 'Business name', s.businessName) + '<div class="cols">' + fld('bp', 'Phone', s.phone) + fld('bw', 'WhatsApp', s.whatsapp) + '</div>' +
    fld('be', 'Email', s.email, 'email') + '<label class="f"><span>Address</span><textarea id="ba">' + esc(s.address) + '</textarea></label>' + fld('bt', 'Footer line', s.tagline) + fld('bweb', 'Website', s.website || '') + '</div>' +
    '<div class="card" data-cat="bank"><h2>Banking &amp; Payments</h2>' + fld('kb', 'Bank', s.bankName) + '<div class="cols">' + fld('kn', 'Account name', s.accountName) + fld('ka', 'Account number', s.accountNumber) + '</div>' +
    fld('kx', 'Small print', s.invoiceNote) + '<div class="cols">' + fld('dd', 'Invoice due in (days)', s.paymentDays) + fld('kod', 'Remind me when overdue by (days)', s.overdueReminderDays || 0) + '</div><p class="small muted">Prices and payments are in EC$ (XCD).</p></div>' +
    '<div class="card" data-cat="docs"><h2>Invoices &amp; Quotes</h2><div class="cols">' + fld('dn', 'Next invoice number', S.data.nextInvoiceNo) + fld('dq', 'Days a quote is valid', s.quoteDays) + '</div>' + fld('dp', 'Default price per job when no area price (EC$)', s.defaultPrice) +
      '<p class="small muted">Numbering never reuses an existing invoice number. Changes apply to new documents only.</p><h3 class="rep-h">Document appearance</h3>' +
      [['docShowLogo', 'Show company logo', 'Logo in the document header'], ['docShowBank', 'Show payment instructions', 'Bank name, account name and number'], ['docShowTerms', 'Show payment terms', 'The payment deadline on invoices']].map(function (o) { return '<label class="switch-row"><span><b>' + o[1] + '</b><br><span class="small muted">' + o[2] + '</span></span><input type="checkbox" class="switch" id="' + o[0] + '"' + (s[o[0]] !== false ? ' checked' : '') + '></label>'; }).join('') +
      '<button class="btn quiet block" id="docPrev">Preview with your latest invoice</button></div>' +
    '<div class="card" data-cat="fin"><h2>Financial Settings</h2><p class="small muted" style="margin-top:0">Financial year: <b>January to December</b>. Profit is reported as operating profit (revenue less job costs and running expenses).</p><div class="cols">' + fld('dt', 'Monthly operating profit target (EC$)', s.monthlyTarget || '') + '<span></span></div>' +
      '<label class="f"><span>Running expense categories (comma separated)</span><input id="xcat" value="' + esc((s.expenseCategories && s.expenseCategories.length ? s.expenseCategories : EXPENSE_TYPES).join(', ')) + '"></label><p class="small muted">Categories already used by past expenses are always kept.</p></div>' +
    '<div class="card" data-cat="routes"><h2>Pricing by Area</h2><p class="small muted">Filled in automatically on invoices, quotes and bookings. Every job can still use a different price and its own actual costs; issued invoices never change.</p>' +
    '<input type="search" id="rtQ" placeholder="Search areas" style="margin-bottom:10px"><div id="rtCards">' + allRouteNames().map(function (rt) { return routeCard(rt); }).join('') + '</div>' +
    '<button class="btn quiet block" id="rtAdd">+ Add area</button></div>' +
    '<div class="card" data-cat="veh"><h2>Vehicles</h2><p class="small muted">The name on the left is what every job records, so it stays fixed. Nicknames and details show across the app.</p>' +
    vehicles().map(function (vh, i) { return '<div class="vehcard"><div class="cols"><label class="f"><span>Vehicle</span><input value="' + esc(vh.id) + '" disabled></label><label class="f"><span>Nickname</span><input data-vh="' + i + '" data-vk="nickname" value="' + esc(vh.nickname || '') + '"></label></div>' +
      '<div class="cols"><label class="f"><span>Registration plate</span><input data-vh="' + i + '" data-vk="plate" value="' + esc(vh.plate || '') + '" placeholder="Unconfigured"></label><label class="f"><span>Year</span><input data-vh="' + i + '" data-vk="year" inputmode="numeric" value="' + esc(vh.year || '') + '" placeholder="Unconfigured"></label></div>' +
      '<div class="cols"><label class="f"><span>Make</span><input data-vh="' + i + '" data-vk="make" value="' + esc(vh.make || '') + '"></label><label class="f"><span>Model</span><input data-vh="' + i + '" data-vk="model" value="' + esc(vh.model || '') + '" placeholder="Unconfigured"></label></div>' +
      '<label class="f"><span>VIN / chassis number</span><input data-vh="' + i + '" data-vk="vin" value="' + esc(vh.vin || '') + '" placeholder="Unconfigured"></label>' +
      '<label class="check"><input type="checkbox" data-vh="' + i + '" data-vk="active"' + (vh.active !== false ? ' checked' : '') + '> In service</label></div>'; }).join('') + '</div>' +
    '<div class="card" data-cat="drivers"><h2>Crew</h2><p class="small muted">Choose the crew member on each job to keep the Crew and Pay ledger.</p><div id="drvList">' +
    drivers().filter(function (d) { return d.active !== false; }).map(function (d, i) { return '<div class="cols drvrow"><label class="f"><span>Name</span><input data-dv="' + i + '" data-dk="name" value="' + esc(d.name) + '"></label><label class="f"><span>Phone</span><input data-dv="' + i + '" data-dk="phone" value="' + esc(d.phone || '') + '"></label><input type="hidden" data-dv="' + i + '" data-dk="id" value="' + esc(d.id) + '"></div>'; }).join('') +
    '</div><button class="btn quiet block" id="drvAdd">+ Add a crew member</button><p class="small muted">To retire a crew member, clear their name; past jobs keep it.</p></div>' +
    '<div class="card" data-cat="fin"><h2>' + icon('lock', 'gi-inline') + ' Closing months</h2><p class="small muted" style="margin-top:0">Months are closed and reopened one at a time on the Month-End screen, with a check of each month first.</p>' +
      '<p class="small">' + (closedList().length ? closedList().length + (closedList().length === 1 ? ' month closed' : ' months closed') + ', most recently ' + esc(ymName(closedList().slice().sort().pop())) + '.' : 'No months closed yet.') + '</p><button class="btn quiet block" data-go="monthend">Open Month-End ›</button></div>' +
    '<div class="card" data-cat="reports"><h2>Reports &amp; Notifications</h2><div id="mailStatus" class="small muted">Checking…</div>' +
    fld('er', 'Year-end pack goes to (1 January each year)', s.reportEmails) + fld('eb', 'Monthly backup goes here only if Google Drive is not connected', s.backupEmails) +
    '<p class="small muted" style="margin-top:-4px">Separate several addresses with commas. Monthly backups normally go to Google Drive: see Backups.</p>' +
    '<label class="switch-row"><span><b>Backup failure alerts</b><br><span class="small muted">Email the backup address if a scheduled backup fails.</span></span><input type="checkbox" class="switch" id="bkAl"' + (s.backupAlerts !== false ? ' checked' : '') + '></label>' +
    '<p class="small muted">Quarterly and annual report schedules are under Reports → Financial Reports. Each person chooses their own phone alerts under Notifications.</p>' +
    '<div class="btn-row" style="margin-top:4px"><button class="btn quiet" id="mTest">Send test email</button><button class="btn quiet" id="goRep">Report schedule ›</button></div></div>' +
    '<div class="set-save"><button class="btn gold block" id="saveS">Save changes</button></div>';
  qa('[data-cat]').forEach(function (c) { if (c.dataset.cat !== cat) c.style.display = 'none'; });
  $('title').textContent = (SET_CATS.find(function (c) { return c[0] === cat; }) || [0, 0, 'Business Settings'])[2];
  $('saveS').onclick = function () {
        var payload = { businessName: $('bn').value, phone: $('bp').value, whatsapp: $('bw').value, email: $('be').value, address: $('ba').value, tagline: $('bt').value, bankName: $('kb').value,
      accountName: $('kn').value, accountNumber: $('ka').value, invoiceNote: $('kx').value, paymentDays: $('dd').value, defaultPrice: $('dp').value, quoteDays: $('dq').value, monthlyTarget: $('dt').value,
      backupEmails: $('eb').value, reportEmails: $('er').value,
      vehicles: vehicles().map(function (vh, i) { var o = { id: vh.id }; qa('[data-vh="' + i + '"]').forEach(function (el) { o[el.dataset.vk] = el.type === 'checkbox' ? el.checked : el.value; }); return o; }),
      drivers: qa('.drvrow').map(function (row) { var o = {}; qa('[data-dk]', row).forEach(function (el) { o[el.dataset.dk] = el.value; }); return o; })
        .map(function (o) { if (o.name.trim()) { o.active = true; return o; } var old = drivers().find(function (d) { return d.id === o.id; }); return old ? Object.assign({}, old, { active: false }) : null; })
        .filter(Boolean).concat(drivers().filter(function (d) { return d.active === false; })),
      routeRates: qa('.rt-edit').map(function (cd) { var o = { route: (cd.querySelector('[data-rname]') || {}).value || cd.dataset.route }; qa('[data-rk]', cd).forEach(function (el) { o[el.dataset.rk] = el.value; }); return o; }),
      website: $('bweb').value, overdueReminderDays: $('kod').value, docShowLogo: $('docShowLogo').checked, docShowBank: $('docShowBank').checked, docShowTerms: $('docShowTerms').checked, backupAlerts: $('bkAl').checked,
      expenseCategories: uniq($('xcat').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean).concat(uniq(S.data.expenses.map(function (e) { return e.category; })))) };
    if (String($('dn').value) !== String(S.data.nextInvoiceNo)) payload.nextInvoiceNo = $('dn').value;
    api('saveSettings', { settings: payload }, 'Saving…').then(function () { toast('Saved.'); render(); }).catch(function () {});
  };
  if (window.PREVIEW) $('mailStatus').textContent = 'Email is not available in this preview.';
  else api('emailStatus', {}).then(function (r) {
    $('mailStatus').innerHTML = r.configured ? '<span class="pos"><b>Email is set up</b></span>, sending from ' + esc(r.from) + '.' : '<span class="neg"><b>Email is not set up yet.</b></span> Add GMAIL_ADDRESS and GMAIL_APP_PASSWORD in Netlify (see the setup notes), then redeploy.';
  }).catch(function () {});
  $('mTest').onclick = function () { api('sendTestEmail', {}, 'Sending…').then(function (r) { toast('Test email sent to ' + r.to + '.'); }).catch(function () {}); };
  $('goRep').onclick = function () { go('yearend'); };
  qa('[data-go="monthend"]').forEach(function (b) { b.onclick = function () { go('monthend'); }; });
  $('setBack').onclick = function () { S.setCat = null; render(); };
  $('docPrev').onclick = function () { var li = liveInvoices().sort(function (a, b) { return b.no - a.no; })[0]; if (!li) return toast('No invoices yet to preview.', true); pdfSheet('Preview: ' + invNo(li), function () { return makePdf(li); }, clientOf(li)); };
  $('rtQ').oninput = function () { var q = this.value.toLowerCase(); qa('.rt-edit').forEach(function (c) { c.style.display = c.dataset.route.toLowerCase().indexOf(q) >= 0 ? '' : 'none'; }); };
  $('rtAdd').onclick = function () { $('rtCards').insertAdjacentHTML('afterbegin', routeCard('', true)); $('rtCards').querySelector('[data-rname]').focus(); };
  $('drvAdd').onclick = function () { var n = qa('.drvrow').length; $('drvList').insertAdjacentHTML('beforeend', '<div class="cols drvrow"><label class="f"><span>Name</span><input data-dv="' + n + '" data-dk="name"></label><label class="f"><span>Phone</span><input data-dv="' + n + '" data-dk="phone"></label><input type="hidden" data-dv="' + n + '" data-dk="id" value=""></div>'); qa('.drvrow')[n].querySelector('input').focus(); };

};

/* ---- users (owner) ---- */
function roleLabel(r) { return r === 'driver' ? 'Crew' : r === 'other' ? 'View only' : 'Manager'; }
function roleSelect(attrs, val) { return '<select ' + attrs + '>' + [['member', 'Manager'], ['driver', 'Crew'], ['other', 'View only']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === val ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; }
/* ==================== Team & Permissions (P1) ==================== */
function userStatus(u) { return !u.active ? ['Suspended', 'Cancelled'] : (!u.lastLogin || u.mustChange) ? ['Pending', 'Unpaid'] : ['Active', 'Paid']; }
function newCode() { var a = new Uint8Array(24); (window.crypto || window.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
VIEWS.users = function () {
  var us = S.data.users, inv = S.data.invites || [];
  var acts = function (u) { return (S.data.audit || []).filter(function (a) { return a.by === u.name; }).length; };
  var h = '<div class="cu-top" style="margin-bottom:8px"><span class="small muted">' + us.length + ' accounts · access is checked on the server for every action</span></div>' + us.map(function (u) {
    var me = u.role === 'owner', st = userStatus(u);
    return '<div class="card"><div class="cu-top"><div><b style="font-size:1.05rem">' + esc(u.name) + '</b><div class="small muted">@' + esc(u.username) + '</div></div><span class="pill ' + st[1] + '">' + st[0] + '</span></div>' +
      '<table style="margin-top:6px"><tbody><tr><td>Role</td><td class="n">' + (me ? 'Owner' : roleSelect('class="role-sel" data-role="' + u.id + '"' + (u.active ? '' : ' disabled'), u.role)) + '</td></tr>' +
      '<tr><td>Setup</td><td class="n">' + (u.mustChange ? 'Must choose own password' : u.lastLogin ? 'Complete' : 'Not signed in yet') + (u.passkeys ? ' · Face ID on ' + u.passkeys + ' device' + (u.passkeys === 1 ? '' : 's') : '') + '</td></tr>' +
      '<tr><td>Last sign-in</td><td class="n">' + (u.lastLogin ? nice(u.lastLogin.slice(0, 10)) : 'Never') + '</td></tr><tr><td>Signed-in devices</td><td class="n">' + (u.sessions || 0) + '</td></tr><tr><td>Recorded activity</td><td class="n">' + acts(u) + ' changes</td></tr></tbody></table>' +
      '<div class="btn-row"><button class="btn quiet" data-reset="' + u.id + '">Reset password</button>' + (me ? '<span></span>' : '<button class="btn ' + (u.active ? 'danger' : 'quiet') + '" data-act="' + u.id + '" data-on="' + (u.active ? '0' : '1') + '">' + (u.active ? 'Suspend access' : 'Restore access') + '</button>') + '</div></div>'; }).join('');
  h += '<div class="card"><h2>Invite a Team Member</h2><p class="small muted" style="margin-top:0">Creates a secure link that works once and expires after 72 hours. They choose their own username and password; no password is shared.</p>' +
    '<label class="f"><span>Full name</span><input id="ivN" placeholder="e.g. Shawn Baptiste"></label><label class="f"><span>Role</span>' + roleSelect('id="ivR"', 'driver') + '</label>' +
    '<p class="small muted">Manager: everything except settings and team. Crew: jobs, fuel, reminders and incidents, with no prices or profit. View only: can look but not change anything.</p><button class="btn gold block" id="ivGo">Create invitation link</button></div>' +
    (inv.length ? '<div class="card"><h2>Pending Invitations</h2><ul class="list">' + inv.map(function (x) { return '<li><div class="row-btn" style="cursor:default"><span class="t">' + esc(x.name) + '</span><span class="a"><span class="pill Unpaid">' + roleLabel(x.role) + '</span></span><span class="m">Expires ' + nice(x.expires.slice(0, 10)) + ' · by ' + esc(x.createdBy) + '</span><span><button class="btn link" data-ivx="' + x.id + '" style="color:var(--danger)">Cancel</button></span></div></li>'; }).join('') + '</ul></div>' : '') +
    '<details class="cf-x"><summary>' + icon('key', 'gi-x') + '<span><b>Add with a temporary password instead</b><br><span class="small muted">The older method, if a link cannot be sent</span></span></summary><div class="cf-body">' +
    '<div class="cols"><label class="f"><span>Name</span><input id="nn"></label><label class="f"><span>Username</span><input id="nu" autocapitalize="none"></label></div><label class="f"><span>Access</span>' + roleSelect('id="nr"', 'member') + '</label>' +
    '<label class="f"><span>Temporary password (10+ characters)</span><input id="np" autocomplete="new-password"></label><button class="btn quiet block" id="addU">Give access</button></div></details>';
  $('view').innerHTML = h;
  qa('[data-role]').forEach(function (sel) { var was = sel.value; sel.onchange = function () { var to = sel.value, u = us.find(function (x) { return x.id === sel.dataset.role; });
    if (!confirm('Change ' + u.name + ' to ' + roleLabel(to) + '? They will be signed out on every device to apply it.')) { sel.value = was; return; }
    api('setUserRole', { userId: u.id, role: to }, 'Saving…').then(function () { toast(u.name + ' is now ' + roleLabel(to) + '.'); render(); }).catch(function () { sel.value = was; }); }; });
  $('ivGo').onclick = function () {
    var name = $('ivN').value.trim(), role = $('ivR').value, code = newCode(); if (!name) return toast('Enter their name.', true);
    api('createInvite', { name: name, role: role, code: code }, 'Creating…').then(function () {
      var link = location.origin + '/#/invite/' + code, msg = 'Hi ' + name.split(' ')[0] + ', you have been invited to NV Ops for ' + S.data.settings.businessName + '. Open this link to choose your username and password (it works once and expires in 72 hours):\n' + link;
      openSheet('Invitation ready', '<p>Send this link to <b>' + esc(name) + '</b>. It works once and expires in 72 hours.</p><textarea rows="5" readonly id="ivL">' + esc(link) + '</textarea>' +
        '<div class="btn-row"><button class="btn gold" id="ivWa">Send on WhatsApp</button><button class="btn quiet" id="ivCp">Copy link</button></div><button class="btn quiet block" id="ivMail" style="margin-top:8px">Send by email</button>');
      $('ivWa').onclick = function () { window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank'); };
      $('ivCp').onclick = function () { (navigator.clipboard ? navigator.clipboard.writeText(link) : Promise.reject()).then(function () { toast('Link copied.'); }).catch(function () { $('ivL').select(); }); };
      $('ivMail').onclick = function () { location.href = 'mailto:?subject=' + encodeURIComponent('Your NV Ops invitation') + '&body=' + encodeURIComponent(msg); };
      render();
    }).catch(function () {});
  };
  qa('[data-ivx]').forEach(function (b) { b.onclick = function () { if (confirm('Cancel this invitation?')) api('cancelInvite', { id: b.dataset.ivx }, 'Saving…').then(function () { render(); }).catch(function () {}); }; });
  $('addU').onclick = function () { api('addUser', { name: $('nn').value, username: $('nu').value, password: $('np').value, role: $('nr').value }, 'Saving…').then(function () { toast('Access given.'); render(); }).catch(function () {}); };
  qa('[data-act]').forEach(function (b) { b.onclick = function () { if (b.dataset.on === '0' && !confirm('Suspend access? They will be signed out on every device.')) return; api('setUserActive', { userId: b.dataset.act, active: b.dataset.on === '1' }, 'Saving…').then(function () { render(); }); }; });
  qa('[data-reset]').forEach(function (b) { b.onclick = function () { var p = prompt('New temporary password (at least 10 characters):'); if (!p) return; api('resetPassword', { userId: b.dataset.reset, password: p }, 'Saving…').then(function () { toast('Password reset. They will be asked to choose a new one.'); render(); }); }; });
};
/** The page an invited person opens: choose a username and password. */
function inviteScreen(code) {
  $('root').innerHTML = '<div class="auth"><img src="/logo.jpg" alt="NV Construction"><div class="brand">NV <span>Construction</span></div><div class="sub">Join NV Ops</div><div class="lane"></div><div class="form" id="ivBody"><p class="sub">Checking your invitation…</p></div></div>';
  fetch('/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'inviteInfo', code: code }) }).then(function (r) { return r.json(); }).then(function (d) {
    if (!d.valid) { $('ivBody').innerHTML = '<div class="alert err">This invitation has expired or has already been used. Ask for a new link.</div><a class="btn quiet block" href="/">Go to sign in</a>'; return; }
    $('ivBody').innerHTML = '<p>Welcome, <b>' + esc(d.name) + '</b>. You are joining ' + esc(d.business) + ' as <b>' + roleLabel(d.role) + '</b>.</p><form id="ivF"><label class="f"><span>Choose a username</span><input id="ivU" autocapitalize="none" autocomplete="username" required></label>' +
      '<label class="f"><span>Choose a password (10+ characters)</span><input id="ivP" type="password" autocomplete="new-password" required minlength="10"></label><button class="btn gold block" type="submit">Create my account</button></form>';
    $('ivF').onsubmit = function (e) { e.preventDefault();
      fetch('/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'acceptInvite', code: code, username: $('ivU').value, password: $('ivP').value }) }).then(function (r) { return r.json(); }).then(function (res) {
        if (!res.ok) return toast(res.error || 'That did not work.', true);
        try { localStorage.setItem('nv_token', res.token); } catch (x) {} location.replace('/#/dashboard'); location.reload(); }); };
  }).catch(function () { $('ivBody').innerHTML = '<div class="alert err">Could not reach the server. Check your connection.</div>'; });
}
/* ---- backups (owner) ---- */
VIEWS.backups = function () {
  $('view').innerHTML = '<div class="card"><h2>' + icon('archive', 'gi-inline') + ' Monthly backup to Google Drive</h2><div id="bkStatus" class="small muted">Checking…</div>' +
    '<p class="small">On the 1st of every month, a full copy for the month just ended is saved as <b>“' + esc(monthName(addMonths(today(), -1)) + ' Back Up') + '”</b> (a spreadsheet plus a restore copy) in the <b>NV Ops Backups</b> folder.</p>' +
    '<label class="f"><span>Share the backups folder with</span><input id="dsh" value="' + esc(S.data.settings.driveShare || '') + '" placeholder="email@example.com"></label>' +
    '<div class="btn-row" style="margin-top:0"><button class="btn quiet" id="dshSave">Save</button><button class="btn gold" id="bkNow">Back up now</button></div>' +
    '<p class="small muted">Back up now saves “' + esc(monthName(today()) + ' Back Up') + '”. It is replaced by the full month on the 1st.</p></div>' +
    '<div class="card"><h2>Daily backups</h2><p class="muted">A copy of every record is saved automatically each day and kept for 180 days. Restoring replaces current records with that day\'s copy. Users and passwords are not affected.</p><div id="bl" class="muted">Loading…</div></div>';
  if (window.PREVIEW) $('bkStatus').textContent = 'Not available in this preview.';
  else api('backupStatus', {}).then(function (r) {
    $('bkStatus').innerHTML = r.drive ? '<span class="pos"><b>Google Drive is connected.</b></span>' : '<span class="neg"><b>Google Drive is not connected yet.</b></span> ' + (r.email ? 'Until it is, monthly backups are emailed.' : 'Follow the Google Drive setup steps, then redeploy.');
  }).catch(function () {});
  $('dshSave').onclick = function () { api('saveSettings', { settings: { driveShare: $('dsh').value } }, 'Saving…').then(function () { toast('Saved. They get access at the next backup.'); }).catch(function () {}); };
  $('bkNow').onclick = function () { api('sendBackupNow', {}, 'Backing up…').then(function (r) { toast('“' + r.label + '” saved to ' + r.where + '.'); }).catch(function () {}); };
  if (window.PREVIEW) return;
  api('listBackups', {}).then(function (res) {
    $('bl').innerHTML = res.backups.length ? '<ul class="list">' + res.backups.map(function (k) { return '<li><div class="row-btn" style="cursor:default"><span class="t">' + nice(k) + '</span><span><button class="btn link" data-restore="' + k + '">Restore</button></span></div></li>'; }).join('') + '</ul>'
      : 'No backups yet. The first one is made within 24 hours of setup.';
    qa('[data-restore]').forEach(function (b) { b.onclick = function () {
      var t = prompt('Type RESTORE to replace all current records with the copy from ' + nice(b.dataset.restore) + '.');
      if (t !== 'RESTORE') return;
      api('restoreBackup', { key: b.dataset.restore }, 'Restoring…').then(function () { toast('Backup restored.'); go('dashboard'); }); }; });
  }).catch(function () {});
};

/* ---- activity ---- */
VIEWS.activity = function () {
  var a = S.data.audit || [];
  $('view').innerHTML = '<div class="card flush"><ul class="list">' + (a.length ? a.map(function (x) {
    return '<li><div class="row-btn" style="cursor:default"><span class="t">' + esc(x.action) + '</span><span class="a small muted">' + esc(x.ref || '') + '</span><span class="m">' + esc(x.by) + ' · ' + nice(x.at.slice(0, 10)) + ' ' + x.at.slice(11, 16) + ' UTC</span></div></li>'; }).join('') : '<li class="empty">No activity yet.</li>') + '</ul></div>';
};

/* ---- password ---- */
VIEWS.password = function () {
  $('view').innerHTML = '<div class="card"><label class="f"><span>Current password</span><input id="pc" type="password" autocomplete="current-password"></label>' +
    '<label class="f"><span>New password (at least 10 characters)</span><input id="pn" type="password" autocomplete="new-password"></label><button class="btn gold block" id="pgo">Change password</button></div>';
  $('pgo').onclick = function () { api('changePassword', { current: $('pc').value, password: $('pn').value }, 'Saving…').then(function () { toast('Password changed.'); go('more'); }).catch(function () {}); };
};

/* ==================== attachments ==================== */
function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
/** Files chosen on a form before the record exists; uploaded straight after it is saved. */
/** "Paid from invoice #052" line for an expense that an invoice's money covered. */
function fundedFrom(e) {
  if (!e || !e.id) return '';
  var F = Calc.expenseFunding(S.data, e.id); if (!F.from.length) return '';
  return '<div class="funded">' + icon('receipt', 'gi-inline') + '<span>Paid from ' + F.from.map(function (o) { return '<button class="btn link" data-fundinv="' + o.inv.id + '">' + invNo(o.inv) + '</button> (' + ec2(o.amount) + ')'; }).join(', ') + (F.total < e.amount - 0.005 ? '. ' + ec2(e.amount - F.total) + ' not covered by an invoice.' : '') + '</span></div>';
}
function bindFunded() { qa('[data-fundinv]').forEach(function (b) { b.onclick = function () { closeSheet(); go('invoice', b.dataset.fundinv); }; }); }
function pendingFiles(id) {
  var st = { files: [] };
  st.html = '<div class="pf" id="' + id + '"><div class="pf-list"></div><label class="rc-pick">' + icon('camera', 'gi-inline') + '<span>Attach photo or PDF</span><input type="file" accept="image/*,application/pdf" multiple hidden></label></div>';
  st.bind = function () {
    var box = $(id); if (!box) return;
    var draw = function () { box.querySelector('.pf-list').innerHTML = st.files.map(function (f, k) { return '<div class="rc-pick done">' + (f.thumb ? '<img src="' + f.thumb + '" alt="">' : icon('file', 'gi-inline')) + '<span>' + esc(f.file.name) + '</span><button type="button" class="btn link" data-pfrm="' + k + '" style="color:var(--danger)">Remove</button></div>'; }).join('');
      qa('[data-pfrm]', box).forEach(function (b) { b.onclick = function () { st.files.splice(+b.dataset.pfrm, 1); draw(); }; }); };
    box.querySelector('input').onchange = function () {
      Array.prototype.forEach.call(this.files, function (fl) {
        if (fl.size > 15 * 1048576) return toast(fl.name + ' is too large (15 MB maximum).', true);
        if (!/^image\/|^application\/pdf$/.test(fl.type)) return toast('Photos and PDFs only.', true);
        if (st.files.length >= 10) return toast('Up to 10 files per record.', true);
        var item = { file: fl }; st.files.push(item);
        if (/^image\//.test(fl.type)) shrinkImage(fl).then(function (d) { item.thumb = d; draw(); }).catch(draw);
      });
      this.value = ''; draw();
    };
  };
  st.upload = function (target) {
    if (!st.files.length || window.PREVIEW) return Promise.resolve(0);
    return st.files.reduce(function (p, it) { return p.then(function (n) {
      var img = /^image\//.test(it.file.type);
      if (!img && it.file.size > 8 * 1048576) { toast(it.file.name + ' is over 8 MB and was not attached.', true); return n; }
      return (img ? (it.thumb ? Promise.resolve(it.thumb) : shrinkImage(it.file)) : readAsDataUrl(it.file)).then(function (data) {
        return api('uploadFile', { target: target, file: { name: img ? it.file.name.replace(/\.[^.]+$/, '') + '.jpg' : it.file.name, type: img ? 'image/jpeg' : it.file.type, data: data } }, 'Attaching files…');
      }).then(function () { return n + 1; });
    }); }, Promise.resolve(0));
  };
  return st;
}
function attachmentsCard(title, list, editable) {
  list = list || [];
  return '<div class="card"><div class="card-head"><h2>' + esc(title) + '</h2><span class="kicker">' + list.length + '</span></div>' +
    (list.length ? '<ul class="list">' + list.map(function (a) {
      return '<li><div class="row-btn" style="cursor:default"><span class="t">' + icon(/^image/.test(a.type) ? 'camera' : 'file', 'gi-inline') + esc(a.name) + '</span><span class="a att-acts"><button class="btn link" data-viewfile="' + a.id + '">View</button>' +
        (editable ? ' <button class="btn link" data-delfile="' + a.id + '">Remove</button>' : '') + '</span><span class="m">' + fmtSize(a.size) + ' · added by ' + esc(a.by) + ' ' + nice(a.at.slice(0, 10)) + '</span></div></li>'; }).join('') + '</ul>'
      : '<p class="muted small">Delivery photos, signed dockets, receipts. Kept with this record.</p>') +
    (editable ? '<label class="btn quiet block" style="margin-top:8px">+ Add photo or PDF<input type="file" id="attIn" accept="image/*,application/pdf" style="display:none"></label>' : '') + '</div>';
}
function readAsDataUrl(blob) { return new Promise(function (res, rej) { var fr = new FileReader(); fr.onload = function () { res(fr.result); }; fr.onerror = rej; fr.readAsDataURL(blob); }); }
function shrinkImage(file) {
  return new Promise(function (res) {
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
      var cv = document.createElement('canvas'); cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      res(cv.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = function () { URL.revokeObjectURL(url); readAsDataUrl(file).then(res); };
    img.src = url;
  });
}
function dataUrlToFile(dataUrl, name) {
  var parts = dataUrl.split(','), type = (parts[0].match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  var bin = atob(parts[1]), bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], name, { type: type });
}
function bindAttachments(target, list) {
  if ($('attIn')) $('attIn').onchange = function () {
    var f = this.files[0]; if (!f) return;
    if (f.size > 8 * 1048576) { toast('That file is too large. Keep files under 8 MB.', true); return; }
    busy('Uploading…');
    (/^image\//.test(f.type) ? shrinkImage(f) : readAsDataUrl(f)).then(function (data) {
      var name = /^image\//.test(f.type) ? (f.name || 'photo').replace(/\.[^.]+$/, '') + '.jpg' : f.name;
      return api('uploadFile', { target: target, file: { name: name, type: /^image\//.test(f.type) ? 'image/jpeg' : f.type, data: data } }, 'Uploading…');
    }).then(function () { toast('File added.'); if (!$('sheet-wrap').classList.contains('hidden')) closeSheet(); render(); }).catch(function () { busy(null); });
  };
  qa('[data-viewfile]').forEach(function (b) { b.onclick = function () {
    var meta = (list || []).find(function (a) { return a.id === b.dataset.viewfile; }) || { name: 'file' };
    api('getFile', { id: b.dataset.viewfile }, 'Opening…').then(function (res) {
      var d = res.file.data;
      if (/^data:image/.test(d)) {
        openSheet(meta.name, '<img src="' + d + '" alt="" style="width:100%;border-radius:10px;border:1px solid var(--rule)"><div style="height:12px"></div><button class="btn gold block" id="shareAtt">Share</button>');
        $('shareAtt').onclick = function () { shareFile(dataUrlToFile(d, meta.name), meta.name); };
      } else shareFile(dataUrlToFile(d, meta.name), meta.name);
    }).catch(function () {});
  }; });
  qa('[data-delfile]').forEach(function (b) { b.onclick = function () {
    if (!confirm('Remove this file?')) return;
    api('deleteFile', { target: target, id: b.dataset.delfile }, 'Removing…').then(function () { toast('File removed.'); if (!$('sheet-wrap').classList.contains('hidden')) closeSheet(); render(); }).catch(function () {});
  }; });
}

/* ==================== quotes ==================== */
function quoteStatus(q) { if (q.status === 'Open' && q.validUntil < today()) return 'Expired'; return q.status; }
function quoteRow(q) {
  var st = quoteStatus(q), cls = { Open: 'Unpaid', Accepted: 'Paid', Declined: 'Cancelled', Expired: 'Overdue' }[st];
  return '<li><button class="row-btn" data-quote="' + q.id + '"><span class="t">' + esc(clientOf(q).name) + '</span><span class="a">' + ec2(quoteTotal(q)) + '</span><span class="m">' +
    quoteNo(q) + ' · ' + nice(q.issueDate) + ' · valid to ' + nice(q.validUntil) + '</span><span><span class="pill ' + cls + '">' + st + '</span></span></button></li>';
}
VIEWS.quote = function () {
  var q = S.data.quotes.find(function (x) { return x.id === S.param; });
  if (!q) { $('view').innerHTML = '<div class="card empty">Quote not found.</div>'; return; }
  var c = clientOf(q), st = quoteStatus(q), costs = q.lines.reduce(function (t, l) { return t + lineCosts(l); }, 0), total = quoteTotal(q);
  $('title').textContent = 'Quote ' + quoteNo(q);
  var h = '<div class="inv-hero"><div class="inv-top"><div class="no">' + quoteNo(q) + '</div><span class="pill ' + ({ Open: 'Unpaid', Accepted: 'Paid', Declined: 'Cancelled', Expired: 'Overdue' }[st]) + '">' + st + '</span></div>' +
    '<div class="client">' + esc(c.name) + '</div><div class="meta">Issued ' + nice(q.issueDate) + ' · Valid until ' + nice(q.validUntil) + '</div>' +
    '<div class="bal"><span class="meta">Quoted</span><span class="fig">' + ec2(total) + '</span></div></div>';
  if (q.status === 'Accepted') h += '<div class="alert">Accepted and turned into an invoice. <button class="btn link" id="toInv">Open the invoice ›</button></div>';
  if (q.status !== 'Accepted') h += '<div class="btn-row"><button class="btn gold" id="qSend">Send PDF</button><button class="btn" id="qConvert">Accepted: make invoice</button></div>';
  h += '<div class="card"><h2>Work quoted</h2><ul class="list lines">' + q.lines.map(function (l) {
    return '<li><div class="ln"><div><b>' + esc(l.title) + '</b><div class="small muted">' + esc([l.truck, l.route, l.load].filter(Boolean).join(' · ')) + '</div>' + (l.detail ? '<div class="small">' + esc(l.detail) + '</div>' : '') +
      (l.qty !== 1 ? '<div class="small muted">' + l.qty + ' × ' + ec2(l.price) + '</div>' : '') + '</div><div class="num"><b>' + ec2(lineAmount(l)) + '</b></div></div></li>'; }).join('') +
    '</ul><div class="ln total-ln"><b>Total</b><b class="num">' + ec2(total) + '</b></div>' +
    (costs ? '<p class="small muted" style="margin:10px 0 0">Estimated costs: ' + ec2(costs) + '. Expected net: <b>' + ec2(total - costs) + '</b>.</p>' : '') + '</div>';
  if (q.internalNotes) h += '<div class="card small"><b>Private notes:</b> ' + esc(q.internalNotes) + '</div>';
  h += attachmentsCard('Photos and documents', q.attachments, q.status !== 'Accepted');
  if (q.status !== 'Accepted') h += '<div class="stack"><button class="btn quiet block" id="qEdit">Edit quote</button>' +
    (q.status === 'Declined' ? '<button class="btn quiet block" id="qReopen">Reopen quote</button>' : '<button class="btn quiet block" id="qDecline">Customer declined</button>') +
    '<button class="btn danger block" id="qDel">Delete quote</button></div>';
  $('view').innerHTML = h;
  bindAttachments({ kind: 'quote', id: q.id }, q.attachments);
  if ($('toInv')) $('toInv').onclick = function () { go('invoice', q.invoiceId); };
  if ($('qSend')) $('qSend').onclick = function () { pdfSheet('Send ' + quoteNo(q), function () { return quotePdf(q); }, c, function () { api('markQuoteSent', { quoteId: q.id, via: 'Shared PDF' }).catch(function () {}); }); };
  if ($('qConvert')) $('qConvert').onclick = function () {
    openSheet('Make invoice from ' + quoteNo(q), '<p class="muted">Creates invoice #' + pad3(S.data.nextInvoiceNo) + ' with the same lines and prices. You can edit it afterwards.</p>' +
      '<label class="f"><span>Job date</span><input type="date" id="cvDate" value="' + today() + '"></label><button class="btn gold block" id="cvGo">Create invoice</button>');
    $('cvGo').onclick = function () { api('convertQuote', { quoteId: q.id, jobDate: $('cvDate').value }, 'Creating invoice…').then(function (res) { closeSheet(); toast('Invoice #' + pad3(res.result.no) + ' created.'); go('invoice', res.result.id); }).catch(function () {}); };
  };
  if ($('qEdit')) $('qEdit').onclick = function () { invoiceEditor(q, null, 'quote'); };
  if ($('qDecline')) $('qDecline').onclick = function () { api('setQuoteStatus', { quoteId: q.id, status: 'Declined' }, 'Saving…').then(render).catch(function () {}); };
  if ($('qReopen')) $('qReopen').onclick = function () { api('setQuoteStatus', { quoteId: q.id, status: 'Open' }, 'Saving…').then(render).catch(function () {}); };
  if ($('qDel')) $('qDel').onclick = function () { if (confirm('Delete this quote?')) api('deleteQuote', { quoteId: q.id }, 'Deleting…').then(function () { go('invoices'); }).catch(function () {}); };
};

/* ==================== truck reminders ==================== */
var REMINDER_TYPES = ['Insurance renewal', 'Crew member licence', 'Vehicle licence / road tax', 'Inspection', 'Service', 'Tyres', 'Brakes', 'Other'];
function kmLeft(r) { if (!r.dueKm) return null; var o = odometerOf(r.truck); return o ? r.dueKm - o : null; }
function remindersDue(days) {
  var limit = addDays(today(), days);
  return (S.data.reminders || []).filter(function (r) { var k = kmLeft(r); return (r.due && r.due <= limit) || (k !== null && k <= 1000); })
    .sort(function (a, b) { return (a.due || '9999') < (b.due || '9999') ? -1 : 1; });
}
function reminderLine(r) {
  var parts = [];
  if (r.due) { var d = daysBetween(today(), r.due); parts.push(d < 0 ? '<span class="neg">' + (-d) + (d === -1 ? ' day' : ' days') + ' overdue</span>' : d === 0 ? '<span class="neg">due today</span>' : 'due in ' + d + (d === 1 ? ' day' : ' days')); }
  var k = kmLeft(r); if (k !== null) parts.push(k <= 0 ? '<span class="neg">' + F0.format(-k) + ' km over</span>' : F0.format(k) + ' km to go');
  else if (r.dueKm) parts.push('at ' + F0.format(r.dueKm) + ' km');
  return '<li><button class="row-btn" data-rem="' + r.id + '"><span class="t">' + esc(r.type) + '</span><span class="a small">' + (r.due ? nice(r.due) : F0.format(r.dueKm) + ' km') + '</span><span class="m">' + esc(r.truck) + (r.note ? ' · ' + esc(r.note) : '') + '</span><span class="m">' + parts.join(' · ') + '</span></button></li>';
}
function bindReminders() { qa('[data-rem]').forEach(function (b) { b.onclick = function () { reminderSheet(S.data.reminders.find(function (r) { return r.id === b.dataset.rem; })); }; }); }
function reminderSheet(r) {
  var drv = isDriver(), odo = odometerOf(r.truck);
  openSheet(r.type, '<p><b>' + esc(r.truck) + '</b>' + (r.due ? ' · due ' + nice(r.due) : '') + (r.dueKm ? ' · due at ' + F0.format(r.dueKm) + ' km' : '') +
    (r.repeatMonths ? ' · every ' + r.repeatMonths + ' months' : '') + (r.everyKm ? ' · every ' + F0.format(r.everyKm) + ' km' : '') + '</p>' +
    (odo ? '<p class="small muted">Latest odometer reading: ' + F0.format(odo) + ' km</p>' : '') + (r.note ? '<p class="muted">' + esc(r.note) + '</p>' : '') +
    (drv ? '<p class="small muted">Tell the office when this has been done.</p>' :
    '<div class="card"><h2>Mark as done</h2><div class="cols"><label class="f"><span>Date done</span><input type="date" id="rdD" value="' + today() + '"></label>' +
    '<label class="f"><span>Cost (EC$, optional)</span><input id="rdC" inputmode="decimal"></label></div><div class="cols"><label class="f"><span>Paid by</span><select id="rdM">' + opts(METHODS, 'Cash') + '</select></label>' +
    '<label class="f"><span>Odometer now (km)</span><input id="rdO" inputmode="numeric" placeholder="' + (odo ? F0.format(odo) : '') + '"></label></div>' +
    '<p class="small muted">A cost is added to Expenses automatically.' + (r.repeatMonths || r.everyKm ? ' The next due point moves forward' + (r.repeatMonths ? ' ' + r.repeatMonths + ' months' : '') + (r.repeatMonths && r.everyKm ? ' and' : '') + (r.everyKm ? ' ' + F0.format(r.everyKm) + ' km' : '') + '.' : ' The reminder is then closed.') + '</p>' +
    '<button class="btn gold block" id="rdGo">Mark done</button></div>') +
    (r.history && r.history.length ? '<div class="card"><h2>History</h2><table><tbody>' + r.history.map(function (h) { return '<tr><td>Done ' + nice(h.done) + ' <span class="muted small">(due ' + nice(h.due) + ', ' + esc(h.by) + ')</span></td><td class="n">' + (h.cost ? ec2(h.cost) : '') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '') +
    (drv ? '' : '<div class="stack"><button class="btn quiet block" id="rdEdit">Edit reminder</button><button class="btn danger block" id="rdDel">Delete reminder</button></div>'));
  if (drv) return;
  $('rdGo').onclick = function () { api('completeReminder', { id: r.id, doneDate: $('rdD').value, cost: $('rdC').value, method: $('rdM').value, odometer: $('rdO').value }, 'Saving…').then(function () { closeSheet(); toast('Marked done.'); render(); }).catch(function () {}); };
  $('rdEdit').onclick = function () { reminderEditor(r); };
  $('rdDel').onclick = function () { if (confirm('Delete this reminder?')) api('deleteReminder', { id: r.id }, 'Deleting…').then(function () { closeSheet(); render(); }).catch(function () {}); };
}
function reminderEditor(r) {
  r = r || { truck: 'Skip truck', type: 'Insurance renewal', repeatMonths: 6, due: addDays(today(), 30) };
  openSheet(r.id ? 'Edit reminder' : 'New reminder',
    '<div class="cols"><label class="f"><span>Truck</span><select id="reT">' + truckOptsCompat(['Both trucks'], r.truck) + '</select></label>' +
    '<label class="f"><span>What</span><select id="reY">' + opts(REMINDER_TYPES, r.type) + '</select></label></div>' +
    '<div class="cols"><label class="f"><span>Due date</span><input type="date" id="reD" value="' + v(r.due) + '"></label>' +
    '<label class="f"><span>Repeats every</span><select id="reR">' + [[0, 'Does not repeat'], [3, '3 months'], [6, '6 months'], [12, '12 months'], [24, '24 months']].map(function (o) { return '<option value="' + o[0] + '"' + (Number(r.repeatMonths) === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label></div>' +
    '<div class="cols"><label class="f"><span>Or due at (km)</span><input id="reK" inputmode="numeric" value="' + v(r.dueKm) + '" placeholder="e.g. 250000"></label>' +
    '<label class="f"><span>Repeats every (km)</span><input id="reE" inputmode="numeric" value="' + v(r.everyKm) + '" placeholder="e.g. 15000"></label></div>' +
    '<label class="f"><span>Note</span><input id="reN" value="' + v(r.note) + '" placeholder="Policy number, licence holder, garage…"></label>' +
    '<label class="f"><span>Expected cost (EC$, optional, used in the cash-flow forecast)</span><input id="reC" inputmode="decimal" value="' + v(r.expectedCost) + '"></label>' +
    '<p class="small muted">Shows on Home and in phone alerts before the date (timing set under Maintenance & Compliance), or as the mileage approaches, using odometer readings from the fuel log.</p>', 'Save');
  $('sheetGo').onclick = function () { api('saveReminder', { reminder: { id: r.id, truck: $('reT').value, type: $('reY').value, due: $('reD').value, repeatMonths: $('reR').value, dueKm: $('reK').value, everyKm: $('reE').value, note: $('reN').value, expectedCost: $('reC').value } }, 'Saving…')
    .then(function () { closeSheet(); toast('Reminder saved.'); render(); }).catch(function () {}); };
}
VIEWS.reminders = function () {
  var t = today(), all = (S.data.reminders || []).slice(), set = S.data.settings, ad = (set.alertDays && set.alertDays.length ? set.alertDays : [30, 14, 7]);
  var stat = function (r) {
    var d = r.due ? daysBetween(t, r.due) : null, odo = odometerOf(r.truck), km = r.dueKm && odo ? r.dueKm - odo : null;
    var over = (d != null && d < 0) || (km != null && km < 0), urgent = (d != null && d <= 7) || (km != null && km <= 300), soon = (d != null && d <= ad[0]) || (km != null && km <= 1500);
    return { d: d, km: km, odo: odo, label: over ? 'Overdue' : urgent ? 'Urgent' : soon ? 'Due soon' : 'Scheduled', cls: over ? 'Overdue' : urgent ? 'Overdue' : soon ? 'Unpaid' : 'Paid' };
  };
  var dated = all.filter(function (r) { return r.due; }).sort(function (a, b) { return a.due < b.due ? -1 : 1; }), mileage = all.filter(function (r) { return r.dueKm && !r.due; }).sort(function (a, b) { return (stat(a).km || 0) - (stat(b).km || 0); });
  var card = function (r) { var x = stat(r), iv = r.everyKm || 0, pc = iv && x.km != null ? Math.max(0, Math.min(1, 1 - x.km / iv)) : null;
    return '<button class="card mc-card" data-rem="' + r.id + '"><div class="cu-top"><b>' + esc(r.type) + '</b><span class="pill ' + x.cls + '">' + x.label + '</span></div><span class="small muted">' + esc(truckName(r.truck)) + (r.note ? ' · ' + esc(r.note) : '') + '</span>' +
      (r.due ? '<span>' + (x.d < 0 ? '<b class="neg">' + Math.abs(x.d) + ' days overdue</b>' : '<b>' + x.d + ' days remaining</b>') + ' · ' + nice(r.due) + (r.repeatMonths ? ' · every ' + r.repeatMonths + ' months' : '') + '</span>' : '') +
      (r.dueKm ? '<span>' + (x.km == null ? 'Due at ' + F0.format(r.dueKm) + ' km (no odometer reading yet)' : (x.km < 0 ? '<b class="neg">' + F0.format(-x.km) + ' km overdue</b>' : '<b>' + F0.format(x.km) + ' km remaining</b>') + ' · due at ' + F0.format(r.dueKm) + ' km' + (iv ? ' · every ' + F0.format(iv) + ' km' : '')) + '</span>' : '') +
      (pc != null ? '<div class="meter" style="margin-top:6px"><span style="width:' + (pc * 100) + '%;background:' + (pc > .9 ? 'var(--danger)' : 'var(--gold)') + '"></span></div><span class="small muted">' + Math.round(pc * 100) + '% of the service interval used</span>' : '') +
      (r.expectedCost ? '<span class="small muted">Expected cost ' + ec(r.expectedCost) + '</span>' : '') + '</button>'; };
  var h = (isDriver() ? '' : '<div class="toolbar"><button class="btn gold" id="addRem">+ Add reminder</button></div>') +
    '<div class="mc-key small muted"><span class="pill Paid">Scheduled</span><span class="pill Unpaid">Due soon</span><span class="pill Overdue">Urgent</span><span class="pill Overdue">Overdue</span> Overdue items stay here until marked done.</div>' +
    '<h3 class="rep-h">Renewals and inspections by date</h3>' + (dated.length ? dated.map(card).join('') : '<div class="card empty">No date-based items. Add insurance, vehicle licence and inspection dates.</div>') +
    '<h3 class="rep-h">Servicing by mileage</h3>' + (mileage.length ? mileage.map(card).join('') : '<div class="card empty">No mileage-based services. Add each truck\'s own service interval (from the manufacturer or your mechanic), and the countdown uses odometer readings from the fuel log.</div>') +
    (S.data.me.role === 'owner' ? '<div class="card"><h2>Advance alerts</h2><p class="small muted" style="margin-top:0">Phone alerts are sent this many days before each date, plus 3 days, 1 day, on the day and weekly while overdue.</p><div class="ad-row">' +
      [60, 30, 14, 7].map(function (n) { return '<label class="check"><input type="checkbox" data-ad="' + n + '"' + (ad.indexOf(n) >= 0 ? ' checked' : '') + '> ' + n + ' days</label>'; }).join('') + '</div><button class="btn quiet block" id="adSave">Save alert timing</button></div>' : '') +
    '<p class="small muted">Intervals are whatever you enter for each truck; the app does not assume regulatory or manufacturer requirements.</p>';
  $('view').innerHTML = h;
  if ($('addRem')) $('addRem').onclick = function () { reminderEditor(); };
  if ($('adSave')) $('adSave').onclick = function () { var v2 = qa('[data-ad]').filter(function (c) { return c.checked; }).map(function (c) { return +c.dataset.ad; }); if (!v2.length) return toast('Choose at least one.', true);
    api('saveSettings', { settings: { alertDays: v2 } }, 'Saving…').then(function () { toast('Alert timing saved.'); }).catch(function () {}); };
  bindReminders();
};

/* ==================== reports ==================== */
function groupMenu(groups) {
  return groups.filter(function (g) { return g.items.length; }).map(function (g) {
    return '<section class="mgroup"><div class="mg-head"><h2>' + g.title + '</h2>' + (g.sub ? '<p>' + g.sub + '</p>' : '') + '</div><ul class="list">' +
      g.items.map(function (i) { return '<li><button class="row-btn" data-go="' + i[0] + '">' + tileIcon(i[1]) + '<span><span class="t">' + i[2] + '</span>' + (i[3] ? '<br><span class="m">' + i[3] + '</span>' : '') + '</span><span class="chev">›</span></button></li>'; }).join('') +
      '</ul></section>';
  }).join('');
}
function bindGo() { qa('[data-go]').forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; }); }
VIEWS.reports = function () {
  $('view').innerHTML = groupMenu([
    { title: 'Financial Performance', sub: 'Understand revenue, profitability and cash flow', items: [
      ['monthly', 'calendar', 'Financial Overview', 'Revenue, costs, operating profit and monthly trends'],
      ['opcosts', 'wallet', 'Operating Costs', 'Every cost broken down by type, truck, month and who paid'],
      ['yearend', 'book', 'Financial Reports', 'Annual report as a PDF, emailed every January'],
      ['cashflow', 'trend', 'Cash Flow Forecast', 'Expected receipts, payments and upcoming shortfalls']] },
    { title: 'Operations & Profitability', sub: 'Where the business makes and loses money', items: [
      ['aptperf', 'key', 'Occupancy and Revenue', 'Occupancy, nightly rates, booking sites and each unit'],
      ['projreport', 'chart', 'Project Performance', 'Margin by project, residential against commercial, win rate'],
      ['routes', 'route', 'Area Performance', 'Revenue, costs and contribution by area'],
      ['loads', 'package', 'Load Performance', 'Profitability by material and load type'],
      ['trucks', 'truck', 'Fleet Performance', 'Truck earnings, operating costs and efficiency'],
      ['custreport', 'users', 'Customer Performance', 'Revenue, profitability and payment behaviour']] },
    { title: 'Records', sub: 'Every transaction in one place', items: [
      ['log', 'receipt', 'Transaction Ledger', 'Search, filter and export all income and expenses']] },
    { title: 'Insights', sub: 'Decision-ready observations from your records', items: [
      ['insights', 'trend', 'Insights', 'Payback, pricing, customers, fleet and trends']] }
  ]);
  bindGo();
};
VIEWS.reportsOld = function () {
  var items = [['cashflow', 'trend', 'Cash flow', 'Money expected in and out over the coming weeks'], ['yearend', 'book', 'Year-end pack', 'Full-year accounts summary as a PDF'], ['monthly', 'calendar', 'Monthly performance', 'Every month: income, costs, profit, change'], ['routes', 'route', 'Area performance', 'Which areas make the most money'],
    ['loads', 'package', 'Load performance', 'Which materials bring in the most money and profit'],
    ['custreport', 'users', 'Customer performance', 'Profit, prices and how fast each customer pays'], ['trucks', 'truck', 'Trucks', 'Each truck\'s earnings and costs, plus reminders'],
    ['capital', 'pie', 'Partner capital and split', 'Contributions, profit share and payouts'], ['log', 'receipt', 'All transactions', 'Every job and expense, searchable']];
  $('view').innerHTML = '<div class="card flush menu"><ul class="list">' + items.map(function (i) {
    return '<li><button class="row-btn" data-go="' + i[0] + '">' + tileIcon(i[1]) + '<span><span class="t">' + i[2] + '</span><br><span class="m">' + i[3] + '</span></span><span class="chev">›</span></button></li>'; }).join('') + '</ul></div>';
  qa('[data-go]').forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; });
};

/* ---- monthly ---- */
S.year = null;
function yearsWithData() {
  var f = facts(), ys = uniq(f.jobs.map(function (j) { return j.date.slice(0, 4); }).concat(f.expenses.map(function (e) { return e.date.slice(0, 4); }))).sort();
  return ys.length ? ys : [today().slice(0, 4)];
}
function monthStats(f, y, m) {
  var from = y + '-' + String(m + 1).padStart(2, '0') + '-01', to = isoOf(new Date(+y, m + 1, 0));
  var x = summarise(f, from, to); x.from = from; x.to = to; x.m = m; return x;
}
/* ==================== shared report components ==================== */
/** Horizontally swipeable companion views with arrow buttons (charts beside tables). */
function swipe(id, panes) {
  return '<div class="swp card" id="' + id + '"><div class="swp-head"><h2 class="swp-title" style="margin:0">' + panes[0][0] + '</h2><span class="swp-nav"><button class="arr" data-swp="' + id + '" data-d="-1" aria-label="Previous view">‹</button>' +
    '<span class="swp-dots">' + panes.map(function (p, i) { return '<i' + (i ? '' : ' class="on"') + '></i>'; }).join('') + '</span><button class="arr" data-swp="' + id + '" data-d="1" aria-label="Next view">›</button></span></div>' +
    '<div class="swp-track">' + panes.map(function (p) { return '<div class="swp-pane" data-title="' + esc(p[0]) + '">' + p[1] + '</div>'; }).join('') + '</div></div>';
}
function bindSwipe(id) {
  var el = $(id); if (!el) return;
  var tr = el.querySelector('.swp-track'), panes = qa('.swp-pane', el), dots = qa('.swp-dots i', el);
  var idx = function () { return Math.max(0, Math.min(panes.length - 1, Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth)))); };
  var upd = function () { var i = idx(); dots.forEach(function (d, k) { d.classList.toggle('on', k === i); }); el.querySelector('.swp-title').textContent = panes[i].dataset.title;
    qa('[data-swp]', el).forEach(function (b) { b.disabled = +b.dataset.d < 0 ? i === 0 : i === panes.length - 1; }); };
  tr.addEventListener('scroll', function () { clearTimeout(tr._t); tr._t = setTimeout(upd, 60); });
  qa('[data-swp]', el).forEach(function (b) { b.onclick = function () { tr.scrollTo({ left: (idx() + (+b.dataset.d)) * tr.clientWidth, behavior: document.body.classList.contains('reduce-motion') ? 'auto' : 'smooth' }); }; });
  upd();
}
/** "Show all" toggles for long lists and tables. */
function moreBtn(target, total, shown, noun) { return total > shown ? '<button class="btn link more-btn" data-more="' + target + '" data-label="Show all ' + total + ' ' + noun + ' ▾" data-less="Show fewer ▴">Show all ' + total + ' ' + noun + ' ▾</button>' : ''; }
function bindMore() { qa('[data-more]').forEach(function (b) { b.onclick = function () { var o = $(b.dataset.more).classList.toggle('open'); b.textContent = o ? b.dataset.less : b.dataset.label; }; }); }
/** A list of the records behind any figure, each opening its source. */
function drill(title, jobs, exps, note) {
  var rows = (jobs || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (j) {
    return '<li><button class="row-btn" data-dinv="' + j.inv.id + '"><span class="t">' + esc(j.client) + '</span><span class="a">' + ec2(j.amount) + '</span><span class="m">' + nice(j.date) + ' · ' + esc(j.route || j.title || '') + ' · ' + invNo(j.inv) + '</span><span class="m">Job costs ' + ec2(j.cost) + '</span></button></li>'; })
    .concat((exps || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(function (e) {
      return '<li><button class="row-btn" data-dexp="' + e.id + '"><span class="t">' + esc(e.category) + '</span><span class="a">' + ec2(e.amount) + '</span><span class="m">' + nice(e.date) + ' · ' + esc(e.description || '') + (e.truck ? ' · ' + esc(e.truck) : '') + '</span><span></span></button></li>'; }));
  openSheet(title, (note ? '<p class="small muted">' + note + '</p>' : '') + (rows.length ? '<ul class="list">' + rows.join('') + '</ul>' : '<p class="muted">No records.</p>'));
  qa('[data-dinv]').forEach(function (b) { b.onclick = function () { closeSheet(); go('invoice', b.dataset.dinv); }; });
  qa('[data-dexp]').forEach(function (b) { b.onclick = function () { var e = S.data.expenses.find(function (x) { return x.id === b.dataset.dexp; }); closeSheet(); if (e) expenseEditor(e); }; });
}
function shiftYear(d, n) { return d ? (+d.slice(0, 4) + n) + d.slice(4) : d; }
S.cmp = 'prev';
function cmpRange(p) { var r = periodRange(p); if (S.cmp === 'lastyear') return r.from ? { from: shiftYear(r.from, -1), to: shiftYear(r.to, -1) } : null; return previousRange(p); }
function cmpLabel(p) { if (S.cmp === 'lastyear') { var r = periodRange(p); return r.from ? 'same period ' + (+r.from.slice(0, 4) - 1) : ''; } return prevLabel(p); }
function cmpControl() { return '<div class="cmp-row"><span class="small muted">Compare with</span><div class="seg mini">' + [['prev', 'Previous period'], ['lastyear', 'Same period last year']].map(function (o) { return '<button data-cmp="' + o[0] + '" aria-pressed="' + (S.cmp === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div></div>'; }
function bindCmp() { qa('[data-cmp]').forEach(function (b) { b.onclick = function () { S.cmp = b.dataset.cmp; render(); }; }); }
function chg(c, p, opt) {
  opt = opt || {}; if (p == null || !isFinite(c) || !isFinite(p)) return '';
  var d = c - p; if (Math.abs(d) < 0.005) return '<span class="chg-pill flat">No change</span>';
  var good = opt.invert ? d < 0 : d > 0, txt = opt.pts ? (d > 0 ? '+' : '−') + Math.abs(d * 100).toFixed(1) + ' pts' : opt.count ? (d > 0 ? '+' : '−') + Math.abs(d) : (p ? (d > 0 ? '+' : '−') + Math.abs(Math.round(d / Math.abs(p) * 100)) + '%' : (d > 0 ? '+' : '−') + ec(Math.abs(d)));
  return '<span class="chg-pill ' + (good ? 'up' : 'down') + '">' + txt + '</span>';
}
/** Report periods by grain: each month of a year, each quarter, each year, or every month. */
function grainBuckets(f, grain, y) {
  var out = [], t = today(), add = function (label, full, from, to) { var x = summarise(f, from, to); x.label = label; x.full = full; x.from = from; x.to = to; out.push(x); };
  if (grain === 'month') for (var m = 0; m < 12; m++) { var a = y + '-' + String(m + 1).padStart(2, '0') + '-01'; if (a > t) break; add(MON[m], MONTH[m] + ' ' + y, a, isoOf(new Date(+y, m + 1, 0))); }
  else if (grain === 'quarter') for (var q = 0; q < 4; q++) { var qa0 = y + '-' + String(q * 3 + 1).padStart(2, '0') + '-01'; if (qa0 > t) break; add('Q' + (q + 1), 'Q' + (q + 1) + ' ' + y, qa0, isoOf(new Date(+y, q * 3 + 3, 0))); }
  else if (grain === 'year') yearsWithData().forEach(function (yy) { add(yy, yy, yy + '-01-01', yy + '-12-31'); });
  else { var first = (f.jobs.map(function (j) { return j.date; }).concat(f.expenses.map(function (e) { return e.date; })).sort()[0] || t).slice(0, 7);
    for (var d = first + '-01'; d <= t; d = addMonths(d, 1)) { var dd = parseIso(d); add(MON[dd.getMonth()] + ' ' + String(dd.getFullYear()).slice(2), MONTH[dd.getMonth()] + ' ' + dd.getFullYear(), d, isoOf(new Date(dd.getFullYear(), dd.getMonth() + 1, 0))); } }
  while (out.length > 1 && !out[out.length - 1].income && !out[out.length - 1].costs && out[out.length - 1].from > t.slice(0, 8) + '01') out.pop();
  return out;
}

/* ==================== Financial Overview (C1 to C5) ==================== */
S.foGrain = 'month'; S.ftGrain = 'month'; S.ftShow = { rev: true, cost: true, prof: true }; S.ftPrevYear = false;
VIEWS.monthly = function () {
  var f = facts(), r = periodRange(S.period), pr = cmpRange(S.period);
  var cur = summarise(f, r.from, r.to), prev = pr ? summarise(f, pr.from, pr.to) : null, t = today();
  var open = !r.to || r.to >= t, noDriver = cur.jobs.filter(function (j) { return !(Number(j.costs.labour) > 0); }).length;
  var years = yearsWithData(); if (!S.year || years.indexOf(S.year) < 0) S.year = years[years.length - 1];
  var card = function (label, val, sub, c, cls) { return '<div class="mcard"><span class="ml">' + label + '</span><b class="' + (cls || '') + '">' + val + '</b><span class="ms">' + sub + '</span>' + (c || '') + '</div>'; };
  var h = '<div class="card fo"><div class="fo-head"><div><h2 style="margin:0">Financial Overview</h2><p class="muted" style="margin:2px 0 0">Revenue, costs and profitability</p></div>' + icon('trend', 'gi-head') + '</div>' +
    periodControl(render) + '<div class="fo-sub"><b>' + esc(periodLabel(S.period)) + '</b><span class="muted">EC$ · XCD</span></div>' + cmpControl() +
    '<div class="mgrid">' +
      card('Revenue', ec(cur.income), 'Total recorded income', chg(cur.income, prev && prev.income)) +
      '<button class="mcard" id="foCosts">' + '<span class="ml">Recorded costs ›</span><b>' + ec(cur.costs) + '</b><span class="ms">Job costs ' + ec(cur.jobCosts) + ' + running ' + ec(cur.overheads) + '</span>' + chg(cur.costs, prev && prev.costs, { invert: true }) + '</button>' +
      card('Operating profit', ec(cur.net), noDriver ? noDriver + (noDriver === 1 ? ' job has' : ' jobs have') + ' no labour cost recorded' : 'Revenue less all recorded costs', chg(cur.net, prev && prev.net), cur.net < 0 ? 'neg' : '') +
      card('Profit margin', isNaN(cur.margin) ? '–' : pct(cur.margin), 'Operating profit ÷ revenue', prev && !isNaN(prev.margin) && !isNaN(cur.margin) ? chg(cur.margin, prev.margin, { pts: true }) : '') +
      card('Cash received', ec(cur.received), 'Actual collections in the period', chg(cur.received, prev && prev.received)) +
      card('Completed jobs', String(cur.trips), 'Recorded jobs', prev ? chg(cur.trips, prev.trips, { count: true }) : '') +
    '</div><p class="small muted" style="margin:10px 0 0">' + (prev ? 'Changes compare with ' + esc(cmpLabel(S.period).toLowerCase()) + '. ' : '') + (open ? '<b>Provisional:</b> this period is still open, so figures will change. ' : '') +
      'Operating profit is before depreciation, finance costs and tax, none of which are recorded in the app.</p></div>';

  // C2: Financial Trends (one interactive chart)
  h += '<div class="card"><div class="card-head"><div><h2 style="margin:0">Financial Trends</h2><p class="small muted" style="margin:2px 0 0">Revenue, costs and profit over time. Tap a point to see that month\'s records.</p></div>' + icon('trend', 'gi-head') + '</div>' +
    '<div class="ft-legend">' + [['rev', 'Revenue', cur.income, 'var(--navy-3)'], ['cost', 'Costs', cur.costs, 'var(--ocean)'], ['prof', 'Profit', cur.net, 'var(--gold)']].map(function (m) {
      return '<button class="ft-key' + (S.ftShow[m[0]] ? ' on' : '') + '" data-ft="' + m[0] + '" aria-pressed="' + !!S.ftShow[m[0]] + '" style="--k:' + m[3] + '"><span>' + m[1] + '</span><b>' + ec(m[2]) + '</b></button>'; }).join('') + '</div>' +
    '<div class="ft-ctrl"><div class="seg mini">' + [['month', 'Monthly'], ['quarter', 'Quarterly'], ['year', 'Yearly']].map(function (g) { return '<button data-ftg="' + g[0] + '" aria-pressed="' + (S.ftGrain === g[0]) + '">' + g[1] + '</button>'; }).join('') + '</div>' +
    (S.ftGrain === 'month' ? '<label class="check" style="margin:0"><input type="checkbox" id="ftPY"' + (S.ftPrevYear ? ' checked' : '') + '> Previous year</label>' : '') + '</div>' +
    '<div class="chart-box tall"><canvas id="cFT" role="img" aria-label="Financial trends chart"></canvas></div></div>';

  // Month by month: grain Month / Quarter / Year / All, collapsible list and table
  var g = S.foGrain, bs = grainBuckets(f, g, S.year), withData = bs.filter(function (x) { return x.income || x.costs; });
  var best = withData.slice().sort(function (a, b) { return b.net - a.net; })[0];
  var gname = { month: 'Month by Month', quarter: 'Quarter by Quarter', year: 'Year by Year', all: 'Every Month' }[g];
  h += '<div class="card"><div class="card-head"><h2 style="margin:0">' + gname + '</h2>' + (best ? '<span class="kicker">Best: ' + esc(best.full) + '</span>' : '') + '</div>' +
    '<div class="seg" style="margin:8px 0">' + [['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year'], ['all', 'All']].map(function (o) { return '<button data-fog="' + o[0] + '" aria-pressed="' + (g === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
    (g === 'month' || g === 'quarter' ? '<div class="period-nav" style="margin:0 0 8px"><button id="yPrev"' + (years.indexOf(S.year) <= 0 ? ' disabled' : '') + '>‹</button><span class="label">' + S.year + '</span><button id="yNext"' + (years.indexOf(S.year) >= years.length - 1 ? ' disabled' : '') + '>›</button></div>' : '') +
    (withData.length ? '<div class="chart-box tall"><canvas id="cMonths"></canvas></div>' : '<p class="muted">No activity in this range.</p>') + '</div>';
  if (withData.length) {
    var listRows = withData.slice().reverse();
    h += '<div class="card flush"><ul class="list clip" id="foList">' + listRows.map(function (x, k) {
      var pi = bs.indexOf(x) - 1, pv = pi >= 0 ? bs[pi] : null, d = pv && (pv.income || pv.costs) ? x.net - pv.net : null;
      return '<li class="' + (k >= 3 ? 'xrow' : '') + '"><button class="row-btn" data-bucket="' + x.from + '|' + x.to + '|' + g + '"><span class="t">' + esc(x.full) + '</span><span class="a ' + (x.net < 0 ? 'neg' : '') + '">' + ec(x.net) + '</span>' +
        '<span class="m">' + x.trips + (x.trips === 1 ? ' job' : ' jobs') + ' · revenue ' + ec(x.income) + ' · costs ' + ec(x.costs) + '</span><span class="m">' + (x.income ? pct(x.margin) + ' margin' : '') +
        (d != null ? ' · <span class="' + (d >= 0 ? 'pos' : 'neg') + '">' + (d >= 0 ? '▲ ' : '▼ ') + ec(Math.abs(d)) + '</span>' : '') + '</span></button></li>'; }).join('') + '</ul>' +
      '<div style="padding:0 14px 10px">' + moreBtn('foList', listRows.length, 3, g === 'year' ? 'years' : g === 'quarter' ? 'quarters' : 'months') + '</div></div>';
    var tot = summarise(f, withData[0].from, withData[withData.length - 1].to), ct = costSplit(tot), extra = COST_TYPES.slice(4).filter(function (c) { return ct[c[0]]; });
    var cols = [['labour', 'Labour'], ['material', 'Materials'], ['subcontract', 'Subcontractors'], ['fuel', 'Fuel']].concat(extra.map(function (c) { return [c[0], c[1].split(' ')[0]]; }));
    h += '<div class="card"><h2>Full Table</h2><div class="scroll-x"><table class="clip" id="foTable"><thead><tr><th>Period</th><th class="n">Jobs</th><th class="n">Revenue</th>' + cols.map(function (c) { return '<th class="n">' + c[1] + '</th>'; }).join('') + '<th class="n">Running</th><th class="n">Op. profit</th></tr></thead><tbody>' +
      listRows.map(function (x, k) { var c = costSplit(x); return '<tr class="' + (k >= 3 ? 'xrow' : '') + '"><td>' + esc(x.label) + '</td><td class="n">' + x.trips + '</td><td class="n">' + F0.format(x.income) + '</td>' + cols.map(function (cc) { return '<td class="n">' + F0.format(c[cc[0]]) + '</td>'; }).join('') + '<td class="n">' + F0.format(x.overheads) + '</td><td class="n ' + (x.net < 0 ? 'neg' : '') + '">' + F0.format(x.net) + '</td></tr>'; }).join('') +
      '<tr class="total"><td>Total</td><td class="n">' + tot.trips + '</td><td class="n">' + F0.format(tot.income) + '</td>' + cols.map(function (cc) { return '<td class="n">' + F0.format(ct[cc[0]]) + '</td>'; }).join('') + '<td class="n">' + F0.format(tot.overheads) + '</td><td class="n">' + F0.format(tot.net) + '</td></tr>' +
      '</tbody></table></div>' + moreBtn('foTable', listRows.length, 3, 'rows') + '<p class="small muted">All figures in EC$, newest first. "Running" is expenses not tied to a single job.</p></div>';
  }

  // C3: Profit Breakdown
  var cs = costSplit(cur), ex = cur.exps, grp = function (cats) { return ex.filter(function (e) { return cats.indexOf(e.category) >= 0; }); };
  var insL = grp(['Insurance', 'Licensing']), maint = grp(['Maintenance', 'Repairs', 'Tyres']), fuelX = grp(['Fuel']), other = ex.filter(function (e) { return insL.indexOf(e) < 0 && maint.indexOf(e) < 0 && fuelX.indexOf(e) < 0; });
  var sumE = function (l) { return l.reduce(function (a, e) { return a + e.amount; }, 0); };
  var pl = function (label, amt, key, cls) { return '<tr class="' + (cls || '') + '"><td>' + (key ? '<button class="btn link pl-link" data-pl="' + key + '">' + label + '</button>' : label) + '</td><td class="n">' + amt + '</td></tr>'; };
  h += '<div class="card"><div class="card-head"><h2 style="margin:0">Profit Breakdown</h2><span class="kicker">' + esc(periodLabel(S.period)) + '</span></div><p class="small muted" style="margin:2px 0 8px">Tap any line to see the records behind it.</p><table class="pl"><tbody>' +
    pl('Total revenue', ec(cur.income), 'rev', 'pl-strong') + '<tr class="pl-sec"><td colspan="2">Direct job costs</td></tr>' +
    COST_TYPES.map(function (c) { return (cs[c[0]] || ['labour', 'material'].indexOf(c[0]) >= 0) ? pl('  ' + c[1], ec(-cs[c[0]]), 'c:' + c[0], 'pl-sub') : ''; }).join('') +
    pl('Gross contribution', ec(cur.income - cur.jobCosts), null, 'pl-strong') + '<tr class="pl-sec"><td colspan="2">Operating expenses <button class="btn link pl-link" data-go="opcosts" style="float:right;text-transform:none;letter-spacing:0">Full breakdown ›</button></td></tr>' +
    pl('  Insurance and licensing', ec(-sumE(insL)), 'x:ins', 'pl-sub') + pl('  Vehicle repairs and maintenance', ec(-sumE(maint)), 'x:maint', 'pl-sub') + pl('  Fuel not tied to a job', ec(-sumE(fuelX)), 'x:fuel', 'pl-sub') + pl('  Other running costs', ec(-sumE(other)), 'x:other', 'pl-sub') +
    pl('Operating profit', ec(cur.net), null, 'pl-total') + pl('  Depreciation', 'Not configured', null, 'pl-sub muted') + pl('  Finance costs and tax', 'Not recorded', null, 'pl-sub muted') +
    pl('Net profit', 'Not available', null, 'pl-strong muted') + '</tbody></table><p class="small muted">Net profit needs depreciation, finance costs and tax, which the app does not record, so operating profit is the bottom line shown. Equipment purchases are never counted as running expenses.</p></div>';

  // C4: Expense analysis and efficiency
  var rows4 = COST_TYPES.map(function (c) { var js = cur.jobs.filter(function (j) { return Number(j.costs[c[0]]) > 0; }), pjs = prev ? prev.jobs.filter(function (j) { return Number(j.costs[c[0]]) > 0; }) : [];
      return { label: c[1], kind: 'Direct', amt: cs[c[0]], prev: prev ? costSplit(prev)[c[0]] : null, trips: js.length, per: js.length ? cs[c[0]] / js.length : 0, key: 'c:' + c[0] }; })
    .concat(Object.keys(Calc.expenseSplit(ex)).map(function (k) { var sp = Calc.expenseSplit(ex), pp = prev ? Calc.expenseSplit(prev.exps) : {}; return { label: k, kind: 'Overhead', amt: sp[k], prev: prev ? (pp[k] || 0) : null, key: 'cat:' + k }; }))
    .filter(function (x) { return x.amt || x.prev; }).sort(function (a, b) { return b.amt - a.amt; });
  var totC = cur.costs || 1, avgDays = daysToPay(null);
  var owedNow = liveInvoices().filter(function (i) { return invBalance(i) > 0.009; }), owedT = owedNow.reduce(function (a, i) { return a + invBalance(i); }, 0), byC = {};
  owedNow.forEach(function (i) { var n = clientOf(i).name; byC[n] = (byC[n] || 0) + invBalance(i); }); var topC = Object.keys(byC).sort(function (a, b) { return byC[b] - byC[a]; })[0];
  h += '<div class="card"><h2>Expense Analysis</h2>' + (rows4.length ? '<div class="chart-box short"><canvas id="cExp"></canvas></div><div class="scroll-x"><table class="clip" id="expTable"><thead><tr><th>Category</th><th class="n">Amount</th><th class="n">Share</th><th class="n">Change</th><th class="n">Jobs · avg</th></tr></thead><tbody>' +
    rows4.map(function (x, k) { return '<tr class="' + (k >= 5 ? 'xrow' : '') + '"><td><button class="btn link pl-link" data-pl="' + x.key + '">' + esc(x.label) + '</button><br><span class="small muted">' + x.kind + '</span></td><td class="n">' + ec(x.amt) + '</td><td class="n">' + pct(x.amt / totC) + '</td><td class="n">' + (x.prev != null ? chg(x.amt, x.prev, { invert: true }) : '–') + '</td><td class="n">' + (x.kind === 'Direct' ? x.trips + ' · ' + ec(x.per) : '–') + '</td></tr>'; }).join('') +
    '</tbody></table></div>' + moreBtn('expTable', rows4.length, 5, 'categories') : '<p class="muted">No costs recorded in this period.</p>') +
    '<p class="small muted">Direct costs ' + ec(cur.jobCosts) + ' (' + pct(cur.jobCosts / totC) + ') · overhead ' + ec(cur.overheads) + ' (' + pct(cur.overheads / totC) + '). "Jobs · avg" shows how many jobs had that cost and the average on those jobs.</p></div>';
  var eff = [['Revenue per job', cur.trips ? ec(cur.income / cur.trips) : 'Insufficient data', prev && prev.trips && cur.trips ? chg(cur.income / cur.trips, prev.income / prev.trips) : ''],
    ['Direct cost per job', cur.trips ? ec(cur.jobCosts / cur.trips) : 'Insufficient data', prev && prev.trips && cur.trips ? chg(cur.jobCosts / cur.trips, prev.jobCosts / prev.trips, { invert: true }) : ''],
    ['Contribution per job', cur.trips ? ec((cur.income - cur.jobCosts) / cur.trips) : 'Insufficient data', ''],
    ['Operating margin', isNaN(cur.margin) ? 'Insufficient data' : pct(cur.margin), ''],
    ['Revenue growth', prev && prev.income ? pct((cur.income - prev.income) / prev.income) : 'Insufficient data', ''],
    ['Average days to payment', avgDays != null ? Math.round(avgDays) + ' days' : 'Insufficient data', ''],
    ['Receivables concentration', owedT ? pct(byC[topC] / owedT) : 'Nothing owed', owedT ? '<span class="small muted">' + esc(topC) + '</span>' : '']];
  h += '<div class="card"><h2>Financial Efficiency</h2><div class="eff-grid">' + eff.map(function (e) { return '<div class="eff"><span class="small muted">' + e[0] + '</span><b>' + e[1] + '</b>' + e[2] + '</div>'; }).join('') + '</div>' +
    (avgDays == null ? '<p class="small muted">Average days to payment appears once payments are recorded in the app (imported invoices have no real payment dates).</p>' : '') + '</div>';

  // C5: Financial Observations
  var obs = [];
  if (prev && (prev.trips || prev.costs)) {
    if (prev.net < 0 && cur.net > 0) obs.push(['trend', 'pos', 'Profitability improvement', esc(periodLabel(S.period)) + ' shows a move from a recorded loss of ' + ec(Math.abs(prev.net)) + ' (' + esc(cmpLabel(S.period).toLowerCase()) + ') to a profit of ' + ec(cur.net) + '.' + (open ? ' This period is still open.' : ''), 'Revenue and every recorded cost in both periods.']);
    else if (Math.abs(cur.net - prev.net) > Math.max(500, Math.abs(prev.net) * 0.2)) obs.push(['trend', cur.net > prev.net ? 'pos' : 'neg', cur.net > prev.net ? 'Profit up' : 'Profit down', 'Operating profit ' + (cur.net > prev.net ? 'rose' : 'fell') + ' from ' + ec(prev.net) + ' to ' + ec(cur.net) + ' against ' + esc(cmpLabel(S.period).toLowerCase()) + '.' + (open ? ' This period is still open, so the gap may narrow.' : ''), cur.trips + ' jobs now against ' + prev.trips + ' before.']);
    if (!isNaN(cur.margin) && !isNaN(prev.margin) && Math.abs(cur.margin - prev.margin) >= 0.1) obs.push(['chart', cur.margin > prev.margin ? 'pos' : 'warn', 'Margin ' + (cur.margin > prev.margin ? 'improved' : 'narrowed'), 'Operating margin moved from ' + pct(prev.margin) + ' to ' + pct(cur.margin) + '.', 'Operating profit ÷ revenue in each period.']);
    rows4.filter(function (x) { return x.prev && x.amt > x.prev * 1.5 && x.amt - x.prev > 300; }).slice(0, 1).forEach(function (x) { obs.push(['alarm', 'warn', esc(x.label) + ' costs rose', esc(x.label) + ' rose from ' + ec(x.prev) + ' to ' + ec(x.amt) + (x.kind === 'Direct' ? ', across ' + x.trips + (x.trips === 1 ? ' job' : ' jobs') : '') + '. One-off jobs can explain this, so check the records before acting.', 'Recorded ' + x.kind.toLowerCase() + ' costs.']); });
  }
  if (owedT && byC[topC] / owedT >= 0.5) obs.push(['alarm', 'neg', 'Receivables concentration', esc(topC) + ' accounts for ' + pct(byC[topC] / owedT) + ' of the ' + ec(owedT) + ' currently outstanding.', owedNow.length + ' unpaid invoices today.']);
  obs.push(noDriver ? ['clip', 'warn', 'Data completeness', noDriver + (noDriver === 1 ? ' job in this period has' : ' jobs in this period have') + ' no labour cost recorded, so profit is overstated until costs are added.', 'Job cost fields on each invoice line.']
    : ['clip', 'info', 'Data completeness', 'Every job in this period has its labour cost recorded. ' + (open ? 'The period is still open, so treat the result as provisional until the month is closed.' : 'Close the month in Business Settings to make the result final.'), cur.trips + ' jobs and ' + cur.exps.length + ' running expenses.']);
  if (cur.trips && cur.trips < 5) obs.push(['info', 'info', 'Limited history', 'Only ' + cur.trips + (cur.trips === 1 ? ' job is' : ' jobs are') + ' recorded in this period, too few to establish a trend.', 'Completed jobs in the selected period.']);
  h += '<div class="card"><h2>' + icon('bulb', 'gi-inline') + ' Financial Observations</h2><ul class="obs">' + obs.map(function (o) { return '<li class="' + o[1] + '">' + icon(o[0], 'gi-obs') + '<div><b>' + o[2] + '</b><p>' + o[3] + '</p><span class="small muted">Based on: ' + o[4] + '</span></div></li>'; }).join('') + '</ul></div>';

  $('view').innerHTML = h; bindYear(); bindCmp(); bindMore(); bindGo();
  if ($('foCosts')) $('foCosts').onclick = function () { go('opcosts'); };
  qa('[data-ft]').forEach(function (b) { b.onclick = function () { S.ftShow[b.dataset.ft] = !S.ftShow[b.dataset.ft]; if (!S.ftShow.rev && !S.ftShow.cost && !S.ftShow.prof) S.ftShow[b.dataset.ft] = true; render(); }; });
  qa('[data-ftg]').forEach(function (b) { b.onclick = function () { S.ftGrain = b.dataset.ftg; render(); }; });
  if ($('ftPY')) $('ftPY').onchange = function () { S.ftPrevYear = this.checked; render(); };
  qa('[data-fog]').forEach(function (b) { b.onclick = function () { S.foGrain = b.dataset.fog; render(); }; });
  qa('[data-bucket]').forEach(function (b) { b.onclick = function () { var p = b.dataset.bucket.split('|'); if (p[2] === 'month' || p[2] === 'all') go('month', p[0]); else { S.period = { type: p[2] === 'quarter' ? 'quarter' : 'year', anchor: p[0] }; window.scrollTo(0, 0); render(); } }; });
  qa('[data-pl]').forEach(function (b) { b.onclick = function () {
    var k = b.dataset.pl, lbl = b.textContent.trim();
    if (k === 'rev') return drill('Revenue · ' + periodLabel(S.period), cur.jobs, []);
    if (k.indexOf('c:') === 0) { var ck = k.slice(2); return drill(lbl + ' · ' + periodLabel(S.period), cur.jobs.filter(function (j) { return Number(j.costs[ck]) > 0; }), [], 'Jobs where the business paid this cost.'); }
    if (k.indexOf('cat:') === 0) return drill(lbl, [], ex.filter(function (e) { return (e.category || 'Other') === k.slice(4); }));
    drill(lbl, [], { 'x:ins': insL, 'x:maint': maint, 'x:fuel': fuelX, 'x:other': other }[k]);
  }; });
  // charts
  var tb = trendBuckets(f, S.ftGrain, r.to && r.to < t ? r.to : t);
  var ds = [], col = { rev: COLORS.navy, cost: COLORS.ocean, prof: COLORS.gold };
  [['rev', 'Revenue', 'income'], ['cost', 'Costs', 'costs'], ['prof', 'Profit', 'net']].forEach(function (m) {
    if (!S.ftShow[m[0]]) return;
    ds.push({ label: m[1], data: tb.map(function (x) { return round2(x[m[2]]); }), borderColor: col[m[0]], backgroundColor: col[m[0]], borderWidth: 2.5, pointRadius: 3.5, pointHoverRadius: 6, tension: 0, fill: false });
    if (S.ftPrevYear && S.ftGrain === 'month') ds.push({ label: m[1] + ' (previous year)', data: tb.map(function (x) { return round2(summarise(f, shiftYear(x.from, -1), shiftYear(x.to, -1))[m[2]]); }), borderColor: col[m[0]], borderDash: [5, 4], borderWidth: 1.5, pointRadius: 0, tension: 0, fill: false });
  });
  chart('cFT', { type: 'line', data: { labels: tb.map(function (x) { return x.label; }), datasets: ds },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: S.ftPrevYear, position: 'bottom', labels: { boxWidth: 12 } }, tooltip: moneyTip() },
      scales: { y: { ticks: { callback: function (v) { return 'EC$' + (Math.abs(v) >= 1000 ? (v / 1000) + 'K' : v); } }, title: { display: true, text: 'EC$' } }, x: { grid: { display: false }, title: { display: true, text: { month: 'Month', quarter: 'Quarter', year: 'Year' }[S.ftGrain] } } },
      onClick: function (e, els) { if (els && els.length && S.ftGrain === 'month') go('month', tb[els[0].index].from); } } });
  if (withData.length) chart('cMonths', { data: { labels: withData.map(function (x) { return x.label; }), datasets: [
    { type: 'bar', label: 'Revenue', data: withData.map(function (x) { return round2(x.income); }), backgroundColor: COLORS.navy, borderRadius: 4, order: 2 },
    { type: 'bar', label: 'Costs', data: withData.map(function (x) { return round2(x.costs); }), backgroundColor: COLORS.grey, borderRadius: 4, order: 3 },
    { type: 'line', label: 'Operating profit', data: withData.map(function (x) { return round2(x.net); }), borderColor: COLORS.gold, backgroundColor: COLORS.gold, borderWidth: 3, pointRadius: 3, tension: 0, order: 1 }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: moneyTip() }, scales: { y: { ticks: moneyTicks() }, x: { grid: { display: false } } },
      onClick: function (e, els) { if (els && els.length) { var x = withData[els[0].index]; if (g === 'month' || g === 'all') go('month', x.from); } } } });
  if ($('cExp')) { var top8 = rows4.slice(0, 8); var el = $('cExp'); el.parentNode.style.height = Math.max(150, 30 * top8.length + 40) + 'px';
    chart('cExp', { type: 'bar', data: { labels: top8.map(function (x) { return x.label; }), datasets: [{ data: top8.map(function (x) { return round2(x.amt); }), backgroundColor: top8.map(function (x) { return x.kind === 'Direct' ? COLORS.navy : COLORS.gold; }), borderRadius: 4 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ec(c.parsed.x) + ' (' + pct(c.parsed.x / totC) + ')'; } } } }, scales: { x: { ticks: moneyTicks() }, y: { grid: { display: false } } } } }); }
};
/** Rolling series for the trends chart: 12 months, 8 quarters or every year, ending at the selected period. */
function trendBuckets(f, grain, end) {
  var out = [], e = parseIso(end), add = function (label, from, to) { var x = summarise(f, from, to); x.label = label; x.from = from; x.to = to; out.push(x); };
  if (grain === 'month') for (var k = 11; k >= 0; k--) { var d = new Date(e.getFullYear(), e.getMonth() - k, 1); add(MON[d.getMonth()] + (d.getMonth() === 0 || k === 11 ? ' ' + String(d.getFullYear()).slice(2) : ''), isoOf(d), isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0))); }
  else if (grain === 'quarter') { var q0 = Math.floor(e.getMonth() / 3); for (var k2 = 7; k2 >= 0; k2--) { var d2 = new Date(e.getFullYear(), (q0 - k2) * 3, 1); add('Q' + (Math.floor(d2.getMonth() / 3) + 1) + ' ' + String(d2.getFullYear()).slice(2), isoOf(d2), isoOf(new Date(d2.getFullYear(), d2.getMonth() + 3, 0))); } }
  else yearsWithData().forEach(function (y) { add(y, y + '-01-01', y + '-12-31'); });
  return out;
}
function bindYear() {
  var years = yearsWithData();
  if ($('yPrev')) $('yPrev').onclick = function () { S.year = years[years.indexOf(S.year) - 1]; render(); };
  if ($('yNext')) $('yNext').onclick = function () { S.year = years[years.indexOf(S.year) + 1]; render(); };
}
function costSplit(x) { return Calc.costSplit(x.jobs); }
VIEWS.month = function () {
  var from = S.param || today().slice(0, 8) + '01', d = parseIso(from), f = facts();
  var x = monthStats(f, String(d.getFullYear()), d.getMonth()), prev = monthStats(f, String(new Date(d.getFullYear(), d.getMonth() - 1, 1).getFullYear()), (d.getMonth() + 11) % 12);
  var c = costSplit(x);
  $('title').textContent = MONTH[d.getMonth()] + ' ' + d.getFullYear();
  var rows = [['Jobs', x.trips, prev.trips, 'count'], ['Income', x.income, prev.income], ['Labour', c.labour, costSplit(prev).labour, 0, true], ['Fuel', c.fuel, costSplit(prev).fuel, 0, true],
    ['Subcontractors', c.subcontract, costSplit(prev).subcontract, 0, true], ['Materials', c.material, costSplit(prev).material, 0, true]].concat(
    (c.loading || costSplit(prev).loading) ? [['Loading', c.loading, costSplit(prev).loading, 0, true]] : [], (c.other || costSplit(prev).other) ? [['Other direct costs', c.other, costSplit(prev).other, 0, true]] : [], [['Running expenses', x.overheads, prev.overheads, 0, true], ['Net profit', x.net, prev.net], ['Margin', x.margin, prev.margin, 'pct']]);
  var h = '<div class="card"><div class="card-head"><h2>' + MONTH[d.getMonth()] + ' ' + d.getFullYear() + '</h2><span class="kicker">vs ' + MON[(d.getMonth() + 11) % 12] + '</span></div><div class="scroll-x"><table class="kpi-table"><thead><tr><th></th><th class="n">Before</th><th class="n">Now</th><th class="n">Change</th></tr></thead><tbody>' +
    rows.map(function (r) { var fmt = r[3] === 'pct' ? pct : r[3] === 'count' ? String : ec;
      return '<tr><td>' + r[0] + '</td><td class="n muted">' + fmt(r[2]) + '</td><td class="n"><b>' + fmt(r[1]) + '</b></td>' + (r[3] === 'count' ? changeCountCell(r[1], r[2]) : changeCell(r[1], r[2], r[3] === 'pct', r[4])) + '</tr>'; }).join('') + '</tbody></table></div></div>';
  h += '<div class="grid2"><div class="card"><h2>Areas this month</h2>' + miniTable(groupStats(x.jobs, 'route')) + '</div><div class="card"><h2>Customers this month</h2>' + miniTable(groupStats(x.jobs, 'client')) + '</div></div>';
  h += '<div class="card flush"><ul class="list">' + x.jobs.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (j) {
    return '<li><button class="row-btn" data-inv="' + j.inv.id + '"><span class="t">' + esc(j.title) + '</span><span class="a">' + ec2(j.amount) + '</span><span class="m">' + nice(j.date) + ' · ' + esc(j.client) + ' · ' + invNo(j.inv) + '</span><span class="m">net ' + ec(j.amount - j.cost) + '</span></button></li>'; }).join('') +
    x.exps.map(function (e) { return '<li><div class="row-btn" style="cursor:default"><span class="t">' + esc(e.description) + '</span><span class="a neg">−' + ec2(e.amount) + '</span><span class="m">' + nice(e.date) + ' · ' + esc(e.category) + '</span><span></span></div></li>'; }).join('') +
    (!x.jobs.length && !x.exps.length ? '<li class="empty">Nothing recorded this month.</li>' : '') + '</ul></div>';
  $('view').innerHTML = h; bindInvRows();
};
function groupStats(jobs, key) {
  var m = {};
  jobs.forEach(function (j) { var k = (j[key] || 'Not set').trim(); var g = m[k] || (m[k] = { name: k, trips: 0, income: 0, cost: 0, subcontract: 0, fuel: 0, labour: 0, material: 0, plant: 0, tipping: 0, other: 0 });
    g.trips++; g.income += j.amount; g.cost += j.cost; COST_KEYS.forEach(function (ck) { g[ck] += Number(j.costs[ck]) || 0; }); });
  return Object.keys(m).map(function (k) { var g = m[k]; g.net = g.income - g.cost; g.margin = g.income ? g.net / g.income : NaN; g.avg = g.income / g.trips; return g; }).sort(function (a, b) { return b.net - a.net; });
}
function miniTable(gs) {
  if (!gs.length) return '<p class="muted">None.</p>';
  return '<table><thead><tr><th></th><th class="n">Jobs</th><th class="n">Income</th><th class="n">Net</th></tr></thead><tbody>' + gs.map(function (g) {
    return '<tr><td>' + esc(g.name) + '</td><td class="n">' + g.trips + '</td><td class="n">' + ec(g.income) + '</td><td class="n">' + ec(g.net) + '</td></tr>'; }).join('') + '</tbody></table>';
}

/* ---- routes ---- */
/* ==================== Route Performance (E1 to E3) ==================== */
S.rtMetric = 'contrib'; S.rtSort = 'contrib'; S.rtSortDir = -1; S.rtOpen = {};
var RT_METRICS = [['contrib', 'Direct profit'], ['income', 'Revenue'], ['cost', 'Direct costs'], ['margin', 'Direct margin'], ['per', 'Per job']];
function rtVal(g, k) { return k === 'contrib' ? g.net : k === 'income' ? g.income : k === 'cost' ? g.cost : k === 'margin' ? g.margin : g.net / g.trips; }
function rtFmt(v, k) { return k === 'margin' ? pct(v) : ec(v); }
VIEWS.routes = function () {
  var f = facts(), r = periodRange(S.period), s = summarise(f, r.from, r.to), pr = previousRange(S.period), ps = pr ? summarise(f, pr.from, pr.to) : null;
  var gs = groupStats(s.jobs, 'route').filter(function (g) { return g.trips; });
  var h = periodControl(render);
  if (!gs.length) { $('view').innerHTML = h + '<div class="card empty">No completed jobs in this period.</div>'; return; }
  var contrib = s.income - s.jobCosts, margin = s.income ? contrib / s.income : NaN, perTrip = contrib / s.trips;
  var reliable = ps && ps.trips >= 3, pc = reliable ? ps.income - ps.jobCosts : null;
  var topTot = gs.slice().sort(function (a, b) { return b.net - a.net; })[0], topPer = gs.slice().sort(function (a, b) { return b.net / b.trips - a.net / a.trips; })[0];
  var kc = function (lbl, val, sub, c) { return '<div class="mcard"><span class="ml">' + lbl + '</span><b>' + val + '</b><span class="ms">' + sub + '</span>' + (c || '') + '</div>'; };
  h += '<div class="card"><div class="fo-head"><h2 style="margin:0">Area Performance Overview</h2><span class="muted">' + esc(periodLabel(S.period)) + '</span></div><div class="mgrid" style="margin-top:12px">' +
    kc('Area revenue', ec(s.income), s.trips + ' completed jobs', reliable ? chg(s.income, ps.income) : '') +
    kc('Direct profit', ec(contrib), 'Before business overhead', reliable ? chg(contrib, pc) : '') +
    kc('Direct margin', isNaN(margin) ? '–' : pct(margin), 'Across all areas', reliable && ps.income ? chg(margin, pc / ps.income, { pts: true }) : '') +
    kc('Average profit / job', ec(perTrip), s.trips + ' jobs across ' + gs.length + (gs.length === 1 ? ' area' : ' areas')) + '</div>' +
    '<div class="rt-top"><div><span class="small muted">Highest total direct profit</span><b>' + esc(topTot.name) + '</b><span>' + ec(topTot.net) + ' from ' + topTot.trips + (topTot.trips === 1 ? ' job' : ' jobs') + '</span></div>' + icon('trophy', 'gi-head') + '</div>' +
    (topPer !== topTot ? '<div class="rt-top second"><div><span class="small muted">Highest direct profit per job</span><b>' + esc(topPer.name) + '</b><span>' + ec(topPer.net / topPer.trips) + ' a job, from ' + topPer.trips + (topPer.trips === 1 ? ' job' : ' jobs') + '</span></div></div>' : '') +
    '<p class="small muted" style="margin:10px 0 0">Direct profit is revenue less each job\'s own costs (labour cost and any materials, subcontractors, equipment hire, fuel, tipping or other costs the business paid), before running costs such as insurance. ' + (reliable ? 'Changes compare with ' + esc(prevLabel(S.period).toLowerCase()) + '.' : 'No comparison shown: the previous period has too few jobs to be reliable.') + '</p></div>';
  // E2: chart and sortable table, side by side on a swipe panel
  var ms = S.rtMetric, byM = gs.slice().sort(function (a, b) { return rtVal(b, ms) - rtVal(a, ms); }), maxV = Math.max.apply(null, byM.map(function (g) { return Math.abs(rtVal(g, ms)); }).concat([1]));
  var chartPane = '<p class="small muted" style="margin:0 0 6px">Choose what to compare</p><div class="chips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">' + RT_METRICS.map(function (m) { return '<button class="chip" data-rtm="' + m[0] + '" aria-pressed="' + (ms === m[0]) + '">' + m[1] + '</button>'; }).join('') + '</div>' +
    '<div class="rt-bars">' + byM.map(function (g) { var v = rtVal(g, ms); return '<div class="rt-bar"><div class="rt-bl"><span>' + esc(g.name) + '</span><b>' + rtFmt(v, ms) + '</b></div><div class="rt-track"><i class="' + (v < 0 ? 'neg' : '') + '" style="width:' + Math.max(2, Math.abs(v) / maxV * 100) + '%"></i></div></div>'; }).join('') + '</div>' +
    '<p class="small muted">' + esc(periodLabel(S.period)) + ' · based on recorded jobs.</p>';
  var sk = S.rtSort, sorted = gs.slice().sort(function (a, b) { var va = sk === 'name' ? a.name : sk === 'trips' ? a.trips : rtVal(a, sk), vb = sk === 'name' ? b.name : sk === 'trips' ? b.trips : rtVal(b, sk); return (va < vb ? -1 : va > vb ? 1 : 0) * S.rtSortDir; });
  var th = function (k, l) { return '<th class="' + (k === 'name' ? '' : 'n') + '"><button class="sort-th" data-rts="' + k + '">' + l + (sk === k ? (S.rtSortDir < 0 ? ' ▾' : ' ▴') : '') + '</button></th>'; };
  var tablePane = '<div class="scroll-x"><table class="rt-table"><thead><tr>' + th('name', 'Area') + th('trips', 'Jobs') + th('income', 'Revenue') + th('cost', 'Direct costs') + th('contrib', 'Direct profit') + th('per', 'Per job') + th('margin', 'Margin') + '</tr></thead><tbody>' +
    sorted.map(function (g) { return '<tr><td>' + esc(g.name.replace('SVG → ', '')) + '</td><td class="n">' + g.trips + '</td><td class="n">' + F0.format(g.income) + '</td><td class="n">' + F0.format(g.cost) + '</td><td class="n">' + F0.format(g.net) + '</td><td class="n">' + F0.format(g.net / g.trips) + '</td><td class="n">' + pct(g.margin) + '</td></tr>'; }).join('') +
    '<tr class="total"><td>Total</td><td class="n">' + s.trips + '</td><td class="n">' + F0.format(s.income) + '</td><td class="n">' + F0.format(s.jobCosts) + '</td><td class="n">' + F0.format(contrib) + '</td><td class="n">' + F0.format(perTrip) + '</td><td class="n">' + pct(margin) + '</td></tr></tbody></table></div><p class="small muted">Amounts in EC$. Tap a heading to sort.</p>';
  h += swipe('rtSwipe', [['Area Comparison', chartPane], ['Comparison Table', tablePane]]);
  // E3: compact expandable cards
  h += '<h3 class="rep-h" style="margin:18px 4px 8px">Areas</h3>' + gs.map(function (g, i) {
    var openC = !!S.rtOpen[g.name];
    return '<div class="card rt-card"><div class="rt-c-head"><div><b class="rt-name">' + esc(g.name) + '</b><span class="small muted">' + g.trips + (g.trips === 1 ? ' completed job' : ' completed jobs') + '</span></div><div style="text-align:right"><b class="rt-big ' + (g.net < 0 ? 'neg' : 'pos') + '">' + ec(g.net) + '</b><span class="small muted">Direct profit</span></div></div>' +
      '<div class="rt-c-row"><div><span class="small muted">Revenue</span><b>' + ec(g.income) + '</b></div><div><span class="small muted">Margin</span><b>' + pct(g.margin) + '</b></div><div><span class="small muted">Profit / job</span><b>' + ec(g.net / g.trips) + '</b></div></div>' +
      '<button class="btn quiet block rt-tog" data-rto="' + esc(g.name) + '" aria-expanded="' + openC + '">' + (openC ? 'Hide cost breakdown ▴' : 'Show cost breakdown ▾') + '</button>' +
      (openC ? '<table class="rt-costs"><tbody>' + COST_TYPES.map(function (c) { return (c[0] !== 'labour' && c[0] !== 'material') && !g[c[0]] ? '' : '<tr><td>' + c[1] + '</td><td class="n">' + ec(g[c[0]]) + '</td></tr>'; }).join('') +
        '<tr class="total"><td>Total direct costs</td><td class="n">' + ec(g.cost) + '</td></tr></tbody></table>' : '') +
      '<button class="btn link block" data-routejobs="' + esc(g.name) + '">View associated jobs →</button></div>'; }).join('');
  // insights: worked out from this period's jobs every time the page opens, phrased cautiously
  var ins = [], sample = s.trips, avgPer = perTrip, nm = function (g) { return esc(g.name.replace('SVG → ', '')); };
  var byPer = gs.slice().sort(function (a, b) { return b.net / b.trips - a.net / a.trips; }), bestPer = byPer[0];
  if (gs.length > 1) {
    var ties = byPer.filter(function (g) { return Math.abs(g.net / g.trips - bestPer.net / bestPer.trips) < 0.5; });
    if (ties.length > 1) ins.push(['trend', 'pos', 'Joint best profit per job', ties.map(nm).join(' and ') + ' each made ' + ec(bestPer.net / bestPer.trips) + ' per job, against ' + ec(avgPer) + ' across all areas.']);
    else { var nxt = byPer[1], gap = (bestPer.net / bestPer.trips) - (nxt.net / nxt.trips);
      ins.push(['trend', 'pos', 'Best profit per job: ' + nm(bestPer), nm(bestPer) + ' made ' + ec(bestPer.net / bestPer.trips) + ' per job, ' + ec(gap) + ' more than ' + nm(nxt) + ' (' + ec(nxt.net / nxt.trips) + ') and ' + ec(bestPer.net / bestPer.trips - avgPer) + ' above the average of ' + ec(avgPer) + '.' + (bestPer.trips < 3 ? ' This is from ' + bestPer.trips + (bestPer.trips === 1 ? ' job' : ' jobs') + ', so treat it as an early sign.' : '')]); }
    var busiest = gs.slice().sort(function (a, b) { return b.trips - a.trips; })[0];
    if (busiest.trips > 1 && busiest.trips / s.trips >= 0.4) ins.push(['route', 'info', 'Busiest area: ' + nm(busiest), busiest.trips + ' of ' + s.trips + ' jobs (' + pct(busiest.trips / s.trips) + ') and ' + pct(busiest.income / s.income) + ' of area revenue.']);
  }
  gs.forEach(function (g) {
    var per = g.net / g.trips, biggest = COST_TYPES.map(function (c) { return [c[1], g[c[0]] || 0]; }).sort(function (a, b) { return b[1] - a[1]; })[0];
    var lowMargin = !isNaN(margin) && g.margin < margin - 0.15, lowPer = per < avgPer * 0.85;
    if (lowMargin && lowPer) ins.push(['alarm', 'warn', 'Review ' + nm(g) + ' pricing', nm(g) + ' made ' + ec(per) + ' per job, below the ' + ec(avgPer) + ' average, at a ' + pct(g.margin) + ' margin.' + (biggest[1] ? ' Its largest cost was ' + biggest[0].toLowerCase() + ' at ' + ec(biggest[1]) + (g.trips === 1 ? ' on a single job' : ' over ' + g.trips + ' jobs') + '.' : '') + ' A one-off job can explain this, so check the jobs before changing prices.']);
    else if (lowMargin && biggest[1]) ins.push(['info', 'info', nm(g) + ': lower margin, still pays its way', nm(g) + '\'s margin was ' + pct(g.margin) + ' against ' + pct(margin) + ' overall, because ' + ec(biggest[1]) + ' of ' + biggest[0].toLowerCase() + ' is included in its price. It still made ' + ec(per) + ' per job' + (per >= avgPer ? ', at or above the average,' : '') + ' so the price covers the cost.']);
    var rate = rateFor(g.name), avgPrice = g.income / g.trips;
    if (rate && rate.price && g.trips >= 2 && avgPrice < rate.price * 0.95) ins.push(['alarm', 'warn', nm(g) + ' charged below the standard price', 'The average charge was ' + ec(avgPrice) + ' against today\'s standard ' + ec(rate.price) + ' over ' + g.trips + ' jobs. Some may have been agreed before the current price, so check recent jobs first.']);
  });
  if (reliable) {
    var pg = {}; groupStats(ps.jobs, 'route').forEach(function (g) { pg[g.name] = g; });
    gs.forEach(function (g) { var p0 = pg[g.name]; if (p0 && p0.trips >= 2 && g.trips >= 2 && Math.abs(g.trips - p0.trips) >= 2) ins.push(['chart', g.trips > p0.trips ? 'pos' : 'warn', nm(g) + ' jobs ' + (g.trips > p0.trips ? 'up' : 'down'), g.trips + ' jobs against ' + p0.trips + ' in ' + esc(prevLabel(S.period).toLowerCase()) + '.']); });
    Object.keys(pg).filter(function (k) { return pg[k].trips >= 2 && !gs.some(function (g) { return g.name === k; }); }).forEach(function (k) { ins.push(['info', 'info', 'No ' + esc(k.replace('SVG → ', '')) + ' jobs this period', pg[k].trips + ' jobs in ' + esc(prevLabel(S.period).toLowerCase()) + '.']); });
  }
  if (sample < 10) ins.push(['info', 'info', 'Limited sample', 'Only ' + sample + (sample === 1 ? ' job is' : ' jobs are') + ' recorded in this period, so these are early signs rather than reliable trends.']);
  h += '<div class="card"><h2>' + icon('bulb', 'gi-inline') + ' Area Insights</h2><ul class="obs">' + ins.map(function (o) { return '<li class="' + o[1] + '">' + icon(o[0], 'gi-obs') + '<div><b>' + o[2] + '</b><p>' + o[3] + '</p></div></li>'; }).join('') + '</ul></div>';
  $('view').innerHTML = h; bindSwipe('rtSwipe');
  qa('[data-rtm]').forEach(function (b) { b.onclick = function () { S.rtMetric = b.dataset.rtm; render(); }; });
  qa('[data-rts]').forEach(function (b) { b.onclick = function () { var k = b.dataset.rts; if (S.rtSort === k) S.rtSortDir *= -1; else { S.rtSort = k; S.rtSortDir = k === 'name' ? 1 : -1; } render(); setTimeout(function () { var tr = $('rtSwipe') && $('rtSwipe').querySelector('.swp-track'); if (tr) tr.scrollLeft = tr.clientWidth; }, 0); }; });
  qa('[data-rto]').forEach(function (b) { b.onclick = function () { S.rtOpen[b.dataset.rto] = !S.rtOpen[b.dataset.rto]; render(); }; });
  qa('[data-routejobs]').forEach(function (b) { b.onclick = function () { drill(b.dataset.routejobs + ' · ' + periodLabel(S.period), s.jobs.filter(function (j) { return (j.route || 'Not set').trim() === b.dataset.routejobs; }), []); }; });
};

/* ---- customers ---- */
function daysToPay(clientId) {
  var ds = [];
  liveInvoices().forEach(function (i) {
    if (clientId && i.clientId !== clientId) return;
    if (invBalance(i) > 0.009 || !i.payments.length) return;
    if (i.payments.some(function (p) { return /Imported as paid/.test(p.note || ''); })) return;
    var last = i.payments.map(function (p) { return p.date; }).sort().pop();
    ds.push(Math.max(0, daysBetween(i.issueDate, last)));
  });
  return ds.length ? ds.reduce(function (a, b) { return a + b; }, 0) / ds.length : null;
}
VIEWS.custreport = function () {
  var f = facts(), r = periodRange(S.period), s0 = summarise(f, r.from, r.to), all = S.data.clients.map(function (c) { return custStats(c, f); });
  var per = groupStats(s0.jobs, 'client'), byName = {}; per.forEach(function (g) { byName[g.name] = g; });
  var rows = all.map(function (x) { var g = byName[x.c.name] || { trips: 0, income: 0, net: 0 }; return { x: x, trips: g.trips, rev: g.income, gp: g.net, margin: g.income ? g.net / g.income : NaN }; }).filter(function (r0) { return r0.trips || r0.x.owed > 0.009; });
  var sk = S.crSort || 'rev', dir = S.crDir || -1;
  rows.sort(function (a, b) { var va = sk === 'name' ? a.x.c.name : sk === 'owed' ? a.x.owed : sk === 'rel' ? (a.x.onTime == null ? -1 : a.x.onTime) : sk === 'avg' ? (a.trips ? a.rev / a.trips : 0) : a[sk], vb = sk === 'name' ? b.x.c.name : sk === 'owed' ? b.x.owed : sk === 'rel' ? (b.x.onTime == null ? -1 : b.x.onTime) : sk === 'avg' ? (b.trips ? b.rev / b.trips : 0) : b[sk]; return (va < vb ? -1 : va > vb ? 1 : 0) * dir; });
  var activeN = rows.filter(function (r0) { return r0.trips; }).length, owed = all.reduce(function (a, x) { return a + x.owed; }, 0), od = all.reduce(function (a, x) { return a + x.odAmt; }, 0);
  var h = periodControl(render) + '<div class="card"><h2>Customer Performance</h2><div class="mgrid" style="margin-top:10px">' +
    '<div class="mcard"><span class="ml">Active customers</span><b>' + activeN + '</b><span class="ms">With jobs in ' + esc(periodLabel(S.period)) + '</span></div>' +
    '<div class="mcard"><span class="ml">Customer revenue</span><b>' + ec(s0.income) + '</b><span class="ms">' + ec(s0.income - s0.jobCosts) + ' direct profit</span></div>' +
    '<div class="mcard"><span class="ml">Outstanding</span><b>' + ec(owed) + '</b><span class="ms">Today, all periods</span></div>' +
    '<div class="mcard"><span class="ml">Overdue</span><b class="neg">' + ec(od) + '</b><span class="ms">Today</span></div></div>' +
    '<p class="small muted" style="margin:8px 0 0">Gross profit here means direct profit: revenue less each job\'s own costs. Tap a customer for their full account.</p></div>';
  var th = function (k, l) { return '<th class="' + (k === 'name' ? '' : 'n') + '"><button class="sort-th" data-crs="' + k + '">' + l + (sk === k ? (dir < 0 ? ' ▾' : ' ▴') : '') + '</button></th>'; };
  var table = '<div class="scroll-x"><table><thead><tr>' + th('name', 'Customer') + th('rev', 'Revenue') + th('gp', 'Direct profit') + th('margin', 'Margin') + th('trips', 'Jobs') + th('avg', 'Avg / job') + th('owed', 'Outstanding') + th('rel', 'On time') + '</tr></thead><tbody>' +
    rows.map(function (r0) { return '<tr><td><button class="btn link pl-link" data-c="' + r0.x.c.id + '">' + esc(r0.x.c.name) + '</button></td><td class="n">' + F0.format(r0.rev) + '</td><td class="n">' + F0.format(r0.gp) + '</td><td class="n">' + (isNaN(r0.margin) ? '–' : pct(r0.margin)) + '</td><td class="n">' + r0.trips + '</td><td class="n">' + (r0.trips ? F0.format(r0.rev / r0.trips) : '–') + '</td><td class="n ' + (r0.x.odAmt ? 'neg' : '') + '">' + F0.format(r0.x.owed) + '</td><td class="n">' + (r0.x.onTime == null ? 'n/a' : pct(r0.x.onTime) + ' (' + r0.x.sample + ')') + '</td></tr>'; }).join('') + '</tbody></table></div><p class="small muted">Amounts in EC$. "On time" shows the share of recorded payments made by the due date, with the number of payments.</p>';
  h += swipe('crSwipe', [['Customer Ranking', table], ['Revenue against Margin', '<div class="chart-box"><canvas id="cScat"></canvas></div><p class="small muted">Each dot is a customer: further right is more revenue, higher is a better direct margin. Tap a dot to open the customer.</p>']]);
  var bands = { 'Strong': [], 'Watch': [], 'At Risk': [] }; all.filter(function (x) { return x.trips || x.owed > 0.009; }).forEach(function (x) { bands[x.band].push(x); });
  var age = { a: 0, b: 0, c: 0, d: 0 }; liveInvoices().forEach(function (i) { var b = invBalance(i); if (b <= 0.009) return; var dd = daysBetween(i.dueDate, today()); if (dd <= 0) age.a += b; else if (dd <= 30) age.b += b; else if (dd <= 60) age.c += b; else age.d += b; });
  h += '<div class="card"><h2>Customer Payment Health</h2>' + vStack([{ label: 'Not overdue', value: age.a, color: 'var(--ocean)' }, { label: '1–30 days overdue', value: age.b, color: 'var(--gold)' }, { label: '31–60 days', value: age.c, color: '#e07a2b' }, { label: '61+ days', value: age.d, color: 'var(--danger)' }]) +
    ['At Risk', 'Watch', 'Strong'].map(function (k) { return bands[k].length ? '<h3 class="rep-h">' + k + ' · ' + bands[k].length + '</h3><ul class="list">' + bands[k].map(function (x) { return '<li><button class="row-btn" data-c="' + x.c.id + '"><span class="t">' + esc(x.c.name) + '</span><span class="a ' + (x.odAmt ? 'neg' : '') + '">' + ec(x.owed) + '</span><span class="m">' + esc(x.why.join(', ') || 'No overdue balance, healthy margin') + '</span><span></span></button></li>'; }).join('') + '</ul>' : ''; }).join('') +
    '<p class="small muted"><b>How bands work:</b> At Risk has an invoice more than 60 days past due. Watch has any overdue invoice, on-time payment below 50% over 3 or more recorded payments, or a direct margin below 20%. Everyone else is Strong. These are internal attention flags, not credit scores, and late payment does not mean a customer will not pay.</p></div>';
  $('view').innerHTML = h; bindSwipe('crSwipe');
  qa('[data-c]').forEach(function (b) { b.onclick = function () { go('client', b.dataset.c); }; });
  qa('[data-crs]').forEach(function (b) { b.onclick = function () { var k = b.dataset.crs; if (S.crSort === k) S.crDir = -(S.crDir || -1); else { S.crSort = k; S.crDir = k === 'name' ? 1 : -1; } render(); }; });
  var pts = rows.filter(function (r0) { return r0.trips && !isNaN(r0.margin); });
  chart('cScat', { type: 'scatter', data: { datasets: [{ data: pts.map(function (r0) { return { x: round2(r0.rev), y: Math.round(r0.margin * 1000) / 10, n: r0.x.c.name, id: r0.x.c.id }; }), backgroundColor: COLORS.gold, borderColor: COLORS.navy, pointRadius: 7, pointHoverRadius: 9 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return c.raw.n + ': ' + ec(c.raw.x) + ', ' + c.raw.y + '% margin'; } } } },
      scales: { x: { title: { display: true, text: 'Revenue (EC$)' }, ticks: moneyTicks() }, y: { title: { display: true, text: 'Direct margin (%)' } } },
      onClick: function (e, els) { if (els && els.length) go('client', pts[els[0].index].x.c.id); } } });
};

/* ---- trucks ---- */
/** Kilometres driven in a period, from the first and last fuel odometer readings. */
function kmIn(truck, from, to) {
  var logs = (S.data.fuel || []).filter(function (x) { return x.truck === truck && x.date >= from && x.date <= to && x.odometer; }).sort(function (a, b) { return a.odometer - b.odometer; });
  return logs.length >= 2 ? logs[logs.length - 1].odometer - logs[0].odometer : 0;
}
function truckStats(r, s) {
  var from = r.from || (s.jobs.concat(s.exps).map(function (x) { return x.date; }).sort()[0]) || addDays(today(), -89), to = r.to && r.to < today() ? r.to : today();
  var span = Math.max(1, daysBetween(from, to) + 1);
  return TRUCKS.map(function (t) {
    var jobs = s.jobs.filter(function (j) { return j.truck === t; }), exps = s.exps.filter(function (e) { return e.truck === t; });
    var maint = exps.filter(function (e) { return MAINT.indexOf(e.category) >= 0; });
    var work = uniq(jobs.map(function (j) { return j.date; })).length, offDays = 0;
    for (var dd = from; dd <= to; dd = addDays(dd, 1)) if (unavailableOn(t, dd)) offDays++;
    var off = Math.min(span - work, offDays);
    var c = costSplit({ jobs: jobs }), inc = jobs.reduce(function (a, j) { return a + j.amount; }, 0), jc = jobs.reduce(function (a, j) { return a + j.cost; }, 0), ov = exps.reduce(function (a, e) { return a + e.amount; }, 0);
    return { t: t, short: t, trips: jobs.length, income: inc, jobCosts: jc, running: ov, net: inc - jc - ov, c: c, maint: maint, maintCost: maint.reduce(function (a, e) { return a + e.amount; }, 0),
      work: work, off: off, idle: Math.max(0, span - work - off), span: span };
  });
}
VIEWS.trucks = function () {
  var f = facts(), r = periodRange(S.period), s = summarise(f, r.from, r.to);
  var h = periodControl(render);
  var ts = truckStats(r, s);
  var tRev = ts.reduce(function (a, x) { return a + x.income; }, 0), tDir = ts.reduce(function (a, x) { return a + x.jobCosts; }, 0), tRun = ts.reduce(function (a, x) { return a + x.running; }, 0);
  var tWork = ts.reduce(function (a, x) { return a + x.work; }, 0), tAvail = ts.reduce(function (a, x) { return a + x.span - x.off; }, 0);
  h += '<div class="card"><div class="fo-head"><div><h2 style="margin:0">Fleet Performance</h2><p class="muted" style="margin:2px 0 0">Truck earnings, operating costs and efficiency</p></div><span class="muted">' + esc(periodLabel(S.period)) + '</span></div><div class="mgrid" style="margin-top:12px">' +
    '<div class="mcard"><span class="ml">Earned revenue</span><b>' + ec(tRev) + '</b><span class="ms">' + s.trips + ' completed loads</span></div>' +
    '<div class="mcard"><span class="ml">Direct operating costs</span><b>' + ec(tDir + tRun) + '</b><span class="ms">Job costs and truck expenses</span></div>' +
    '<div class="mcard"><span class="ml">Fleet contribution</span><b>' + ec(tRev - tDir - tRun) + '</b><span class="ms">' + (tRev ? pct((tRev - tDir - tRun) / tRev) + ' margin' : '–') + '</span></div>' +
    '<div class="mcard"><span class="ml">Truck utilisation</span><b>' + (tAvail ? pct(tWork / tAvail) : '–') + '</b><span class="ms">' + tWork + ' of ' + tAvail + ' available truck-days</span></div></div>' +
    '<p class="small muted" style="margin:8px 0 0">Utilisation counts days with at least one recorded job against days each truck was not recorded as off the road. Days with no recorded work are shown as unknown, not idle, because the app has no vehicle tracking.</p></div>';
  h += swipe('flSwipe', [['Earnings and Costs', '<div class="chart-box"><canvas id="cTrk1"></canvas></div>'], ['Revenue against Operating Costs', '<div class="chart-box"><canvas id="cTrk6"></canvas></div><p class="small muted">Last six months, all trucks.</p>']]);
  var pm0 = previousRange(S.period), pts0 = pm0 ? truckStats(pm0, summarise(f, pm0.from, pm0.to)) : null;
  h += ts.map(function (x) {
    var o = !!(S.flOpen || {})[x.t], km = kmIn(x.t, r.from || addDays(today(), -365), r.to || today()), prevX = pts0 ? pts0.find(function (y) { return y.t === x.t; }) : null, off = unavailableOn(x.t, today());
    return '<div class="card rt-card"><div class="rt-c-head"><div><b class="rt-name">' + esc(truckName(x.t)) + '</b><span class="small muted">' + x.trips + (x.trips === 1 ? ' completed job' : ' completed jobs') + '</span></div><div style="text-align:right"><b class="rt-big ' + (x.net < 0 ? 'neg' : 'pos') + '">' + ec(x.net) + '</b><span class="small muted">Recorded contribution</span></div></div>' +
      '<div class="rt-c-row"><div><span class="small muted">Revenue</span><b>' + ec(x.income) + '</b></div><div><span class="small muted">Cost / job</span><b>' + (x.trips ? ec((x.jobCosts + x.running) / x.trips) : '–') + '</b></div><div><span class="small muted">Status today</span><b class="' + (off ? 'neg' : '') + '">' + (off ? 'Off the road' : 'Available') + '</b></div></div>' +
      '<button class="btn quiet block rt-tog" data-flo="' + esc(x.t) + '">' + (o ? 'Hide vehicle details ▴' : 'Show vehicle details ▾') + '</button>' +
      (o ? '<table class="rt-costs"><tbody>' +
        [['Revenue per job', x.trips ? ec(x.income / x.trips) : '–'], ['Contribution per job', x.trips ? ec(x.net / x.trips) : '–'], ['Revenue per working day', x.work ? ec(x.income / x.work) : '–'], ['Contribution per working day', x.work ? ec(x.net / x.work) : '–'],
         ['Direct job costs', ec(x.jobCosts)], ['Truck operating costs', ec(x.running)], ['Operating cost ratio', x.income ? pct((x.jobCosts + x.running) / x.income) : '–'],
         ['Working days', x.work + ' of ' + (x.span - x.off) + ' available' + (x.span - x.off ? ' (' + pct(x.work / (x.span - x.off)) + ')' : '')], ['Downtime recorded', x.off + (x.off === 1 ? ' day' : ' days')],
         ['Maintenance and repairs', ec(x.maintCost)], ['Maintenance cost per km', km ? ec(x.maintCost / km) + ' over ' + F0.format(km) + ' km' : 'Unknown (needs two fuel odometer readings)'],
         ['Change against previous period', prevX ? (x.net - prevX.net >= 0 ? '+' : '−') + ec(Math.abs(x.net - prevX.net)) : '–']].map(function (rw) { return '<tr><td>' + rw[0] + '</td><td class="n">' + rw[1] + '</td></tr>'; }).join('') +
        '</tbody></table><p class="small muted">A formal return on investment is not shown until depreciation and attributable capital are agreed.</p>' : '') +
      '<button class="btn link block" data-veh="' + esc(x.t) + '">Open vehicle profile →</button></div>'; }).join('');
  h += '<div class="card"><h2>Days on the road</h2><div class="chart-box short"><canvas id="cTrk2"></canvas></div><p class="small muted">Working days have at least one job. Off the road comes from incidents and from days entered on repair, maintenance and tyre expenses. The rest is no recorded work: status unknown, possibly spare capacity.</p></div>';
  h += '<div class="card"><h2>Maintenance and repairs</h2>' + (ts.some(function (x) { return x.maintCost; }) ? '<div class="chart-box short"><canvas id="cTrk3"></canvas></div>' : '') +
    '<table><tbody>' + ts.map(function (x) { return '<tr><td>' + esc(x.t) + '</td><td class="n">' + ec(x.maintCost) + '</td><td class="n">' + x.off + (x.off === 1 ? ' day' : ' days') + ' off the road</td></tr>'; }).join('') + '</tbody></table></div>';
  h += '<div class="card"><h2>Cost per job</h2><div class="chart-box short"><canvas id="cTrk4"></canvas></div></div>';
  var fuelSeries = TRUCKS.map(function (t) { var logs = (S.data.fuel || []).filter(function (x) { return x.truck === t; }).sort(function (a, b) { return a.odometer - b.odometer; }), pts = [];
    for (var i = 1; i < logs.length; i++) { var d = logs[i].odometer - logs[i - 1].odometer; if (d > 0 && logs[i].full !== false && logs[i].litres) pts.push({ x: logs[i].date, y: round2(d / logs[i].litres) }); } return pts; });
  if (fuelSeries.some(function (p) { return p.length > 1; })) h += '<div class="card"><h2>Fuel efficiency</h2><div class="chart-box short"><canvas id="cTrk5"></canvas></div><p class="small muted">Kilometres per litre at each full fill-up. A falling line can mean a fault, a heavy load or a fuel issue worth checking.</p></div>';
  var due = remindersDue(30);
  h += '<div class="card"><div class="card-head"><h2 style="margin:0">Reminders</h2><button class="btn link" id="allRem">All reminders ›</button></div>' +
    (due.length ? '<ul class="list">' + due.map(reminderLine).join('') + '</ul>' : '<p class="muted small">Nothing due in the next 30 days.</p>') + '</div>';
  var invest = {}; S.data.startup.forEach(function (x) { invest[x.truck] = (invest[x.truck] || 0) + x.amount; });
  h += TRUCKS.map(function (t) {
    var jobs = s.jobs.filter(function (j) { return j.truck === t; }), exps = s.exps.filter(function (e) { return e.truck === t; });
    var inc = jobs.reduce(function (a, j) { return a + j.amount; }, 0), jc = jobs.reduce(function (a, j) { return a + j.cost; }, 0), ov = exps.reduce(function (a, e) { return a + e.amount; }, 0);
    var c = costSplit({ jobs: jobs }), net = inc - jc - ov, n = jobs.length, fs = fuelStats(t, r.from, r.to);
    return '<div class="card"><div class="card-head"><h2 style="margin:0">' + esc(t) + '</h2><span class="fig ' + (net < 0 ? 'neg' : '') + '" style="font-size:1.2rem">' + ec(net) + '</span></div>' +
      '<table><tbody><tr><td>Jobs</td><td class="n">' + n + '</td><td>Income</td><td class="n">' + ec(inc) + '</td></tr>' +
      '<tr><td>Fuel per job</td><td class="n">' + (n ? ec(c.fuel / n) : '–') + '</td><td>Labour per job</td><td class="n">' + (n ? ec(c.labour / n) : '–') + '</td></tr>' +
      '<tr><td>Job costs</td><td class="n">' + ec(jc) + '</td><td>Running costs</td><td class="n">' + ec(ov) + '</td></tr>' +
      '<tr><td><b>Cost per job</b></td><td class="n"><b>' + (n ? ec((jc + ov) / n) : '–') + '</b></td><td><b>Net per job</b></td><td class="n"><b>' + (n ? ec(net / n) : '–') + '</b></td></tr>' +
      '<tr><td>Capital invested</td><td class="n">' + ec(invest[t] || 0) + '</td><td>Odometer</td><td class="n">' + (fs.odometer ? F0.format(fs.odometer) + ' km' : '–') + '</td></tr>' +
      '<tr><td>Fuel efficiency</td><td class="n">' + (fs.kmPerL ? fs.kmPerL.toFixed(2) + ' km/L' : '–') + '</td><td>Distance</td><td class="n">' + (fs.km ? F0.format(fs.km) + ' km' : '–') + '</td></tr></tbody></table></div>'; }).join('');
  var shared = s.exps.filter(function (e) { return TRUCKS.indexOf(e.truck) < 0; }).reduce(function (a, e) { return a + e.amount; }, 0);
  if (shared) h += '<p class="small muted">' + ec(shared) + ' of running costs in this period were not assigned to a single truck and are left out above.</p>';
  $('view').innerHTML = h; bindSwipe('flSwipe');
  qa('[data-flo]').forEach(function (b) { b.onclick = function () { S.flOpen = S.flOpen || {}; S.flOpen[b.dataset.flo] = !S.flOpen[b.dataset.flo]; render(); }; });
  qa('[data-veh]').forEach(function (b) { b.onclick = function () { go('vehicle', b.dataset.veh); }; });
  var m6 = []; for (var mi = 5; mi >= 0; mi--) { var md = parseIso(today()); var a0 = isoOf(new Date(md.getFullYear(), md.getMonth() - mi, 1)), a1 = isoOf(new Date(md.getFullYear(), md.getMonth() - mi + 1, 0)), sm = summarise(f, a0, a1); m6.push({ l: MON[parseIso(a0).getMonth()], rev: sm.income, cost: sm.jobCosts + sm.exps.filter(function (e) { return TRUCKS.indexOf(e.truck) >= 0; }).reduce(function (a, e) { return a + e.amount; }, 0) }); }
  chart('cTrk6', { type: 'line', data: { labels: m6.map(function (x) { return x.l; }), datasets: [{ label: 'Revenue', data: m6.map(function (x) { return round2(x.rev); }), borderColor: COLORS.navy, backgroundColor: COLORS.navy, tension: 0, pointRadius: 3 }, { label: 'Operating costs', data: m6.map(function (x) { return round2(x.cost); }), borderColor: COLORS.gold, backgroundColor: COLORS.gold, tension: 0, pointRadius: 3 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: moneyTip() }, scales: { y: { ticks: moneyTicks(), title: { display: true, text: 'EC$' } }, x: { grid: { display: false } } } } });
  if ($('allRem')) $('allRem').onclick = function () { go('reminders'); };
  bindReminders();
  var leg = { position: 'bottom', labels: { boxWidth: 12 } };
  chart('cTrk1', { type: 'bar', data: { labels: ts.map(function (x) { return x.short; }), datasets: [
    { label: 'Income', data: ts.map(function (x) { return round2(x.income); }), backgroundColor: COLORS.navy, borderRadius: 4 },
    { label: 'Job costs', data: ts.map(function (x) { return round2(x.jobCosts); }), backgroundColor: COLORS.grey, borderRadius: 4 },
    { label: 'Running costs', data: ts.map(function (x) { return round2(x.running); }), backgroundColor: COLORS.ocean, borderRadius: 4 },
    { label: 'Net', data: ts.map(function (x) { return round2(x.net); }), backgroundColor: COLORS.gold, borderRadius: 4 }] },
    options: { maintainAspectRatio: false, plugins: { legend: leg, tooltip: moneyTip() }, scales: { y: { ticks: moneyTicks() }, x: { grid: { display: false } } } } });
  chart('cTrk2', { type: 'bar', data: { labels: ts.map(function (x) { return x.short; }), datasets: [
    { label: 'Working', data: ts.map(function (x) { return x.work; }), backgroundColor: COLORS.green, borderRadius: 4 },
    { label: 'Off the road', data: ts.map(function (x) { return x.off; }), backgroundColor: COLORS.red, borderRadius: 4 },
    { label: 'No recorded work', data: ts.map(function (x) { return x.idle; }), backgroundColor: COLORS.grey, borderRadius: 4 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: leg, tooltip: { callbacks: { label: function (c) { return c.dataset.label + ': ' + c.parsed.x + ' days'; } } } }, scales: { x: { stacked: true, ticks: { precision: 0 } }, y: { stacked: true, grid: { display: false } } } } });
  if ($('cTrk3')) {
    var months = []; var mEnd = (r.to && r.to < today() ? r.to : today()).slice(0, 7), mStart = r.from ? r.from.slice(0, 7) : addMonths(today(), -11).slice(0, 7);
    for (var m = mStart; m <= mEnd && months.length < 24; m = addMonths(m + '-01', 1).slice(0, 7)) months.push(m);
    chart('cTrk3', { type: 'bar', data: { labels: months.map(function (mm) { return MONTH[+mm.slice(5) - 1].slice(0, 3); }), datasets: ts.map(function (x, i) {
      return { label: x.short, data: months.map(function (mm) { return round2(x.maint.filter(function (e) { return e.date.slice(0, 7) === mm; }).reduce(function (a, e) { return a + e.amount; }, 0)); }), backgroundColor: i ? COLORS.gold : COLORS.navy, borderRadius: 3 }; }) },
      options: { maintainAspectRatio: false, plugins: { legend: leg, tooltip: moneyTip() }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: moneyTicks() } } } });
  }
  var per = function (x, v) { return x.trips ? round2(v / x.trips) : 0; };
  chart('cTrk4', { type: 'bar', data: { labels: ts.map(function (x) { return x.short; }), datasets: [
    ['Labour', COLORS.navy, function (x) { return x.c.labour; }], ['Fuel', COLORS.gold, function (x) { return x.c.fuel; }], ['Subcontractors', COLORS.ocean, function (x) { return x.c.subcontract; }],
    ['Materials', COLORS.palette[4], function (x) { return x.c.material; }], ['Equipment hire', COLORS.palette[5] || '#8e6bbf', function (x) { return x.c.plant; }], ['Other direct', COLORS.palette[6] || '#5aa', function (x) { return x.c.other; }],
    ['Running', COLORS.grey, function (x) { return x.running; }]].filter(function (d) { return ts.some(function (x) { return d[2](x); }) || d[0] === 'Crew member'; }).map(function (d) {
      return { label: d[0], data: ts.map(function (x) { return per(x, d[2](x)); }), backgroundColor: d[1], borderRadius: 3 }; }) },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: leg, tooltip: moneyTip() }, scales: { x: { stacked: true, ticks: moneyTicks() }, y: { stacked: true, grid: { display: false } } } } });
  if ($('cTrk5')) {
    var dates = uniq([].concat.apply([], fuelSeries.map(function (p) { return p.map(function (q) { return q.x; }); }))).sort();
    chart('cTrk5', { type: 'line', data: { labels: dates.map(niceShort), datasets: fuelSeries.map(function (p, i) {
      return { label: TRUCKS[i], data: dates.map(function (d) { var q = p.find(function (z) { return z.x === d; }); return q ? q.y : null; }), spanGaps: true,
        borderColor: i ? COLORS.gold : COLORS.navy, backgroundColor: i ? COLORS.gold : COLORS.navy, tension: .3, pointRadius: 3 }; }) },
      options: { maintainAspectRatio: false, plugins: { legend: leg }, scales: { y: { title: { display: true, text: 'km per litre' } }, x: { grid: { display: false } } } } });
  }
};

/* ---- partner capital ---- */
function capTabs() { S.capTab = S.capTab || 'overview'; return '<div class="seg" style="margin-bottom:14px"><button data-ctab="overview" aria-pressed="' + (S.capTab === 'overview') + '">Capital</button><button data-ctab="tx" aria-pressed="' + (S.capTab === 'tx') + '">Partner Transactions</button></div>'; }
function bindCapTabs() { qa('[data-ctab]').forEach(function (b) { b.onclick = function () { S.capTab = b.dataset.ctab; render(); }; }); }
S.ptxType = 'all';
function partnerTxView() {
  var all = (S.data.partnerTx || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  var list = all.filter(function (t) { return S.ptxType === 'all' || t.type === S.ptxType; });
  var h = capTabs() + '<p class="small muted" style="margin-top:0">Money moved between the partners: profit shares paid when customers pay, and settlements for expenses one partner paid personally. These records never count as business costs.</p>' +
    (isViewOnly() ? '' : '<div class="toolbar"><button class="btn gold" id="ptAdd">+ Record a transaction</button></div>') +
    '<div class="toolbar">' + [['all', 'All'], ['Profit share', 'Profit shares'], ['Expense settlement', 'Expense settlements'], ['Other', 'Other']].map(function (o) { return '<button class="chip" data-ptt="' + o[0] + '" aria-pressed="' + (S.ptxType === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
    '<div class="card flush"><ul class="list">' + (list.length ? list.map(function (t) {
      var inv = t.invoiceId ? S.data.invoices.find(function (i) { return i.id === t.invoiceId; }) : null;
      return '<li><button class="row-btn" data-ptx="' + t.id + '"><span class="t">' + esc(t.from) + ' → ' + esc(t.to) + '</span><span class="a">' + ec2(t.amount) + '</span><span class="m">' + nice(t.date) + ' · ' + esc(t.type) + (inv ? ' · ' + invNo(inv) + ' ' + esc(clientOf(inv).name) : '') + (t.reference ? ' · ' + esc(t.reference) : '') + '</span><span class="m">' + esc(t.note || '') + '</span></button></li>'; }).join('')
      : '<li class="empty">No partner transactions recorded yet. Profit-share transfers are recorded from a paid invoice, using “Record transfer to …”.</li>') + '</ul></div>';
  $('view').innerHTML = h; bindCapTabs();
  qa('[data-ptt]').forEach(function (b) { b.onclick = function () { S.ptxType = b.dataset.ptt; render(); }; });
  if ($('ptAdd')) $('ptAdd').onclick = function () { partnerTxEditor({}); };
  qa('[data-ptx]').forEach(function (b) { b.onclick = function () { var t = all.find(function (x) { return x.id === b.dataset.ptx; }); partnerTxEditor(t, t.invoiceId ? S.data.invoices.find(function (i) { return i.id === t.invoiceId; }) : null); }; });
}
VIEWS.capital = function () {
  if ((S.capTab || 'overview') === 'tx') { partnerTxView(); return; }
  var ps = partners(), cap = S.data.capital || [], contrib = cap.filter(function (k) { return k.type === 'contribution'; }), ro = isViewOnly();
  var total = contrib.reduce(function (a, k) { return a + k.amount; }, 0), trucks = uniq(TRUCKS.concat(contrib.map(function (k) { return k.truck; }))).filter(function (tr) { return contrib.some(function (k) { return k.truck === tr; }); });
  var txs = S.data.partnerTx || [], rate = S.data.settings.gbpRate || 0;
  var h = capTabs() + '<div class="card"><div class="kicker">Partner Accounts &amp; Distributions · all time</div><div class="mgrid" style="margin-top:8px">' +
    '<div class="mcard"><span class="ml">Capital contributed</span><b>' + ec2(total) + '</b><span class="ms">' + contrib.length + ' recorded contributions</span></div>' +
    '<div class="mcard"><span class="ml">Ownership and profit share</span><b>' + ps.map(function (p) { return p.share + '%'; }).join(' / ') + '</b><span class="ms">' + ps.map(function (p) { return esc(p.name); }).join(' and ') + '</span></div></div>' +
    '<div class="cap-trucks">' + trucks.map(function (tr) { var v2 = contrib.filter(function (k) { return k.truck === tr; }).reduce(function (a, k) { return a + k.amount; }, 0); return '<div><span class="small muted">' + esc(truckName(tr)) + '</span><b>' + ec(v2) + '</b><span class="small muted">' + pct(v2 / total) + '</span></div>'; }).join('') + '</div>' +
    '<p class="small muted" style="margin:8px 0 0">Each partner\'s share of profit is transferred when customer invoices are paid and recorded under Partner Transactions, so no running payout balance is shown here.</p></div>';
  h += '<h3 class="rep-h" style="margin:16px 4px 8px">Partner Accounts</h3><div class="veh-grid">' + ps.map(function (p) {
    var mine = contrib.filter(function (k) { return k.partner === p.name; }), amt = mine.reduce(function (a, k) { return a + k.amount; }, 0);
    var tIn = txs.filter(function (x) { return x.to === p.name; }), tOut = txs.filter(function (x) { return x.from === p.name; });
    return '<div class="card"><div class="cu-top"><b style="font-size:1.1rem">' + esc(p.name) + '</b><span class="pill Paid">' + p.share + '% partner</span></div>' +
      '<table><tbody><tr><td>Capital contributed</td><td class="n">' + ec2(amt) + '</td></tr><tr><td>Share of contributions</td><td class="n">' + (total ? pct(amt / total) : '–') + '</td></tr><tr><td>Agreed profit share</td><td class="n">' + p.share + '%</td></tr>' +
      '<tr><td>Transfers received</td><td class="n">' + tIn.length + (tIn.length ? ' · ' + ec(tIn.reduce(function (a, x) { return a + x.amount; }, 0)) : '') + '</td></tr><tr><td>Transfers made</td><td class="n">' + tOut.length + (tOut.length ? ' · ' + ec(tOut.reduce(function (a, x) { return a + x.amount; }, 0)) : '') + '</td></tr></tbody></table>' +
      (tIn.concat(tOut).length ? '<p class="small muted">Latest reference: ' + esc(tIn.concat(tOut).sort(function (a, b) { return a.date < b.date ? 1 : -1; })[0].reference || 'none entered') + '</p>' : '') + '</div>'; }).join('') + '</div>';
  h += '<h3 class="rep-h" style="margin:16px 4px 8px">Capital Contributions by Vehicle</h3>' + trucks.map(function (tr) {
    var its = contrib.filter(function (k) { return k.truck === tr; }), o = !!(S.pcOpen || {})[tr], sum = its.reduce(function (a, k) { return a + k.amount; }, 0);
    return '<div class="card rt-card"><div class="rt-c-head"><div><b class="rt-name">' + esc(truckName(tr)) + '</b><span class="small muted">' + ps.map(function (p) { return esc(p.name) + ' ' + ec(its.filter(function (k) { return k.partner === p.name; }).reduce(function (a, k) { return a + k.amount; }, 0)); }).join(' · ') + '</span></div><b class="rt-big">' + ec(sum) + '</b></div>' +
      '<button class="btn quiet block rt-tog" data-pco="' + esc(tr) + '">' + (o ? 'Hide items ▴' : 'Show purchase, shipping, customs and other items ▾') + '</button>' +
      (o ? ps.map(function (p) { var mine = its.filter(function (k) { return k.partner === p.name; }); return mine.length ? '<h3 class="rep-h">' + esc(p.name) + '</h3><ul class="list">' + mine.map(function (k) {
          return '<li><button class="row-btn" data-cap="' + k.id + '"><span class="t">' + esc(k.item) + '</span><span class="a">' + ec2(k.amount) + '</span><span class="m">' + (k.gbp ? '£' + F0.format(k.gbp) + ' original' : k.original ? 'Original ' + esc(k.original) : '') + (k.date ? ' · ' + nice(k.date) : '') + '</span><span></span></button></li>'; }).join('') + '</ul>' : ''; }).join('') : '') + '</div>'; }).join('') +
    (ro ? '' : '<button class="btn quiet block" id="addContrib">+ Add contribution</button>') +
    '<p class="small muted">GBP amounts keep their original value; EC$ uses the rate recorded at the time (current default £1 = EC$' + rate + '). Corrections are logged in the Activity Log.</p>';
  $('view').innerHTML = h; bindCapTabs();
  qa('[data-pco]').forEach(function (b) { b.onclick = function () { S.pcOpen = S.pcOpen || {}; S.pcOpen[b.dataset.pco] = !S.pcOpen[b.dataset.pco]; render(); }; });
  qa('[data-cap]').forEach(function (b) { b.onclick = function () { if (!ro) capitalEditor(cap.find(function (k) { return k.id === b.dataset.cap; })); }; });
  if ($('addContrib')) $('addContrib').onclick = function () { capitalEditor({ type: 'contribution' }); };
};
function capitalEditor(k) {
  var ps = (S.data.settings.partners || []).map(function (p) { return p.name; }), draw = k.type === 'drawing', rate = S.data.settings.gbpRate || 0;
  openSheet((k.id ? 'Edit ' : 'New ') + (draw ? 'payout' : 'contribution'),
    '<div class="cols"><label class="f"><span>Partner</span><select id="kP">' + opts(ps, k.partner || ps[0]) + '</select></label>' +
    (draw ? '<label class="f"><span>Date</span><input type="date" id="kD" value="' + v(k.date) + '"></label>' : '<label class="f"><span>Truck</span><select id="kT">' + opts(TRUCKS, k.truck || TRUCKS[0]) + '</select></label>') + '</div>' +
    '<label class="f"><span>' + (draw ? 'Description' : 'Item') + '</span><input id="kI" value="' + v(k.item) + '" placeholder="' + (draw ? 'Profit paid out' : 'Customs duties') + '"></label>' +
    (draw ? '' : '<div class="cols"><label class="f"><span>Amount in £ (if paid in pounds)</span><input id="kG" inputmode="decimal" value="' + v(k.gbp) + '"></label><label class="f"><span>Original as written</span><input id="kO" value="' + v(k.original) + '" placeholder="£1,720 or EC$8,000"></label></div>') +
    '<label class="f"><span>Value in EC$</span><input id="kA" inputmode="decimal" value="' + v(k.amount) + '"></label>' +
    (draw ? '' : '<p class="small muted" style="margin-top:-6px">Fill in pounds and the EC$ value is worked out at £1 = EC$' + rate + ' if left blank.</p>') +
    '<label class="f"><span>Notes</span><textarea id="kN">' + v(k.notes) + '</textarea></label>' + (k.id ? '<button class="btn danger block" id="kDel">Delete</button>' : ''), 'Save');
  if ($('kG')) $('kG').oninput = function () { if (!$('kA').dataset.touched && rate) $('kA').value = (num(this.value) * rate).toFixed(2); };
  $('kA').oninput = function () { this.dataset.touched = '1'; };
  $('sheetGo').onclick = function () {
    api('saveCapital', { entry: { id: k.id, type: k.type, partner: $('kP').value, truck: $('kT') ? $('kT').value : '', date: $('kD') ? $('kD').value : '', item: $('kI').value,
      gbp: $('kG') ? $('kG').value : 0, original: $('kO') ? $('kO').value : '', amount: $('kA').value, notes: $('kN').value } }, 'Saving…').then(function () { closeSheet(); toast('Saved.'); render(); }).catch(function () {});
  };
  if ($('kDel')) $('kDel').onclick = function () { if (confirm('Delete this record?')) api('deleteCapital', { id: k.id }, 'Deleting…').then(function () { closeSheet(); render(); }).catch(function () {}); };
}

/* ==================== bookings ==================== */
S.bkFilter = 'upcoming'; S.calView = 'week'; S.calAnchor = null;
function bkStatusLabel(st) { return { Tentative: 'Tentative', Booked: 'Confirmed', Done: isDriver() ? 'Done' : 'To invoice', Invoiced: 'Invoiced', Cancelled: 'Cancelled' }[st] || st; }
function bkActive(b) { return b.status === 'Booked' || b.status === 'Tentative'; }
/** Days a truck is off the road, from incidents and repair expenses with recorded downtime. */
function unavailableOn(truck, d) {
  var inc = (S.data.incidents || []).some(function (x) { return x.truck === truck && x.offFrom && d >= x.offFrom && d <= (x.offTo || x.offFrom) && x.status !== 'Resolved' || (x.truck === truck && x.offFrom && x.offTo && d >= x.offFrom && d <= x.offTo); });
  var exp = S.data.expenses.some(function (e) {
    if (e.void || e.truck !== truck) return false;
    if (e.offFrom) { var a = e.offFrom.slice(0, 10), b = e.offTo ? e.offTo.slice(0, 10) : null; return d >= a && (b == null ? d <= today() : (a === b ? d === a : d < b)); }
    return e.daysOff > 0 && d >= e.date && d < addDays(e.date, e.daysOff);
  });
  return inc || exp;
}
function bookingConflicts(b) {
  var same = (S.data.bookings || []).filter(function (x) { return x.id !== b.id && bkActive(x) && bkActive(b) && x.date === b.date && x.truck === b.truck; }).length;
  return same + (bkActive(b) && unavailableOn(b.truck, b.date) ? 1 : 0);
}
function bookingRow(b) {
  var cls = { Tentative: 'muted', Booked: 'Unpaid', Done: 'Part-paid', Invoiced: 'Paid', Cancelled: 'Cancelled' }[b.status];
  var clash = bookingConflicts(b), off = bkActive(b) && unavailableOn(b.truck, b.date), canDone = b.status === 'Booked';
  var inv = b.invoiceId ? S.data.invoices.find(function (i) { return i.id === b.invoiceId; }) : null;
  return '<li' + (canDone ? ' class="srow"' : '') + '>' + (canDone ? '<div class="sw-acts"><button class="sw-pay" data-sw="done" data-id="' + b.id + '">' + icon('checkc', 'gi-sw') + 'Done</button></div>' : '') +
    '<button class="row-btn bk-card" data-bk="' + b.id + '"><span class="t">' + esc(b.client || 'Customer') + '</span><span class="a"><span class="pill ' + cls + '">' + bkStatusLabel(b.status) + '</span></span>' +
    '<span class="m">' + (b.time ? esc(b.time) + ' · ' : '') + esc([b.route, b.load].filter(Boolean).join(' · ')) + (b.sailing ? ' · ' + icon('ferry', 'gi-inline') + esc(b.sailing) : '') + '</span>' +
    '<span class="m">' + (!isDriver() && b.price ? '<b>' + ec(b.price * (b.qty || 1)) + '</b>' : '') + '</span>' +
    '<span class="m">' + icon('truck', 'gi-inline') + esc(truckName(b.truck)) + (b.driverId && driverName(b.driverId) ? ' · ' + icon('user', 'gi-inline') + esc(driverName(b.driverId)) : ' · crew member not set') + '</span>' +
    '<span class="m">' + (inv ? 'Invoice ' + invNo(inv) + ' · ' + invStatus(inv) : b.status === 'Done' ? 'Awaiting invoice' : '') + '</span>' +
    (clash ? '<span class="m neg" style="grid-column:1/-1">' + (off ? truckName(b.truck) + ' is recorded as off the road this day' : 'Same truck booked twice this day') + '</span>' : '') + '</button></li>';
}
function calRange() {
  var a = S.calAnchor || today(), d = parseIso(a);
  if (S.calView === 'day') return { from: a, to: a, days: [a] };
  if (S.calView === 'week') { var st = addDays(a, -((d.getDay() + 6) % 7)), days = []; for (var k = 0; k < 7; k++) days.push(addDays(st, k)); return { from: st, to: days[6], days: days }; }
  var m1 = isoOf(new Date(d.getFullYear(), d.getMonth(), 1)), m2 = isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0)), lead = (parseIso(m1).getDay() + 6) % 7, ds = [];
  for (var x = addDays(m1, -lead); x <= m2 || ds.length % 7; x = addDays(x, 1)) ds.push(x);
  return { from: m1, to: m2, days: ds };
}
VIEWS.bookings = function () {
  if (isDriver()) $('title').textContent = 'Jobs';
  var all = (S.data.bookings || []).slice(), t = today(), cr = calRange(), ac = S.calAnchor || t;
  var upcoming = all.filter(function (b) { return bkActive(b) && b.date >= t; }), toInv = all.filter(function (b) { return b.status === 'Done' || (b.status === 'Booked' && b.date < t); });
  var completed = all.filter(function (b) { return b.status === 'Invoiced' || b.status === 'Done'; });
  var availToday = TRUCKS.filter(function (tr) { return !unavailableOn(tr, t) && !all.some(function (b) { return b.truck === tr && b.date === t && bkActive(b); }); });
  var h = (isDriver() ? faceIdHint() : '') + '<div class="mgrid" style="margin-bottom:12px">' +
    '<button class="mcard" data-bf="upcoming"><span class="ml">Upcoming</span><b>' + upcoming.length + '</b><span class="ms">' + upcoming.filter(function (b) { return b.status === 'Tentative'; }).length + ' tentative</span></button>' +
    '<button class="mcard" data-bf="toinvoice"><span class="ml">' + (isDriver() ? 'Past jobs' : 'To invoice') + '</span><b class="' + (toInv.length ? 'neg' : '') + '">' + toInv.length + '</b><span class="ms">Finished, not invoiced</span></button>' +
    '<button class="mcard" data-bf="done"><span class="ml">Completed</span><b>' + completed.length + '</b><span class="ms">All time</span></button>' +
    '<div class="mcard"><span class="ml">Trucks free today</span><b>' + availToday.length + ' of ' + TRUCKS.length + '</b><span class="ms">' + esc(TRUCKS.filter(function (tr) { return availToday.indexOf(tr) < 0; }).map(function (tr) { return tr + (unavailableOn(tr, t) ? ' off road' : ' busy'); }).join(', ') || 'Both available') + '</span></div></div>';
  // calendar
  var dn = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  var head = S.calView === 'month' ? MONTH[parseIso(cr.from).getMonth()] + ' ' + parseIso(cr.from).getFullYear() : S.calView === 'week' ? niceShort(cr.from) + ' – ' + niceShort(cr.to) : longDate(ac);
  var cell = function (d) {
    var day = all.filter(function (b) { return b.date === d && b.status !== 'Cancelled'; }), inMonth = S.calView !== 'month' || (d >= cr.from && d <= cr.to);
    var marks = TRUCKS.map(function (tr, ti) { var off = unavailableOn(tr, d), bs = day.filter(function (b) { return b.truck === tr; });
      var cl = off ? 'off' : bs.some(function (b) { return b.status === 'Booked' || b.status === 'Done' || b.status === 'Invoiced'; }) ? 'conf' : bs.length ? 'tent' : ''; return '<i class="cm t' + (ti + 1) + ' ' + cl + '" title="' + esc(truckName(tr)) + '"></i>'; }).join('');
    var pd = parseIso(d);
    return '<button class="cal-d' + (d === t ? ' today' : '') + (d === ac ? ' sel' : '') + (inMonth ? '' : ' out') + '" data-cal="' + d + '"><span class="cdn">' + (S.calView === 'month' ? '' : dn[(pd.getDay() + 6) % 7] + ' ') + pd.getDate() + '</span>' + (day.length ? '<span class="ccount">' + day.length + '</span>' : '<span class="ccount empty"></span>') + '<span class="cmarks">' + marks + '</span></button>';
  };
  h += '<div class="card cal"><div class="cal-top"><div class="seg mini">' + [['day', 'Day'], ['week', 'Week'], ['month', 'Month']].map(function (o) { return '<button data-cv="' + o[0] + '" aria-pressed="' + (S.calView === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
    '<div class="cal-nav"><button class="arr" id="calPrev" aria-label="Previous">‹</button><button class="btn quiet" id="calToday">Today</button><button class="arr" id="calNext" aria-label="Next">›</button></div></div>' +
    '<div class="cal-head">' + esc(head) + '</div>' + (S.calView === 'month' ? '<div class="cal-grid wd">' + dn.map(function (x) { return '<span>' + x.charAt(0) + '</span>'; }).join('') + '</div>' : '') +
    (S.calView === 'day' ? '' : '<div class="cal-grid ' + S.calView + '">' + cr.days.map(cell).join('') + '</div>') +
    '<div class="cal-key small muted"><span><i class="cm conf"></i>Confirmed</span><span><i class="cm tent"></i>Tentative</span><span><i class="cm off"></i>Unavailable</span><span>Dots: ' + TRUCKS.map(function (tr, ti) { return (ti ? ', ' : '') + TRUCKS[ti]; }).join('') + ' (left to right)</span></div></div>';
  // jobs for the selected day (or the list filter)
  var dayJobs = all.filter(function (b) { return b.date === ac; }).sort(function (a, b) { return (a.time || '') < (b.time || '') ? -1 : 1; });
  var dayOff = TRUCKS.filter(function (tr) { return unavailableOn(tr, ac); });
  h += '<div class="kicker" style="margin:14px 0 6px">' + (ac === t ? 'Today · ' : '') + longDate(ac) + '</div>' + (dayOff.length ? '<div class="alert">' + dayOff.map(truckName).map(esc).join(', ') + ' recorded as unavailable (repairs or incident).</div>' : '') +
    '<div class="card flush"><ul class="list">' + (dayJobs.length ? dayJobs.map(bookingRow).join('') : '<li class="empty">No jobs on this day.' + (TRUCKS.length - dayOff.length ? ' ' + (TRUCKS.length - dayOff.length) + ' truck' + (TRUCKS.length - dayOff.length === 1 ? '' : 's') + ' available.' : '') + '</li>') + '</ul></div>';
  var list = all.filter(function (b) {
    if (S.bkFilter === 'upcoming') return bkActive(b) && b.date >= addDays(t, -1);
    if (S.bkFilter === 'toinvoice') return b.status === 'Done' || (b.status === 'Booked' && b.date < t);
    if (S.bkFilter === 'done') return b.status === 'Invoiced' || b.status === 'Done';
    return true;
  }).sort(function (a, b) { var k = S.bkFilter === 'upcoming' ? 1 : -1; return (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -k : k; });
  var chips = [['upcoming', 'Coming up'], ['toinvoice', (isDriver() ? 'Past jobs' : 'To invoice') + (toInv.length ? ' (' + toInv.length + ')' : '')], ['done', 'Completed'], ['all', 'All']];
  var groups = {}, order = []; list.forEach(function (b) { if (!groups[b.date]) { groups[b.date] = []; order.push(b.date); } groups[b.date].push(b); });
  h += '<div class="toolbar" style="margin-top:16px"><button class="btn gold" id="newBk">+ ' + (isDriver() ? 'Report or book a job' : 'New booking') + '</button></div><div class="toolbar">' +
    chips.map(function (c) { return '<button class="chip" data-bf="' + c[0] + '" aria-pressed="' + (S.bkFilter === c[0]) + '">' + c[1] + '</button>'; }).join('') + '</div>' +
    (order.length ? order.slice(0, 40).map(function (d) { var rel = daysBetween(t, d), lab = rel === 0 ? 'Today' : rel === 1 ? 'Tomorrow' : rel === -1 ? 'Yesterday' : '';
      return '<div class="kicker" style="margin:14px 0 6px">' + (lab ? lab + ' · ' : '') + longDate(d) + '</div><div class="card flush"><ul class="list">' + groups[d].map(bookingRow).join('') + '</ul></div>'; }).join('')
      : '<div class="card empty">' + (S.bkFilter === 'upcoming' ? 'Nothing booked yet.' : 'Nothing here.') + '</div>');
  $('view').innerHTML = h;
  qa('[data-bf]').forEach(function (b) { b.onclick = function () { S.bkFilter = b.dataset.bf; render(); }; });
  qa('[data-cv]').forEach(function (b) { b.onclick = function () { S.calView = b.dataset.cv; render(); }; });
  qa('[data-cal]').forEach(function (b) { b.onclick = function () { S.calAnchor = b.dataset.cal; if (S.calView === 'month') S.calView = 'month'; render(); }; });
  var step = function (n) { var d = parseIso(ac); S.calAnchor = S.calView === 'day' ? addDays(ac, n) : S.calView === 'week' ? addDays(ac, 7 * n) : isoOf(new Date(d.getFullYear(), d.getMonth() + n, 1)); render(); };
  $('calPrev').onclick = function () { step(-1); }; $('calNext').onclick = function () { step(1); }; $('calToday').onclick = function () { S.calAnchor = t; render(); };
  bindFaceIdHint();
  $('newBk').onclick = function () { isDriver() ? newMenu() : bookingEditor(); };
  qa('[data-bk]').forEach(function (b) { b.onclick = function () { if (b._swiped) { b._swiped = false; return; } bookingSheet(S.data.bookings.find(function (x) { return x.id === b.dataset.bk; })); }; });
  bindSwipes();
};
function bookingSheet(b) {
  var drv = isDriver(), clash = bookingConflicts(b);
  var h = '<div class="card"><p style="margin:0"><b>' + esc(b.client) + '</b>' + (b.phone ? ' · <a href="tel:' + esc(b.phone) + '">' + esc(b.phone) + '</a>' : '') + '</p>' +
    '<p class="muted" style="margin:4px 0 0">' + longDate(b.date) + (b.time ? ' at ' + esc(b.time) : '') + ' · ' + esc(b.truck) + '</p>' +
    (b.route ? '<p style="margin:6px 0 0">' + esc(b.route) + (b.load ? ' · ' + esc(b.load) : '') + '</p>' : '') +
    (b.sailing ? '<p style="margin:6px 0 0">' + icon('ferry', 'gi-inline') + esc(b.sailing) + '</p>' : '') +
    (!drv && b.price ? '<p style="margin:6px 0 0">Agreed price: <b>' + ec2(b.price * (b.qty || 1)) + '</b></p>' : '') +
    (b.notes ? '<p class="small" style="white-space:pre-wrap;margin:8px 0 0">' + esc(b.notes) + '</p>' : '') +
    (b.reportedBy ? '<p class="small muted" style="margin:8px 0 0">Marked done by ' + esc(b.reportedBy) + (b.doneAt ? ' on ' + nice(b.doneAt.slice(0, 10)) : '') + '</p>' : '') +
    (clash ? '<div class="alert" style="margin:10px 0 0">' + esc(b.truck) + ' has another job booked on this day.</div>' : '') + '</div>';
  h += attachmentsCard('Photos and dockets', b.attachments, b.status !== 'Invoiced' && b.status !== 'Cancelled');
  if (b.status === 'Invoiced') h += '<button class="btn block" id="bkInv">Open the invoice</button>';
  else {
    if (b.status === 'Tentative' && !drv) h += '<button class="btn gold block" id="bkConf">Confirm booking</button><div style="height:10px"></div>';
    if (b.status === 'Booked') h += '<button class="btn gold block" id="bkDone">Mark job done</button><div style="height:10px"></div>';
    if (!drv && b.status !== 'Cancelled') h += '<button class="btn ' + (b.status === 'Done' ? 'gold' : '') + ' block" id="bkMake">Create invoice from this job</button><div style="height:10px"></div>';
    if (b.status !== 'Cancelled') h += '<button class="btn quiet block" id="bkEdit">Edit</button><div style="height:10px"></div>';
    if (!drv) h += b.status === 'Cancelled' ? '<button class="btn quiet block" id="bkReopen">Reopen booking</button><div style="height:10px"></div><button class="btn danger block" id="bkDel">Delete booking</button>'
      : '<button class="btn danger block" id="bkCancel">Cancel booking</button>';
  }
  openSheet(b.status === 'Done' && !drv ? 'Job to invoice' : 'Job', h);
  bindAttachments({ kind: 'booking', id: b.id }, b.attachments);
  if ($('bkInv')) $('bkInv').onclick = function () { closeSheet(); go('invoice', b.invoiceId); };
  if ($('bkConf')) $('bkConf').onclick = function () { api('setBookingStatus', { id: b.id, status: 'Booked' }, 'Saving…').then(function () { closeSheet(); toast('Booking confirmed.'); render(); }).catch(function () {}); };
  if ($('bkDone')) $('bkDone').onclick = function () {
    openSheet('Mark job done', '<p class="muted">' + esc(b.client) + ' · ' + esc(b.route || '') + '</p><label class="f"><span>Note (optional)</span><textarea id="bdN" placeholder="Delivered, signed by…"></textarea></label>' +
      '<p class="small muted">You can attach the delivery photo or signed docket afterwards.</p><button class="btn gold block" id="bdGo">Mark done</button>');
    $('bdGo').onclick = function () { api('setBookingStatus', { id: b.id, status: 'Done', note: $('bdN').value }, 'Saving…').then(function () { closeSheet(); toast('Job marked done.'); render(); }).catch(function () {}); };
  };
  if ($('bkMake')) $('bkMake').onclick = function () {
    var c = S.data.clients.find(function (x) { return x.name.toLowerCase() === (b.client || '').toLowerCase(); }) || { name: b.client, phone: b.phone };
    var dest = (b.route || '').split('→').pop().trim();
    invoiceEditor({ issueDate: today(), bookingId: b.id, lines: [{ date: b.date, truck: b.truck, route: b.route, category: b.category || 'Building Materials', load: b.load,
      title: b.title || (dest && b.route.indexOf('→') > 0 ? (/SVG/i.test(dest) ? 'Delivery to St Vincent' : 'Delivery to ' + dest) : ''), detail: '', qty: b.qty || 1, price: b.price || S.data.settings.defaultPrice, costs: b.costs || {} }],
      internalNotes: b.notes || '' }, c);
  };
  if ($('bkEdit')) $('bkEdit').onclick = function () { bookingEditor(b); };
  if ($('bkCancel')) $('bkCancel').onclick = function () { api('setBookingStatus', { id: b.id, status: 'Cancelled' }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); };
  if ($('bkReopen')) $('bkReopen').onclick = function () { api('setBookingStatus', { id: b.id, status: 'Booked' }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); };
  if ($('bkDel')) $('bkDel').onclick = function () { if (confirm('Delete this booking?')) api('deleteBooking', { id: b.id }, 'Deleting…').then(function () { closeSheet(); render(); }).catch(function () {}); };
}
function bookingEditor(b) {
  b = b || { date: today(), truck: 'Skip truck' };
  var drv = isDriver(), editing = !!b.id, reporting = !editing && b.status === 'Done';
  var clients = S.data.clients.slice().sort(function (x, y) { return x.name.localeCompare(y.name); });
  var allRoutes = uniq(ROUTES.concat((S.data.bookings || []).map(function (x) { return x.route; })));
  var cs = b.costs || {};
  openSheet(editing ? 'Edit job' : reporting ? 'Report a finished job' : 'New booking',
    '<label class="f"><span>Customer</span><input id="bC" list="bcl" value="' + v(b.client) + '" autocomplete="off"></label>' + datalist('bcl', clients.map(function (x) { return x.name; })) +
    '<label class="f"><span>Customer phone</span><input id="bP" type="tel" value="' + v(b.phone) + '"></label>' +
    '<div class="cols"><label class="f"><span>Date</span><input type="date" id="bD" value="' + v(b.date) + '"></label><label class="f"><span>Time</span><input type="time" id="bT" value="' + v(b.time) + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Truck</span><select id="bTr">' + truckOpts(b.truck) + '</select></label><label class="f"><span>Load</span>' + loadSelect('id="bLs"', b.load) + '</label></div>' + loadOther('id="bLo"', b.load) +
    '<label class="f"><span>Area</span>' + routeSelect('id="bRs"', b.route) + '</label>' + routeOther('id="bRo"', b.route) +
    (drv ? '' : '<label class="check' + (garbageLabel(rateFor(b.route)) ? '' : ' hidden') + '" id="bGw"><input type="checkbox" id="bG"> <span id="bGl">' + esc(garbageLabel(rateFor(b.route))) + '</span></label>') +
    '<label class="f"><span>Site notes</span><input id="bS" value="' + v(b.sailing) + '" placeholder="Gate, access, where to place the bin"></label>' +
    (drv ? '<div class="cols"><label class="f"><span>Fuel spent (EC$)</span><input id="bFu" inputmode="decimal" value="' + v(cs.fuel) + '"></label><label class="f"><span>Subcontractors paid (EC$)</span><input id="bBo" inputmode="decimal" value="' + v(cs.subcontract) + '"></label></div>'
      : '<div class="cols"><label class="f"><span>Agreed price each (EC$)</span><input id="bPr" inputmode="decimal" value="' + v(b.price || (editing ? '' : S.data.settings.defaultPrice)) + '"' + (editing ? '' : ' data-auto="1"') + '></label><label class="f"><span>Quantity</span><input id="bQ" inputmode="decimal" value="' + v(b.qty || 1) + '"></label></div>' +
        '<label class="f"><span>Type of work</span><select id="bCat">' + opts(WORK_TYPES, b.category || 'Building Materials') + '</select></label>' +
        '<details class="costs"' + (lineCosts(b) ? ' open' : '') + '><summary>Expected costs (private)</summary><div class="cols">' +
        '<label class="f"><span>Labour</span><input id="bcD" inputmode="decimal" value="' + v(cs.labour) + '"' + (cs.labour ? '' : ' data-auto="1"') + '></label><label class="f"><span>Fuel</span><input id="bcF" inputmode="decimal" value="' + v(cs.fuel) + '"></label>' +
        '<label class="f"><span>Subcontractors</span><input id="bcB" inputmode="decimal" value="' + v(cs.subcontract) + '"></label><label class="f"><span>Materials</span><input id="bcM" inputmode="decimal" value="' + v(cs.material) + '"></label>' +
        '<label class="f"><span>Loading</span><input id="bcL" inputmode="decimal" value="' + v(cs.loading) + '"></label><label class="f"><span>Other direct</span><input id="bcO" inputmode="decimal" value="' + v(cs.other) + '"></label></div>' +
        '<p class="small muted">Leave the others blank when the customer pays them.</p></details>' +
        (drivers().length ? '<label class="f"><span>Crew member</span><select id="bDrv">' + driverOpts(b.driverId) + '</select></label>' : '')) +
    (!drv && !reporting && (!editing || b.status === 'Booked' || b.status === 'Tentative') ? '<label class="f"><span>Status</span><select id="bSt"><option value="Booked"' + (b.status !== 'Tentative' ? ' selected' : '') + '>Confirmed</option><option value="Tentative"' + (b.status === 'Tentative' ? ' selected' : '') + '>Tentative</option></select></label>' : '') +
    '<label class="f"><span>Notes</span><textarea id="bN">' + v(b.notes) + '</textarea></label>' +
    (reporting ? '<p class="small muted">Saved as done. The office then turns it into an invoice. Attach the delivery photo once it is saved.</p>' : ''), 'Save');
  $('bLs').onchange = function () { $('bLo').closest('[data-load-wrap]').classList.toggle('hidden', this.value !== 'Other'); if (this.value === 'Other') $('bLo').focus(); };
  $('bRs').onchange = function () {
    $('bRo').closest('[data-other-wrap]').classList.toggle('hidden', this.value !== 'Other'); if (this.value === 'Other') $('bRo').focus();
    if ($('bGw')) { var gl = garbageLabel(rateFor(this.value)); $('bGw').classList.toggle('hidden', !gl); $('bGl').textContent = gl; if (!gl) $('bG').checked = false; }
    if ($('bPr')) applyRate(this.value, $('bPr'), $('bcD'), $('bG'));
  };
  if ($('bG')) $('bG').onchange = function () { $('bPr').dataset.auto = '1'; applyRate($('bRs').value, $('bPr'), null, this); };
  if ($('bPr')) { $('bPr').addEventListener('input', function () { delete this.dataset.auto; }); $('bcD').addEventListener('input', function () { delete this.dataset.auto; }); }
  $('bC').onchange = function () { var m = S.data.clients.find(function (x) { return x.name.toLowerCase() === this.value.trim().toLowerCase(); }, this); if (m && !$('bP').value) $('bP').value = m.phone || ''; };
  $('sheetGo').onclick = function () {
    var out = { id: b.id, status: b.status, client: $('bC').value, phone: $('bP').value, date: $('bD').value, time: $('bT').value, truck: $('bTr').value, load: $('bLs').value === 'Other' ? $('bLo').value.trim() : $('bLs').value, route: $('bRs').value === 'Other' ? $('bRo').value.trim() : $('bRs').value, sailing: $('bS').value, notes: $('bN').value, title: b.title };
    if (drv) out.costs = { fuel: $('bFu').value, subcontract: $('bBo').value };
    else Object.assign(out, { price: $('bPr').value, qty: $('bQ').value, category: $('bCat').value, costs: { labour: $('bcD').value, fuel: $('bcF').value, subcontract: $('bcB').value, material: $('bcM').value, loading: $('bcL').value, other: $('bcO').value }, driverId: $('bDrv') ? $('bDrv').value : '' });
    if ($('bSt')) out.status = $('bSt').value;
    api('saveBooking', { booking: out }, 'Saving…').then(function (res) {
      closeSheet(); toast(reporting ? 'Job reported.' : 'Booking saved.');
      if (!res.queued && S.view !== 'bookings') go('bookings'); else render();
    }).catch(function () {});
  };
}

/* ==================== fuel and mileage ==================== */
function fuelStats(truck, from, to) {
  var logs = (S.data.fuel || []).filter(function (f) { return f.truck === truck; }).sort(function (a, b) { return a.odometer - b.odometer; });
  var inRange = logs.filter(function (f) { return within(f.date, from, to); });
  // Full-tank method: distance since the previous fill divided by the litres of this fill.
  var km = 0, litres = 0, cost = 0;
  for (var i = 1; i < logs.length; i++) {
    if (!within(logs[i].date, from, to) || logs[i].full === false) continue;
    var d = logs[i].odometer - logs[i - 1].odometer; if (d <= 0) continue;
    km += d; litres += logs[i].litres; cost += logs[i].cost || 0;
  }
  return { logs: logs, inRange: inRange, km: km, kmPerL: litres ? km / litres : null, costPerKm: km && cost ? cost / km : null,
    litresTotal: inRange.reduce(function (t, f) { return t + f.litres; }, 0), costTotal: inRange.reduce(function (t, f) { return t + (f.cost || 0); }, 0),
    odometer: logs.length ? logs[logs.length - 1].odometer : null };
}
function odometerOf(truck) { var s = fuelStats(truck, null, null); return s.odometer; }
VIEWS.fuel = function () {
  var r = periodRange(S.period);
  var h = periodControl(render) + '<div class="toolbar"><button class="btn gold" id="addFuel">+ Log a fill-up</button></div>';
  h += TRUCKS.map(function (t) {
    var s = fuelStats(t, r.from, r.to);
    return '<div class="card"><div class="card-head"><h2 style="margin:0">' + esc(t) + '</h2><span class="kicker">' + (s.odometer ? F0.format(s.odometer) + ' km' : 'no readings yet') + '</span></div>' +
      '<table><tbody><tr><td>Fuel efficiency</td><td class="n"><b>' + (s.kmPerL ? s.kmPerL.toFixed(2) + ' km/L' : '–') + '</b></td><td>Cost per km</td><td class="n">' + (s.costPerKm ? ec2(s.costPerKm) : '–') + '</td></tr>' +
      '<tr><td>Distance</td><td class="n">' + (s.km ? F0.format(s.km) + ' km' : '–') + '</td><td>Fill-ups</td><td class="n">' + s.inRange.length + '</td></tr>' +
      '<tr><td>Litres</td><td class="n">' + F0.format(s.litresTotal) + '</td><td>Spent</td><td class="n">' + ec(s.costTotal) + '</td></tr></tbody></table></div>'; }).join('');
  var logs = (S.data.fuel || []).filter(function (f) { return within(f.date, r.from, r.to); }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : b.odometer - a.odometer; });
  h += '<div class="card flush"><ul class="list">' + (logs.length ? logs.map(function (f) {
    return '<li><button class="row-btn" data-fu="' + f.id + '"><span class="t">' + esc(f.truck) + ' · ' + f.litres + ' L</span><span class="a">' + (f.cost ? ec2(f.cost) : '') + '</span>' +
      '<span class="m">' + nice(f.date) + ' · ' + F0.format(f.odometer) + ' km' + (f.station ? ' · ' + esc(f.station) : '') + (f.full === false ? ' · part fill' : '') + '</span><span class="m">' + esc(f.createdBy || '') + '</span></button></li>'; }).join('')
    : '<li class="empty">No fill-ups logged in this period. Log each fill-up with the odometer reading to track fuel efficiency and mileage-based servicing.</li>') + '</ul></div>' +
    '<p class="small muted">Efficiency uses the full-tank method: the distance since the last fill-up divided by the litres needed to fill up again. Fuel logged here is for tracking; the cost of fuel still goes on each job or as a running expense, so it is not counted twice.</p>';
  $('view').innerHTML = h;
  $('addFuel').onclick = function () { fuelEditor(); };
  qa('[data-fu]').forEach(function (b) { b.onclick = function () { fuelEditor(S.data.fuel.find(function (f) { return f.id === b.dataset.fu; })); }; });
};
function fuelEditor(f) {
  var editing = !!(f && f.id); f = Object.assign({ date: today(), truck: TRUCKS[0], full: true }, f || {});
  var last = odometerOf(f.truck);
  openSheet(editing ? 'Edit fill-up' : 'Fuel fill-up',
    '<div class="cols"><label class="f"><span>Date</span><input type="date" id="fD" value="' + v(f.date) + '"></label><label class="f"><span>Truck</span><select id="fT">' + truckOpts(f.truck) + '</select></label></div>' +
    '<div class="cols"><label class="f"><span>Litres</span><input id="fL" inputmode="decimal" value="' + v(f.litres) + '"></label><label class="f"><span>Cost (EC$)</span><input id="fC" inputmode="decimal" value="' + v(f.cost) + '"></label></div>' +
    '<label class="f"><span>Odometer (km)</span><input id="fO" inputmode="numeric" value="' + v(f.odometer) + '" placeholder="' + (last ? 'Last reading ' + F0.format(last) : '') + '"></label>' +
    '<label class="check"><input type="checkbox" id="fF"' + (f.full !== false ? ' checked' : '') + '> Filled the tank to full</label>' +
    '<label class="f"><span>Station (optional)</span><input id="fS" value="' + v(f.station) + '"></label>' +
    (drivers().length ? '<label class="f"><span>Crew member</span><select id="fDr">' + driverOpts(f.driverId) + '</select></label>' : '') +
    '<div id="fWarn"></div><label class="f"><span>Receipt photo (optional)</span><input type="file" id="fR" accept="image/*" capture="environment"></label>' +
    (editing ? attachmentsCard('Receipt', f.attachments, true) : '') +
    '<p class="small muted">Fuel is a cost only when the business pays for it; customer-funded fuel is not entered here.</p>' +
    (!editing && !isDriver() ? '<label class="check"><input type="checkbox" id="fX"> Also record the cost as a running expense</label><p class="small muted" style="margin-top:-8px">Leave unticked if this fuel is already entered as a cost on the jobs it was used for.</p>' : '') +
    (editing ? '<button class="btn danger block" id="fDel">Delete entry</button>' : ''), 'Save');
  if (editing) bindAttachments({ kind: 'fuel', id: f.id }, f.attachments);
  var chk = function () { var o = odometerOf($('fT').value), val = num($('fO').value), l = num($('fL').value), c = num($('fC').value), w = [], bad = false;
    if (val && o && val < o && !editing) { w.push('Odometer is below the last reading for this truck (' + F0.format(o) + ' km).'); bad = true; }
    if (val && o && val - o > 3000) { w.push('That is ' + F0.format(val - o) + ' km since the last fill-up. Check the reading.'); bad = true; }
    if (l > 600) { w.push('More litres than a truck tank normally holds.'); bad = true; }
    if (l && c) w.push('Works out at ' + ec2(c / l) + ' a litre.');
    $('fWarn').innerHTML = w.length ? '<p class="small ' + (bad ? 'neg' : 'muted') + '">' + w.join(' ') + '</p>' : ''; };
  ['fO', 'fL', 'fC'].forEach(function (id) { $(id).addEventListener('input', chk); });
  $('fT').onchange = function () { var o = odometerOf(this.value); $('fO').placeholder = o ? 'Last reading ' + F0.format(o) : ''; chk(); };
  $('sheetGo').onclick = function () {
    api('saveFuel', { entry: { id: f.id, date: $('fD').value, truck: $('fT').value, litres: $('fL').value, cost: $('fC').value, odometer: $('fO').value, full: $('fF').checked, station: $('fS').value, driverId: $('fDr') ? $('fDr').value : '', asExpense: $('fX') ? $('fX').checked : false } }, 'Saving…')
      .then(function (res) {
        var fl = $('fR') && $('fR').files[0], id = f.id || (res && res.result && res.result.id);
        if (!fl || !id) { closeSheet(); toast('Fill-up saved.'); render(); return; }
        return shrinkImage(fl).then(function (data) { return api('uploadFile', { target: { kind: 'fuel', id: id }, file: { name: 'Fuel receipt ' + $('fD').value + '.jpg', type: 'image/jpeg', data: data, docType: 'Receipt' } }, 'Saving receipt…'); })
          .then(function () { closeSheet(); toast('Fill-up and receipt saved.'); render(); });
      }).catch(function () {});
  };
  if ($('fDel')) $('fDel').onclick = function () { if (confirm('Delete this entry?')) api('deleteFuel', { id: f.id }, 'Deleting…').then(function () { closeSheet(); render(); }).catch(function () {}); };
}

/* ==================== forecast and targets ==================== */
function forecast() {
  var f = facts(), t = today(), from = addDays(t, -90);
  var s = summarise(f, from, t), months = 90 / 30.44;
  var pace = s.net / months, perTrip = s.trips ? (s.income - s.jobCosts) / s.trips : 0, runPerMonth = s.overheads / months;
  var inv = startupTotal(), done = summarise(f, null, null).net, left = inv - done;
  var out = { pace: pace, perTrip: perTrip, runPerMonth: runPerMonth, left: left, trips: s.trips };
  function dateIn(monthsAhead) { var d = parseIso(t); d.setDate(d.getDate() + Math.round(monthsAhead * 30.44)); return MONTH[d.getMonth()] + ' ' + d.getFullYear(); }
  if (left > 0 && pace > 0) { out.months = left / pace; out.when = dateIn(out.months); }
  var extra = perTrip * 52 / 12;
  if (left > 0 && pace + extra > 0 && perTrip > 0) { out.monthsExtra = left / (pace + extra); out.whenExtra = dateIn(out.monthsExtra); }
  out.breakEven = perTrip > 0 ? Math.ceil(runPerMonth / perTrip) : null;
  return out;
}
function forecastCard() {
  if (!startupTotal()) return '';
  var fc = forecast();
  if (fc.left <= 0) return '';
  var body = fc.when
    ? 'At your pace over the last 90 days (' + ec(fc.pace) + ' net a month), equipment costs are paid back by <b>' + fc.when + '</b>' + (fc.months > 1 ? ', about ' + Math.round(fc.months) + ' months away' : '') + '.' +
      (fc.whenExtra ? ' One extra job a week would bring that forward to <b>' + fc.whenExtra + '</b>.' : '')
    : 'Over the last 90 days the business has not made a net profit, so there is no payback date at the current pace.';
  return '<div class="card forecast"><div class="kicker">Payback forecast</div><p style="margin:6px 0 0">' + body + '</p>' +
    (fc.breakEven != null ? '<p class="small muted" style="margin:8px 0 0">Running costs average ' + ec(fc.runPerMonth) + ' a month; covering them takes about ' + fc.breakEven + (fc.breakEven === 1 ? ' job' : ' jobs') + ' a month at ' + ec(fc.perTrip) + ' net per job.</p>' : '') + '</div>';
}
function targetTile() {
  var tgt = S.data.settings.monthlyTarget || 0;
  if (!tgt) return '';
  var m1 = today().slice(0, 8) + '01', s = summarise(facts(), m1, today()), p = Math.max(0, Math.min(1, s.net / tgt));
  var d = parseIso(today()), dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(), expected = d.getDate() / dim;
  return '<div class="card"><div class="card-head"><h2 style="margin:0">' + MONTH[d.getMonth()] + ' target</h2><span class="kicker">' + ec(s.net) + ' of ' + ec(tgt) + '</span></div>' +
    '<div class="meter"><span style="width:' + (p * 100) + '%"></span><i style="left:' + (expected * 100) + '%"></i></div>' +
    '<p class="small muted" style="margin:8px 0 0">' + (s.net >= tgt ? 'Target reached.' : ec(tgt - s.net) + ' to go with ' + (dim - d.getDate()) + ' days left. The marker shows where you would be on an even pace.') + '</p></div>';
}


/* ==================== Insights: six screens (K1 to K6) ==================== */
S.insTab = null; S.rollN = 6; S.tfSc = { vol: 0, fuel: 0, delay: 0, avail: 100 }; S.expo = 35; S.hlX = { trips: 1, contrib: null };
var INS_TABS = [['exec', 'Executive Overview', 'Key metrics and priority insights'], ['health', 'Financial Health', 'Profitability, capital recovery and cash flow'], ['rev', 'Revenue & Customers', 'Customer concentration, pricing and collections'],
  ['ops', 'Operations & Fleet', 'Truck utilisation, area performance and costs'], ['trends', 'Trends & Forecasts', 'Monthly performance and future scenarios'], ['actions', 'Action Centre', 'What to do next, each linked to the record']];
function legacyCards() { insightsLegacy(); var m = {}; qa('#view .card').forEach(function (c) { var k = c.querySelector('.kicker'); if (k) m[k.textContent.trim().toLowerCase()] = c.outerHTML; }); return m; }
function insActions() {
  var t = today(), out = [];
  liveInvoices().filter(function (i) { return invStatus(i) === 'Overdue'; }).sort(function (a, b) { return a.dueDate < b.dueDate ? -1 : 1; }).forEach(function (i) { var d = daysBetween(i.dueDate, t); out.push([d > 60 ? 3 : 2, 'money', 'Chase ' + esc(clientOf(i).name) + ' for ' + invNo(i), ec2(invBalance(i)) + ', ' + d + ' days past due', 'inv:' + i.id]); });
  var toInv = (S.data.bookings || []).filter(function (b) { return b.status === 'Done' || (b.status === 'Booked' && b.date < t); }); if (toInv.length) out.push([2, 'calendar', 'Invoice ' + toInv.length + ' finished ' + (toInv.length === 1 ? 'job' : 'jobs'), 'Done or past bookings with no invoice yet', 'go:bookings']);
  (S.data.reminders || []).forEach(function (r) { var d = r.due ? daysBetween(t, r.due) : null, km = r.dueKm && odometerOf(r.truck) ? r.dueKm - odometerOf(r.truck) : null; if ((d != null && d <= 14) || (km != null && km <= 500)) out.push([d != null && d < 0 || km != null && km < 0 ? 3 : 2, 'alarm', esc(r.type) + ' · ' + esc(truckName(r.truck)), d != null ? (d < 0 ? Math.abs(d) + ' days overdue' : 'due in ' + d + ' days') : F0.format(km) + ' km left', 'go:reminders']); });
  (S.data.incidents || []).filter(function (x) { return x.status !== 'Resolved'; }).forEach(function (x) { out.push([2, 'truck', 'Open incident: ' + esc(x.type) + ' (' + esc(x.truck) + ')', esc(x.status), 'veh:' + x.truck]); });
  (S.data.quotes || []).filter(function (q) { return q.status === 'Open' && daysBetween(q.issueDate, t) >= 5; }).forEach(function (q) { out.push([1, 'quote', 'Follow up quote ' + quoteNo(q), esc(clientOf(q).name) + ', open ' + daysBetween(q.issueDate, t) + ' days', 'quote:' + q.id]); });
  var lastMonthEnd = isoOf(new Date(parseIso(t).getFullYear(), parseIso(t).getMonth(), 0)).slice(0, 7);
  if (closedList().indexOf(lastMonthEnd) < 0) out.push([1, 'lock', 'Close ' + ymName(lastMonthEnd), 'Check its records, then close it so reports become final', 'go:monthend']);
  if (fcSettings().openingBalance == null) out.push([1, 'wallet', 'Confirm today\'s bank balance', 'Needed for the projected cash balance', 'go:cashflow']);
  vehicles().filter(function (v) { return !v.plate; }).forEach(function (v) { out.push([1, 'clip', 'Add ' + esc(v.id) + ' registration details', 'Plate, model and year are unconfigured', 'go:settings']); });
  return out.sort(function (a, b) { return b[0] - a[0]; });
}
VIEWS.insights = function () {
  var tab = S.insTab, f = facts(), t = today();
  if (!tab) {
    $('view').innerHTML = '<div class="ins-grid">' + INS_TABS.map(function (x, k) { return '<button class="card ins-tile" data-it="' + x[0] + '"><span class="ins-n">0' + (k + 1) + '</span><b>' + x[1] + '</b><span class="small muted">' + x[2] + '</span></button>'; }).join('') + '</div><p class="small muted">Every figure links to the records it comes from and uses the same calculations as the reports.</p>';
    qa('[data-it]').forEach(function (b) { b.onclick = function () { S.insTab = b.dataset.it; window.scrollTo(0, 0); render(); }; }); return;
  }
  var L = legacyCards(), pick = function (k) { return L[k] || ''; }, h = '<div class="ins-nav"><button class="btn link" id="insBack">‹ All insights</button><div class="ins-chips">' + INS_TABS.map(function (x) { return '<button class="chip" data-it="' + x[0] + '" aria-pressed="' + (tab === x[0]) + '">' + x[1] + '</button>'; }).join('') + '</div></div>';
  var r = periodRange(S.period), pr = previousRange(S.period), cur = summarise(f, r.from, r.to), prev = pr ? summarise(f, pr.from, pr.to) : null;
  if (tab === 'exec') {
    var obs = [];
    var od = liveInvoices().filter(function (i) { return invStatus(i) === 'Overdue'; }), odAmt = od.reduce(function (a, i) { return a + invBalance(i); }, 0);
    if (odAmt) obs.push([3, 'money', 'neg', ec(odAmt) + ' overdue', od.length + ' invoices past due; oldest ' + daysBetween(od.map(function (i) { return i.dueDate; }).sort()[0], t) + ' days. Period: today.', 'odinv']);
    if (prev && (prev.trips || prev.costs)) { var dn = cur.net - prev.net; if (Math.abs(dn) > 500) obs.push([2, 'trend', dn > 0 ? 'pos' : 'neg', 'Operating profit ' + (dn > 0 ? 'up ' : 'down ') + ec(Math.abs(dn)), esc(periodLabel(S.period)) + ' against ' + esc(prevLabel(S.period).toLowerCase()) + ': ' + ec(prev.net) + ' to ' + ec(cur.net) + '.', 'monthly']);
      if (!isNaN(cur.margin) && !isNaN(prev.margin) && Math.abs(cur.margin - prev.margin) >= 0.1) obs.push([2, 'chart', cur.margin > prev.margin ? 'pos' : 'warn', 'Margin ' + pct(cur.margin), 'From ' + pct(prev.margin) + ' in ' + esc(prevLabel(S.period).toLowerCase()) + '.', 'monthly']); }
    var s365 = summarise(f, addDays(t, -364), t), cs = groupStats(s365.jobs, 'client').sort(function (a, b) { return b.income - a.income; });
    if (cs.length && s365.income && cs[0].income / s365.income > 0.35) obs.push([2, 'users', 'warn', esc(cs[0].name) + ': ' + pct(cs[0].income / s365.income) + ' of revenue', 'Largest customer over the last 12 months.', 'custreport']);
    TRUCKS.forEach(function (tr) { if (!summarise(f, addDays(t, -89), t).jobs.some(function (j) { return j.truck === tr; })) obs.push([2, 'truck', 'warn', 'No jobs recorded for ' + esc(truckName(tr)), 'In the most recent 90 days. Review fleet records.', 'fleet']); });
    insActions().filter(function (a) { return a[0] >= 3; }).slice(0, 2).forEach(function (a) { if (a[4].indexOf('inv:') !== 0) obs.push([3, a[1], 'neg', a[2], a[3], a[4].replace('go:', '')]); });
    h += periodControl(render) + '<div class="mgrid" style="margin-bottom:12px"><div class="mcard"><span class="ml">Revenue</span><b>' + ec(cur.income) + '</b>' + (prev ? chg(cur.income, prev.income) : '') + '</div><div class="mcard"><span class="ml">Operating profit</span><b>' + ec(cur.net) + '</b>' + (prev ? chg(cur.net, prev.net) : '') + '</div>' +
      '<div class="mcard"><span class="ml">Owed to you</span><b>' + ec(liveInvoices().reduce(function (a, i) { return a + invBalance(i); }, 0)) + '</b></div><div class="mcard"><span class="ml">Jobs</span><b>' + cur.trips + '</b>' + (prev ? chg(cur.trips, prev.trips, { count: true }) : '') + '</div></div>' +
      '<div class="card"><h2>What Matters Now</h2><ul class="obs">' + (obs.length ? obs.sort(function (a, b) { return b[0] - a[0]; }).map(function (o) { return '<li class="' + o[2] + '">' + icon(o[1], 'gi-obs') + '<div><b>' + o[3] + '</b><p>' + o[4] + '</p><button class="btn link pl-link" data-ig="' + o[5] + '">Review records ›</button></div></li>'; }).join('') : '<li class="info">' + icon('checkc', 'gi-obs') + '<div><b>Nothing urgent</b><p>No overdue money, fleet exceptions or big swings in this period.</p></div></li>') + '</ul></div>';
  } else if (tab === 'health') {
    var s90 = summarise(f, addDays(t, -89), t), p90 = summarise(f, addDays(t, -179), addDays(t, -90)), inv0 = startupTotal(), cum = summarise(f, null, null).net, per = s90.trips ? (s90.income - s90.jobCosts) / s90.trips : 0;
    if (S.hlX.contrib == null) S.hlX.contrib = Math.round(per);
    var monthly = s90.net / (90 / 30.44), extra = S.hlX.trips * 4.33 * S.hlX.contrib, mLeft = inv0 - cum > 0 && monthly + extra > 0 ? Math.ceil((inv0 - cum) / (monthly + extra)) : null;
    h += '<div class="card cap-hero"><div class="kicker">Capital performance</div><div class="mgrid" style="margin-top:8px"><div class="mcard"><span class="ml">Initial investment</span><b>' + ec(inv0) + '</b></div><div class="mcard"><span class="ml">Cumulative profit</span><b>' + ec(cum) + '</b></div><div class="mcard"><span class="ml">Profit / investment</span><b>' + pct(cum / inv0) + '</b><span class="ms">Not evidence that cash has been returned</span></div>' +
      '<div class="mcard"><span class="ml">Profit margin</span><b>' + pct(s90.margin) + '</b>' + (!isNaN(p90.margin) ? chg(s90.margin, p90.margin, { pts: true }) : '') + '<span class="ms">Last 90 days vs the 90 before</span></div></div></div>' +
      pick('payback forecast') + pick('costs') +
      '<div class="card"><h2>Investment Scenario</h2><p class="small muted" style="margin-top:0">Adjust the assumptions. Straight-line accounting-profit scenario only; not a cash payback forecast.</p>' +
      '<label class="f"><span>Extra jobs per week: <b id="hxT">' + S.hlX.trips + '</b></span><input type="range" id="hxTr" min="0" max="10" step="1" value="' + S.hlX.trips + '"></label>' +
      '<label class="f"><span>Contribution per additional job: <b id="hxC">' + ec(S.hlX.contrib) + '</b></span><input type="range" id="hxCr" min="0" max="3000" step="50" value="' + S.hlX.contrib + '"></label>' +
      '<div class="mgrid"><div class="mcard"><span class="ml">Monthly profit assumption</span><b id="hxM">' + ec(monthly + extra) + '</b></div><div class="mcard"><span class="ml">Estimated months remaining</span><b id="hxL">' + (inv0 - cum <= 0 ? 'Reached' : mLeft || 'Not reached') + '</b></div></div><p class="small muted">Excludes additional costs, taxes and further investment.</p></div>' +
      '<div class="card"><h2>Profit, Receipts and Cash</h2><table><tbody><tr><td>Operating profit, last 90 days</td><td class="n">' + ec(s90.net) + '</td></tr><tr><td>Cash received from customers</td><td class="n">' + ec(s90.received) + '</td></tr><tr><td>Owed to you now</td><td class="n">' + ec(liveInvoices().reduce(function (a, i) { return a + invBalance(i); }, 0)) + '</td></tr><tr><td>Bank balance confirmed</td><td class="n">' + (fcSettings().openingBalance != null ? ec(fcSettings().openingBalance) + ' on ' + nice(fcSettings().openingDate) : 'Not confirmed') + '</td></tr><tr><td>Forecast net movement, 30 days (base)</td><td class="n">' + ec(cashflowData(30, 'base').tin - cashflowData(30, 'base').tout) + '</td></tr></tbody></table><p class="small muted">Profit, cash received, cash in the bank and forecasts are different things and are kept separate.</p></div>';
  } else if (tab === 'rev') {
    var s365b = summarise(f, addDays(t, -364), t), csb = groupStats(s365b.jobs, 'client').sort(function (a, b) { return b.income - a.income; }), top = csb[0];
    var cut = top ? top.income * S.expo / 100 : 0;
    h += pick('customers') + (top ? '<div class="card"><h2>Revenue Exposure Scenario</h2><label class="f"><span>Reduction in ' + esc(top.name) + ' work: <b id="exV">' + S.expo + '%</b></span><input type="range" id="exR" min="0" max="100" step="5" value="' + S.expo + '"></label>' +
      '<div class="mcard"><span class="ml">Potential total revenue reduction</span><b id="exO">' + pct(cut / s365b.income) + '</b><span class="ms" id="exA">' + ec(cut) + ' a year</span></div><p class="small muted">Assumes other customers\' revenue stays the same. Last 12 months.</p></div>' : '') +
      pick('getting paid') + pick('pricing');
    var hist = []; groupStats(s365b.jobs, 'client').forEach(function (g) { var js = s365b.jobs.filter(function (j) { return j.client === g.name && j.route; });
      uniq(js.map(function (j) { return j.route; })).forEach(function (rt) { var rj = js.filter(function (j) { return j.route === rt; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }); if (rj.length < 3) return; var last = rj[rj.length - 1].price, avg = rj.slice(0, -1).reduce(function (a, j) { return a + j.price; }, 0) / (rj.length - 1); if (Math.abs(last - avg) > 50) hist.push([g, rt, last, avg, rj.length]); }); });
    h += '<div class="card"><h2>Agreed Price Changes</h2>' + (hist.length ? '<ul class="obs">' + hist.map(function (x) { return '<li class="' + (x[2] < x[3] ? 'warn' : 'pos') + '">' + icon('route', 'gi-obs') + '<div><b>' + esc(x[0].name) + ' · ' + esc(x[1].replace('SVG → ', '')) + '</b><p>Latest price ' + ec(x[2]) + ' against an earlier average of ' + ec(x[3]) + ' (' + x[4] + ' jobs). Check whether the change was agreed.</p></div></li>'; }).join('') + '</ul>' : '<p class="muted">No customer\'s price on a area has changed from their own earlier average.</p>') +
      '<p class="small muted">Compares each customer\'s own historical prices, not just today\'s standard area prices.</p></div>' +
      '<div class="card"><h2>Customers</h2><ul class="list">' + csb.slice(0, 8).map(function (g) { var c = S.data.clients.find(function (x) { return x.name === g.name; }); return '<li><button class="row-btn" data-c="' + (c ? c.id : '') + '"><span class="t">' + esc(g.name) + '</span><span class="a">' + ec(g.income) + '</span><span class="m">' + g.trips + ' jobs · ' + pct(g.margin) + ' margin</span><span></span></button></li>'; }).join('') + '</ul></div>';
  } else if (tab === 'ops') {
    var r90 = { from: addDays(t, -89), to: t }, s9 = summarise(f, r90.from, r90.to), ts = truckStats(r90, s9);
    h += '<div class="card"><h2>Fleet Comparison · last 90 days</h2><div class="scroll-x"><table><thead><tr><th>Measure</th>' + ts.map(function (x) { return '<th class="n">' + esc(x.short) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      [['Recorded jobs', function (x) { return x.trips; }], ['Reported net result', function (x) { return ec(x.net); }], ['Working days', function (x) { return x.work; }], ['Off the road', function (x) { return x.off + ' days'; }], ['No recorded work (unknown)', function (x) { return x.idle + ' days'; }],
       ['Revenue per available truck-day', function (x) { return x.span - x.off ? ec(x.income / (x.span - x.off)) : '–'; }], ['Contribution per working day', function (x) { return x.work ? ec(x.net / x.work) : '–'; }],
       ['Maintenance cost / km', function (x) { var km = kmIn(x.t, r90.from, r90.to); return km ? ec(x.maintCost / km) : 'Unknown'; }], ['Breakdowns and incidents', function (x) { return (S.data.incidents || []).filter(function (i) { return i.truck === x.t && i.date >= r90.from; }).length; }],
       ['Fuel efficiency', function (x) { var st = fuelStats(x.t, r90.from, r90.to); return st && st.kmPerL ? st.kmPerL.toFixed(2) + ' km/L' : 'Unknown'; }]].map(function (m) { return '<tr><td>' + m[0] + '</td>' + ts.map(function (x) { return '<td class="n">' + m[1](x) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="small muted">No recorded work does not establish whether a truck was available, so it is shown as unknown rather than idle.</p></div>' + pick('trucks') + pick('routes');
  } else if (tab === 'trends') {
    var n = S.rollN, endM = isoOf(new Date(parseIso(t).getFullYear(), parseIso(t).getMonth() + 1, 0)), stM = addMonths(t.slice(0, 8) + '01', -(n - 1));
    var curW = summarise(f, stM, endM), prvW = summarise(f, addMonths(stM, -n), addDays(stM, -1)), yoy = summarise(f, shiftYear(stM, -1), shiftYear(endM, -1));
    var sc = S.tfSc, s90c = summarise(f, addDays(t, -89), t), mRev = s90c.income / 3, mDir = s90c.jobCosts / 3, mRun = s90c.overheads / 3, fuelShare = (Calc.costSplit(s90c.jobs).fuel / 3) + (Calc.expenseSplit(s90c.exps).Fuel || 0) / 3;
    var vol = (1 + sc.vol / 100) * (sc.avail / 100), pRev = mRev * vol, pDir = (mDir - Calc.costSplit(s90c.jobs).fuel / 3) * vol + (Calc.costSplit(s90c.jobs).fuel / 3) * vol * (1 + sc.fuel / 100), pRun = mRun + ((Calc.expenseSplit(s90c.exps).Fuel || 0) / 3) * (sc.fuel / 100);
    h += '<div class="card"><h2>Performance Trends</h2><div class="seg mini" style="margin-bottom:10px">' + [3, 6, 12].map(function (k) { return '<button data-roll="' + k + '" aria-pressed="' + (n === k) + '">Rolling ' + k + ' months</button>'; }).join('') + '</div><div class="mgrid">' +
      '<div class="mcard"><span class="ml">Revenue</span><b>' + ec(curW.income) + '</b>' + chg(curW.income, prvW.income) + '<span class="ms">vs previous ' + n + ' months</span></div><div class="mcard"><span class="ml">Operating profit</span><b>' + ec(curW.net) + '</b>' + chg(curW.net, prvW.net) + '</div>' +
      '<div class="mcard"><span class="ml">Costs</span><b>' + ec(curW.costs) + '</b>' + chg(curW.costs, prvW.costs, { invert: true }) + '</div><div class="mcard"><span class="ml">Same months last year</span><b>' + (yoy.trips ? ec(yoy.income) : 'No data') + '</b><span class="ms">' + (yoy.trips ? 'Revenue' : 'Year-on-year needs a full prior year') + '</span></div></div><div class="chart-box" style="margin-top:10px"><canvas id="cRoll"></canvas></div></div>' +
      '<div class="card"><h2>Projections · next 3 months</h2><p class="small muted" style="margin-top:0">Starts from the last 90 days. Move the sliders to test realistic changes; nothing here is a promise.</p>' +
      [['vol', 'Job volume and demand', -50, 50, 5, '%'], ['fuel', 'Fuel price', -30, 50, 5, '%'], ['delay', 'Customer payment delay', 0, 60, 5, ' days'], ['avail', 'Truck availability', 50, 100, 5, '%']].map(function (x) { return '<label class="f"><span>' + x[1] + ': <b>' + (x[0] !== 'avail' && x[0] !== 'delay' && sc[x[0]] > 0 ? '+' : '') + sc[x[0]] + x[5] + '</b></span><input type="range" data-tf="' + x[0] + '" min="' + x[2] + '" max="' + x[3] + '" step="' + x[4] + '" value="' + sc[x[0]] + '"></label>'; }).join('') +
      '<div class="scroll-x"><table><thead><tr><th>Projection</th><th class="n">Per month</th><th class="n">3 months</th></tr></thead><tbody>' +
      [['Revenue', pRev], ['Costs', pDir + pRun], ['Operating profit', pRev - pDir - pRun], ['Cash collected', pRev * Math.max(0, 1 - sc.delay / 90)]].map(function (x) { return '<tr><td>' + x[0] + '</td><td class="n">' + ec(x[1]) + '</td><td class="n">' + ec(x[1] * 3) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="small muted">Cash collected assumes payment delays push part of the revenue past the 3-month window. Fuel price applies to fuel the business pays for.</p></div>' + pick('seasons');
  } else {
    var acts = insActions();
    h += '<div class="card"><h2>Action Centre</h2><p class="small muted" style="margin-top:0">Ranked by urgency. Tap to open the record.</p><ul class="list">' + (acts.length ? acts.map(function (a) { return '<li><button class="row-btn" data-act="' + esc(a[4]) + '">' + tileIcon(a[1]) + '<span><span class="t">' + a[2] + '</span><br><span class="m">' + a[3] + '</span></span><span class="pill ' + (a[0] >= 3 ? 'Overdue' : a[0] === 2 ? 'Unpaid' : 'muted') + '">' + (a[0] >= 3 ? 'Urgent' : a[0] === 2 ? 'Soon' : 'Tidy-up') + '</span></button></li>'; }).join('') : '<li class="empty">Nothing needs doing right now.</li>') + '</ul></div>';
  }
  $('view').innerHTML = h;
  $('insBack').onclick = function () { S.insTab = null; render(); };
  qa('[data-it]').forEach(function (b) { b.onclick = function () { S.insTab = b.dataset.it; render(); }; });
  qa('[data-ig]').forEach(function (b) { b.onclick = function () { var k = b.dataset.ig; if (k === 'odinv') { S.invFilter = 'overdue'; go('invoices'); } else go(k); }; });
  qa('[data-igo]').forEach(function (b) { b.onclick = function () { go(b.dataset.igo); }; });
  qa('[data-c]').forEach(function (b) { b.onclick = function () { if (b.dataset.c) go('client', b.dataset.c); }; });
  qa('[data-roll]').forEach(function (b) { b.onclick = function () { S.rollN = +b.dataset.roll; render(); }; });
  qa('[data-tf]').forEach(function (b) { b.onchange = function () { S.tfSc[b.dataset.tf] = +b.value; render(); }; });
  qa('[data-act]').forEach(function (b) { b.onclick = function () { var a = b.dataset.act, p = a.split(':'); if (p[0] === 'inv') go('invoice', p[1]); else if (p[0] === 'quote') go('quote', p[1]); else if (p[0] === 'veh') go('vehicle', p.slice(1).join(':')); else go(p[1]); }; });
  if ($('exR')) $('exR').oninput = function () { S.expo = +this.value; var s3 = summarise(f, addDays(t, -364), t), tp = groupStats(s3.jobs, 'client').sort(function (a, b) { return b.income - a.income; })[0], c2 = tp.income * S.expo / 100; $('exV').textContent = S.expo + '%'; $('exO').textContent = pct(c2 / s3.income); $('exA').textContent = ec(c2) + ' a year'; };
  var upd = function () { var s9 = summarise(f, addDays(t, -89), t), inv1 = startupTotal(), cm = summarise(f, null, null).net, mo = s9.net / (90 / 30.44) + S.hlX.trips * 4.33 * S.hlX.contrib;
    $('hxT').textContent = S.hlX.trips; $('hxC').textContent = ec(S.hlX.contrib); $('hxM').textContent = ec(mo); $('hxL').textContent = inv1 - cm <= 0 ? 'Reached' : mo > 0 ? Math.ceil((inv1 - cm) / mo) : 'Not reached'; };
  if ($('hxTr')) { $('hxTr').oninput = function () { S.hlX.trips = +this.value; upd(); }; $('hxCr').oninput = function () { S.hlX.contrib = +this.value; upd(); }; }
  if ($('cRoll')) { var mb = []; for (var k = S.rollN - 1; k >= 0; k--) { var a0 = addMonths(t.slice(0, 8) + '01', -k), a1 = isoOf(new Date(parseIso(a0).getFullYear(), parseIso(a0).getMonth() + 1, 0)), sm = summarise(f, a0, a1), ly = summarise(f, shiftYear(a0, -1), shiftYear(a1, -1)); mb.push({ l: MON[parseIso(a0).getMonth()], rev: sm.income, net: sm.net, ly: ly.income }); }
    chart('cRoll', { data: { labels: mb.map(function (x) { return x.l; }), datasets: [{ type: 'bar', label: 'Revenue', data: mb.map(function (x) { return round2(x.rev); }), backgroundColor: COLORS.navy, borderRadius: 4 }, { type: 'line', label: 'Operating profit', data: mb.map(function (x) { return round2(x.net); }), borderColor: COLORS.gold, backgroundColor: COLORS.gold, tension: 0 }].concat(mb.some(function (x) { return x.ly; }) ? [{ type: 'line', label: 'Revenue last year', data: mb.map(function (x) { return round2(x.ly); }), borderColor: COLORS.grey, borderDash: [5, 4], pointRadius: 0, tension: 0 }] : []) },
      options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: moneyTip() }, scales: { y: { ticks: moneyTicks() }, x: { grid: { display: false } } } } }); }
};

/* ==================== drivers and pay ==================== */
VIEWS.driverpay = function () {
  var f = facts(), ds = drivers(), pays = S.data.driverPay || [];
  var unassigned = f.jobs.filter(function (j) { return !j.driverId || !ds.some(function (d) { return d.id === j.driverId; }); }).reduce(function (a, j) { return a + (Number(j.costs.labour) || 0); }, 0);
  var h = '<p class="small muted" style="margin-top:0">Labour costs come from the jobs each crew member is chosen on and the days logged on building projects; payments are what was actually paid to them. The difference is what is still owed.</p>';
  if (!ds.length) h += '<div class="card empty">No crew added yet. Add them under Business Settings, then choose the crew member on each job.</div>';
  ds.forEach(function (d) {
    var jobs = f.jobs.filter(function (j) { return j.driverId === d.id; }), pl = projLabour(d.id), fees = jobs.reduce(function (a, j) { return a + (Number(j.costs.labour) || 0); }, 0) + pl.amount;
    var mine = pays.filter(function (p) { return p.driverId === d.id; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; }), paid = mine.reduce(function (a, p) { return a + p.amount; }, 0);
    h += '<div class="card"><div class="card-head"><h2 style="margin:0">' + esc(d.name) + '</h2><span class="kicker">' + jobs.length + (jobs.length === 1 ? ' job' : ' jobs') + (pl.days ? ' · ' + pl.days + (pl.days === 1 ? ' day' : ' days') + ' on projects' : '') + '</span></div>' +
      '<table><tbody><tr><td>Labour earned</td><td class="n">' + ec2(fees) + '</td></tr><tr><td>Paid to ' + esc(d.name.split(' ')[0]) + '</td><td class="n">' + ec2(paid) + '</td></tr>' +
      '<tr class="total"><td>' + (fees - paid >= 0 ? 'Still owed' : 'Paid in advance') + '</td><td class="n">' + ec2(Math.abs(fees - paid)) + '</td></tr></tbody></table>' +
      (mine.length ? '<ul class="list" style="margin-top:6px">' + mine.slice(0, 12).map(function (p) { return '<li><button class="row-btn" data-dp="' + p.id + '"><span class="t">' + nice(p.date) + '</span><span class="a">' + ec2(p.amount) + '</span><span class="m">' + esc(p.method) + (p.paidBy ? ' · paid by ' + esc(p.paidBy) : '') + (p.note ? ' · ' + esc(p.note) : '') + '</span><span></span></button></li>'; }).join('') + '</ul>' : '') +
      (isViewOnly() ? '' : '<button class="btn gold block" data-dpnew="' + d.id + '">Record payment to ' + esc(d.name.split(' ')[0]) + '</button>') + '</div>';
  });
  if (unassigned) h += '<p class="small muted">' + ec2(unassigned) + ' of labour costs are on jobs with no crew member chosen (including older jobs), so they are not counted against anyone above.</p>';
  $('view').innerHTML = h;
  qa('[data-dpnew]').forEach(function (b) { b.onclick = function () { driverPayEditor({ driverId: b.dataset.dpnew }); }; });
  qa('[data-dp]').forEach(function (b) { b.onclick = function () { driverPayEditor(pays.find(function (p) { return p.id === b.dataset.dp; })); }; });
};
function driverPayEditor(p) {
  var editing = !!p.id;
  openSheet((editing ? 'Payment to ' : 'Pay ') + driverName(p.driverId),
    '<div class="cols"><label class="f"><span>Amount (EC$)</span><input id="dpA" inputmode="decimal" value="' + v(p.amount) + '"></label><label class="f"><span>Date</span><input id="dpD" type="date" value="' + v(p.date || today()) + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Method</span><select id="dpM">' + opts(METHODS, p.method || 'Cash') + '</select></label><label class="f"><span>Paid by</span><select id="dpB">' + payerOpts(p.paidBy) + '</select></label></div>' +
    '<label class="f"><span>Note (optional)</span><input id="dpN" value="' + v(p.note) + '" placeholder="e.g. jobs 12 to 18 Oct"></label>' +
    (editing && S.data.me.role === 'owner' ? '<button class="btn link block" id="dpDel" style="color:var(--danger)">Delete this payment</button>' : ''), 'Save');
  $('sheetGo').onclick = function () { api('saveDriverPay', { pay: { id: p.id, driverId: p.driverId, amount: $('dpA').value, date: $('dpD').value, method: $('dpM').value, paidBy: $('dpB').value, note: $('dpN').value } }, 'Saving…').then(function () { closeSheet(); toast('Crew member payment recorded.'); render(); }).catch(function () {}); };
  if ($('dpDel')) $('dpDel').onclick = function () { if (confirm('Delete this payment?')) api('deleteDriverPay', { id: p.id }, 'Deleting…').then(function () { closeSheet(); render(); }).catch(function () {}); };
}

/* ==================== insights ==================== */
function insightCard(title, headline, body, link, linkLabel, visual) {
  return '<div class="card insight"><div class="kicker">' + title + '</div><p class="ins-head">' + headline + '</p>' + (visual || '') + (body ? '<div class="small muted">' + body + '</div>' : '') +
    (link ? '<button class="btn link" data-igo="' + link + '">' + (linkLabel || 'See the report') + ' ›</button>' : '') + '</div>';
}
/* Small visuals drawn with plain HTML/SVG so the screen stays light and quick. */
function vBars(rows, max) {
  max = max || Math.max.apply(null, rows.map(function (r) { return Math.max(r.value, r.marker || 0); }).concat([1]));
  return '<div class="vbars">' + rows.map(function (r) {
    return '<div class="vb"><span class="vb-l">' + esc(r.label) + '</span><span class="vb-t"><i style="width:' + Math.max(1.5, r.value / max * 100) + '%;background:' + (r.color || 'var(--navy-3)') + '"></i>' +
      (r.marker ? '<b style="left:' + (r.marker / max * 100) + '%" title="Standard"></b>' : '') + '</span><span class="vb-r">' + r.right + '</span></div>'; }).join('') + '</div>';
}
function vDonut(frac, mid, sub) {
  var r = 38, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac));
  return '<svg class="vdonut" viewBox="0 0 100 100" role="img" aria-label="' + Math.round(f * 100) + '%"><circle cx="50" cy="50" r="' + r + '" class="vd-bg"/><circle cx="50" cy="50" r="' + r + '" class="vd-fg" stroke-dasharray="' + (c * f).toFixed(1) + ' ' + c.toFixed(1) + '" transform="rotate(-90 50 50)"/>' +
    '<text x="50" y="50" class="vd-mid">' + mid + '</text>' + (sub ? '<text x="50" y="64" class="vd-sub">' + sub + '</text>' : '') + '</svg>';
}
function vSpark(vals, labels) {
  var pts = vals.map(function (v, i) { return v == null ? null : [i, v]; }).filter(Boolean); if (pts.length < 2) return '';
  var lo = Math.min.apply(null, pts.map(function (p) { return p[1]; })), hi = Math.max.apply(null, pts.map(function (p) { return p[1]; })); if (hi === lo) { hi += 1; lo -= 1; }
  var W = 300, H = 70, X = function (i) { return 8 + i * (W - 16) / (vals.length - 1); }, Y = function (v) { return 10 + (hi - v) / (hi - lo) * (H - 22); };
  return '<svg class="vspark" viewBox="0 0 ' + W + ' ' + (H + 14) + '" preserveAspectRatio="none"><polyline points="' + pts.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '"/>' +
    pts.map(function (p, k) { return '<circle cx="' + X(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="' + (k === pts.length - 1 ? 4.5 : 3) + '"/>'; }).join('') +
    labels.map(function (l, i) { return '<text x="' + X(i).toFixed(1) + '" y="' + (H + 10) + '">' + l + '</text>'; }).join('') + '</svg>';
}
function vCols(vals, labels, hi, lo) {
  var max = Math.max.apply(null, vals.concat([1]));
  return '<div class="vcols">' + vals.map(function (v, i) { return '<div class="vc"><i class="' + (i === hi ? 'hi' : i === lo ? 'lo' : '') + '" style="height:' + Math.max(3, v / max * 80) + '%"></i><span>' + labels[i] + '</span></div>'; }).join('') + '</div>';
}
function vStack(parts) {
  var tot = parts.reduce(function (a, p) { return a + p.value; }, 0) || 1;
  return '<div class="vstack">' + parts.map(function (p) { return p.value ? '<i style="width:' + (p.value / tot * 100) + '%;background:' + p.color + '"></i>' : ''; }).join('') + '</div>' +
    '<div class="vlegend">' + parts.map(function (p) { return '<span><i style="background:' + p.color + '"></i>' + esc(p.label) + ' <b>' + ec(p.value) + '</b></span>'; }).join('') + '</div>';
}
function insightsLegacy() {
  var f = facts(), t = today(), from90 = addDays(t, -89), prev90 = addDays(t, -179), from365 = addDays(t, -364);
  var s90 = summarise(f, from90, t), p90 = summarise(f, prev90, addDays(from90, -1)), s365 = summarise(f, from365, t);
  var h = '<p class="muted small" style="margin-top:0">Worked out from your own records. “Recent” means the last 90 days.</p>';
  // 1. Payback forecast with a progress ring
  var inv = startupTotal(), rec = summarise(f, null, null).net;
  if (inv) { var fc = forecastCard(); var ring = '<div class="ins-row">' + vDonut(rec / inv, pct(Math.max(0, rec / inv)), 'recovered') + '<div class="small">Invested <b>' + ec(inv) + '</b><br>Recovered <b>' + ec(Math.max(0, rec)) + '</b><br>To go <b>' + ec(Math.max(0, inv - rec)) + '</b></div></div>';
    h += fc.replace('<div class="kicker">Payback forecast</div>', '<div class="kicker">Payback forecast</div>' + ring); }
  // 2. Pricing against the standard route prices
  var gaps = {}, lost = 0;
  s90.jobs.forEach(function (j) { var r = rateFor(j.route); if (!r || !r.price) return; var g = gaps[j.route] || (gaps[j.route] = { route: j.route, trips: 0, charged: 0, std: r.price }); var q = j.amount && j.price ? j.amount / j.price : 1; g.trips++; g.charged += j.price || j.amount; if ((j.price || j.amount) < r.price - 0.5) lost += (r.price - (j.price || j.amount)) * q; });
  var gl = Object.keys(gaps).map(function (k) { var g = gaps[k]; g.avg = g.charged / g.trips; return g; }).sort(function (a, b) { return (a.avg - a.std) - (b.avg - b.std); });
  if (gl.length) h += insightCard('Pricing', lost > 0.5 ? 'Jobs priced below the standard area price cost <b>' + ec(lost) + '</b> in the last 90 days.' : 'Every recent job was charged at or above the standard area price.',
    'Bar: average charged. Line: your standard price. Red means charged below it.', 'routes', 'Area performance',
    vBars(gl.map(function (g) { return { label: g.route.replace('SVG → ', ''), value: g.avg, marker: g.std, color: g.avg < g.std - 0.5 ? 'var(--danger)' : 'var(--green)', right: ec(g.avg) + ' · ' + g.trips + (g.trips === 1 ? ' job' : ' jobs') }; })));
  // 3. Customer concentration
  var cs = groupStats(s365.jobs, 'client').sort(function (a, b) { return b.income - a.income; });
  if (cs.length && s365.income) { var top = cs[0], share = top.income / s365.income;
    h += insightCard('Customers', '<b>' + esc(top.name) + '</b> brought in <b>' + pct(share) + '</b> of income over the last 12 months.',
      share > 0.35 ? 'That is a lot to depend on one customer: a delay or price cut from them would hit the business hard. Winning two or three more regular customers spreads the risk.' : 'Income is reasonably spread across customers.', 'custreport', 'Customer performance',
      '<div class="ins-row">' + vDonut(share, pct(share), 'top customer') + '<div class="vlegend col">' + cs.slice(0, 4).map(function (c, i) { return '<span><i style="background:' + (i ? 'var(--rule)' : 'var(--gold)') + '"></i>' + esc(c.name) + ' <b>' + pct(c.income / s365.income) + '</b></span>'; }).join('') + '</div></div>'); }
  // 4. Getting paid, with an ageing bar
  var avgPay = daysToPay(null), owed = liveInvoices().filter(function (i) { return invBalance(i) > 0.009; });
  var age = { a: 0, b: 0, c: 0, d: 0 }; owed.forEach(function (i) { var od = daysBetween(i.dueDate, t), v = invBalance(i); if (od <= 0) age.a += v; else if (od <= 30) age.b += v; else if (od <= 60) age.c += v; else age.d += v; });
  var owedAmt = age.a + age.b + age.c + age.d;
  var slow = S.data.clients.map(function (c) { return { c: c, d: daysToPay(c.id) }; }).filter(function (x) { return x.d != null; }).sort(function (a, b) { return b.d - a.d; })[0];
  h += insightCard('Getting paid', avgPay != null ? 'Customers take <b>' + Math.round(avgPay) + ' days</b> on average to pay.' : (owedAmt ? '<b>' + ec(owedAmt) + '</b> is owed to you right now.' : 'Nothing is owed right now.'),
    (avgPay != null && owedAmt ? ec(owedAmt) + ' is owed now. ' : '') + (avgPay == null ? 'Average days to pay will show once payments are recorded in the app. ' : '') + (slow ? 'Slowest payer: ' + esc(slow.c.name) + ', ' + Math.round(slow.d) + ' days.' : ''), 'invoices', 'Who owes what',
    owedAmt ? vStack([{ label: 'Not yet due', value: age.a, color: 'var(--ocean)' }, { label: '1–30 days late', value: age.b, color: 'var(--gold)' }, { label: '31–60', value: age.c, color: '#e07a2b' }, { label: '60+', value: age.d, color: 'var(--danger)' }]) : '');
  // 5. Routes
  var rs = groupStats(s90.jobs, 'route').filter(function (g) { return g.name !== 'Not set' && g.trips >= 2; }).sort(function (a, b) { return b.net / b.trips - a.net / a.trips; });
  if (rs.length >= 2) { var best = rs[0], worst = rs[rs.length - 1];
    h += insightCard('Areas', 'Best recent area: <b>' + esc(best.name) + '</b>, ' + ec(best.net / best.trips) + ' net a job.', 'Weakest: ' + esc(worst.name) + ', ' + ec(worst.net / worst.trips) + ' net a job over ' + worst.trips + ' jobs.', 'routes', 'Area performance',
      vBars(rs.slice(0, 6).map(function (g, i) { return { label: g.name.replace('SVG → ', 'to ').replace(' → SVG', ' back'), value: Math.max(0, g.net / g.trips), color: i === 0 ? 'var(--gold)' : 'var(--navy-3)', right: ec(g.net / g.trips) }; }))); }
  // 6. Trucks
  var ts = truckStats({ from: from90, to: t }, s90);
  h += insightCard('Trucks', ts.map(function (x) { return '<b>' + esc(x.t) + '</b>: ' + x.trips + ' jobs, ' + ec(x.net) + ' net'; }).join('<br>'),
    'Days in the last 90: working, off the road for repairs, or no recorded work (status unknown).', 'trucks', 'Trucks',
    ts.map(function (x) { return '<div class="vt"><span>' + esc(x.short) + '</span>' + '<div class="vstack thin">' + [['work', x.work, 'var(--green)'], ['off', x.off, 'var(--danger)'], ['unknown', x.idle, 'var(--rule)']].map(function (p) { return p[1] ? '<i style="width:' + (p[1] / x.span * 100) + '%;background:' + p[2] + '"></i>' : ''; }).join('') + '</div><b>' + x.work + ' days</b></div>'; }).join('') +
    '<div class="vlegend"><span><i style="background:var(--green)"></i>Working</span><span><i style="background:var(--danger)"></i>Off the road</span><span><i style="background:var(--rule)"></i>No recorded work</span></div>');
  // 7. Costs and margin trend (last 6 months)
  var mL = [], mV = []; for (var k = 5; k >= 0; k--) { var m0 = addMonths(t.slice(0, 8) + '01', -k), m1 = addDays(addMonths(m0, 1), -1), sm = summarise(f, m0, m1); mL.push(MONTH[+m0.slice(5, 7) - 1].slice(0, 3)); mV.push(sm.income ? Math.round(sm.margin * 100) : null); }
  var fuelNow = s90.trips ? s90.jobs.reduce(function (a, j) { return a + (j.costs.fuel || 0); }, 0) / s90.trips : 0, fuelPrev = p90.trips ? p90.jobs.reduce(function (a, j) { return a + (j.costs.fuel || 0); }, 0) / p90.trips : 0;
  h += insightCard('Costs', 'Profit margin ' + (isNaN(s90.margin) ? 'not yet measurable' : '<b>' + pct(s90.margin) + '</b>') + (isNaN(p90.margin) ? '' : ' recently, against ' + pct(p90.margin) + ' in the 90 days before.'),
    'Margin each month, in %. ' + (fuelNow || fuelPrev ? 'Fuel per job: ' + ec(fuelNow) + (fuelPrev ? ' (previously ' + ec(fuelPrev) + ')' : '') + '. ' : '') + 'Running costs: ' + ec(s90.overheads / 3) + ' a month on average.', 'monthly', 'Monthly performance', vSpark(mV, mL));
  // 8. Seasons: the last 12 months
  var sL = [], sV = []; for (var q = 11; q >= 0; q--) { var a0 = addMonths(t.slice(0, 8) + '01', -q), a1 = addDays(addMonths(a0, 1), -1); sL.push(MONTH[+a0.slice(5, 7) - 1].charAt(0)); sV.push(summarise(f, a0, a1).income); }
  var withData = sV.map(function (v, i) { return [v, i]; }).filter(function (p) { return p[0] > 0; });
  if (withData.length >= 3) { var hiI = withData.slice().sort(function (a, b) { return b[0] - a[0]; })[0][1], loI = withData.slice().sort(function (a, b) { return a[0] - b[0]; })[0][1];
    var monthOf = function (i) { return monthName(addMonths(t.slice(0, 8) + '01', i - 11)); };
    h += insightCard('Seasons', 'Best month in the last year: <b>' + monthOf(hiI) + '</b>, ' + ec(sV[hiI]) + ' income.', 'Quietest: ' + monthOf(loI) + ', ' + ec(sV[loI]) + '. Plan maintenance and time off for the quiet months.', 'monthly', 'Monthly performance', vCols(sV, sL, hiI, loI)); }
  $('view').innerHTML = h;
  qa('[data-igo]').forEach(function (b) { b.onclick = function () { go(b.dataset.igo); }; });
}

/* ==================== notifications ==================== */
function b64ToUint8(b64) { var p = '='.repeat((4 - b64.length % 4) % 4), raw = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(raw, function (c) { return c.charCodeAt(0); }); }
VIEWS.notify = function () {
  var supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  var standalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  var h = '<div class="card"><h2>Alerts on this phone</h2><p class="muted">Short notifications each morning at 8am St Vincent time, only when there is something to tell you:</p><ul class="small">' +
    (isDriver() ? '' : '<li>an invoice becomes overdue</li>') + '<li>truck admin due in 7 days, tomorrow or today</li><li>jobs booked for tomorrow</li>' + (isDriver() ? '' : '<li>every Monday, a summary of last week</li>') + '</ul>';
  if (window.PREVIEW) h += '<div class="alert">Notifications cannot be switched on in this preview. On the installed app this screen turns them on with one tap.</div>';
  else if (!supported) h += '<div class="alert">' + (/iPhone|iPad/.test(navigator.userAgent) && !standalone ? 'On iPhone, notifications only work in the installed app. Add NV Ops to your Home Screen from Safari, open it from the icon, then come back here.' : 'This browser does not support notifications.') + '</div>';
  h += '<div id="pushState" class="muted">Checking…</div></div>';
  var np = Object.assign({ collections: true, bookings: true, maintenance: true, reports: true, security: true, summary: true, summaryFreq: 'weekly' }, S.data.me.notify || {});
  var cats = (isDriver() ? [] : [['collections', 'Invoice collection', 'When an invoice becomes overdue']]).concat([['bookings', 'Bookings', 'Jobs booked for tomorrow'], ['maintenance', 'Maintenance & compliance', 'Truck admin and services coming due']]).concat(isDriver() ? [] : [['summary', 'Business summaries', 'Jobs, revenue and costs'], ['reports', 'Reports', 'When quarterly and annual reports are ready (by email)']]).concat([['security', 'Security notices', 'New sign-ins on your account (shown in Account & Security)']]);
  h += '<div class="card"><h2>Your Notification Choices</h2><p class="small muted" style="margin-top:0">Saved for ' + esc(S.data.me.name) + ' on every device. Alerts arrive as phone notifications; reports and backup alerts arrive by email. No other channels are used.</p>' +
    cats.map(function (c) { return '<label class="switch-row"><span><b>' + c[1] + '</b><br><span class="small muted">' + c[2] + '</span></span><input type="checkbox" class="switch" data-np="' + c[0] + '"' + (np[c[0]] !== false ? ' checked' : '') + '></label>'; }).join('') +
    (isDriver() ? '' : '<label class="f" style="margin-top:8px"><span>Business summary frequency</span><select id="npF">' + [['weekly', 'Weekly (Monday)'], ['monthly', 'Monthly (1st)'], ['both', 'Weekly and monthly']].map(function (o) { return '<option value="' + o[0] + '"' + ((np.summaryFreq || 'weekly') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></label>') +
    '<p class="small muted">Reminder lead times for truck admin are set under Maintenance & Compliance.</p><button class="btn gold block" id="npSave">Save my choices</button></div>';
  $('view').innerHTML = h;
  $('npSave').onclick = function () { var o = {}; qa('[data-np]').forEach(function (c) { o[c.dataset.np] = c.checked; }); o.summaryFreq = $('npF') ? $('npF').value : 'weekly';
    api('saveNotify', { notify: o }, 'Saving…').then(function () { toast('Notification choices saved.'); }).catch(function () {}); };
  if (window.PREVIEW || !supported) { $('pushState').textContent = ''; return; }
  navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription().then(function (sub) { drawPush(reg, sub); }); }).catch(function () { $('pushState').textContent = 'Notifications are not available on this device.'; });
};
function drawPush(reg, sub) {
  var el = $('pushState'); if (!el) return;
  if (!sub) {
    el.innerHTML = (Notification.permission === 'denied' ? '<div class="alert err">Notifications are blocked for NV Ops in this phone\'s settings. Allow them there, then return here.</div>' : '') +
      '<button class="btn gold block" id="pushOn">Turn on notifications</button>';
    if ($('pushOn')) $('pushOn').onclick = function () {
      Notification.requestPermission().then(function (perm) {
        if (perm !== 'granted') { toast('Notifications were not allowed.', true); return VIEWS.notify(); }
        return api('pushKey', {}).then(function (res) {
          return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(res.key) });
        }).then(function (s2) {
          return api('savePushSub', { sub: s2.toJSON() }, 'Switching on…').then(function () { toast('Notifications are on.'); drawPush(reg, s2); });
        });
      }).catch(function (e) { toast((e && e.message) || 'Could not switch on notifications.', true); });
    };
    return;
  }
  el.innerHTML = '<p class="pos"><b>On for this device.</b></p>' +
    [['overdue', 'Overdue invoices'], ['reminders', 'Truck admin due'], ['bookings', 'Tomorrow\'s bookings'], ['weekly', 'Monday summary']]
      .filter(function (o) { return !isDriver() || ['reminders', 'bookings'].indexOf(o[0]) >= 0; })
      .map(function (o) { return '<label class="check"><input type="checkbox" data-pref="' + o[0] + '" checked> ' + o[1] + '</label>'; }).join('') +
    '<button class="btn quiet block" id="pushTest">Send a test notification</button><div style="height:10px"></div><button class="btn danger block" id="pushOff">Turn off on this device</button>';
  qa('[data-pref]').forEach(function (cb) { cb.onchange = function () { var p = {}; p[cb.dataset.pref] = cb.checked; api('updatePushPrefs', { endpoint: sub.endpoint, prefs: p }).catch(function () {}); }; });
  $('pushTest').onclick = function () { api('testPush', {}, 'Sending…').then(function (r) { toast(r.sent ? 'Test sent. It should appear in a few seconds.' : 'Nothing was sent. Try turning notifications off and on again.', !r.sent); }).catch(function () {}); };
  $('pushOff').onclick = function () { api('removePushSub', { endpoint: sub.endpoint }, 'Switching off…').then(function () { return sub.unsubscribe(); }).then(function () { toast('Notifications are off.'); drawPush(reg, null); }).catch(function () {}); };
}

/* ==================== Face ID / fingerprint sign-in (passkeys) ==================== */
function b64uToBuf(x) { x = String(x).replace(/-/g, '+').replace(/_/g, '/'); while (x.length % 4) x += '='; var b = atob(x), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a.buffer; }
function bufToB64u(buf) { var a = new Uint8Array(buf), t = ''; for (var i = 0; i < a.length; i++) t += String.fromCharCode(a[i]); return btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function passkeysSupported() { return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create) && !window.PREVIEW; }
function deviceName() { var u = navigator.userAgent; return /iPhone/.test(u) ? 'iPhone' : /iPad/.test(u) ? 'iPad' : /Android/.test(u) ? 'Android phone' : /Macintosh/.test(u) ? 'Mac' : /Windows/.test(u) ? 'Windows computer' : 'This device'; }
function passkeyRegister() {
  return api('passkeyRegStart', {}, 'Preparing…').then(function (res) {
    var o = res.options;
    var pk = Object.assign({}, o, { challenge: b64uToBuf(o.challenge), user: Object.assign({}, o.user, { id: b64uToBuf(o.user.id) }),
      excludeCredentials: (o.excludeCredentials || []).map(function (c) { return Object.assign({}, c, { id: b64uToBuf(c.id) }); }) });
    return navigator.credentials.create({ publicKey: pk }).then(function (c) {
      var resp = { id: c.id, rawId: bufToB64u(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment || undefined,
        response: { clientDataJSON: bufToB64u(c.response.clientDataJSON), attestationObject: bufToB64u(c.response.attestationObject), transports: c.response.getTransports ? c.response.getTransports() : [] },
        clientExtensionResults: c.getClientExtensionResults ? c.getClientExtensionResults() : {} };
      return api('passkeyRegFinish', { note: res.note, response: resp, name: deviceName() }, 'Saving…');
    });
  });
}
function passkeySignIn() {
  return rawApi('passkeyLoginStart', {}).then(function (res) {
    if (!res.ok) throw new Error(res.error || 'Face ID sign-in is not available.');
    var o = res.options;
    var pk = Object.assign({}, o, { challenge: b64uToBuf(o.challenge), allowCredentials: (o.allowCredentials || []).map(function (c) { return Object.assign({}, c, { id: b64uToBuf(c.id) }); }) });
    return navigator.credentials.get({ publicKey: pk }).then(function (c) {
      var resp = { id: c.id, rawId: bufToB64u(c.rawId), type: c.type, authenticatorAttachment: c.authenticatorAttachment || undefined,
        response: { clientDataJSON: bufToB64u(c.response.clientDataJSON), authenticatorData: bufToB64u(c.response.authenticatorData), signature: bufToB64u(c.response.signature),
          userHandle: c.response.userHandle ? bufToB64u(c.response.userHandle) : undefined },
        clientExtensionResults: c.getClientExtensionResults ? c.getClientExtensionResults() : {} };
      return api('passkeyLoginFinish', { note: res.note, response: resp }, 'Signing in…');
    });
  });
}
function faceIdHint() {
  if (!passkeysSupported() || !S.data || S.data.me.passkeys || lsGet('nv_pk_hint', 0)) return '';
  return '<div class="alert hint"><div style="display:flex;gap:12px;align-items:center">' + icon('faceid', 'gi-hint') + '<div style="flex:1"><b>Sign in with Face ID or fingerprint</b><br><span class="small">Faster than a password, and it works only on your own device.</span></div></div>' +
    '<div style="display:flex;gap:10px;margin-top:10px"><button class="btn gold" id="pkHintGo">Set up now</button><button class="btn quiet" id="pkHintNo">Not now</button></div></div>';
}
function bindFaceIdHint() {
  if ($('pkHintNo')) $('pkHintNo').onclick = function () { lsSet('nv_pk_hint', 1); render(); };
  if ($('pkHintGo')) $('pkHintGo').onclick = function () { passkeyRegister().then(function () { toast('Face ID sign-in is set up on this device.'); render(); }).catch(pkError); };
}
function pkError(e) { if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) return; if (e && e.name === 'InvalidStateError') return toast('This device is already set up.', true); if (e && e.message && !/^(Failed|Load)/.test(e.message)) toast(e.message, true); }
VIEWS.passkeys = function () {
  var h = '<div class="card"><h2>Face ID or fingerprint</h2><p class="muted">Sign in with your face or fingerprint instead of typing your password. Nothing about your face or fingerprint leaves the device; the phone simply confirms it is you.</p>';
  if (window.PREVIEW) h += '<div class="alert">Face ID sign-in cannot be set up in this preview. On the installed app this screen sets it up in one tap.</div>';
  else if (!passkeysSupported()) h += '<div class="alert">This browser cannot use Face ID or fingerprint sign-in. On iPhone, use Safari or the installed app.</div>';
  else h += '<button class="btn gold block" id="pkAdd">Set up on this ' + esc(deviceName()) + '</button>';
  h += '</div><div class="card"><h2>Devices set up</h2><div id="pkList" class="muted">Loading…</div><p class="small muted" style="margin-top:10px">Your password still works. Remove a device here if it is lost or sold.</p></div>';
  $('view').innerHTML = h;
  if ($('pkAdd')) $('pkAdd').onclick = function () { passkeyRegister().then(function () { toast('Face ID sign-in is set up on this device.'); render(); }).catch(pkError); };
  if (window.PREVIEW) { $('pkList').textContent = 'None yet.'; return; }
  api('passkeyList', {}).then(function (res) { drawPk(res.passkeys); }).catch(function () {});
  function drawPk(list) {
    $('pkList').innerHTML = list.length ? '<ul class="list">' + list.map(function (k) { return '<li><div class="row-btn" style="cursor:default"><span class="t">' + esc(k.name) + '</span><span class="a"><button class="btn link" data-pkrm="' + esc(k.id) + '" style="color:var(--danger)">Remove</button></span><span class="m">Added ' + nice(k.at.slice(0, 10)) + (k.lastUsed ? ' · last used ' + nice(k.lastUsed.slice(0, 10)) : '') + '</span><span></span></div></li>'; }).join('') + '</ul>' : 'None yet.';
    qa('[data-pkrm]').forEach(function (b) { b.onclick = function () { if (confirm('Remove Face ID sign-in for this device?')) api('passkeyRemove', { id: b.dataset.pkrm }, 'Removing…').then(function (r) { drawPk(r.passkeys); toast('Removed.'); }).catch(function () {}); }; });
  }
};

/* ==================== locked months ==================== */
function closedList() { return (S.data && S.data.settings && S.data.settings.closedMonths) || []; }
function isLocked(d) { return !!(d && closedList().indexOf(String(d).slice(0, 7)) >= 0); }
function ymName(ym) { return MONTH[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4); }

/* ==================== cash flow ==================== */
S.cfDays = 30;
/* ==================== Cash Flow Forecast (D3, D4) ==================== */
var FC_DEFAULTS = { openingBalance: null, openingDate: '', confirmedBy: '', baseDelay: 0, cautiousDelay: 14, optimisticRecovery: 50, partnerTransfers: true, runningCosts: true };
function fcSettings() { return Object.assign({}, FC_DEFAULTS, (S.data.settings && S.data.settings.forecast) || {}); }
/** How late a customer usually pays, from payments recorded in the app (needs 3 or more). */
function clientLateness(clientId) {
  var ds = [];
  liveInvoices().forEach(function (i) {
    if (i.clientId !== clientId || invBalance(i) > 0.009 || !i.payments.length || !i.dueDate) return;
    if (i.payments.some(function (p) { return /Imported as paid/.test(p.note || ''); })) return;
    ds.push(daysBetween(i.dueDate, i.payments.map(function (p) { return p.date; }).sort().pop()));
  });
  return ds.length >= 3 ? { days: Math.max(0, Math.round(ds.reduce(function (a, b) { return a + b; }, 0) / ds.length)), n: ds.length } : null;
}
/**
 * Scenario forecast. Receipts are never assumed before they are due:
 *   Base: on the due date, plus the customer's observed lateness (3+ recorded payments) or the base delay.
 *   Cautious: base timing plus the cautious delay; nothing overdue is assumed to arrive.
 *   Optimistic: on the due date, and a share of the overdue balance arrives in the first week.
 * When a receipt arrives, the other partner's share of that invoice's job profit is transferred out (agreed workflow).
 */
function cashflowData(days, scen) {
  scen = scen || 'base';
  var t = today(), end = addDays(t, days - 1), set = S.data.settings, fc = fcSettings(), holderName = holder();
  var others = partners().filter(function (p) { return p.name !== holderName; }), otherPct = others.reduce(function (a, p) { return a + Number(p.share || 0); }, 0);
  var weeks = []; for (var d = t; d <= end; d = addDays(d, 7)) weeks.push({ from: d, to: addDays(d, 6) > end ? end : addDays(d, 6), inv: 0, book: 0, jobCost: 0, admin: 0, running: 0, partner: 0 });
  var wk = function (d) { return weeks.find(function (w) { return d >= w.from && d <= w.to; }); };
  var overdue = [], ins = [], outs = [];
  var delayFor = function (clientId) { var o = clientLateness(clientId), base = o ? o.days : Number(fc.baseDelay) || 0; return { d: scen === 'optimistic' ? 0 : base + (scen === 'cautious' ? Number(fc.cautiousDelay) || 0 : 0), observed: o }; };
  var addIn = function (date, label, amount, kind, profit, note) {
    var w = wk(date < t ? t : date); if (!w || !amount) return;
    if (kind === 'Booked job') w.book += amount; else w.inv += amount;
    ins.push({ date: date < t ? t : date, label: label, amount: amount, kind: kind, note: note || '' });
    if (fc.partnerTransfers && otherPct && profit > 0) { var tr = round2(profit * otherPct / 100); w.partner += tr; outs.push({ date: date < t ? t : date, label: 'Transfer to ' + others.map(function (p) { return p.name; }).join(', ') + ' (' + label + ')', amount: tr, kind: 'Partner share' }); }
  };
  liveInvoices().forEach(function (i) {
    var b = invBalance(i); if (b <= 0.009) return;
    var share = invTotal(i) ? b / invTotal(i) : 1, profit = Calc.invJobProfit(i) * share;
    if (i.dueDate < t) {
      overdue.push({ i: i, amount: b });
      if (scen === 'optimistic' && fc.optimisticRecovery > 0) addIn(t, clientOf(i).name + ', ' + invNo(i) + ' (' + fc.optimisticRecovery + '% of overdue)', round2(b * fc.optimisticRecovery / 100), 'Overdue recovery', profit * fc.optimisticRecovery / 100);
      return;
    }
    var dl = delayFor(i.clientId);
    addIn(addDays(i.dueDate, dl.d), clientOf(i).name + ', ' + invNo(i), b, 'Invoice due', profit, dl.observed ? 'usually pays ' + dl.observed.days + ' days late (' + dl.observed.n + ' payments)' : dl.d ? dl.d + '-day assumed delay' : 'on due date');
  });
  (S.data.bookings || []).forEach(function (bk) {
    if (bk.status !== 'Booked' && bk.status !== 'Done' && bk.status !== 'Tentative') return;
    if (bk.status === 'Tentative' && scen !== 'optimistic') return;
    var val = (bk.price || 0) * (bk.qty || 1), cost = lineCosts(bk), jd = bk.date < t ? t : bk.date;
    var cl = (S.data.clients || []).find(function (c) { return c.name === bk.client; }), dl = delayFor(cl ? cl.id : null);
    addIn(addDays(jd, (set.paymentDays || 14) + dl.d), (bk.client || 'Customer') + ' (job ' + niceShort(bk.date) + ')', val, 'Booked job', val - cost);
    var wc = wk(jd); if (wc && cost) { wc.jobCost += cost; outs.push({ date: jd, label: 'Job costs: ' + (bk.client || '') + ' ' + niceShort(bk.date), amount: cost, kind: 'Job costs' }); }
  });
  (S.data.reminders || []).forEach(function (r) {
    if (!r.due) return; var cost = r.expectedCost || (r.history && r.history[0] && r.history[0].cost) || 0, w = wk(r.due < t ? t : r.due);
    if (w && cost) { w.admin += cost; outs.push({ date: r.due < t ? t : r.due, label: r.type + ' (' + r.truck + ')', amount: cost, kind: 'Truck admin' }); }
  });
  var from90 = addDays(t, -90), runAvg = fc.runningCosts ? S.data.expenses.filter(function (e) { return !e.void && e.date >= from90 && e.date < t; }).reduce(function (a, e) { return a + e.amount; }, 0) / (90 / 7) : 0;
  var bal = fc.openingBalance != null && fc.openingBalance !== '' ? Number(fc.openingBalance) : null;
  weeks.forEach(function (w) { w.running = runAvg * ((daysBetween(w.from, w.to) + 1) / 7); w.in = w.inv + w.book; w.out = w.jobCost + w.admin + w.running + w.partner; w.net = w.in - w.out; if (bal != null) { bal += w.net; w.balance = bal; } });
  var tin = weeks.reduce(function (a, w) { return a + w.in; }, 0), tout = weeks.reduce(function (a, w) { return a + w.out; }, 0);
  return { weeks: weeks, overdue: overdue, ins: ins.sort(function (a, b) { return a.date < b.date ? -1 : 1; }), outs: outs.sort(function (a, b) { return a.date < b.date ? -1 : 1; }), runAvg: runAvg, tin: tin, tout: tout, opening: bal != null ? Number(fc.openingBalance) : null, closing: bal, fc: fc };
}
S.cfDays = 30; S.cfScen = 'base'; S.cfOpen = '';
VIEWS.cashflow = function () {
  var cf = cashflowData(S.cfDays, S.cfScen), fc = cf.fc, od = cf.overdue.reduce(function (a, o) { return a + o.amount; }, 0), net = cf.tin - cf.tout;
  var scenTxt = { cautious: 'Receipts arrive ' + fc.cautiousDelay + ' days after their expected date; nothing overdue is assumed to arrive; tentative jobs excluded.', base: 'Receipts arrive on their due dates' + (fc.baseDelay ? ' plus ' + fc.baseDelay + ' days' : '') + ', or later for customers whose recorded payments show they usually pay late. Overdue invoices excluded.', optimistic: 'Receipts arrive on their due dates, tentative jobs go ahead, and ' + fc.optimisticRecovery + '% of the ' + ec(od) + ' overdue balance is recovered in the first week.' }[S.cfScen];
  var h = '<div class="card"><div class="fo-head"><h2 style="margin:0">Cash Flow Forecast</h2>' + icon('calendar', 'gi-head') + '</div>' +
    '<div class="seg" style="margin:10px 0 8px">' + [30, 60, 90].map(function (d) { return '<button data-cfd="' + d + '" aria-pressed="' + (S.cfDays === d) + '">' + d + ' days</button>'; }).join('') + '</div>' +
    '<div class="seg mini" style="margin-bottom:12px">' + [['cautious', 'Cautious'], ['base', 'Base'], ['optimistic', 'Optimistic']].map(function (o) { return '<button data-scen="' + o[0] + '" aria-pressed="' + (S.cfScen === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
    '<div class="cf-net"><span class="small muted">Projected net cash movement</span><b class="' + (net < 0 ? 'neg' : 'pos') + '">' + (net >= 0 ? '+' : '−') + ec(Math.abs(net)) + '</b><span class="small muted">' + (S.cfScen === 'optimistic' ? 'Includes ' + fc.optimisticRecovery + '% of overdue receivables' : 'Excludes ' + ec(od) + ' overdue receivables') + '</span></div>' +
    '<div class="cols cf-io"><div class="cf-box"><span class="small muted">Expected in</span><b class="pos">' + ec(cf.tin) + '</b></div><div class="cf-box"><span class="small muted">Expected out</span><b class="neg">' + ec(cf.tout) + '</b></div></div>' +
    (cf.opening != null ? '<div class="cols cf-io"><div class="cf-box"><span class="small muted">Opening balance (' + nice(fc.openingDate) + ')</span><b>' + ec(cf.opening) + '</b></div><div class="cf-box"><span class="small muted">Closing balance, day ' + S.cfDays + '</span><b class="' + (cf.closing < 0 ? 'neg' : '') + '">' + ec(cf.closing) + '</b></div></div>' : '') +
    '<p class="small muted" style="margin:8px 0 0"><b>' + { cautious: 'Cautious', base: 'Base', optimistic: 'Optimistic' }[S.cfScen] + ' assumptions:</b> ' + scenTxt + (fc.partnerTransfers && partners().length > 1 ? ' When money arrives, the partner share of that job\'s profit is transferred out, as agreed.' : '') + ' Dates are estimates, not promises.</p>' +
    (cf.overdue.length ? '<div class="cf-alert"><div><b>Collection alerts</b><br><span class="small muted">Outstanding invoices past due: follow-up required</span></div><div style="text-align:right"><span class="pill Overdue">' + cf.overdue.length + ' overdue</span><br><b class="neg">' + ec(od) + '</b></div></div>' : '') + '</div>';
  // companion charts (D3)
  h += swipe('cfSwipe', [['Money in and out by week', '<div class="chart-box"><canvas id="cCash"></canvas></div>'],
    ['Projected cash balance', cf.opening != null ? '<div class="chart-box"><canvas id="cBal"></canvas></div><p class="small muted">Starts from the opening balance confirmed on ' + nice(fc.openingDate) + (fc.confirmedBy ? ' by ' + esc(fc.confirmedBy) : '') + '.</p>' : '<div class="empty" style="padding:24px 10px">Confirm today\'s bank and cash balance under Forecast settings to see the projected balance. It is never worked out from profit.</div>']]);
  // explore (expandable)
  var sec = function (id, ic, title, sub, body) { return '<details class="cf-x" id="' + id + '"' + (S.cfOpen === id ? ' open' : '') + '><summary>' + icon(ic, 'gi-x') + '<span><b>' + title + '</b><br><span class="small muted">' + sub + '</span></span></summary><div class="cf-body">' + body + '</div></details>'; };
  var lst = function (rows, sign) { return rows.length ? '<ul class="list">' + rows.map(function (r) { return '<li><div class="row-btn" style="cursor:default"><span class="t">' + esc(r.label) + '</span><span class="a ' + (sign > 0 ? 'pos' : 'neg') + '">' + ec(r.amount) + '</span><span class="m">' + niceShort(r.date) + ' · ' + esc(r.kind) + (r.note ? ' · ' + esc(r.note) : '') + '</span><span></span></div></li>'; }).join('') + '</ul>' : '<p class="muted">None in this window.</p>'; };
  var wkTable = '<div class="scroll-x"><table><thead><tr><th>Week of</th><th class="n">In</th><th class="n">Out</th><th class="n">Net</th>' + (cf.opening != null ? '<th class="n">Balance</th>' : '') + '</tr></thead><tbody>' +
    cf.weeks.map(function (w) { return '<tr><td>' + niceShort(w.from) + '</td><td class="n">' + ec(w.in) + '</td><td class="n">' + ec(w.out) + '</td><td class="n ' + (w.net < 0 ? 'neg' : 'pos') + '">' + ec(w.net) + '</td>' + (cf.opening != null ? '<td class="n">' + ec(w.balance) + '</td>' : '') + '</tr>'; }).join('') + '</tbody></table></div>';
  var canEdit = !isViewOnly();
  h += '<div class="card"><h2>Explore the Forecast</h2>' +
    sec('cfW', 'chart', 'Weekly forecast', 'Cash position and trends', wkTable) +
    sec('cfR', 'arrin', 'Expected receipts', 'Invoices and collections', lst(cf.ins, 1) + (cf.overdue.length ? '<h3 class="rep-h">Overdue, chase these</h3><ul class="list">' + cf.overdue.sort(function (a, b) { return b.amount - a.amount; }).map(function (o) { return '<li><button class="row-btn" data-inv="' + o.i.id + '"><span class="t">' + esc(clientOf(o.i).name) + '</span><span class="a neg">' + ec(o.amount) + '</span><span class="m">' + invNo(o.i) + ' · ' + daysBetween(o.i.dueDate, today()) + ' days past due</span><span></span></button></li>'; }).join('') + '</ul>' : '')) +
    sec('cfP', 'arrout', 'Expected payments', 'Costs and commitments', lst(cf.outs, -1) + (cf.runAvg ? '<p class="small muted">Plus typical running costs of ' + ec(cf.runAvg) + ' a week (the average of the last 90 days), included in the weekly totals.</p>' : '')) +
    sec('cfS', 'sliders', 'Forecast settings', 'Assumptions and scenarios',
      '<label class="f"><span>Bank and cash balance today (EC$), confirmed from the bank</span><input id="fcOB" inputmode="decimal" value="' + (fc.openingBalance != null ? esc(fc.openingBalance) : '') + '" placeholder="Not confirmed"' + (canEdit ? '' : ' disabled') + '></label>' +
      '<div class="cols"><label class="f"><span>Base delay (days)</span><input id="fcBD" inputmode="numeric" value="' + esc(fc.baseDelay) + '"' + (canEdit ? '' : ' disabled') + '></label><label class="f"><span>Cautious extra delay (days)</span><input id="fcCD" inputmode="numeric" value="' + esc(fc.cautiousDelay) + '"' + (canEdit ? '' : ' disabled') + '></label></div>' +
      '<label class="f"><span>Optimistic: share of overdue recovered (%)</span><input id="fcOR" inputmode="numeric" value="' + esc(fc.optimisticRecovery) + '"' + (canEdit ? '' : ' disabled') + '></label>' +
      '<label class="switch-row"' + (partners().length > 1 ? '' : ' hidden') + '><span><b>Partner share transfers</b><br><span class="small muted">Model the transfer of the other partner\'s share when each payment arrives.</span></span><input type="checkbox" class="switch" id="fcPT"' + (fc.partnerTransfers ? ' checked' : '') + (canEdit ? '' : ' disabled') + '></label>' +
      '<label class="switch-row"><span><b>Typical running costs</b><br><span class="small muted">Include the 90-day average of running expenses.</span></span><input type="checkbox" class="switch" id="fcRC"' + (fc.runningCosts ? ' checked' : '') + (canEdit ? '' : ' disabled') + '></label>' +
      (canEdit ? '<button class="btn gold block" id="fcSave">Save forecast settings</button>' : '') + '<p class="small muted">Customer-specific timing is used automatically once a customer has 3 or more payments recorded in the app.</p>') + '</div>';
  $('view').innerHTML = h; bindInvRows(); bindSwipe('cfSwipe');
  qa('details.cf-x').forEach(function (d) { d.addEventListener('toggle', function () { if (d.open) { S.cfOpen = d.id; qa('details.cf-x').forEach(function (o) { if (o !== d) o.open = false; }); } }); });
  qa('[data-cfd]').forEach(function (b) { b.onclick = function () { S.cfDays = +b.dataset.cfd; render(); }; });
  qa('[data-scen]').forEach(function (b) { b.onclick = function () { S.cfScen = b.dataset.scen; render(); }; });
  if ($('fcSave')) $('fcSave').onclick = function () {
    var ob = $('fcOB').value.trim();
    api('saveForecast', { forecast: { openingBalance: ob === '' ? null : ob, baseDelay: $('fcBD').value, cautiousDelay: $('fcCD').value, optimisticRecovery: $('fcOR').value, partnerTransfers: $('fcPT').checked, runningCosts: $('fcRC').checked } }, 'Saving…')
      .then(function () { S.cfOpen = ''; toast('Forecast settings saved.'); render(); }).catch(function () {});
  };
  chart('cCash', { type: 'bar', data: { labels: cf.weeks.map(function (w) { return niceShort(w.from); }), datasets: [
    { label: 'In', data: cf.weeks.map(function (w) { return round2(w.in); }), backgroundColor: COLORS.green, borderRadius: 4 },
    { label: 'Out', data: cf.weeks.map(function (w) { return round2(w.out); }), backgroundColor: COLORS.grey, borderRadius: 4 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: moneyTip() }, scales: { y: { ticks: moneyTicks(), title: { display: true, text: 'EC$' } }, x: { grid: { display: false }, title: { display: true, text: 'Week starting' } } } } });
  if ($('cBal')) chart('cBal', { type: 'line', data: { labels: [nice(today()).replace(/ \d{4}$/, '')].concat(cf.weeks.map(function (w) { return niceShort(w.to); })), datasets: [
    { label: 'Projected balance', data: [round2(cf.opening)].concat(cf.weeks.map(function (w) { return round2(w.balance); })), borderColor: COLORS.navy, backgroundColor: COLORS.navy, borderWidth: 2.5, pointRadius: 3, tension: 0, fill: false }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: moneyTip() }, scales: { y: { ticks: moneyTicks(), title: { display: true, text: 'Projected cash balance (EC$)' } }, x: { grid: { display: false } } } } });
};
function cashCard() {
  if (isDriver()) return '';
  var cf = cashflowData(30, 'base'), tin = cf.tin, tout = cf.tout;
  return '<button class="card" id="cashCard" style="display:block;width:100%;text-align:left;cursor:pointer"><div class="card-head"><h2 style="margin:0">Next 30 days</h2><span class="btn link">Cash flow ›</span></div>' +
    '<div style="display:flex;gap:18px;flex-wrap:wrap"><span>In <b class="pos">' + ec(tin) + '</b></span><span>Out <b class="neg">' + ec(tout) + '</b></span><span>Difference <b>' + ec(tin - tout) + '</b></span></div></button>';
}

/* ==================== Month-End: close and reopen months one at a time ==================== */
/** What is worth checking before a month is closed. Nothing here blocks closing. */
function monthChecks(ym) {
  var from = ym + '-01', to = isoOf(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0)), f = facts(), x = summarise(f, from, to), out = [];
  var noFee = x.jobs.filter(function (j) { return !(Number(j.costs.labour) > 0); }); if (noFee.length) out.push(['warn', noFee.length + (noFee.length === 1 ? ' job has' : ' jobs have') + ' no labour cost', 'Profit is overstated until it is added.', noFee[0].inv.id]);
  var toInv = (S.data.bookings || []).filter(function (b) { return b.date >= from && b.date <= to && (b.status === 'Done' || b.status === 'Booked'); }); if (toInv.length) out.push(['warn', toInv.length + (toInv.length === 1 ? ' booking was' : ' bookings were') + ' not invoiced', 'Invoice them, or cancel any that did not happen.', 'bookings']);
  var noTruck = x.exps.filter(function (e) { return MAINT.indexOf(e.category) >= 0 && TRUCKS.indexOf(e.truck) < 0; }); if (noTruck.length) out.push(['info', noTruck.length + ' repair cost' + (noTruck.length === 1 ? ' is' : 's are') + ' not linked to a truck', 'They are left out of per-truck figures.', null]);
  var noRcpt = x.exps.filter(function (e) { return !(e.attachments || []).length; }); if (noRcpt.length) out.push(['info', noRcpt.length + (noRcpt.length === 1 ? ' expense has' : ' expenses have') + ' no receipt attached', 'Worth adding before the month is closed.', null]);
  return { x: x, checks: out, from: from, to: to };
}
VIEWS.monthend = function () {
  var owner = S.data.me.role === 'owner', t = today(), closed = closedList(), info = S.data.settings.closedInfo || {};
  var f = facts(), first = (f.jobs.map(function (j) { return j.date; }).concat(f.expenses.map(function (e) { return e.date; })).sort()[0] || t).slice(0, 7);
  var months = []; for (var m = first; m < t.slice(0, 7); m = addMonths(m + '-01', 1).slice(0, 7)) months.push(m); months.reverse();
  var open = months.filter(function (mm) { return closed.indexOf(mm) < 0; });
  var h = '<div class="card"><h2 style="margin-top:0">Month-End</h2><p class="small muted" style="margin:0">Closing a month locks every invoice, payment, expense and job dated in it, so nothing changes by mistake and reports for it become <b>Final</b>. Payments received later for its invoices can still be recorded. A closed month can be reopened with a reason, which is kept in the Activity Log.</p>' +
    '<div class="mgrid" style="margin-top:12px"><div class="mcard"><span class="ml">Open months</span><b class="' + (open.length ? 'neg' : 'pos') + '">' + open.length + '</b><span class="ms">' + (open.length ? 'Oldest ' + ymName(open[open.length - 1]) : 'All finished months closed') + '</span></div><div class="mcard"><span class="ml">Closed months</span><b>' + closed.length + '</b><span class="ms">' + (closed.length ? 'Latest ' + ymName(closed.slice().sort().pop()) : 'None yet') + '</span></div></div>' +
    '<p class="small muted" style="margin:8px 0 0">' + ymName(t.slice(0, 7)) + ' is still running, so it can be closed from 1 ' + MONTH[parseIso(addMonths(t.slice(0, 8) + '01', 1)).getMonth()] + '.</p></div>';
  h += months.map(function (mm) {
    var c = closed.indexOf(mm) >= 0, mc = monthChecks(mm), x = mc.x, inf = info[mm] || {};
    return '<div class="card me-row' + (c ? ' closed' : '') + '"><div class="cu-top"><div><b class="rt-name">' + ymName(mm) + '</b><div class="small muted">' + x.trips + (x.trips === 1 ? ' job' : ' jobs') + ' · revenue ' + ec(x.income) + ' · operating profit ' + ec(x.net) + '</div></div><span class="pill ' + (c ? 'Paid' : 'Unpaid') + '">' + icon(c ? 'lock' : 'calendar', 'gi-inline') + ' ' + (c ? 'Closed' : 'Open') + '</span></div>' +
      (c ? '<p class="small muted" style="margin:6px 0 0">' + (inf.closedBy ? 'Closed by ' + esc(inf.closedBy) + ' on ' + nice(inf.closedAt.slice(0, 10)) : 'Closed') + '</p>'
         : (inf.reopenedBy ? '<p class="small muted" style="margin:6px 0 0">Reopened by ' + esc(inf.reopenedBy) + ' on ' + nice(inf.reopenedAt.slice(0, 10)) + ': ' + esc(inf.reason) + '</p>' : '') + (mc.checks.length ? '<p class="small" style="margin:6px 0 0">' + icon('alarm', 'gi-inline') + ' ' + mc.checks.length + (mc.checks.length === 1 ? ' thing' : ' things') + ' to check first</p>' : '<p class="small pos" style="margin:6px 0 0">' + icon('checkc', 'gi-inline') + ' Nothing to check</p>')) +
      (owner ? '<button class="btn ' + (c ? 'quiet' : 'gold') + ' block" style="margin-top:10px" data-me="' + mm + '" data-act="' + (c ? 'reopen' : 'close') + '">' + (c ? 'Reopen ' : 'Review and close ') + MONTH[+mm.slice(5, 7) - 1] + '</button>' : '') + '</div>';
  }).join('') + (months.length ? '' : '<div class="card empty">No finished months yet.</div>');
  $('view').innerHTML = h;
  qa('[data-me]').forEach(function (b) { b.onclick = function () { b.dataset.act === 'close' ? closeMonthSheet(b.dataset.me) : reopenMonthSheet(b.dataset.me); }; });
};
function closeMonthSheet(ym) {
  var mc = monthChecks(ym), x = mc.x;
  openSheet('Close ' + ymName(ym),
    '<div class="mgrid"><div class="mcard"><span class="ml">Revenue</span><b>' + ec(x.income) + '</b></div><div class="mcard"><span class="ml">Recorded costs</span><b>' + ec(x.costs) + '</b></div><div class="mcard"><span class="ml">Operating profit</span><b>' + ec(x.net) + '</b></div><div class="mcard"><span class="ml">Jobs · expenses</span><b>' + x.trips + ' · ' + x.exps.length + '</b></div></div>' +
    '<h3 class="rep-h">Before closing</h3>' + (mc.checks.length ? '<ul class="obs">' + mc.checks.map(function (c) { return '<li class="' + c[0] + '">' + icon(c[0] === 'warn' ? 'alarm' : 'info', 'gi-obs') + '<div><b>' + c[1] + '</b><p>' + c[2] + '</p>' + (c[3] ? '<button class="btn link pl-link" data-mego="' + c[3] + '">Open ›</button>' : '') + '</div></li>'; }).join('') + '</ul><p class="small muted">These are reminders, not blockers. You can still close the month.</p>'
      : '<p class="pos">' + icon('checkc', 'gi-inline') + ' Every job has its labour cost, nothing is waiting to be invoiced and every expense has its details.</p>') +
    '<p class="small muted">Once closed, nothing dated in ' + ymName(ym) + ' can be edited, cancelled or deleted until the month is reopened. Payments for its invoices can still be recorded.</p>', 'Close month');
  qa('[data-mego]').forEach(function (b) { b.onclick = function () { closeSheet(); var g = b.dataset.mego; g === 'bookings' ? go('bookings') : go('invoice', g); }; });
  $('sheetGo').onclick = function () { api('closeMonth', { month: ym }, 'Closing…').then(function () { closeSheet(); toast(ymName(ym) + ' closed.'); render(); }).catch(function () {}); };
}
function reopenMonthSheet(ym) {
  openSheet('Reopen ' + ymName(ym),
    '<p>Reopening lets records dated in ' + ymName(ym) + ' be changed again, and reports covering it go back to <b>Provisional</b> until it is closed again.</p>' +
    '<label class="f"><span>Why is it being reopened?</span><input id="roW" placeholder="e.g. correct a fuel cost on invoice #048"></label><p class="small muted">Kept in the Activity Log with your name and the date.</p>', 'Reopen month');
  $('sheetGo').onclick = function () { var w = $('roW').value.trim(); if (!w) return toast('Add a short reason.', true);
    api('reopenMonth', { month: ym, reason: w }, 'Reopening…').then(function () { closeSheet(); toast(ymName(ym) + ' reopened. Close it again once the correction is made.'); render(); }).catch(function () {}); };
}

/* ==================== Operating Costs: every cost, broken down ==================== */
S.ocKind = 'running'; S.ocCat = null;
VIEWS.opcosts = function () {
  var f = facts(), r = periodRange(S.period), pr = cmpRange(S.period), cur = summarise(f, r.from, r.to), prev = pr ? summarise(f, pr.from, pr.to) : null, kind = S.ocKind;
  // One list of cost items for the chosen view: running expenses, job costs, or both
  var items = function (x) {
    var out = [];
    if (kind !== 'job') x.exps.forEach(function (e) { out.push({ cat: e.category || 'Other', amt: e.amount, date: e.date, truck: TRUCKS.indexOf(e.truck) >= 0 ? e.truck : (e.truck === 'Both trucks' ? 'Both trucks' : 'Not linked to a truck'), payer: e.paidBy || 'Not recorded', label: e.description || e.category, exp: e }); });
    if (kind !== 'running') x.jobs.forEach(function (j) { COST_TYPES.forEach(function (c) { var v = Number(j.costs[c[0]]) || 0; if (v) out.push({ cat: c[1] + (kind === 'all' ? ' (job)' : ''), amt: v, date: j.date, truck: j.truck || 'Not linked to a truck', payer: 'Business', label: j.client + ' · ' + (j.route || ''), job: j }); }); });
    return out;
  };
  var it = items(cur), pit = prev ? items(prev) : [], tot = it.reduce(function (a, x) { return a + x.amt; }, 0), ptot = pit.reduce(function (a, x) { return a + x.amt; }, 0);
  var by = function (list, key) { var m = {}; list.forEach(function (x) { var k2 = x[key]; m[k2] = m[k2] || { k: k2, amt: 0, n: 0 }; m[k2].amt += x.amt; m[k2].n++; }); return Object.keys(m).map(function (k2) { return m[k2]; }).sort(function (a, b) { return b.amt - a.amt; }); };
  var cats = by(it, 'cat'), pcats = {}; by(pit, 'cat').forEach(function (c) { pcats[c.k] = c.amt; });
  var months = r.from && r.to ? Math.max(1, Math.round(daysBetween(r.from, r.to < today() ? r.to : today()) / 30.44)) : null;
  var bar = function (rows, color, max) { max = max || Math.max.apply(null, rows.map(function (x) { return x.amt; }).concat([1])); return rows.map(function (x) { return '<div class="rt-bar"><div class="rt-bl"><span>' + esc(x.k) + ' <span class="small muted">· ' + x.n + '</span></span><b>' + ec(x.amt) + '</b></div><div class="rt-track"><i style="width:' + Math.max(2, x.amt / max * 100) + '%;background:' + color + '"></i></div></div>'; }).join(''); };
  var h = periodControl(render) + cmpControl() +
    '<div class="seg" style="margin-bottom:12px">' + [['running', 'Running costs'], ['job', 'Job costs'], ['all', 'All costs']].map(function (o) { return '<button data-ock="' + o[0] + '" aria-pressed="' + (kind === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
    '<div class="card"><div class="mgrid">' +
      '<div class="mcard"><span class="ml">' + { running: 'Operating (running) costs', job: 'Direct job costs', all: 'All recorded costs' }[kind] + '</span><b>' + ec(tot) + '</b>' + (pit.length ? chg(tot, ptot, { invert: true }) : '<span class="ms">No records in the comparison period</span>') + '</div>' +
      '<div class="mcard"><span class="ml">Share of revenue</span><b>' + (cur.income ? pct(tot / cur.income) : '–') + '</b><span class="ms">Revenue ' + ec(cur.income) + '</span></div>' +
      '<div class="mcard"><span class="ml">Records</span><b>' + it.length + '</b><span class="ms">' + cats.length + ' categories</span></div>' +
      '<div class="mcard"><span class="ml">Monthly average</span><b>' + (months ? ec(tot / months) : '–') + '</b><span class="ms">' + (months ? 'Over ' + months + (months === 1 ? ' month' : ' months') : 'Choose a period') + '</span></div></div>' +
      '<p class="small muted" style="margin:8px 0 0">' + { running: 'Running costs are expenses not tied to one job: insurance, licences, repairs, servicing, tyres and fuel bought for general running.', job: 'Job costs are the labour cost and any materials, subcontractors, equipment hire, fuel, tipping or other cost recorded on each job.', all: 'Every cost the business recorded, job costs and running costs together.' }[kind] + ' Equipment purchases are never included.</p></div>';
  if (!it.length) { $('view').innerHTML = h + '<div class="card empty">No costs recorded in this period.</div>'; bindOc(); return; }
  h += '<div class="card"><h2>By Category</h2><p class="small muted" style="margin-top:0">Tap a category to see its records.</p><div class="scroll-x"><table class="clip" id="ocCats"><thead><tr><th>Category</th><th class="n">Amount</th><th class="n">Share</th>' + (pit.length ? '<th class="n">Change</th>' : '') + '</tr></thead><tbody>' +
    cats.map(function (c, k) { return '<tr class="' + (k >= 8 ? 'xrow' : '') + '"><td><button class="btn link pl-link" data-occ="' + esc(c.k) + '">' + esc(c.k) + '</button><br><span class="small muted">' + c.n + (c.n === 1 ? ' record' : ' records') + '</span></td><td class="n">' + ec(c.amt) + '</td><td class="n">' + pct(c.amt / tot) + '</td>' + (pit.length ? '<td class="n">' + chg(c.amt, pcats[c.k] || 0, { invert: true }) + '</td>' : '') + '</tr>'; }).join('') +
    '<tr class="total"><td>Total</td><td class="n">' + ec(tot) + '</td><td class="n">100%</td>' + (pit.length ? '<td class="n">' + chg(tot, ptot, { invert: true }) + '</td>' : '') + '</tr></tbody></table></div>' + moreBtn('ocCats', cats.length, 8, 'categories') +
    '<div class="chart-box" style="margin-top:10px"><canvas id="cOcCat"></canvas></div></div>';
  var trucks = by(it, 'truck'), payers = by(it, 'payer');
  h += swipe('ocSwipe', [['By Truck', bar(trucks, 'var(--navy-3)') + '<p class="small muted">Costs entered against "Both trucks" or no truck are shown on their own line.</p>'],
    ['By Who Paid', bar(payers, 'var(--gold)') + '<p class="small muted">Job costs count as paid by the business. </p>'],
    ['By Month', '<div class="chart-box"><canvas id="cOcMon"></canvas></div><p class="small muted">Each bar split by category.</p>']]);
  var list = it.filter(function (x) { return !S.ocCat || x.cat === S.ocCat; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  h += '<div class="card flush" id="ocList"><div class="card-head" style="padding:14px 14px 0"><h2 style="margin:0">' + (S.ocCat ? esc(S.ocCat) : 'Every Cost') + '</h2>' + (S.ocCat ? '<button class="btn link" id="ocAll">Show all categories</button>' : '<span class="kicker">' + list.length + '</span>') + '</div>' +
    '<ul class="list clip" id="ocItems">' + list.map(function (x, k) { return '<li class="' + (k >= 10 ? 'xrow' : '') + '"><button class="row-btn" ' + (x.exp ? 'data-ocexp="' + x.exp.id + '"' : 'data-ocinv="' + x.job.inv.id + '"') + '><span class="t">' + esc(x.label) + '</span><span class="a">' + ec2(x.amt) + '</span><span class="m">' + nice(x.date) + ' · ' + esc(x.cat) + ' · ' + esc(x.truck) + '</span><span class="m">' + (x.exp ? (x.payer === 'Not recorded' ? '' : 'Paid by ' + esc(x.payer)) : 'On ' + invNo(x.job.inv)) + '</span></button></li>'; }).join('') + '</ul><div style="padding:0 14px 10px">' + moreBtn('ocItems', list.length, 10, 'records') + '</div></div>';
  $('view').innerHTML = h; bindOc(); bindCmp(); bindMore(); bindSwipe('ocSwipe');
  qa('[data-occ]').forEach(function (b) { b.onclick = function () { S.ocCat = b.dataset.occ; render(); setTimeout(function () { var el = $('ocList'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 30); }; });
  if ($('ocAll')) $('ocAll').onclick = function () { S.ocCat = null; render(); };
  qa('[data-ocexp]').forEach(function (b) { b.onclick = function () { var e = S.data.expenses.find(function (x) { return x.id === b.dataset.ocexp; }); if (!e) return; MAINT.indexOf(e.category) >= 0 && TRUCKS.indexOf(e.truck) >= 0 ? serviceEditor(e.truck, e) : expenseEditor(e); }; });
  qa('[data-ocinv]').forEach(function (b) { b.onclick = function () { go('invoice', b.dataset.ocinv); }; });
  var top = cats.slice(0, 10), el = $('cOcCat'); if (el) el.parentNode.style.height = Math.max(150, 30 * top.length + 40) + 'px';
  chart('cOcCat', { type: 'bar', data: { labels: top.map(function (c) { return c.k; }), datasets: [{ data: top.map(function (c) { return round2(c.amt); }), backgroundColor: top.map(function (c, k) { return COLORS.palette[k % COLORS.palette.length]; }), borderRadius: 4 }] },
    options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (c) { return ec(c.parsed.x) + ' (' + pct(c.parsed.x / tot) + ')'; } } } }, scales: { x: { ticks: moneyTicks() }, y: { grid: { display: false } } } } });
  var mb = r.from ? grainBuckets(f, 'all', null).filter(function (b0) { return b0.to >= r.from && b0.from <= (r.to || today()); }) : grainBuckets(f, 'all', null).slice(-12);
  var mcats = cats.slice(0, 6).map(function (c) { return c.k; });
  chart('cOcMon', { type: 'bar', data: { labels: mb.map(function (b0) { return b0.label; }), datasets: mcats.map(function (ck, k) { return { label: ck, data: mb.map(function (b0) { return round2(items(b0).filter(function (x) { return x.cat === ck; }).reduce(function (a, x) { return a + x.amt; }, 0)); }), backgroundColor: COLORS.palette[k % COLORS.palette.length], borderRadius: 2 }; })
      .concat(cats.length > 6 ? [{ label: 'Other categories', data: mb.map(function (b0) { return round2(items(b0).filter(function (x) { return mcats.indexOf(x.cat) < 0; }).reduce(function (a, x) { return a + x.amt; }, 0)); }), backgroundColor: COLORS.grey, borderRadius: 2 }] : []) },
    options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } }, tooltip: moneyTip() }, scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: moneyTicks() } } } });
};
function bindOc() { qa('[data-ock]').forEach(function (b) { b.onclick = function () { S.ocKind = b.dataset.ock; S.ocCat = null; render(); }; }); }

/* ==================== Financial Reports (D1, D2) ==================== */
S.yeYear = null; S.repScope = 'all';
function repStatus(from, to) {
  var t = today(); if (from > t) return ['Not started', 'muted'];
  if (to >= t) return ['In progress', 'Unpaid'];
  var f0 = facts(), first = (f0.jobs.map(function (j) { return j.date; }).concat(f0.expenses.map(function (e) { return e.date; })).sort()[0] || '').slice(0, 7);
  // Months before the first job or expense have nothing in them, so they count as closed
  for (var m = from.slice(0, 7); m <= to.slice(0, 7); m = addMonths(m + '-01', 1).slice(0, 7)) if (!(first && m < first) && closedList().indexOf(m) < 0) return ['Provisional', 'Overdue'];
  return ['Final', 'Paid'];
}
function scopedFacts(scope) {
  var f = facts(); if (!scope || scope === 'all') return f;
  return { jobs: f.jobs.filter(function (j) { return j.truck === scope; }), expenses: f.expenses.filter(function (e) { return e.truck === scope; }), invoices: f.invoices };
}
function reportCsv(from, to, scope) {
  var f = scopedFacts(scope), q = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  var head = ['Date', 'Type', 'Invoice', 'Customer or category', 'Description', 'Area', 'Truck', 'Revenue'].concat(COST_TYPES.map(function (c) { return c[1]; })).concat(['Running expense']);
  var rows = f.jobs.filter(function (j) { return within(j.date, from, to); }).map(function (j) { return [j.date, 'Job', invNo(j.inv), j.client, j.title, j.route, j.truck, round2(j.amount)].concat(COST_TYPES.map(function (c) { return round2(Number(j.costs[c[0]]) || 0); })).concat(['']); })
    .concat(f.expenses.filter(function (e) { return within(e.date, from, to); }).map(function (e) { return [e.date, 'Expense', '', e.category, e.description, '', e.truck, ''].concat(COST_TYPES.map(function () { return ''; })).concat([round2(e.amount)]); }))
    .sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
  return [head].concat(rows).map(function (r) { return r.map(q).join(','); }).join('\n');
}
function reportSheet(o) {
  var f = scopedFacts(S.repScope), x = summarise(f, o.from, o.to), st = repStatus(o.from, o.to), canSend = !isViewOnly() && !isDriver();
  var scopeTxt = S.repScope === 'all' ? 'All operations' : truckName(S.repScope);
  openSheet(o.title + ' ' + o.label,
    '<p class="small muted" style="margin-top:0">' + nice(o.from) + ' to ' + nice(o.to) + ' · ' + esc(scopeTxt) + ' · <span class="pill ' + st[1] + '">' + st[0] + '</span></p>' +
    '<div class="mgrid">' + [['Revenue', ec(x.income)], ['Recorded costs', ec(x.costs)], ['Operating profit', ec(x.net)], ['Margin', isNaN(x.margin) ? '–' : pct(x.margin)], ['Cash received', ec(x.received)], ['Completed jobs', String(x.trips)]].map(function (m) { return '<div class="mcard"><span class="ml">' + m[0] + '</span><b>' + m[1] + '</b></div>'; }).join('') + '</div>' +
    '<p class="small muted">' + (st[0] === 'Final' ? 'Every month in this period is closed, so these figures are final.' : st[0] === 'Provisional' ? 'Provisional: close these months in Business Settings to make the report final. Scheduled emails say so in the subject.' : 'This period has not finished, so the report shows the figures so far.') + '</p>' +
    '<button class="btn gold block" id="rpPdf">Download PDF report</button><div class="btn-row" style="margin-top:8px"><button class="btn quiet" id="rpXls">Excel</button><button class="btn quiet" id="rpCsv">CSV</button></div>' +
    (canSend ? '<button class="btn quiet block" id="rpMail" style="margin-top:8px">Email to ' + esc(S.data.settings.reportEmails || 'report recipients') + '</button>' : '') +
    '<p class="small muted">The PDF includes charts for the period, the profit and loss, where the money went, customers and money owed. Exports use the same period and scope.</p>');
  var body = { from: o.from, to: o.to, title: o.title, label: o.label, scope: S.repScope };
  var serverOnly = function () { toast('Reports are built by the server, so they are not available in this preview.', true); };
  $('rpPdf').onclick = function () { if (window.PREVIEW) return serverOnly(); api('reportPdf', body, 'Building the report…').then(function (res) { shareFile(dataUrlToFile('data:application/pdf;base64,' + res.file.base64, res.file.name, 'application/pdf')); }).catch(function () {}); };
  $('rpXls').onclick = function () { if (window.PREVIEW) return serverOnly(); api('reportXlsx', body, 'Building the spreadsheet…').then(function (res) { shareFile(dataUrlToFile('data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + res.file.base64, res.file.name, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')); }).catch(function () {}); };
  $('rpCsv').onclick = function () { shareFile(new File([reportCsv(o.from, o.to, S.repScope)], ('NV ' + o.title + ' ' + o.label).replace(/\s+/g, '-') + '.csv', { type: 'text/csv' })); };
  if ($('rpMail')) $('rpMail').onclick = function () { if (window.PREVIEW) return serverOnly(); if (!confirm('Email the ' + o.title.toLowerCase() + ' to ' + S.data.settings.reportEmails + '?')) return; api('emailReport', body, 'Sending…').then(function (r) { toast('Sent to ' + r.to + ' (' + r.status + ').'); }).catch(function () {}); };
}
VIEWS.yearend = function () {
  var years = uniq(yearsWithData().concat([today().slice(0, 4)])).sort(); if (!S.yeYear || years.indexOf(S.yeYear) < 0) S.yeYear = today().slice(0, 4);
  var y = S.yeYear, set = S.data.settings, owner = S.data.me.role === 'owner';
  var qs = [0, 1, 2, 3].map(function (q) { var from = y + '-' + String(q * 3 + 1).padStart(2, '0') + '-01'; return { q: q + 1, from: from, to: isoOf(new Date(+y, q * 3 + 3, 0)), months: MON[q * 3] + ' – ' + MON[q * 3 + 2] }; });
  var ast = repStatus(y + '-01-01', y + '-12-31');
  var h = '<div class="card rep"><div class="fo-head"><div><h2 style="margin:0">Financial Reports</h2><p class="muted" style="margin:2px 0 0">Review and export consolidated business results</p></div>' + icon('book', 'gi-head') + '</div>' +
    '<div class="cols" style="margin-top:12px"><label class="f"><span>Reporting year</span><select id="repY">' + years.slice().reverse().map(function (yy) { return '<option' + (yy === y ? ' selected' : '') + '>' + yy + '</option>'; }).join('') + '</select></label>' +
    '<label class="f"><span>Report scope</span><select id="repS"><option value="all">All operations</option>' + TRUCKS.map(function (tr) { return '<option value="' + esc(tr) + '"' + (S.repScope === tr ? ' selected' : '') + '>' + esc(truckName(tr)) + '</option>'; }).join('') + '</select></label></div>' +
    '<h3 class="rep-h">Quarterly reports</h3><div class="q-grid">' + qs.map(function (q) { var st = repStatus(q.from, q.to), off = st[0] === 'Not started';
      return '<button class="q-tile" data-q="' + q.q + '"' + (off ? ' disabled' : '') + '><span class="q-top"><b>Q' + q.q + '</b>' + icon('file', 'gi-q') + '</span><span class="muted">' + q.months + '</span><span class="pill ' + st[1] + '">' + st[0] + '</span><span class="q-link">' + (off ? 'Not available yet' : 'View report ↗') + '</span></button>'; }).join('') + '</div>' +
    '<div class="annual"><div><h3 style="margin:0">Annual Report ' + y + '</h3><p class="muted" style="margin:4px 0 0">Full-year financial and operating performance</p><span class="pill ' + ast[1] + '" style="margin-top:6px;display:inline-block">' + ast[0] + '</span></div>' +
    '<button class="btn gold" id="repGen">Generate →</button></div></div>';
  h += '<div class="card"><h2>Delivery and Schedule</h2>' +
    '<label class="f"><span>Report recipients</span><input id="repTo" type="email" multiple value="' + esc(set.reportEmails || '') + '"' + (owner ? '' : ' disabled') + ' placeholder="name@example.com, office@example.com"></label>' +
    '<label class="switch-row"><span><b>Quarterly reports</b><br><span class="small muted">Emailed on the 7th day after each quarter ends (7 January, April, July and October).</span></span><input type="checkbox" class="switch" id="repQ"' + (set.quarterlyReports !== false ? ' checked' : '') + (owner ? '' : ' disabled') + '></label>' +
    '<label class="switch-row"><span><b>Annual report</b><br><span class="small muted">Emailed on 1 January for the year just ended, with the full records spreadsheet.</span></span><input type="checkbox" class="switch" id="repA"' + (set.annualReports !== false ? ' checked' : '') + (owner ? '' : ' disabled') + '></label>' +
    '<label class="switch-row"><span><b>Weekly business report</b><br><span class="small muted">Emailed every Monday at 8am for the previous Monday to Sunday: key figures, money owed, areas, customers, costs and the week ahead, with the PDF report.</span></span><input type="checkbox" class="switch" id="repW"' + (set.weeklyEmail !== false ? ' checked' : '') + (owner ? '' : ' disabled') + '></label>' +
    '<label class="switch-row"><span><b>Monthly business report</b><br><span class="small muted">Emailed on the 1st at 8am for the month just ended, in the same format.</span></span><input type="checkbox" class="switch" id="repM"' + (set.monthlyEmail !== false ? ' checked' : '') + (owner ? '' : ' disabled') + '></label>' +
    '<div id="repMail" class="small muted" style="margin:6px 0 4px"></div>' +
    (isViewOnly() ? '' : '<div class="btn-row" style="margin:6px 0 10px"><button class="btn quiet" data-sumnow="weekly">Email last week now</button><button class="btn quiet" data-sumnow="monthly">Email last month now</button></div>') +
    '<p class="small muted"><b>Safeguard against preliminary reports:</b> a scheduled report is marked <b>Final</b> only when every month in it is closed under Manage → Month-End; otherwise it is sent marked <b>Provisional</b>, in the subject line and on the cover. The financial year runs January to December.</p>' +
    (owner ? '<button class="btn quiet block" id="repSave">Save delivery settings</button>' : '<p class="small muted">Only the account owner can change recipients and schedules.</p>') + '</div>';
  $('view').innerHTML = h;
  $('repY').onchange = function () { S.yeYear = this.value; render(); };
  if (window.PREVIEW) { if ($('repMail')) $('repMail').textContent = 'Emails are sent by the server, so not from this preview.'; }
  else api('emailStatus', {}).then(function (r) { if (!$('repMail')) return;
    $('repMail').innerHTML = r.configured ? icon('checkc', 'gi-inline') + ' <span class="pos">Email is set up</span>' + (r.from ? ', sending from ' + esc(r.from) : '') + '.'
      : '<span class="neg">' + icon('alarm', 'gi-inline') + ' <b>Email is not set up yet</b>, so scheduled and manual report emails cannot be sent.</span> Add GMAIL_ADDRESS and GMAIL_APP_PASSWORD in Netlify, then redeploy.'; }).catch(function () {});
  qa('[data-sumnow]').forEach(function (b) { b.onclick = function () { if (window.PREVIEW) return toast('Emails are sent by the server, so not from this preview.', true); var k = b.dataset.sumnow;
    if (!confirm('Email the ' + (k === 'weekly' ? 'report for last week' : 'report for last month') + ' to ' + (S.data.settings.reportEmails || 'the report recipients') + '?')) return;
    api('emailSummary', { kind: k }, 'Sending…').then(function (r) { toast('Sent: ' + r.label + '.'); }).catch(function () {}); }; });
  $('repS').onchange = function () { S.repScope = this.value; };
  qa('[data-q]').forEach(function (b) { b.onclick = function () { var q = qs[+b.dataset.q - 1]; reportSheet({ from: q.from, to: q.to, title: 'Quarterly Report', label: 'Q' + q.q + ' ' + y }); }; });
  $('repGen').onclick = function () { reportSheet({ from: y + '-01-01', to: y + '-12-31', title: 'Annual Report', label: y }); };
  if ($('repSave')) $('repSave').onclick = function () { api('saveSettings', { settings: { reportEmails: $('repTo').value, quarterlyReports: $('repQ').checked, annualReports: $('repA').checked, weeklyEmail: $('repW').checked, monthlyEmail: $('repM').checked } }, 'Saving…').then(function () { toast('Delivery settings saved.'); }).catch(function () {}); };
};

/* ==================== boot ==================== */
document.addEventListener('visibilitychange', function () {
  if (document.hidden || !S.token || !S.data) return;
  if (Date.now() - S.lastLoad > 2 * 60 * 1000 && $('sheet-wrap').classList.contains('hidden')) api('load', {}).then(render).catch(function () {});
});

/* ==================== NV Construction additions: skip bins, engine hours, lines of business ==================== */
TITLES.bins = 'Skip Bins'; TITLES.hours = 'Engine Hours';
function nvBins() { return (S.data.bins || []).slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'en', { numeric: true }); }); }
function nvHires() { return S.data.hires || []; }
function binName(id) { var b = (S.data.bins || []).find(function (x) { return x.id === id; }); return b ? b.name : 'Unknown bin'; }
function hireDays(h) { return Math.max(0, daysBetween(h.outDate, h.backDate || today())); }
function hireState(h) {
  if (h.status === 'Collected') return ['Collected', 'Paid'];
  if (h.collectBy && h.collectBy < today()) return ['Collection overdue', 'Overdue'];
  if (h.collectBy === today()) return ['Collect today', 'Unpaid'];
  return ['On site', 'muted'];
}
S.binTab = S.binTab || 'out';
VIEWS.bins = function () {
  var bins = nvBins(), hires = nvHires(), t = today(), ro = isViewOnly();
  var out = hires.filter(function (h) { return h.status === 'Out'; }).sort(function (a, b) { return (a.collectBy || '9') < (b.collectBy || '9') ? -1 : 1; });
  var outIds = out.map(function (h) { return h.binId; }), active = bins.filter(function (b) { return b.active !== false; });
  var due = out.filter(function (h) { return h.collectBy && h.collectBy <= t; });
  var notBilled = hires.filter(function (h) { return h.status === 'Collected' && !h.invoiceId; }).length;
  var h = '<div class="mgrid" style="margin-bottom:12px"><div class="mcard"><span class="ml">Bins out</span><b>' + out.length + '</b><span class="ms">of ' + active.length + ' in service</span></div>' +
    '<div class="mcard"><span class="ml">In the yard</span><b class="pos">' + active.filter(function (b) { return outIds.indexOf(b.id) < 0; }).length + '</b></div>' +
    '<div class="mcard"><span class="ml">Collections due</span><b class="' + (due.length ? 'neg' : '') + '">' + due.length + '</b><span class="ms">Today or overdue</span></div>' +
    '<div class="mcard"><span class="ml">To invoice</span><b class="' + (notBilled ? 'neg' : '') + '">' + notBilled + '</b><span class="ms">Collected, no invoice yet</span></div></div>';
  h += '<div class="ins-chips tabs-row" style="margin-bottom:12px">' + [['out', 'Bins out'], ['done', 'Collected'], ['reg', 'Bin register']].map(function (o) { return '<button class="chip" data-bt="' + o[0] + '" aria-pressed="' + (S.binTab === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  if (!ro && S.binTab !== 'reg') h += '<div class="toolbar"><button class="btn gold" id="hireNew"' + (active.length ? '' : ' disabled') + '>+ Bin out to a site</button></div>';
  var card = function (x) {
    var st = hireState(x), d = hireDays(x);
    return '<div class="card"><div class="cu-top"><b>' + esc(binName(x.binId)) + ' · ' + esc(x.client) + '</b><span class="pill ' + st[1] + '">' + st[0] + '</span></div>' +
      '<div class="small muted">' + esc([x.area, x.address].filter(Boolean).join(' · ') || 'No site given') + (x.load ? ' · ' + esc(x.load) : '') + '</div>' +
      '<table style="margin-top:6px"><tbody><tr><td>Delivered</td><td class="n">' + nice(x.outDate) + '</td></tr>' +
      (x.status === 'Out' ? '<tr><td>Collect by</td><td class="n">' + (x.collectBy ? nice(x.collectBy) : 'Not agreed') + '</td></tr>' : '<tr><td>Collected</td><td class="n">' + nice(x.backDate) + '</td></tr>') +
      '<tr><td>Days on hire</td><td class="n"><b>' + d + '</b></td></tr>' + (x.notes ? '<tr><td>Notes</td><td class="n">' + esc(x.notes) + '</td></tr>' : '') + '</tbody></table>' +
      (ro ? '' : '<div class="btn-row" style="margin-top:8px">' + (x.status === 'Out' ? '<button class="btn gold" data-col="' + x.id + '">Collected</button>' : '') +
        (x.invoiceId ? '<button class="btn quiet" data-hinv="' + x.invoiceId + '">See invoice</button>' : isDriver() ? '' : '<button class="btn quiet" data-bill="' + x.id + '">Invoice</button>') +
        '<button class="btn link" data-hed="' + x.id + '">Edit</button></div>') + '</div>';
  };
  if (S.binTab === 'out') h += out.length ? out.map(card).join('') : '<div class="card empty">No bins are out. Tap “Bin out to a site” when one is delivered.</div>';
  else if (S.binTab === 'done') { var done = hires.filter(function (x) { return x.status === 'Collected'; }).sort(function (a, b) { return a.backDate < b.backDate ? 1 : -1; }).slice(0, 40);
    h += done.length ? done.map(card).join('') : '<div class="card empty">No collections recorded yet.</div>'; }
  else {
    h += '<div class="card"><h2>Bin register</h2>' + (bins.length ? '<ul class="list">' + bins.map(function (b) { var o = out.find(function (x) { return x.binId === b.id; });
      return '<li><button class="row-btn" data-bed="' + b.id + '"><span><span class="t">' + esc(b.name) + (b.size ? ' · ' + esc(b.size) : '') + '</span><br><span class="m">' + (b.active === false ? 'Out of service' : o ? 'On site with ' + esc(o.client) + ', ' + hireDays(o) + ' days' : 'In the yard') + '</span></span><span class="chev">›</span></button></li>'; }).join('') + '</ul>'
      : '<p class="small muted">Add each skip bin once, with a number painted on it, so the app can show where every bin is.</p>') +
      (S.data.me.role === 'owner' || S.data.me.role === 'member' ? '<button class="btn quiet block" id="binNew">+ Add a bin</button>' : '') + '</div>';
  }
  $('view').innerHTML = h;
  qa('[data-bt]').forEach(function (b) { b.onclick = function () { S.binTab = b.dataset.bt; render(); }; });
  if ($('hireNew')) $('hireNew').onclick = function () { hireEditor(); };
  if ($('binNew')) $('binNew').onclick = function () { binEditor(); };
  qa('[data-bed]').forEach(function (b) { b.onclick = function () { if (S.data.me.role === 'owner' || S.data.me.role === 'member') binEditor((S.data.bins || []).find(function (x) { return x.id === b.dataset.bed; })); }; });
  qa('[data-hed]').forEach(function (b) { b.onclick = function () { hireEditor(hires.find(function (x) { return x.id === b.dataset.hed; })); }; });
  qa('[data-hinv]').forEach(function (b) { b.onclick = function () { go('invoice', b.dataset.hinv); }; });
  qa('[data-bill]').forEach(function (b) { b.onclick = function () { invoiceFromHire(hires.find(function (x) { return x.id === b.dataset.bill; })); }; });
  qa('[data-col]').forEach(function (b) { b.onclick = function () {
    var x = hires.find(function (z) { return z.id === b.dataset.col; });
    openSheet('Collect ' + binName(x.binId), '<p class="muted">' + esc(x.client) + ' · out since ' + nice(x.outDate) + '</p><label class="f"><span>Date collected</span><input id="hcD" type="date" value="' + today() + '"></label>', 'Save');
    $('sheetGo').onclick = function () { api('collectHire', { id: x.id, backDate: $('hcD').value }, 'Saving…').then(function () { closeSheet(); toast(binName(x.binId) + ' is back in the yard.'); render(); }).catch(function () {}); };
  }; });
};
function binEditor(b) {
  b = b || {}; var owner = S.data.me.role === 'owner';
  openSheet(b.id ? 'Edit ' + b.name : 'Add a skip bin', '<div class="cols"><label class="f"><span>Name or number</span><input id="bnN" value="' + v(b.name) + '" placeholder="Bin 1"></label>' +
    '<label class="f"><span>Size (optional)</span><input id="bnS" value="' + v(b.size) + '" placeholder="e.g. 10 yard"></label></div>' +
    '<label class="f"><span>Notes</span><input id="bnO" value="' + v(b.notes) + '"></label>' +
    '<label class="check"><input type="checkbox" id="bnA"' + (b.active !== false ? ' checked' : '') + '> In service</label>' +
    (b.id && owner ? '<button class="btn link" id="bnDel" style="color:var(--danger)">Delete this bin</button>' : ''), 'Save');
  $('sheetGo').onclick = function () { api('saveBin', { bin: { id: b.id, name: $('bnN').value, size: $('bnS').value, notes: $('bnO').value, active: $('bnA').checked } }, 'Saving…').then(function () { closeSheet(); S.binTab = 'reg'; render(); }).catch(function () {}); };
  if ($('bnDel')) $('bnDel').onclick = function () { if (confirm('Delete ' + b.name + '?')) api('deleteBin', { id: b.id }, 'Deleting…').then(function () { closeSheet(); render(); }).catch(function () {}); };
}
function hireEditor(x) {
  x = x || { outDate: today() };
  var free = nvBins().filter(function (b) { return b.active !== false && (b.id === x.binId || !nvHires().some(function (h) { return h.binId === b.id && h.status === 'Out'; })); });
  if (!free.length) { toast('Every bin in service is already out.', true); return; }
  var clients = S.data.clients.map(function (c) { return c.name; }).sort();
  openSheet(x.id ? 'Edit hire' : 'Bin out to a site',
    '<div class="cols"><label class="f"><span>Bin</span><select id="hrB">' + free.map(function (b) { return '<option value="' + b.id + '"' + (b.id === x.binId ? ' selected' : '') + '>' + esc(b.name + (b.size ? ' · ' + b.size : '')) + '</option>'; }).join('') + '</select></label>' +
    '<label class="f"><span>Delivered</span><input id="hrO" type="date" value="' + v(x.outDate) + '"></label></div>' +
    '<label class="f"><span>Customer</span><input id="hrC" list="hrCl" value="' + v(x.client) + '" autocomplete="off"></label>' + datalist('hrCl', clients) +
    '<label class="f"><span>Phone / WhatsApp</span><input id="hrP" type="tel" value="' + v(x.phone) + '"></label>' +
    '<div class="cols"><label class="f"><span>Area</span><input id="hrA" list="hrAr" value="' + v(x.area) + '"></label>' + datalist('hrAr', ROUTES) +
    '<label class="f"><span>Collect by (optional)</span><input id="hrBy" type="date" value="' + v(x.collectBy) + '"></label></div>' +
    '<label class="f"><span>Site address or directions</span><input id="hrAd" value="' + v(x.address) + '"></label>' +
    '<label class="f"><span>What is going in it</span><input id="hrL" list="hrLo" value="' + v(x.load) + '"></label>' + datalist('hrLo', LOADS) +
    '<label class="f"><span>Notes</span><input id="hrN" value="' + v(x.notes) + '" placeholder="e.g. place by the gate"></label>' +
    (x.id && !isDriver() ? '<button class="btn link" id="hrDel" style="color:var(--danger)">Delete this hire</button>' : ''), 'Save');
  $('hrC').oninput = function () { var c = S.data.clients.find(function (z) { return z.name.toLowerCase() === $('hrC').value.trim().toLowerCase(); }); if (c && !$('hrP').value) $('hrP').value = c.phone || ''; };
  $('sheetGo').onclick = function () {
    api('saveHire', { hire: { id: x.id, binId: $('hrB').value, outDate: $('hrO').value, client: $('hrC').value, phone: $('hrP').value, area: $('hrA').value, collectBy: $('hrBy').value, address: $('hrAd').value, load: $('hrL').value, notes: $('hrN').value } }, 'Saving…')
      .then(function () { closeSheet(); S.binTab = 'out'; if (S.view !== 'bins') go('bins'); else render(); toast('Saved.'); }).catch(function () {});
  };
  if ($('hrDel')) $('hrDel').onclick = function () { if (confirm('Delete this hire record?')) api('deleteHire', { id: x.id }, 'Deleting…').then(function () { closeSheet(); render(); }).catch(function () {}); };
}
function invoiceFromHire(x) {
  var r = rateFor(x.area), d = hireDays(x), c = S.data.clients.find(function (z) { return z.name.toLowerCase() === x.client.toLowerCase(); });
  var line = Object.assign(blankLine(), { date: x.backDate || x.outDate, truck: TRUCKS.indexOf('Skip truck') >= 0 ? 'Skip truck' : TRUCKS[0], route: x.area, category: 'Skip bin rental', load: x.load,
    title: 'Skip bin hire' + (x.area ? ', ' + x.area : ''), detail: 'Delivered ' + nice(x.outDate) + (x.backDate ? ', collected ' + nice(x.backDate) : '') + ' (' + d + (d === 1 ? ' day' : ' days') + ')',
    price: r && r.price ? r.price : (S.data.settings.defaultPrice || ''), costs: r ? { labour: r.labour || 0, tipping: r.tipping || 0, fuel: r.fuel || 0 } : {} });
  invoiceEditor({ issueDate: today(), hireId: x.id, lines: [line] }, c || { name: x.client, phone: x.phone });
}
/* ---- engine hours ---- */
function hourMachines() {
  var ids = uniq(vehicles().filter(function (v) { return /excavat|digger|loader|machine|bobcat|backhoe|roller/i.test(v.id + ' ' + (v.model || '') + ' ' + (v.nickname || '')); }).map(function (v) { return v.id; })
    .concat((S.data.hours || []).map(function (x) { return x.truck; })).concat(Object.keys(S.data.hourPlans || {})));
  return ids.length ? ids : TRUCKS.slice(-1);
}
function hourStatus(truck) {
  var rs = (S.data.hours || []).filter(function (x) { return x.truck === truck; }).sort(function (a, b) { return b.hours - a.hours; });
  var last = rs[0], svc = rs.find(function (x) { return x.serviced; }), plan = (S.data.hourPlans || {})[truck];
  var next = plan && plan.every ? (svc ? svc.hours : 0) + plan.every : null;
  return { readings: rs, last: last, svc: svc, plan: plan, next: next, left: next != null && last ? next - last.hours : null };
}
VIEWS.hours = function () {
  var mgr = S.data.me.role === 'owner' || S.data.me.role === 'member', ro = isViewOnly();
  var h = '<p class="small muted" style="margin-top:0">Machines are serviced by engine hours, not mileage. Record the hour meter now and then, and mark each service, so the app can say when the next one is due.</p>';
  h += hourMachines().map(function (m) {
    var s = hourStatus(m), warn = s.left != null && s.left <= 25;
    return '<div class="card"><div class="cu-top"><b>' + esc(truckName(m)) + '</b><span class="pill ' + (s.left == null ? 'muted' : s.left < 0 ? 'Overdue' : warn ? 'Unpaid' : 'Paid') + '">' + (s.left == null ? 'No service interval' : s.left < 0 ? 'Service overdue' : warn ? 'Service soon' : 'OK') + '</span></div>' +
      '<div class="rt-c-row"><div><span class="small muted">Hour meter</span><b>' + (s.last ? F0.format(s.last.hours) + ' h' : '–') + '</b></div><div><span class="small muted">Last service</span><b>' + (s.svc ? F0.format(s.svc.hours) + ' h' : '–') + '</b></div>' +
      '<div><span class="small muted">Next service</span><b class="' + (warn ? 'neg' : '') + '">' + (s.next != null ? F0.format(s.next) + ' h' : 'Not set') + '</b></div></div>' +
      (s.left != null && s.last ? '<p class="small ' + (warn ? 'neg' : 'muted') + '" style="margin:6px 0 0">' + (s.left < 0 ? F0.format(-s.left) + ' hours past the service point.' : F0.format(s.left) + ' hours to the next service.') + ' Service every ' + s.plan.every + ' hours.</p>' : '') +
      (s.last ? '<p class="small muted" style="margin:4px 0 0">Last reading ' + nice(s.last.date) + '.</p>' : '') +
      (ro ? '' : '<div class="btn-row" style="margin-top:8px"><button class="btn gold" data-hr="' + esc(m) + '">Add reading</button><button class="btn quiet" data-hs="' + esc(m) + '">Record service</button>' + (mgr ? '<button class="btn link" data-hp="' + esc(m) + '">Interval</button>' : '') + '</div>') +
      (s.readings.length ? '<details style="margin-top:8px"><summary class="small">History (' + s.readings.length + ')</summary><ul class="list">' + s.readings.slice(0, 30).map(function (x) {
        return '<li><button class="row-btn" data-hdel="' + x.id + '"><span><span class="t">' + F0.format(x.hours) + ' h' + (x.serviced ? ' · service' : '') + '</span><br><span class="m">' + nice(x.date) + (x.note ? ' · ' + esc(x.note) : '') + ' · ' + esc(x.createdBy || '') + '</span></span><span class="chev">×</span></button></li>'; }).join('') + '</ul></details>' : '') + '</div>';
  }).join('');
  $('view').innerHTML = h;
  var entry = function (m, serviced) {
    var s = hourStatus(m);
    openSheet((serviced ? 'Service on ' : 'Hour reading, ') + truckName(m), '<div class="cols"><label class="f"><span>Hour meter</span><input id="hrH" inputmode="decimal" value="' + (s.last ? s.last.hours : '') + '"></label><label class="f"><span>Date</span><input id="hrD" type="date" value="' + today() + '"></label></div>' +
      '<label class="f"><span>' + (serviced ? 'What was done' : 'Note (optional)') + '</span><input id="hrT" placeholder="' + (serviced ? 'e.g. oil and filters, greased' : '') + '"></label>' +
      (serviced ? '<p class="small muted">Record the cost of the service as a running expense under Maintenance.</p>' : ''), 'Save');
    $('sheetGo').onclick = function () { api('saveHours', { entry: { truck: m, hours: $('hrH').value, date: $('hrD').value, note: $('hrT').value, serviced: serviced } }, 'Saving…').then(function () { closeSheet(); toast('Saved.'); render(); }).catch(function () {}); };
  };
  qa('[data-hr]').forEach(function (b) { b.onclick = function () { entry(b.dataset.hr, false); }; });
  qa('[data-hs]').forEach(function (b) { b.onclick = function () { entry(b.dataset.hs, true); }; });
  qa('[data-hp]').forEach(function (b) { b.onclick = function () {
    var m = b.dataset.hp, p = (S.data.hourPlans || {})[m] || {};
    openSheet('Service interval, ' + truckName(m), '<label class="f"><span>Service every (engine hours)</span><input id="hpE" inputmode="numeric" value="' + v(p.every) + '" placeholder="e.g. 250"></label><p class="small muted">Use the interval in the machine’s manual. Leave blank to stop hour-based reminders.</p>', 'Save');
    $('sheetGo').onclick = function () { api('setHourPlan', { truck: m, every: $('hpE').value }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); };
  }; });
  qa('[data-hdel]').forEach(function (b) { b.onclick = function () { if (!ro && confirm('Delete this reading?')) api('deleteHours', { id: b.dataset.hdel }, 'Deleting…').then(render).catch(function () {}); }; });
};
/* ---- Needs Attention: bins to collect and machines due a service ---- */
var nvNeeds = needsAttention;
needsAttention = function () {
  var items = nvNeeds(), t = today();
  var due = nvHires().filter(function (h) { return h.status === 'Out' && h.collectBy && h.collectBy <= t; });
  if (due.length) items.splice(1, 0, ['truck', due.some(function (h) { return h.collectBy < t; }) ? 'danger' : 'warn', due.length + (due.length === 1 ? ' bin to collect' : ' bins to collect'), due.map(function (h) { return binName(h.binId) + ', ' + h.client; }).slice(0, 2).join(' · '), 'bins']);
  var unbilled = nvHires().filter(function (h) { return h.status === 'Collected' && !h.invoiceId; });
  if (unbilled.length && !isDriver()) items.push(['invoice', 'warn', unbilled.length + (unbilled.length === 1 ? ' collected bin' : ' collected bins') + ' not invoiced', 'Skip hires with no invoice yet', 'bins']);
  hourMachines().forEach(function (m) { var s = hourStatus(m); if (s.left != null && s.left <= 25) items.push(['alarm', s.left < 0 ? 'danger' : 'warn', truckName(m) + ': service ' + (s.left < 0 ? 'overdue' : 'due soon'), s.left < 0 ? F0.format(-s.left) + ' hours past the service point' : F0.format(s.left) + ' engine hours left', 'hours']); });
  return items;
};
/* ---- lines of business: Construction, Skip bins, Equipment and haulage ---- */
function lineStats(jobs, pcs) {
  return BUSINESS_LINES.map(function (name) {
    var js = jobs.filter(function (j) { return lineOf(j.category) === name; }), inc = js.reduce(function (a, j) { return a + j.amount; }, 0), cost = js.reduce(function (a, j) { return a + j.cost; }, 0) + (pcs || []).filter(function (e) { return lineOf(e.type) === name; }).reduce(function (a, e) { return a + e.amount; }, 0);
    return { name: name, jobs: js.length, income: inc, cost: cost, net: inc - cost, margin: inc ? (inc - cost) / inc : NaN };
  });
}
function lineTable(jobs, note, pcs) {
  var rows = lineStats(jobs, pcs), tot = rows.reduce(function (a, r) { return a + r.income; }, 0);
  return '<div class="scroll-x"><table><thead><tr><th>Line</th><th class="n">Jobs</th><th class="n">Revenue</th><th class="n">Direct costs</th><th class="n">Contribution</th><th class="n">Margin</th></tr></thead><tbody>' +
    rows.map(function (r) { return '<tr><td>' + r.name + '<div class="meter" style="margin-top:4px"><span style="width:' + (tot ? Math.round(r.income / tot * 100) : 0) + '%"></span></div></td><td class="n">' + r.jobs + '</td><td class="n">' + ec(r.income) + '</td><td class="n">' + ec(r.cost) + '</td><td class="n"><b class="' + (r.net < 0 ? 'neg' : '') + '">' + ec(r.net) + '</b></td><td class="n">' + pct(r.margin) + '</td></tr>'; }).join('') +
    '</tbody></table></div><p class="small muted" style="margin:6px 0 0">' + (note || 'Contribution is revenue less the direct costs recorded on each job, before running expenses.') + '</p>';
}
var nvDash = VIEWS.dashboard;
VIEWS.dashboard = function () {
  nvDash();
  if (isDriver()) return;
  var r = periodRange(S.period), cur = summarise(facts(), r.from, r.to); if (!cur.jobs.length) return;
  var anchor = document.querySelector('[data-sec="summary"]'); if (!anchor) return;
  anchor.insertAdjacentHTML('afterend', sec('lines', 'By Line of Business', lineTable(cur.jobs, 'Construction, skip bins, and equipment and haulage for ' + esc(periodLabel(S.period)) + '. Contribution is before running expenses; project costs count under Construction.', cur.projectCosts)));
};
var nvMonthly = VIEWS.monthly;
VIEWS.monthly = function () {
  nvMonthly();
  var y = S.year || today().slice(0, 4), sm = summarise(facts(), y + '-01-01', y + '-12-31'), jobs = sm.jobs; if (!jobs.length) return;
  $('view').insertAdjacentHTML('beforeend', '<div class="card"><h2>By Line of Business · ' + esc(y) + '</h2>' + lineTable(jobs, null, sm.projectCosts) + '</div>');
};


/* ==================== NV Construction: building projects ==================== */
TITLES.projects = 'Projects'; TITLES.project = 'Project'; TITLES.projreport = 'Project Performance';
var P_STATUS = ['Quoted', 'Won', 'On site', 'Handed over', 'Defects period', 'Closed', 'Lost'];
var P_LIVE = ['Won', 'On site', 'Handed over', 'Defects period'];
var P_HEAD = [['labour', 'Labour'], ['material', 'Materials'], ['subcontract', 'Subcontractors'], ['plant', 'Equipment hire'], ['fuel', 'Fuel & transport'], ['tipping', 'Tipping fees'], ['other', 'Other']];
var P_SECTIONS = ['Site preparation', 'Foundations and slab', 'Walls and structure', 'Roof', 'Electrical and plumbing', 'Finishes', 'External works', 'General'];
function projMgr() { return S.data.me.role === 'owner' || S.data.me.role === 'member'; }
function projects() { return S.data.projects || []; }
function projById(id) { return projects().find(function (p) { return p.id === id; }); }
function pHeadLabel(k) { var h = P_HEAD.find(function (x) { return x[0] === k; }); return h ? h[1] : 'Other'; }
function pValue(p) { return (p.contractSum || 0) + (p.variations || []).filter(function (v) { return v.status === 'Approved'; }).reduce(function (t, v) { return t + v.amount; }, 0); }
function pInvoices(p) { return (S.data.invoices || []).filter(function (i) { return i.projectId === p.id && !i.void; }); }
function pInvoiced(p) { return pInvoices(p).reduce(function (t, i) { return t + invTotal(i); }, 0); }
function pReceived(p) { return pInvoices(p).reduce(function (t, i) { return t + invPaid(i); }, 0); }
function pCost(p) { return (p.costs || []).reduce(function (t, c) { return t + c.amount; }, 0); }
function pCommitted(p) { return (p.orders || []).filter(function (o) { return o.status === 'Ordered'; }).reduce(function (t, o) { return t + o.amount; }, 0); }
function projLabour(driverId) { var t = 0, n = 0; projects().forEach(function (p) { (p.costs || []).forEach(function (c) { if (c.driverId === driverId) { t += c.amount; n += c.days || 0; } }); }); return { amount: t, days: n }; }
function poNo(o) { return 'PO-' + String(o.no).padStart(4, '0'); }
function pBudget(p) { return (p.budget || []).reduce(function (t, b) { return t + b.amount; }, 0); }
function pRetentionHeld(p) { var v = (p.valuations || []).slice(-1)[0]; return v ? Math.max(0, v.retention - (p.retentionReleases || []).reduce(function (t, r) { return t + r.amount; }, 0)) : 0; }
function pProgress(p) {
  var v = (p.valuations || []).slice(-1)[0]; if (v) return v.pct;
  var d = (p.diary || []).find(function (e) { return e.progress != null; }); if (d) return d.progress;
  var st = p.stages || [], done = st.filter(function (s) { return s.invoiceId; }).reduce(function (t, s) { return t + s.pct; }, 0);
  return st.length ? done : (p.status === 'Handed over' || p.status === 'Defects period' || p.status === 'Closed' ? 100 : 0);
}
/** Forecast margin: the larger of the budget and the cost so far, against the contract value. */
function pForecast(p) {
  var val = pValue(p), b = pBudget(p), done = ['Handed over', 'Defects period', 'Closed'].indexOf(p.status) >= 0;
  if (!b && !done) return { value: val, cost: pCost(p), profit: NaN, margin: NaN, noBudget: true };
  var cost = done ? pCost(p) : Math.max(b, pCost(p) + pCommitted(p)); return { value: val, cost: cost, profit: val - cost, margin: val ? (val - cost) / val : NaN };
}
function pStatusPill(s) { return s === 'On site' ? 'Unpaid' : s === 'Lost' ? 'Overdue' : s === 'Quoted' ? 'muted' : 'Paid'; }
function defectsEnd(p) { return p.handover && p.defectsMonths ? (function () { var d = parseIso(p.handover); d.setMonth(d.getMonth() + p.defectsMonths); return isoOf(d); })() : ''; }
S.projFilter = S.projFilter || 'live'; S.projTab = S.projTab || 'overview';

VIEWS.projects = function () {
  var all = projects(), mgr = projMgr() && !isDriver(), f = S.projFilter;
  var show = all.filter(function (p) { return f === 'all' ? true : f === 'live' ? P_LIVE.indexOf(p.status) >= 0 : f === 'quoted' ? p.status === 'Quoted' : f === 'Residential' || f === 'Commercial' ? p.sector === f && p.status !== 'Lost' : ['Closed', 'Lost'].indexOf(p.status) >= 0; })
    .sort(function (a, b) { return P_STATUS.indexOf(a.status) - P_STATUS.indexOf(b.status) || (b.start || '').localeCompare(a.start || ''); });
  var live = all.filter(function (p) { return P_LIVE.indexOf(p.status) >= 0; });
  var h = '';
  if (!isDriver()) {
    var quoted = all.filter(function (p) { return p.status === 'Quoted'; });
    var toBill = live.reduce(function (t, p) { return t + Math.max(0, pValue(p) - pInvoiced(p)); }, 0);
    h += '<div class="mgrid" style="margin-bottom:12px"><div class="mcard"><span class="ml">Work in hand</span><b>' + ec(toBill) + '</b><span class="ms">Contract value still to invoice on ' + live.length + ' live ' + (live.length === 1 ? 'project' : 'projects') + '</span></div>' +
      '<div class="mcard"><span class="ml">Quoted, not yet won</span><b>' + ec(quoted.reduce(function (t, p) { return t + pValue(p); }, 0)) + '</b><span class="ms">' + quoted.length + ' open</span></div>' +
      '<div class="mcard"><span class="ml">Owed on projects</span><b class="' + '">' + ec(live.reduce(function (t, p) { return t + pInvoiced(p) - pReceived(p); }, 0)) + '</b><span class="ms">Invoiced, not yet paid</span></div>' +
      '<div class="mcard"><span class="ml">Retention held</span><b>' + ec(all.reduce(function (t, p) { return t + pRetentionHeld(p); }, 0)) + '</b><span class="ms">Due back from clients</span></div></div>';
  }
  h += '<div class="ins-chips tabs-row" style="margin-bottom:12px">' + [['live', 'Live'], ['quoted', 'Quoted'], ['Residential', 'Residential'], ['Commercial', 'Commercial'], ['done', 'Closed and lost'], ['all', 'All']].map(function (o) { return '<button class="chip" data-pf="' + o[0] + '" aria-pressed="' + (f === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  if (mgr) h += '<div class="toolbar"><button class="btn gold" id="pNew">+ New project</button></div>';
  h += show.length ? show.map(function (p) {
    var fc = pForecast(p), inv = pInvoiced(p), prog = pProgress(p);
    return '<button class="card proj-card" data-pid="' + p.id + '" style="display:block;width:100%;text-align:left"><div class="cu-top"><b>' + esc(p.name) + '</b><span class="pill ' + pStatusPill(p.status) + '">' + esc(p.status) + '</span></div>' +
      '<div class="small muted">' + esc(p.sector) + ' · ' + esc(p.type) + (p.area ? ' · ' + esc(p.area) : '') + '</div>' +
      '<div class="meter" style="margin:10px 0 4px"><span style="width:' + Math.min(100, prog) + '%"></span></div><div class="small muted">' + Math.round(prog) + '% complete' + (p.finish ? ' · finish ' + nice(p.finish) : '') + '</div>' +
      (isDriver() ? '' : '<div class="rt-c-row" style="margin-top:8px"><div><span class="small muted">Contract</span><b>' + ec(fc.value) + '</b></div><div><span class="small muted">Invoiced</span><b>' + ec(inv) + '</b></div><div><span class="small muted">Forecast margin</span><b class="' + (fc.profit < 0 ? 'neg' : '') + '">' + pct(fc.margin) + '</b></div></div>') + '</button>';
  }).join('') : '<div class="card empty">' + (all.length ? 'No projects in this view.' : 'No projects yet. Create one here, or turn a won quote into a project from the quote.') + '</div>';
  $('view').innerHTML = h;
  qa('[data-pf]').forEach(function (b) { b.onclick = function () { S.projFilter = b.dataset.pf; render(); }; });
  qa('[data-pid]').forEach(function (b) { b.onclick = function () { S.projTab = 'overview'; go('project', b.dataset.pid); }; });
  if ($('pNew')) $('pNew').onclick = function () { projectEditor(); };
};

function projectEditor(p) {
  p = p ? JSON.parse(JSON.stringify(p)) : { sector: 'Residential', status: 'Quoted', retentionPct: 0, defectsMonths: 6, stages: [{ name: 'Deposit', pct: 30 }, { name: 'Foundations and slab', pct: 25 }, { name: 'Walls and roof', pct: 25 }, { name: 'Completion', pct: 20 }], budget: [] };
  var types = WORK_TYPES.filter(function (t) { return lineOf(t) === 'Construction' && t !== 'Other'; });
  var stRow = function (s, i) { return '<div class="cols" data-st="' + i + '"><label class="f"><span>Stage</span><input data-sn value="' + v(s.name) + '"' + (s.invoiceId ? ' disabled' : '') + '></label><label class="f"><span>% of contract</span><input data-sp inputmode="decimal" value="' + v(s.pct) + '"' + (s.invoiceId ? ' disabled' : '') + '></label></div>'; };
  var bRow = function (b, i) { return '<div class="cols" data-bg="' + i + '"><label class="f"><span>Section</span><input data-bs list="pSecL" value="' + v(b.section) + '"></label><label class="f"><span>Heading</span><select data-bh>' + P_HEAD.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === b.heading ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label><label class="f"><span>Budget (EC$)</span><input data-ba inputmode="decimal" value="' + v(b.amount) + '"></label></div>'; };
  openSheet(p.id ? 'Edit project' : 'New project',
    '<label class="f"><span>Project name</span><input id="pjN" value="' + v(p.name) + '" placeholder="e.g. Charles residence, Calliaqua"></label>' +
    '<div class="cols"><label class="f"><span>Residential or commercial</span><select id="pjS">' + opts(['Residential', 'Commercial'], p.sector) + '</select></label><label class="f"><span>Type of work</span><select id="pjT">' + opts(types, p.type || types[0]) + '</select></label></div>' +
    '<div class="cols"><label class="f"><span>Client</span><input id="pjC" list="pjCl" value="' + v(p.client) + '" autocomplete="off"></label>' + datalist('pjCl', S.data.clients.map(function (c) { return c.name; })) +
    '<label class="f"><span>Client phone</span><input id="pjP" type="tel" value="' + v(p.phone) + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Site</span><input id="pjSi" value="' + v(p.site) + '" placeholder="Lot, street or directions"></label><label class="f"><span>Area</span><input id="pjA" list="pjAr" value="' + v(p.area) + '"></label></div>' + datalist('pjAr', ROUTES) +
    '<div class="cols"><label class="f"><span>Status</span><select id="pjSt">' + opts(P_STATUS, p.status) + '</select></label><label class="f"><span>Contract sum (EC$)</span><input id="pjV" inputmode="decimal" value="' + v(p.contractSum) + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Start</span><input id="pjSd" type="date" value="' + v(p.start) + '"></label><label class="f"><span>Planned finish</span><input id="pjF" type="date" value="' + v(p.finish) + '"></label></div>' +
    '<label class="f"><span>How the client pays</span><select id="pjB"><option value="stages"' + (p.billing !== 'valuations' ? ' selected' : '') + '>Stage payments (usual for homes)</option><option value="valuations"' + (p.billing === 'valuations' ? ' selected' : '') + '>Valuations by % complete, with retention (usual for commercial)</option></select></label>' +
    '<div id="pjStages"><h3 class="rep-h">Payment stages</h3><p class="small muted" style="margin-top:0">They must add up to 100%. The last stage collects whatever is left, including approved variations.</p><div id="pjStL">' + (p.stages || []).map(stRow).join('') + '</div><button class="btn quiet" id="pjStAdd" type="button">+ Add a stage</button></div>' +
    '<div id="pjRet" class="cols"><label class="f"><span>Retention %</span><input id="pjR" inputmode="decimal" value="' + v(p.retentionPct) + '" placeholder="e.g. 5"></label><label class="f"><span>Defects period (months)</span><input id="pjDm" inputmode="numeric" value="' + v(p.defectsMonths) + '"></label></div>' +
    '<details' + ((p.budget || []).length ? ' open' : '') + '><summary class="small"><b>Budget by section and heading</b> (' + (p.budget || []).length + ')</summary><div id="pjBgL">' + (p.budget || []).map(bRow).join('') + '</div><button class="btn quiet" id="pjBgAdd" type="button">+ Add a budget line</button></details>' + datalist('pSecL', P_SECTIONS) +
    '<label class="f"><span>Notes</span><textarea id="pjNo">' + esc(p.notes || '') + '</textarea></label>' +
    (p.id && S.data.me.role === 'owner' ? '<button class="btn link" id="pjDel" style="color:var(--danger)">Delete this project</button>' : ''), 'Save');
  var sync = function () { var val = $('pjB').value === 'valuations'; $('pjStages').style.display = val ? 'none' : ''; $('pjR').closest('.f').style.display = val ? '' : 'none'; };
  $('pjB').onchange = sync; sync();
  $('pjS').onchange = function () { if ($('pjS').value === 'Commercial') { $('pjB').value = 'valuations'; if (!$('pjR').value) $('pjR').value = 5; } else $('pjB').value = 'stages'; if ($('pjS').value === 'Commercial') $('pjT').value = 'Commercial construction'; sync(); };
  $('pjStAdd').onclick = function () { $('pjStL').insertAdjacentHTML('beforeend', stRow({ name: '', pct: '' }, qa('[data-st]').length)); };
  $('pjBgAdd').onclick = function () { $('pjBgL').insertAdjacentHTML('beforeend', bRow({ section: '', heading: 'material', amount: '' }, qa('[data-bg]').length)); };
  $('pjC').oninput = function () { var c = S.data.clients.find(function (z) { return z.name.toLowerCase() === $('pjC').value.trim().toLowerCase(); }); if (c && !$('pjP').value) $('pjP').value = c.phone || ''; };
  $('sheetGo').onclick = function () {
    var val = $('pjB').value === 'valuations';
    var stages = val ? [] : qa('[data-st]').map(function (r, i) { var o = (p.stages || [])[i] || {}; return { id: o.id, invoiceId: o.invoiceId, name: r.querySelector('[data-sn]').value, pct: r.querySelector('[data-sp]').value }; }).filter(function (s) { return s.name || num(s.pct); });
    var budget = qa('[data-bg]').map(function (r, i) { var o = (p.budget || [])[i] || {}; return { id: o.id, section: r.querySelector('[data-bs]').value, heading: r.querySelector('[data-bh]').value, amount: r.querySelector('[data-ba]').value }; });
    api('saveProject', { project: { id: p.id, quoteId: p.quoteId, name: $('pjN').value, sector: $('pjS').value, type: $('pjT').value, client: $('pjC').value, phone: $('pjP').value, site: $('pjSi').value, area: $('pjA').value, status: $('pjSt').value, contractSum: $('pjV').value,
      start: $('pjSd').value, finish: $('pjF').value, handover: p.handover, billing: $('pjB').value, retentionPct: val ? $('pjR').value : 0, defectsMonths: $('pjDm').value, stages: stages, budget: budget, notes: $('pjNo').value } }, 'Saving…')
      .then(function (res) { closeSheet(); toast(p.id ? 'Project updated.' : 'Project created.'); go('project', res.result.id, !!p.id); }).catch(function () {});
  };
  if ($('pjDel')) $('pjDel').onclick = function () { if (confirm('Delete ' + p.name + '? This cannot be undone.')) api('deleteProject', { id: p.id }, 'Deleting…').then(function () { closeSheet(); go('projects'); }).catch(function () {}); };
}

VIEWS.project = function () {
  var p = projById(S.param); if (!p) { $('view').innerHTML = '<div class="card empty">Project not found.</div>'; return; }
  $('title').textContent = p.name.length > 26 ? p.name.slice(0, 25) + '…' : p.name;
  var mgr = projMgr() && !isDriver(), crew = isDriver(), ro = isViewOnly(), tab = crew && (S.projTab === 'money' || S.projTab === 'costs') ? 'site' : S.projTab;
  var fc = pForecast(p), inv = pInvoiced(p), rec = pReceived(p), cost = pCost(p), budget = pBudget(p), prog = pProgress(p), t = today();
  var h = '<div class="card cap-hero"><div class="kicker">' + esc(p.sector) + ' · ' + esc(p.type) + '</div><h2 style="margin:4px 0 2px">' + esc(p.name) + '</h2>' +
    '<div class="small" style="opacity:.85">' + esc(p.client) + (p.site ? ' · ' + esc(p.site) : '') + (p.area ? ', ' + esc(p.area) : '') + '</div>' +
    '<div class="meter" style="margin:12px 0 4px"><span style="width:' + Math.min(100, prog) + '%"></span></div><div class="small" style="opacity:.85">' + Math.round(prog) + '% complete · ' + esc(p.status) + (p.finish ? ' · planned finish ' + nice(p.finish) : '') + '</div>' +
    (crew ? '' : '<div class="mgrid" style="margin-top:12px"><div class="mcard"><span class="ml">Contract value</span><b>' + ec(fc.value) + '</b><span class="ms">' + (fc.value !== p.contractSum ? 'Includes ' + ec(fc.value - p.contractSum) + ' of variations' : 'No variations yet') + '</span></div>' +
      '<div class="mcard"><span class="ml">Invoiced</span><b>' + ec(inv) + '</b><span class="ms">' + ec(rec) + ' received</span></div>' +
      '<div class="mcard"><span class="ml">Cost so far</span><b>' + ec(cost) + '</b><span class="ms">' + (budget ? pct(cost / budget) + ' of the ' + ec(budget) + ' budget' : 'No budget set') + (pCommitted(p) ? '; ' + ec(pCommitted(p)) + ' more on order' : '') + '</span></div>' +
      '<div class="mcard"><span class="ml">Forecast margin</span><b class="' + (fc.profit < 0 ? 'neg' : '') + '">' + pct(fc.margin) + '</b><span class="ms">' + (fc.noBudget ? 'Add a budget to forecast' : ec(fc.profit) + ' profit') + '</span></div></div>') + '</div>';
  var tabs = crew ? [['site', 'Site log'], ['prog', 'Programme'], ['quality', 'Quality and safety'], ['snags', 'Snags']] : [['overview', 'Overview'], ['prog', 'Programme'], ['money', 'Billing'], ['costs', 'Costs'], ['site', 'Site log'], ['quality', 'Quality and safety'], ['snags', 'Snags']];
  if (!tabs.some(function (x) { return x[0] === tab; })) tab = tabs[0][0];
  h += '<div class="ins-chips tabs-row" style="margin:12px 0">' + tabs.map(function (o) { return '<button class="chip" data-pt="' + o[0] + '" aria-pressed="' + (tab === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>';
  if (tab === 'overview') {
    if (!ro) h += '<div class="btn-row" style="margin-bottom:12px">' + (mgr ? '<button class="btn gold" id="pjEdit">Edit project</button><button class="btn quiet" id="pjStat">Change status</button>' : '') + '<button class="btn quiet" id="pjWa">Send client an update</button></div>';
    var de = defectsEnd(p);
    h += '<div class="card"><h2>Details</h2><table><tbody>' + [['Client', esc(p.client) + (p.phone ? ' · ' + esc(p.phone) : '')], ['Site', esc([p.site, p.area].filter(Boolean).join(', ') || 'Not given')], ['Start', p.start ? nice(p.start) : 'Not set'], ['Planned finish', p.finish ? nice(p.finish) : 'Not set'],
      ['Handover', p.handover ? nice(p.handover) : 'Not yet'], ['Defects period', p.defectsMonths ? p.defectsMonths + ' months' + (de ? ', ends ' + nice(de) : '') : 'None'], ['Billing', p.billing === 'valuations' ? 'Valuations by % complete' + (p.retentionPct ? ', ' + p.retentionPct + '% retention' : '') : 'Stage payments']]
      .map(function (r) { return '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td></tr>'; }).join('') + '</tbody></table>' + (p.notes ? '<p class="small" style="margin:10px 0 0">' + esc(p.notes) + '</p>' : '') + '</div>';
    var last = (p.diary || [])[0];
    if (last) h += '<div class="card"><h2>Latest from site</h2><p class="small muted" style="margin:0 0 4px">' + nice(last.date) + ' · ' + esc(last.createdBy || '') + (last.weather ? ' · ' + esc(last.weather) : '') + '</p><p style="margin:0">' + esc(last.notes) + '</p>' + (last.issues ? '<p class="small neg" style="margin:6px 0 0">' + esc(last.issues) + '</p>' : '') + '</div>';
    var openSn = (p.snags || []).filter(function (s) { return !s.done; }).length;
    if (openSn) h += '<div class="alert">' + openSn + (openSn === 1 ? ' snag is' : ' snags are') + ' still open.</div>';
    h += attachmentsCard('Drawings, permits and photos', p.attachments || [], !ro);
  } else if (tab === 'money') {
    if (p.billing === 'valuations') {
      var vals = p.valuations || [], held = pRetentionHeld(p);
      h += '<div class="card"><div class="card-head"><h2 style="margin:0">Valuations</h2>' + (mgr ? '<button class="btn gold" id="pjVal">+ Valuation</button>' : '') + '</div>' +
        (vals.length ? '<div class="scroll-x"><table><thead><tr><th>No.</th><th>Date</th><th class="n">% done</th><th class="n">Gross</th><th class="n">Retention</th><th class="n">This claim</th></tr></thead><tbody>' + vals.map(function (x) {
          return '<tr><td><button class="btn link" data-inv="' + x.invoiceId + '">' + x.n + '</button></td><td>' + niceShort(x.date) + '</td><td class="n">' + x.pct + '%</td><td class="n">' + ec(x.gross) + '</td><td class="n">' + ec(x.retention) + '</td><td class="n"><b>' + ec(x.thisClaim) + '</b></td></tr>'; }).join('') + '</tbody></table></div>'
          : '<p class="small muted">Each valuation values the work done so far, holds back ' + (p.retentionPct || 0) + '% retention, takes off what was claimed before, and creates the invoice.</p>') +
        (held ? '<div class="alert" style="margin-top:10px">Retention held: <b>' + ec2(held) + '</b>' + (defectsEnd(p) ? '. The defects period ends ' + nice(defectsEnd(p)) + '.' : '.') + (mgr ? '<div class="btn-row" style="margin-top:8px"><button class="btn quiet" data-rel="half">Release half</button><button class="btn quiet" data-rel="all">Release the rest</button></div>' : '') + '</div>' : '') + '</div>';
    } else {
      h += '<div class="card"><h2>Payment stages</h2>' + ((p.stages || []).length ? '<ul class="list">' + p.stages.map(function (s) {
        var i = s.invoiceId && (S.data.invoices || []).find(function (x) { return x.id === s.invoiceId && !x.void; });
        return '<li class="row-btn" style="display:flex;justify-content:space-between;align-items:center;gap:10px"><span><span class="t">' + esc(s.name) + ' · ' + s.pct + '%</span><br><span class="m">' + (i ? 'Invoice #' + pad3(i.no) + ' · ' + invStatus(i) : 'About ' + ec(pValue(p) * s.pct / 100) + (s.due ? ' · due ' + nice(s.due) : '')) + '</span></span>' +
          (i ? '<button class="btn link" data-inv="' + i.id + '">Open</button>' : mgr ? '<button class="btn gold" data-claim="' + s.id + '">Invoice</button>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="small muted">No payment stages set. Add them under Edit project.</p>') + '</div>';
    }
    var vs = p.variations || [];
    h += '<div class="card"><div class="card-head"><h2 style="margin:0">Variations</h2>' + (mgr ? '<button class="btn quiet" id="pjVo">+ Variation</button>' : '') + '</div>' + (vs.length ? '<ul class="list">' + vs.map(function (x) {
      return '<li><button class="row-btn" data-vo="' + x.id + '"><span><span class="t">' + esc(x.ref) + ' · ' + esc(x.description) + '</span><br><span class="m">' + nice(x.date) + ' · ' + x.status + '</span></span><span class="money ' + (x.status === 'Approved' ? '' : 'muted') + '">' + ec(x.amount) + '</span></button></li>'; }).join('') + '</ul>'
      : '<p class="small muted">Changes the client asks for after the contract is agreed. Approved variations are added to the contract value and billed in later stages or valuations.</p>') + '</div>';
    var invs = pInvoices(p);
    if (invs.length) h += '<div class="card"><h2>Invoices on this project</h2><ul class="list">' + invs.map(function (i) { return '<li><button class="row-btn" data-inv="' + i.id + '"><span><span class="t">#' + pad3(i.no) + ' · ' + esc((i.lines[0] || {}).title || '') + '</span><br><span class="m">' + nice(i.issueDate) + ' · ' + invStatus(i) + '</span></span><span class="money">' + ec(invTotal(i)) + '</span></button></li>'; }).join('') + '</ul></div>';
  } else if (tab === 'costs') {
    var byH = {}; (p.budget || []).forEach(function (b) { byH[b.heading] = byH[b.heading] || { b: 0, a: 0, o: 0 }; byH[b.heading].b += b.amount; });
    (p.costs || []).forEach(function (c) { byH[c.heading] = byH[c.heading] || { b: 0, a: 0, o: 0 }; byH[c.heading].a += c.amount; });
    (p.orders || []).filter(function (o) { return o.status === 'Ordered'; }).forEach(function (o) { byH[o.heading] = byH[o.heading] || { b: 0, a: 0, o: 0 }; byH[o.heading].o = (byH[o.heading].o || 0) + o.amount; });
    var comm = pCommitted(p);
    h += (mgr ? '<div class="btn-row" style="margin-bottom:12px"><button class="btn gold" id="pjCost">+ Cost</button><button class="btn quiet" id="pjTs">Log labour</button><button class="btn quiet" id="pjPo">+ Purchase order</button></div>' : '') +
      '<div class="card"><h2>Budget against actual</h2>' +
      (Object.keys(byH).length ? '<div class="scroll-x"><table><thead><tr><th>Heading</th><th class="n">Budget</th><th class="n">Spent</th><th class="n">On order</th><th class="n">Left</th></tr></thead><tbody>' + P_HEAD.filter(function (x) { return byH[x[0]]; }).map(function (x) { var r = byH[x[0]], left = r.b - r.a - (r.o || 0);
        return '<tr><td>' + x[1] + '</td><td class="n">' + ec(r.b) + '</td><td class="n">' + ec(r.a) + '</td><td class="n">' + (r.o ? ec(r.o) : '–') + '</td><td class="n"><b class="' + (r.b && left < 0 ? 'neg' : '') + '">' + (r.b ? ec(left) : '–') + '</b></td></tr>'; }).join('') +
        '<tr><td><b>Total</b></td><td class="n"><b>' + ec(budget) + '</b></td><td class="n"><b>' + ec(cost) + '</b></td><td class="n"><b>' + (comm ? ec(comm) : '–') + '</b></td><td class="n"><b class="' + (budget && cost + comm > budget ? 'neg' : '') + '">' + (budget ? ec(budget - cost - comm) : '–') + '</b></td></tr></tbody></table></div>' : '<p class="small muted">Log materials, labour, subcontractors and equipment hire here as they are paid. They count as direct costs in every report.</p>') + '</div>';
    var subs = p.subs || [];
    h += '<div class="card"><div class="card-head"><h2 style="margin:0">Subcontractors</h2>' + (mgr ? '<button class="btn quiet" id="pjSub">+ Subcontractor</button>' : '') + '</div>' + (subs.length ? '<ul class="list">' + subs.map(function (s) { var paid = (p.costs || []).filter(function (c) { return c.subId === s.id; }).reduce(function (t, c) { return t + c.amount; }, 0);
      return '<li><button class="row-btn" data-sub="' + s.id + '"><span><span class="t">' + esc(s.name) + (s.trade ? ' · ' + esc(s.trade) : '') + '</span><br><span class="m">Agreed ' + ec(s.agreed) + ' · paid ' + ec(paid) + ' · ' + (s.agreed ? 'owed ' + ec(Math.max(0, s.agreed - paid)) : 'no agreed price') + '</span></span><span class="chev">›</span></button></li>'; }).join('') + '</ul>' : '<p class="small muted">Electricians, plumbers and other trades on a fixed price. Payments to them are logged as costs.</p>') + '</div>';
    var os = (p.orders || []).slice().sort(function (a, b) { return (a.status === 'Ordered' ? 0 : 1) - (b.status === 'Ordered' ? 0 : 1) || b.no - a.no; });
    if (os.length) h += '<div class="card"><h2>Purchase orders</h2><ul class="list">' + os.slice(0, 40).map(function (o) {
      return '<li class="row-btn" style="display:block"><div style="display:flex;justify-content:space-between;gap:10px"><span><span class="t">' + poNo(o) + ' · ' + esc(o.supplier) + '</span><br><span class="m">' + esc(o.description) + '</span><br><span class="m">' + nice(o.date) + (o.needed ? ' · needed ' + nice(o.needed) : '') + ' · ' + o.status + (o.received ? ' ' + nice(o.received) : '') + '</span></span><span class="money ' + (o.status === 'Cancelled' ? 'muted' : '') + '">' + ec(o.amount) + '</span></div>' +
        (mgr && o.status === 'Ordered' ? '<div class="btn-row" style="margin-top:6px"><button class="btn gold" data-porec="' + o.id + '">Received</button><button class="btn quiet" data-posend="' + o.id + '">Send</button><button class="btn link" data-poed="' + o.id + '">Edit</button><button class="btn link" data-pocan="' + o.id + '" style="color:var(--danger)">Cancel</button></div>' : '') + '</li>'; }).join('') + '</ul></div>';
    var cs = (p.costs || []).slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    if (cs.length) h += '<div class="card"><h2>Cost log</h2><ul class="list">' + cs.slice(0, 60).map(function (c) { var s = (p.subs || []).find(function (x) { return x.id === c.subId; });
      return '<li><button class="row-btn" data-cost="' + c.id + '"><span><span class="t">' + esc(c.description || pHeadLabel(c.heading)) + '</span><br><span class="m">' + nice(c.date) + ' · ' + pHeadLabel(c.heading) + (s ? ' · ' + esc(s.name) : c.supplier ? ' · ' + esc(c.supplier) : '') + (c.section ? ' · ' + esc(c.section) : '') + '</span></span><span class="money">' + ec(c.amount) + '</span></button></li>'; }).join('') + '</ul></div>';
  } else if (tab === 'site') {
    if (!ro) h += '<div class="toolbar"><button class="btn gold" id="pjDy">+ Today on site</button></div>';
    h += (p.diary || []).length ? p.diary.slice(0, 40).map(function (e) {
      return '<div class="card"><div class="cu-top"><b>' + nice(e.date) + '</b><span class="small muted">' + esc(e.createdBy || '') + '</span></div>' + (e.weather || e.crew ? '<div class="small muted">' + esc([e.weather, e.crew ? 'Crew: ' + e.crew : ''].filter(Boolean).join(' · ')) + '</div>' : '') +
        '<p style="margin:6px 0 0">' + esc(e.notes) + '</p>' + (e.issues ? '<p class="small neg" style="margin:6px 0 0">Problem: ' + esc(e.issues) + '</p>' : '') + diaryExtra(e) + (e.progress != null ? '<p class="small muted" style="margin:6px 0 0">Progress: ' + e.progress + '%</p>' : '') +
        (ro || (crew && e.createdBy !== S.data.me.name) ? '' : '<button class="btn link" data-dy="' + e.id + '">Edit</button>') + '</div>'; }).join('') : '<div class="card empty">No diary entries yet. A line or two each day is enough: who was on site, what got done, and any problems.</div>';
    h += attachmentsCard('Site photos', p.attachments || [], !ro);
  } else if (tab === 'prog' || tab === 'quality') {
    h += '<div id="pjExtra" data-tab="' + tab + '"></div>';
  } else {
    var sn = (p.snags || []).slice().sort(function (a, b) { return (a.done ? 1 : 0) - (b.done ? 1 : 0); });
    if (!ro) h += '<div class="toolbar"><button class="btn gold" id="pjSn">+ Snag</button></div>';
    h += sn.length ? '<div class="card"><ul class="list">' + sn.map(function (s) { return '<li class="row-btn" style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-snag="' + s.id + '"' + (s.done ? ' checked' : '') + (ro ? ' disabled' : '') + ' aria-label="Fixed"><span style="flex:1"><span class="t" style="' + (s.done ? 'text-decoration:line-through;opacity:.6' : '') + '">' + esc(s.text) + '</span><br><span class="m">' + esc(s.location || '') + (s.location ? ' · ' : '') + 'raised ' + nice(s.raised) + (s.done ? ' · fixed ' + nice(s.done) : '') + '</span></span></li>'; }).join('') + '</ul></div>'
      : '<div class="card empty">No snags. Walk the job with the client before handover and list anything that needs putting right.</div>';
  }
  $('view').innerHTML = h;
  qa('[data-pt]').forEach(function (b) { b.onclick = function () { S.projTab = b.dataset.pt; render(); }; });
  qa('[data-inv]').forEach(function (b) { b.onclick = function () { go('invoice', b.dataset.inv); }; });
  if ($('pjEdit')) $('pjEdit').onclick = function () { projectEditor(p); };
  if ($('pjStat')) $('pjStat').onclick = function () {
    openSheet('Project status', '<label class="f"><span>Status</span><select id="pjSs">' + opts(P_STATUS, p.status) + '</select></label>', 'Save');
    $('sheetGo').onclick = function () { api('setProjectStatus', { id: p.id, status: $('pjSs').value }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); };
  };
  if ($('pjWa')) $('pjWa').onclick = function () {
    var d = (p.diary || [])[0], next = (p.stages || []).find(function (s) { return !s.invoiceId; });
    var msg = 'Hello ' + p.client.split(',')[0] + ', here is an update on ' + p.name + ' from ' + S.data.settings.businessName + '.\n\nProgress: about ' + Math.round(prog) + '% complete.' + (d ? '\nLatest on site (' + nice(d.date) + '): ' + d.notes : '') + (p.finish ? '\nPlanned finish: ' + nice(p.finish) + '.' : '') + (next && !crew ? '\nNext payment stage: ' + next.name + '.' : '') + '\n\nAny questions, just reply here.';
    window.open(waLink(p.phone, msg), '_blank');
  };
  qa('[data-claim]').forEach(function (b) { b.onclick = function () {
    var s = p.stages.find(function (x) { return x.id === b.dataset.claim; }), open = p.stages.filter(function (x) { return !x.invoiceId; }), amt = open.length === 1 ? pValue(p) - pInvoiced(p) : pValue(p) * s.pct / 100;
    openSheet('Invoice ' + s.name, '<p>This creates an invoice to ' + esc(p.client) + ' for <b>' + ec2(amt) + '</b>' + (open.length === 1 ? ', the final balance of the contract value including approved variations.' : ', ' + s.pct + '% of the contract value.') + '</p><label class="f"><span>Invoice date</span><input id="pjCd" type="date" value="' + today() + '"></label>', 'Create invoice');
    $('sheetGo').onclick = function () { api('claimStage', { projectId: p.id, stageId: s.id, date: $('pjCd').value }, 'Creating…').then(function (res) { closeSheet(); toast('Invoice created.'); go('invoice', res.result.id); }).catch(function () {}); };
  }; });
  if ($('pjVal')) $('pjVal').onclick = function () {
    var last = (p.valuations || []).slice(-1)[0];
    openSheet('New valuation', '<p class="small muted" style="margin-top:0">Contract value ' + ec2(pValue(p)) + (last ? '. Last valuation ' + last.pct + '% complete.' : '.') + '</p><div class="cols"><label class="f"><span>Work complete (%)</span><input id="pjVp" inputmode="decimal" value="' + (last ? last.pct : '') + '"></label><label class="f"><span>Date</span><input id="pjVd" type="date" value="' + today() + '"></label></div><p class="small" id="pjVx"></p><label class="f"><span>Note on the invoice (optional)</span><input id="pjVn"></label>', 'Create invoice');
    var calc = function () { var g = pValue(p) * num($('pjVp').value) / 100, r = g * (p.retentionPct || 0) / 100, before = (p.valuations || []).reduce(function (t, x) { return t + x.thisClaim; }, 0);
      $('pjVx').innerHTML = 'Gross ' + ec2(g) + ' less ' + (p.retentionPct || 0) + '% retention ' + ec2(r) + ' less previously claimed ' + ec2(before) + ' = <b>' + ec2(g - r - before) + '</b> this claim.'; };
    $('pjVp').oninput = calc; calc();
    $('sheetGo').onclick = function () { api('addValuation', { projectId: p.id, pctComplete: $('pjVp').value, date: $('pjVd').value, note: $('pjVn').value }, 'Creating…').then(function (res) { closeSheet(); toast('Valuation invoiced.'); go('invoice', res.result.id); }).catch(function () {}); };
  };
  qa('[data-rel]').forEach(function (b) { b.onclick = function () { if (confirm(b.dataset.rel === 'half' ? 'Invoice half of the retention?' : 'Invoice the rest of the retention?')) api('releaseRetention', { projectId: p.id, part: b.dataset.rel }, 'Creating…').then(function (res) { toast('Retention invoice created.'); go('invoice', res.result.id); }).catch(function () {}); }; });
  var voEd = function (x) { x = x || { date: today(), status: 'Pending' };
    openSheet(x.id ? 'Variation ' + x.ref : 'New variation', '<label class="f"><span>What changed</span><input id="voD" value="' + v(x.description) + '" placeholder="e.g. Extra window in the back bedroom"></label><div class="cols"><label class="f"><span>Amount (EC$)</span><input id="voA" inputmode="decimal" value="' + v(x.amount) + '"></label><label class="f"><span>Date</span><input id="voT" type="date" value="' + v(x.date) + '"></label></div><label class="f"><span>Status</span><select id="voS">' + opts(['Pending', 'Approved', 'Rejected'], x.status) + '</select></label><p class="small muted">Get the client’s agreement in writing (WhatsApp is fine) before marking it approved.</p>', 'Save');
    $('sheetGo').onclick = function () { api('saveVariation', { projectId: p.id, variation: { id: x.id, description: $('voD').value, amount: $('voA').value, date: $('voT').value, status: $('voS').value } }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); }; };
  if ($('pjVo')) $('pjVo').onclick = function () { voEd(); };
  qa('[data-vo]').forEach(function (b) { b.onclick = function () { if (mgr) voEd(p.variations.find(function (x) { return x.id === b.dataset.vo; })); }; });
  var costEd = function (c) { c = c || { date: today(), heading: 'material' };
    openSheet(c.id ? 'Edit cost' : 'Project cost', '<div class="cols"><label class="f"><span>Amount (EC$)</span><input id="pcA" inputmode="decimal" value="' + v(c.amount) + '"></label><label class="f"><span>Date</span><input id="pcD" type="date" value="' + v(c.date) + '"></label></div>' +
      '<div class="cols"><label class="f"><span>Heading</span><select id="pcH">' + P_HEAD.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === c.heading ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label><label class="f"><span>Section</span><input id="pcS" list="pSecL2" value="' + v(c.section) + '"></label></div>' + datalist('pSecL2', P_SECTIONS) +
      '<label class="f"><span>What it was</span><input id="pcW" value="' + v(c.description) + '" placeholder="e.g. 400 blocks and 20 bags of cement"></label>' +
      '<div class="cols"><label class="f"><span>Supplier</span><input id="pcSu" value="' + v(c.supplier) + '"></label><label class="f"><span>Subcontractor payment</span><select id="pcSb"><option value="">Not a subcontractor</option>' + (p.subs || []).map(function (s) { return '<option value="' + s.id + '"' + (s.id === c.subId ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label></div>' +
      (c.id ? '<button class="btn link" id="pcDel" style="color:var(--danger)">Delete this cost</button>' : ''), 'Save');
    $('sheetGo').onclick = function () { api('saveProjectCost', { projectId: p.id, cost: { id: c.id, amount: $('pcA').value, date: $('pcD').value, heading: $('pcH').value, section: $('pcS').value, description: $('pcW').value, supplier: $('pcSu').value, subId: $('pcSb').value } }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); };
    if ($('pcDel')) $('pcDel').onclick = function () { if (confirm('Delete this cost?')) api('deleteProjectCost', { projectId: p.id, id: c.id }, 'Deleting…').then(function () { closeSheet(); render(); }).catch(function () {}); }; };
  if ($('pjCost')) $('pjCost').onclick = function () { costEd(); };
  qa('[data-cost]').forEach(function (b) { b.onclick = function () { if (mgr) costEd(p.costs.find(function (x) { return x.id === b.dataset.cost; })); }; });
  var subEd = function (s) { s = s || {};
    openSheet(s.id ? s.name : 'Subcontractor', '<label class="f"><span>Name</span><input id="sbN" value="' + v(s.name) + '"></label><div class="cols"><label class="f"><span>Trade</span><input id="sbT" value="' + v(s.trade) + '" placeholder="e.g. Electrical"></label><label class="f"><span>Phone</span><input id="sbP" type="tel" value="' + v(s.phone) + '"></label></div><label class="f"><span>Agreed price (EC$)</span><input id="sbA" inputmode="decimal" value="' + v(s.agreed) + '"></label>', 'Save');
    $('sheetGo').onclick = function () { api('saveSub', { projectId: p.id, sub: { id: s.id, name: $('sbN').value, trade: $('sbT').value, phone: $('sbP').value, agreed: $('sbA').value } }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); }; };
  if ($('pjSub')) $('pjSub').onclick = function () { subEd(); };
  qa('[data-sub]').forEach(function (b) { b.onclick = function () { if (mgr) subEd(p.subs.find(function (x) { return x.id === b.dataset.sub; })); }; });
  var dyEd = function (e) { e = e || { date: today(), crew: '' };
    openSheet(e.id ? 'Diary, ' + nice(e.date) : 'Today on site', '<div class="cols"><label class="f"><span>Date</span><input id="dyD" type="date" value="' + v(e.date) + '"></label><label class="f"><span>Weather</span><select id="dyW">' + opts(['', 'Sunny', 'Cloudy', 'Showers', 'Heavy rain', 'Windy'], e.weather || '') + '</select></label></div>' +
      '<label class="f"><span>Who was on site</span><input id="dyC" value="' + v(e.crew) + '" placeholder="e.g. Andre, Kevin and 2 labourers"></label><label class="f"><span>What got done</span><textarea id="dyN">' + esc(e.notes || '') + '</textarea></label>' +
      '<label class="f"><span>Problems or delays (optional)</span><input id="dyI" value="' + v(e.issues) + '"></label><label class="f"><span>Overall progress % (optional)</span><input id="dyP" inputmode="numeric" value="' + (e.progress == null ? '' : e.progress) + '"></label>', 'Save');
    $('sheetGo').onclick = function () { api('saveDiary', { projectId: p.id, entry: { id: e.id, date: $('dyD').value, weather: $('dyW').value, crew: $('dyC').value, notes: $('dyN').value, issues: $('dyI').value, progress: $('dyP').value } }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); }; };
  if ($('pjDy')) $('pjDy').onclick = function () { dyEd(); };
  qa('[data-dy]').forEach(function (b) { b.onclick = function () { dyEd(p.diary.find(function (x) { return x.id === b.dataset.dy; })); }; });
  if ($('pjSn')) $('pjSn').onclick = function () {
    openSheet('Snag', '<label class="f"><span>What needs putting right</span><input id="snT" placeholder="e.g. Bathroom door sticks"></label><label class="f"><span>Where</span><input id="snL" placeholder="e.g. Upstairs bathroom"></label>', 'Save');
    $('sheetGo').onclick = function () { api('saveSnag', { projectId: p.id, snag: { text: $('snT').value, location: $('snL').value } }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); };
  };
  qa('[data-snag]').forEach(function (c) { c.onchange = function () { var s = p.snags.find(function (x) { return x.id === c.dataset.snag; }); api('saveSnag', { projectId: p.id, snag: { id: s.id, text: s.text, location: s.location, done: c.checked } }).then(render).catch(function () {}); }; });
  var poEd = function (o) { o = o || { date: today(), heading: 'material' };
    openSheet(o.id ? poNo(o) : 'Purchase order', '<div class="cols"><label class="f"><span>Supplier</span><input id="poS" list="poSl" value="' + v(o.supplier) + '"></label><label class="f"><span>Supplier phone</span><input id="poP" type="tel" value="' + v(o.phone) + '"></label></div>' +
      datalist('poSl', uniq(projects().reduce(function (a, x) { return a.concat((x.orders || []).map(function (y) { return y.supplier; })).concat((x.costs || []).map(function (y) { return y.supplier; })); }, []))) +
      '<label class="f"><span>What is being ordered</span><textarea id="poD" placeholder="e.g. 600 x 6-inch blocks, 40 bags cement">' + esc(o.description || '') + '</textarea></label>' +
      '<div class="cols"><label class="f"><span>Order value (EC$)</span><input id="poA" inputmode="decimal" value="' + v(o.amount) + '"></label><label class="f"><span>Heading</span><select id="poH">' + P_HEAD.map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === o.heading ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="cols"><label class="f"><span>Order date</span><input id="poT" type="date" value="' + v(o.date) + '"></label><label class="f"><span>Needed on site by</span><input id="poN" type="date" value="' + v(o.needed) + '"></label></div>' +
      '<label class="f"><span>Section (optional)</span><input id="poX" list="pSecL3" value="' + v(o.section) + '"></label>' + datalist('pSecL3', P_SECTIONS), 'Save');
    $('sheetGo').onclick = function () { api('savePO', { projectId: p.id, order: { id: o.id, supplier: $('poS').value, phone: $('poP').value, description: $('poD').value, amount: $('poA').value, heading: $('poH').value, date: $('poT').value, needed: $('poN').value, section: $('poX').value } }, 'Saving…').then(function (res) { closeSheet(); toast(o.id ? 'Order updated.' : 'PO-' + String(res.result.no).padStart(4, '0') + ' created.'); render(); }).catch(function () {}); }; };
  if ($('pjPo')) $('pjPo').onclick = function () { poEd(); };
  qa('[data-poed]').forEach(function (b) { b.onclick = function () { poEd(p.orders.find(function (x) { return x.id === b.dataset.poed; })); }; });
  qa('[data-pocan]').forEach(function (b) { b.onclick = function () { if (confirm('Cancel this order?')) api('cancelPO', { projectId: p.id, id: b.dataset.pocan }, 'Saving…').then(render).catch(function () {}); }; });
  qa('[data-porec]').forEach(function (b) { b.onclick = function () { var o = p.orders.find(function (x) { return x.id === b.dataset.porec; });
    openSheet('Received ' + poNo(o), '<p class="small muted" style="margin-top:0">' + esc(o.supplier) + ': ' + esc(o.description) + '</p><div class="cols"><label class="f"><span>Amount charged (EC$)</span><input id="prA" inputmode="decimal" value="' + o.amount + '"></label><label class="f"><span>Date</span><input id="prD" type="date" value="' + today() + '"></label></div><p class="small muted">This adds the cost to the project. Change the amount if the supplier’s invoice differs from the order.</p>', 'Save');
    $('sheetGo').onclick = function () { api('receivePO', { projectId: p.id, id: o.id, amount: $('prA').value, date: $('prD').value }, 'Saving…').then(function () { closeSheet(); toast('Added to project costs.'); render(); }).catch(function () {}); }; }; });
  qa('[data-posend]').forEach(function (b) { b.onclick = function () { var o = p.orders.find(function (x) { return x.id === b.dataset.posend; }), st = S.data.settings;
    var msg = 'Purchase order ' + poNo(o) + ' from ' + st.businessName + '\n\n' + o.description + '\n\nOrder value: EC$' + Number(o.amount).toFixed(2) + '\nDeliver to: ' + [p.site, p.area].filter(Boolean).join(', ') + ' (' + p.name + ')' + (o.needed ? '\nNeeded by: ' + nice(o.needed) : '') + '\n\nPlease quote ' + poNo(o) + ' on your invoice. Questions: ' + (st.phone || '');
    window.open(waLink(o.phone, msg), '_blank'); }; });
  if ($('pjTs')) $('pjTs').onclick = function () {
    var ds = drivers().filter(function (d) { return d.active !== false; });
    if (!ds.length) { toast('Add your crew under Business Settings first.', true); return; }
    var lastRate = function (id) { var r = 0, dt = ''; projects().forEach(function (x) { (x.costs || []).forEach(function (c) { if (c.driverId === id && c.rate && c.date >= dt) { r = c.rate; dt = c.date; } }); }); return r || ''; };
    openSheet('Log labour', '<p class="small muted" style="margin-top:0">' + esc(p.name) + '. Each line becomes a labour cost on this project and counts towards what that person is owed under Crew & Pay.</p><label class="f"><span>Date</span><input id="tsD" type="date" value="' + today() + '"></label>' +
      ds.map(function (d) { return '<div class="cols" data-ts="' + d.id + '"><label class="f"><span>' + esc(d.name) + '</span><select data-tsd>' + [['0', 'Not on site'], ['0.5', 'Half day'], ['1', 'Full day']].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label><label class="f"><span>Day rate (EC$)</span><input data-tsr inputmode="decimal" value="' + lastRate(d.id) + '"></label></div>'; }).join(''), 'Save');
    $('sheetGo').onclick = function () { api('saveTimesheet', { projectId: p.id, date: $('tsD').value, rows: qa('[data-ts]').map(function (r) { return { driverId: r.dataset.ts, days: r.querySelector('[data-tsd]').value, rate: r.querySelector('[data-tsr]').value }; }) }, 'Saving…')
      .then(function (res) { closeSheet(); toast('Labour logged for ' + res.result.ids.length + (res.result.ids.length === 1 ? ' person.' : ' people.')); render(); }).catch(function () {}); };
  };
  bindAttachments({ kind: 'project', id: p.id }, p.attachments || []);
};

/* ---- project performance report ---- */
VIEWS.projreport = function () {
  var ps = projects().filter(function (p) { return p.status !== 'Lost' && p.status !== 'Quoted'; });
  var rows = ps.map(function (p) { var fc = pForecast(p); return { p: p, value: fc.value, inv: pInvoiced(p), rec: pReceived(p), cost: pCost(p), budget: pBudget(p), profit: fc.profit, margin: fc.margin }; });
  var sec = ['Residential', 'Commercial'].map(function (s) { var r = rows.filter(function (x) { return x.p.sector === s; }); var rf = r.filter(function (x) { return isFinite(x.profit); }), val = r.reduce(function (t, x) { return t + x.value; }, 0), pr = rf.reduce(function (t, x) { return t + x.profit; }, 0), vf = rf.reduce(function (t, x) { return t + x.value; }, 0); return { s: s, n: r.length, val: val, pr: pr, m: vf ? pr / vf : NaN }; });
  var qs = projects(), won = qs.filter(function (p) { return P_LIVE.concat(['Closed']).indexOf(p.status) >= 0; }).length, lost = qs.filter(function (p) { return p.status === 'Lost'; }).length;
  var oq = (S.data.quotes || []), qWon = oq.filter(function (q) { return q.status === 'Accepted' || q.status === 'Converted' || qs.some(function (p) { return p.quoteId === q.id; }); }).length, qLost = oq.filter(function (q) { return q.status === 'Declined' || q.status === 'Expired'; }).length;
  var h = '<div class="card"><h2>Residential and commercial</h2><div class="scroll-x"><table><thead><tr><th>Sector</th><th class="n">Projects</th><th class="n">Contract value</th><th class="n">Forecast profit</th><th class="n">Margin</th></tr></thead><tbody>' +
    sec.map(function (r) { return '<tr><td>' + r.s + '</td><td class="n">' + r.n + '</td><td class="n">' + ec(r.val) + '</td><td class="n"><b class="' + (r.pr < 0 ? 'neg' : '') + '">' + ec(r.pr) + '</b></td><td class="n">' + pct(r.m) + '</td></tr>'; }).join('') + '</tbody></table></div>' +
    '<p class="small muted" style="margin:6px 0 0">Forecast profit uses the larger of the budget and the cost so far, against the contract value including approved variations. Finished projects use actual cost. Projects with no budget are left out of the forecast.</p></div>';
  h += '<div class="card"><h2>Winning work</h2><div class="rt-c-row"><div><span class="small muted">Projects won</span><b>' + won + '</b></div><div><span class="small muted">Projects lost</span><b>' + lost + '</b></div><div><span class="small muted">Win rate</span><b>' + (won + lost ? pct(won / (won + lost)) : '–') + '</b></div></div>' +
    (qWon + qLost ? '<p class="small muted" style="margin:8px 0 0">Quotes: ' + qWon + ' won, ' + qLost + ' declined or expired.</p>' : '') + '</div>';
  h += '<div class="card"><h2>By project</h2>' + (rows.length ? '<div class="scroll-x"><table><thead><tr><th>Project</th><th class="n">Value</th><th class="n">Invoiced</th><th class="n">Cost</th><th class="n">Budget</th><th class="n">Margin</th></tr></thead><tbody>' + rows.sort(function (a, b) { return b.value - a.value; }).map(function (r) {
    return '<tr><td><button class="btn link" data-go2="' + r.p.id + '" style="text-align:left">' + esc(r.p.name) + '</button><div class="small muted">' + esc(r.p.status) + '</div></td><td class="n">' + ec(r.value) + '</td><td class="n">' + ec(r.inv) + '</td><td class="n">' + ec(r.cost) + '</td><td class="n">' + (r.budget ? ec(r.budget) : '–') + '</td><td class="n"><b class="' + (r.profit < 0 ? 'neg' : '') + '">' + pct(r.margin) + '</b></td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="small muted">No won projects yet.</p>') + '</div>';
  $('view').innerHTML = h;
  qa('[data-go2]').forEach(function (b) { b.onclick = function () { S.projTab = 'overview'; go('project', b.dataset.go2); }; });
};

/* ---- quotes become projects ---- */
var pjQuote = VIEWS.quote;
VIEWS.quote = function () {
  pjQuote();
  var q = (S.data.quotes || []).find(function (x) { return x.id === S.param; }); if (!q || !projMgr() || isDriver()) return;
  var ex = projects().find(function (p) { return p.quoteId === q.id; });
  var box = '<div class="card"><h2>Building project</h2>' + (ex ? '<p class="small muted" style="margin-top:0">This quote is the project “' + esc(ex.name) + '”.</p><button class="btn quiet" id="qPjOpen">Open the project</button>'
    : '<p class="small muted" style="margin-top:0">Won the job? Turn this quote into a project. The quote total becomes the contract sum and its estimated costs become the budget.</p><div class="btn-row"><button class="btn gold" data-qpj="Residential">Residential project</button><button class="btn quiet" data-qpj="Commercial">Commercial project</button></div>') + '</div>';
  var v0 = $('view'); var first = v0.querySelector('.card'); if (first) first.insertAdjacentHTML('afterend', box); else v0.insertAdjacentHTML('beforeend', box);
  if ($('qPjOpen')) $('qPjOpen').onclick = function () { go('project', ex.id); };
  qa('[data-qpj]').forEach(function (b) { b.onclick = function () { api('projectFromQuote', { quoteId: q.id, sector: b.dataset.qpj }, 'Creating…').then(function (res) { toast('Project created. Check the payment stages and budget.'); S.projTab = 'overview'; go('project', res.result.id); }).catch(function () {}); }; });
};

/* ---- Home: projects on site; Needs Attention: overdue stages, retention due, budget overruns ---- */
var pjDash = VIEWS.dashboard;
VIEWS.dashboard = function () {
  pjDash();
  var live = projects().filter(function (p) { return p.status === 'On site' || p.status === 'Won'; }); if (!live.length) return;
  var body = '<ul class="list">' + live.slice(0, 5).map(function (p) { var fc = pForecast(p), prog = pProgress(p);
    return '<li><button class="row-btn" data-hp="' + p.id + '"><span style="flex:1"><span class="t">' + esc(p.name) + '</span><br><span class="m">' + esc(p.sector) + ' · ' + Math.round(prog) + '% complete' + (isDriver() ? '' : ' · margin ' + pct(fc.margin)) + '</span><div class="meter" style="margin-top:6px"><span style="width:' + Math.min(100, prog) + '%"></span></div></span><span class="chev">›</span></button></li>'; }).join('') + '</ul>';
  var anchor = document.querySelector('[data-sec="needs"]') || document.querySelector('.hsec');
  var html = sec('projects', 'Projects on Site', body, ['projects', 'All projects']);
  if (anchor) anchor.insertAdjacentHTML('afterend', html); else $('view').insertAdjacentHTML('afterbegin', html);
  qa('[data-hp]').forEach(function (b) { b.onclick = function () { S.projTab = 'overview'; go('project', b.dataset.hp); }; });
  bindGo();
};
var pjNeeds = needsAttention;
needsAttention = function () {
  var items = pjNeeds(), t = today();
  if (isDriver()) return items;
  projects().forEach(function (p) {
    if (P_LIVE.indexOf(p.status) < 0) return;
    var due = (p.stages || []).filter(function (s) { return !s.invoiceId && s.due && s.due <= t; });
    if (due.length) items.push(['invoice', 'warn', p.name + ': stage to invoice', due[0].name + ' was due ' + nice(due[0].due), 'project/' + p.id]);
    var de = defectsEnd(p); if (de && de <= t && pRetentionHeld(p) > 0) items.push(['money', 'warn', p.name + ': retention due', ec(pRetentionHeld(p)) + ' can be released; the defects period has ended', 'project/' + p.id]);
    var b = pBudget(p), c = pCost(p); if (b && c > b) items.push(['chart', 'danger', p.name + ': over budget', ec(c - b) + ' over the ' + ec(b) + ' budget', 'project/' + p.id]);
    var late = (p.orders || []).filter(function (o) { return o.status === 'Ordered' && o.needed && o.needed < t; });
    if (late.length) items.push(['package', 'warn', p.name + ': ' + (late.length === 1 ? 'delivery late' : late.length + ' deliveries late'), poNo(late[0]) + ', ' + late[0].supplier + ', needed ' + nice(late[0].needed), 'project/' + p.id]);
    if (p.finish && p.finish < t && p.status === 'On site') items.push(['calendar', 'warn', p.name + ': past planned finish', 'Planned for ' + nice(p.finish), 'project/' + p.id]);
  });
  return items;
};


/* ==================== Cozy Apartments ==================== */
TITLES.apts = 'Cozy Apartments'; TITLES.unit = 'Unit'; TITLES.tenancy = 'Tenancy'; TITLES.stays = 'Short Stays'; TITLES.repairs = 'Repairs'; TITLES.tenancies = 'Tenancies';
var APT_CATS = ['Long-term rent', 'Short stay', 'Deposit deduction', 'Apartments maintenance'];
function aS() { var d = S.data.aptSettings || {}; return { name: d.name || 'Cozy Apartments', landlord: d.landlord || S.data.settings.businessName, address: d.address || '', phone: d.phone || S.data.settings.phone, whatsapp: d.whatsapp || d.phone || S.data.settings.whatsapp, email: d.email || S.data.settings.email,
  noticeDays: d.noticeDays || 30, graceDays: d.graceDays || 0, lateFee: d.lateFee || 0, depositDays: d.depositDays || 30, checkIn: d.checkIn || '14:00', checkOut: d.checkOut || '11:00', cancelDays: d.cancelDays || 0, houseRules: d.houseRules || '', extraTerms: d.extraTerms || '' }; }
function units() { return (S.data.units || []).slice().sort(function (a, b) { return a.name.localeCompare(b.name, 'en', { numeric: true }); }); }
function unitById(id) { return (S.data.units || []).find(function (u) { return u.id === id; }) || { name: 'Unit', id: id }; }
function tenancies() { return S.data.tenancies || []; }
function stays() { return S.data.stays || []; }
function repairs() { return S.data.repairs || []; }
function isCozyInv(inv) { return inv.brand === 'cozy' || (inv.lines || []).some(function (l) { return APT_CATS.indexOf(l.category) >= 0; }); }
/** Who is in a unit on a given day. */
function occupant(u, d) {
  var t = tenancies().find(function (x) { return x.unitId === u.id && ['Signed', 'Active'].indexOf(x.status) >= 0 && x.start <= d && (!x.end || x.end >= d); });
  if (t) return { kind: 'tenant', name: t.tenant.name, rec: t, until: t.end };
  var s = stays().find(function (x) { return x.unitId === u.id && x.status !== 'Cancelled' && x.checkIn <= d && x.checkOut > d; });
  if (s) return { kind: 'guest', name: s.guest.name, rec: s, until: s.checkOut };
  return null;
}
function tenancyInvoices(t) { return (S.data.invoices || []).filter(function (i) { return i.tenancyId === t.id && !i.void; }); }
function tenancyArrears(t) { return tenancyInvoices(t).filter(function (i) { return invStatus(i) === 'Overdue'; }).reduce(function (a, i) { return a + invBalance(i); }, 0); }
function monthLabel(m) { return MON_LONG[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4); }
var MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function aptMgr() { return (S.data.me.role === 'owner' || S.data.me.role === 'member') && !isDriver(); }

VIEWS.apts = function () {
  var t = today(), us = units().filter(function (u) { return u.active !== false; }), mgr = aptMgr();
  var occ = us.map(function (u) { return occupant(u, t); });
  var lets = occ.filter(function (o) { return o && o.kind === 'tenant'; }).length, guests = occ.filter(function (o) { return o && o.kind === 'guest'; }).length;
  var cozyInv = (S.data.invoices || []).filter(function (i) { return !i.void && isCozyInv(i); });
  var arrears = cozyInv.filter(function (i) { return invStatus(i) === 'Overdue'; }).reduce(function (a, i) { return a + invBalance(i); }, 0);
  var m = t.slice(0, 7), rentDue = cozyInv.filter(function (i) { return i.rentMonth === m; }), rentBilled = rentDue.reduce(function (a, i) { return a + invTotal(i); }, 0), rentIn = rentDue.reduce(function (a, i) { return a + invPaid(i); }, 0);
  var deposits = tenancies().filter(function (x) { return x.status !== 'Ended'; }).reduce(function (a, x) { return a + (x.depositPaid || 0); }, 0);
  var openRep = repairs().filter(function (r) { return r.status !== 'Done'; });
  var soon = addDays(t, 7), arrivals = stays().filter(function (s) { return s.status === 'Booked' && s.checkIn >= t && s.checkIn <= soon; }), departures = stays().filter(function (s) { return s.status !== 'Cancelled' && s.status !== 'Checked out' && s.checkOut >= t && s.checkOut <= soon; });
  var h = '';
  if (!isDriver()) h += '<div class="mgrid" style="margin-bottom:12px"><div class="mcard"><span class="ml">Occupied tonight</span><b>' + (lets + guests) + ' of ' + us.length + '</b><span class="ms">' + lets + ' let · ' + guests + ' short stay · ' + (us.length - lets - guests) + ' empty</span></div>' +
    '<div class="mcard"><span class="ml">' + esc(monthLabel(m)) + ' rent</span><b>' + ec(rentIn) + '</b><span class="ms">received of ' + ec(rentBilled) + ' billed</span></div>' +
    '<div class="mcard"><span class="ml">Rent arrears</span><b class="' + (arrears ? 'neg' : '') + '">' + ec(arrears) + '</b><span class="ms">Overdue apartment invoices</span></div>' +
    '<div class="mcard"><span class="ml">Deposits held</span><b>' + ec(deposits) + '</b><span class="ms">Owed back to tenants, not income</span></div></div>';
  if (mgr) h += '<div class="btn-row" style="margin-bottom:12px"><button class="btn gold" id="apRent">Raise ' + esc(MON_LONG[+m.slice(5) - 1]) + ' rent</button><button class="btn quiet" id="apPay">Record a payment</button><button class="btn quiet" id="apTen">+ Tenancy</button><button class="btn quiet" id="apStay">+ Short stay</button></div>';
  h += '<div class="btn-row" style="margin-bottom:12px"><button class="btn quiet" data-goa="stays">Short stays (' + arrivals.length + ' arriving this week)</button><button class="btn quiet" data-goa="repairs">Repairs (' + openRep.length + ' open)</button>' + (mgr ? '<button class="btn quiet" data-goa="tenancies">Tenancies</button>' : '') + '</div>';
  if (arrivals.length || departures.length) h += '<div class="card"><h2>This week</h2><ul class="list">' + arrivals.map(function (s) { return '<li><button class="row-btn" data-stay="' + s.id + '"><span><span class="t">Arriving ' + niceShort(s.checkIn) + ' · ' + esc(unitById(s.unitId).name) + '</span><br><span class="m">' + esc(s.guest.name) + ', ' + s.nights + (s.nights === 1 ? ' night' : ' nights') + ' · ' + esc(s.source) + '</span></span><span class="chev">›</span></button></li>'; }).join('') +
    departures.map(function (s) { return '<li><button class="row-btn" data-stay="' + s.id + '"><span><span class="t">Leaving ' + niceShort(s.checkOut) + ' · ' + esc(unitById(s.unitId).name) + '</span><br><span class="m">' + esc(s.guest.name) + ' · clean and check the unit</span></span><span class="chev">›</span></button></li>'; }).join('') + '</ul></div>';
  var tiles = function (list) { return '<div class="unit-grid">' + list.map(function (u) { var o = occupant(u, t);
    return '<button class="unit-tile ' + (o ? o.kind : 'free') + '" data-unit="' + u.id + '"><b>' + esc(u.name) + '</b><span>' + (o ? esc(o.name.split(' ')[0]) + (o.until ? ' · to ' + niceShort(o.until) : '') : 'Empty') + '</span></button>'; }).join('') + '</div>'; };
  var props = buildings();
  h += props.map(function (pr) { var list = us.filter(function (u) { return unitPropId(u) === pr.id; }), occN = list.filter(function (u) { return occupant(u, t); }).length;
    return '<div class="card"><div class="card-head"><h2 style="margin:0">' + esc(pr.name) + '</h2>' + (mgr ? '<button class="btn quiet" data-addunits="' + pr.id + '">+ Units</button>' : '') + '</div>' +
      '<p class="small muted" style="margin:-4px 0 10px">' + (pr.address ? esc(pr.address.split('\n')[0]) + ' · ' : '') + list.length + (list.length === 1 ? ' unit' : ' units') + (list.length ? ' · ' + occN + ' occupied tonight' : '') + (mgr ? ' · <button class="btn link" data-editprop="' + pr.id + '" style="padding:0;min-height:0">Edit building</button>' : '') + '</p>' +
      (list.length ? tiles(list) : '<p class="small muted">No units yet. Use “+ Units” to add several at once.</p>') + '</div>'; }).join('') +
    '<p class="small muted" style="margin:0 0 12px"><span class="dot tenant"></span> Long-term tenant <span class="dot guest"></span> Short-stay guest <span class="dot free"></span> Empty tonight</p>' +
    (mgr ? '<div class="btn-row"><button class="btn quiet" id="apUnit">+ One unit</button><button class="btn quiet" id="apProp">+ Building</button></div>' : '');
  $('view').innerHTML = h;
  qa('[data-unit]').forEach(function (b) { b.onclick = function () { go('unit', b.dataset.unit); }; });
  qa('[data-stay]').forEach(function (b) { b.onclick = function () { stayEditor(stays().find(function (s) { return s.id === b.dataset.stay; })); }; });
  qa('[data-goa]').forEach(function (b) { b.onclick = function () { go(b.dataset.goa); }; });
  if ($('apUnit')) $('apUnit').onclick = function () { unitEditor(); };
  if ($('apProp')) $('apProp').onclick = function () { propertyEditor(); };
  if ($('apPay')) $('apPay').onclick = function () { paymentPicker(); };
  qa('[data-addunits]').forEach(function (b) { b.onclick = function () { bulkUnitsSheet(b.dataset.addunits); }; });
  qa('[data-editprop]').forEach(function (b) { b.onclick = function () { propertyEditor(buildings().find(function (x) { return x.id === b.dataset.editprop; })); }; });
  if ($('apTen')) $('apTen').onclick = function () { tenancyEditor(); };
  if ($('apStay')) $('apStay').onclick = function () { stayEditor(); };
  if ($('apRent')) $('apRent').onclick = function () { rentSheet(); };
};
function rentSheet() {
  var t = today(), m = t.slice(0, 7), nx = addMonths(m + '-01', 1).slice(0, 7);
  openSheet('Raise rent', '<p class="small muted" style="margin-top:0">Creates one rent invoice for every signed or active tenancy that covers the month and has not been billed for it. A tenancy starting or ending part-way through is charged by the day.</p><label class="f"><span>Month</span><select id="rsM"><option value="' + m + '">' + monthLabel(m) + '</option><option value="' + nx + '">' + monthLabel(nx) + '</option></select></label>', 'Raise rent');
  $('sheetGo').onclick = function () { api('raiseRent', { month: $('rsM').value }, 'Creating invoices…').then(function (res) { closeSheet(); var n = res.result.ids.length; toast(n ? n + (n === 1 ? ' rent invoice' : ' rent invoices') + ' created.' : 'Every tenancy is already billed for that month.'); render(); }).catch(function () {}); };
}
function unitEditor(u) {
  u = u || { use: 'Either', maxGuests: 2, furnished: true };
  openSheet(u.id ? 'Edit ' + u.name : 'Add a unit', (buildings().length > 1 ? '<label class="f"><span>Building</span><select id="unP">' + buildings().map(function (b) { return '<option value="' + b.id + '"' + (b.id === unitPropId(u) ? ' selected' : '') + '>' + esc(b.name) + '</option>'; }).join('') + '</select></label>' : '') + '<div class="cols"><label class="f"><span>Name or number</span><input id="unN" value="' + v(u.name) + '" placeholder="Unit 1"></label><label class="f"><span>Type</span><input id="unT" list="unTl" value="' + v(u.type) + '" placeholder="1-bedroom"></label></div>' + datalist('unTl', ['1-bedroom', '2-bedroom', '3-bedroom']) +
    '<div class="cols"><label class="f"><span>Bedrooms</span><input id="unB" inputmode="numeric" value="' + v(u.bedrooms) + '"></label><label class="f"><span>Most guests</span><input id="unG" inputmode="numeric" value="' + v(u.maxGuests) + '"></label></div>' +
    '<label class="f"><span>Used for</span><select id="unU">' + opts(['Either', 'Long-term', 'Short stays'], u.use) + '</select></label>' +
    '<div class="cols"><label class="f"><span>Monthly rent (EC$)</span><input id="unR" inputmode="decimal" value="' + v(u.monthlyRent) + '"></label><label class="f"><span>Nightly rate (EC$)</span><input id="unNr" inputmode="decimal" value="' + v(u.nightlyRate) + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Usual deposit (EC$)</span><input id="unD" inputmode="decimal" value="' + v(u.deposit) + '"></label><label class="check" style="align-self:end"><input type="checkbox" id="unF"' + (u.furnished !== false ? ' checked' : '') + '> Furnished</label></div>' +
    '<label class="f"><span>Notes</span><input id="unO" value="' + v(u.notes) + '"></label><label class="check"><input type="checkbox" id="unA"' + (u.active !== false ? ' checked' : '') + '> In use</label>', 'Save');
  $('sheetGo').onclick = function () { api('saveUnit', { unit: { id: u.id, propertyId: $('unP') ? $('unP').value : unitPropId(u), name: $('unN').value, type: $('unT').value, bedrooms: $('unB').value, maxGuests: $('unG').value, use: $('unU').value, monthlyRent: $('unR').value, nightlyRate: $('unNr').value, deposit: $('unD').value, furnished: $('unF').checked, notes: $('unO').value, active: $('unA').checked } }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); };
}
VIEWS.unit = function () {
  var u = (S.data.units || []).find(function (x) { return x.id === S.param; }); if (!u) { $('view').innerHTML = '<div class="card empty">Unit not found.</div>'; return; }
  $('title').textContent = u.name; var t = today(), o = occupant(u, t), mgr = aptMgr();
  var h = '<div class="card cap-hero"><div class="kicker">' + esc([u.type, u.bedrooms ? u.bedrooms + ' bed' : '', u.furnished ? 'Furnished' : 'Unfurnished'].filter(Boolean).join(' · ')) + '</div><h2 style="margin:4px 0">' + esc(u.name) + '</h2>' +
    '<div class="small" style="opacity:.85">' + (o ? (o.kind === 'tenant' ? 'Let to ' : 'Guest: ') + esc(o.name) + (o.until ? ' until ' + nice(o.until) : '') : 'Empty tonight') + '</div>' +
    (isDriver() ? '' : '<div class="rt-c-row" style="margin-top:10px"><div><span class="small" style="opacity:.8">Monthly rent</span><b>' + (u.monthlyRent ? ec(u.monthlyRent) : '–') + '</b></div><div><span class="small" style="opacity:.8">Nightly</span><b>' + (u.nightlyRate ? ec(u.nightlyRate) : '–') + '</b></div><div><span class="small" style="opacity:.8">Deposit</span><b>' + (u.deposit ? ec(u.deposit) : '–') + '</b></div></div>') + '</div>';
  if (mgr) h += '<div class="btn-row" style="margin:12px 0"><button class="btn gold" id="uTen">+ Tenancy</button><button class="btn quiet" id="uStay">+ Short stay</button><button class="btn quiet" id="uRep">Report a repair</button><button class="btn link" id="uEd">Edit unit</button></div>';
  else if (!isViewOnly()) h += '<div class="btn-row" style="margin:12px 0"><button class="btn gold" id="uRep">Report a repair</button></div>';
  var ts = tenancies().filter(function (x) { return x.unitId === u.id; }).sort(function (a, b) { return a.start < b.start ? 1 : -1; });
  if (!isDriver()) h += '<div class="card"><h2>Tenancies</h2>' + (ts.length ? '<ul class="list">' + ts.map(function (x) { return '<li><button class="row-btn" data-ten="' + x.id + '"><span><span class="t">' + esc(x.tenant.name) + '</span><br><span class="m">' + nice(x.start) + (x.end || x.endDate ? ' to ' + nice(x.endDate || x.end) : ', rolling') + ' · ' + ec(x.rent) + ' a month · ' + x.status + '</span></span><span class="chev">›</span></button></li>'; }).join('') + '</ul>' : '<p class="small muted">No tenancies yet.</p>') + '</div>';
  var ss = stays().filter(function (x) { return x.unitId === u.id && x.checkOut >= addDays(t, -60); }).sort(function (a, b) { return a.checkIn < b.checkIn ? -1 : 1; });
  h += '<div class="card"><h2>Short stays</h2>' + (ss.length ? '<ul class="list">' + ss.map(function (x) { return '<li><button class="row-btn" data-stay="' + x.id + '"><span><span class="t">' + niceShort(x.checkIn) + ' to ' + niceShort(x.checkOut) + ' · ' + esc(x.guest.name) + '</span><br><span class="m">' + x.nights + (x.nights === 1 ? ' night' : ' nights') + ' · ' + x.status + ' · ' + esc(x.source) + '</span></span><span class="chev">›</span></button></li>'; }).join('') + '</ul>' : '<p class="small muted">No stays in the last two months or coming up.</p>') + '</div>';
  var rs = repairs().filter(function (r) { return r.unitId === u.id; }).sort(function (a, b) { return a.reported < b.reported ? 1 : -1; });
  h += '<div class="card"><h2>Repairs</h2>' + (rs.length ? '<ul class="list">' + rs.slice(0, 20).map(repairRow).join('') + '</ul>' : '<p class="small muted">No repairs reported.</p>') + '</div>';
  $('view').innerHTML = h;
  if ($('uTen')) $('uTen').onclick = function () { tenancyEditor({ unitId: u.id, rent: u.monthlyRent, deposit: u.deposit, maxOccupants: u.maxGuests, start: today(), dueDay: 1 }); };
  if ($('uStay')) $('uStay').onclick = function () { stayEditor({ unitId: u.id, rate: u.nightlyRate, checkIn: today(), checkOut: addDays(today(), 2), guests: 1, source: 'Direct', status: 'Booked' }); };
  if ($('uRep')) $('uRep').onclick = function () { repairEditor({ unitId: u.id }); };
  if ($('uEd')) $('uEd').onclick = function () { unitEditor(u); };
  bindAptRows();
};
function repairRow(r) { return '<li><button class="row-btn" data-rep="' + r.id + '"><span><span class="t">' + esc(unitById(r.unitId).name) + ' · ' + esc(r.issue) + '</span><br><span class="m">' + r.priority + ' · ' + r.status + ' · reported ' + niceShort(r.reported) + (r.assigned ? ' · ' + esc(r.assigned) : '') + (r.done ? ' · fixed ' + niceShort(r.done) : '') + '</span></span><span class="pill ' + (r.status === 'Done' ? 'Paid' : r.priority === 'Urgent' ? 'Overdue' : 'Unpaid') + '">' + r.status + '</span></button></li>'; }
function bindAptRows() {
  qa('[data-ten]').forEach(function (b) { b.onclick = function () { go('tenancy', b.dataset.ten); }; });
  qa('[data-stay]').forEach(function (b) { b.onclick = function () { stayEditor(stays().find(function (s) { return s.id === b.dataset.stay; })); }; });
  qa('[data-rep]').forEach(function (b) { b.onclick = function () { repairEditor(repairs().find(function (r) { return r.id === b.dataset.rep; })); }; });
}
function tenancyEditor(t) {
  t = t ? JSON.parse(JSON.stringify(t)) : { start: today(), dueDay: 1, maxOccupants: 2 }; t.tenant = t.tenant || {};
  var us = units().filter(function (u) { return u.active !== false && u.use !== 'Short stays'; });
  if (!us.length) { toast('Add the units first.', true); return; }
  openSheet(t.id ? 'Edit tenancy' : 'New tenancy', '<label class="f"><span>Unit</span><select id="tnU">' + us.map(function (u) { return '<option value="' + u.id + '"' + (u.id === t.unitId ? ' selected' : '') + ' data-r="' + (u.monthlyRent || '') + '" data-d="' + (u.deposit || '') + '">' + esc(u.name + (u.type ? ' · ' + u.type : '')) + '</option>'; }).join('') + '</select></label>' +
    '<label class="f"><span>Tenant’s full name</span><input id="tnN" list="tnCl" value="' + v(t.tenant.name) + '" autocomplete="off"></label>' + datalist('tnCl', S.data.clients.map(function (c) { return c.name; })) +
    '<div class="cols"><label class="f"><span>Phone / WhatsApp</span><input id="tnP" type="tel" value="' + v(t.tenant.phone) + '"></label><label class="f"><span>Email</span><input id="tnE" type="email" value="' + v(t.tenant.email) + '"></label></div>' +
    '<div class="cols"><label class="f"><span>ID type</span><select id="tnIt">' + opts(['National ID', 'Passport', 'Driver’s licence'], t.tenant.idType || 'National ID') + '</select></label><label class="f"><span>ID number</span><input id="tnIn" value="' + v(t.tenant.idNumber) + '"></label></div>' +
    '<label class="f"><span>Other people living there (optional)</span><input id="tnO" value="' + v(t.tenant.occupants) + '" placeholder="Names of anyone else in the unit"></label>' +
    '<div class="cols"><label class="f"><span>Start date</span><input id="tnS" type="date" value="' + v(t.start) + '"></label><label class="f"><span>End date (blank for rolling)</span><input id="tnX" type="date" value="' + v(t.end) + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Monthly rent (EC$)</span><input id="tnR" inputmode="decimal" value="' + v(t.rent) + '"></label><label class="f"><span>Rent due on day</span><input id="tnD" inputmode="numeric" value="' + v(t.dueDay) + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Deposit (EC$)</span><input id="tnDp" inputmode="decimal" value="' + v(t.deposit) + '"></label><label class="f"><span>Most people living there</span><input id="tnM" inputmode="numeric" value="' + v(t.maxOccupants) + '"></label></div>' +
    '<label class="f"><span>Included in the rent</span><input id="tnI" value="' + v(t.included) + '" placeholder="e.g. water and internet; tenant pays electricity"></label>' +
    '<label class="check"><input type="checkbox" id="tnPt"' + (t.pets ? ' checked' : '') + '> Pets allowed</label>' +
    '<label class="f"><span>Special terms (optional)</span><textarea id="tnSp" placeholder="Anything agreed for this tenancy only">' + esc(t.special || '') + '</textarea></label>', 'Save');
  $('tnU').onchange = function () { var o = $('tnU').selectedOptions[0]; if (!$('tnR').value) $('tnR').value = o.dataset.r; if (!$('tnDp').value) $('tnDp').value = o.dataset.d; };
  $('tnN').oninput = function () { var c = S.data.clients.find(function (z) { return z.name.toLowerCase() === $('tnN').value.trim().toLowerCase(); }); if (c) { if (!$('tnP').value) $('tnP').value = c.phone || ''; if (!$('tnE').value) $('tnE').value = c.email || ''; } };
  $('sheetGo').onclick = function () {
    api('saveTenancy', { tenancy: { id: t.id, unitId: $('tnU').value, tenant: { name: $('tnN').value, phone: $('tnP').value, email: $('tnE').value, idType: $('tnIt').value, idNumber: $('tnIn').value, occupants: $('tnO').value }, start: $('tnS').value, end: $('tnX').value, rent: $('tnR').value, dueDay: $('tnD').value, deposit: $('tnDp').value, maxOccupants: $('tnM').value, included: $('tnI').value, pets: $('tnPt').checked, special: $('tnSp').value } }, 'Saving…')
      .then(function (res) { closeSheet(); go('tenancy', res.result.id, !!t.id); }).catch(function () {});
  };
}
VIEWS.tenancies = function () {
  var ts = tenancies().slice().sort(function (a, b) { return (a.status === 'Ended' ? 1 : 0) - (b.status === 'Ended' ? 1 : 0) || unitById(a.unitId).name.localeCompare(unitById(b.unitId).name, 'en', { numeric: true }); });
  $('view').innerHTML = (aptMgr() ? '<div class="toolbar"><button class="btn gold" id="tsNew">+ Tenancy</button></div>' : '') + (ts.length ? '<div class="card flush"><ul class="list">' + ts.map(function (x) { var ar = tenancyArrears(x);
    return '<li><button class="row-btn" data-ten="' + x.id + '"><span><span class="t">' + esc(unitById(x.unitId).name) + ' · ' + esc(x.tenant.name) + '</span><br><span class="m">' + ec(x.rent) + ' a month · ' + x.status + (ar ? ' · <b class="neg">' + ec(ar) + ' overdue</b>' : '') + '</span></span><span class="chev">›</span></button></li>'; }).join('') + '</ul></div>' : '<div class="card empty">No tenancies yet.</div>');
  if ($('tsNew')) $('tsNew').onclick = function () { tenancyEditor(); };
  bindAptRows();
};
VIEWS.tenancy = function () {
  var t = tenancies().find(function (x) { return x.id === S.param; }); if (!t) { $('view').innerHTML = '<div class="card empty">Tenancy not found.</div>'; return; }
  var u = unitById(t.unitId), mgr = aptMgr(), invs = tenancyInvoices(t).sort(function (a, b) { return a.issueDate < b.issueDate ? 1 : -1; }), ar = tenancyArrears(t), owed = invs.reduce(function (a, i) { return a + invBalance(i); }, 0);
  $('title').textContent = u.name + ' tenancy';
  var signedT = t.signedTenant && t.signedTenant.at, signedL = t.signedLandlord && t.signedLandlord.at;
  var h = '<div class="card cap-hero"><div class="kicker">' + esc(u.name) + ' · ' + t.status + '</div><h2 style="margin:4px 0">' + esc(t.tenant.name) + '</h2><div class="small" style="opacity:.85">' + nice(t.start) + (t.end ? ' to ' + nice(t.end) : ', rolling month to month') + (t.endDate ? ' · ended ' + nice(t.endDate) : '') + '</div>' +
    '<div class="rt-c-row" style="margin-top:10px"><div><span class="small" style="opacity:.8">Rent</span><b>' + ec(t.rent) + '</b></div><div><span class="small" style="opacity:.8">Owed now</span><b class="' + (ar ? 'neg' : '') + '">' + ec(owed) + '</b></div><div><span class="small" style="opacity:.8">Deposit held</span><b>' + ec(t.status === 'Ended' ? 0 : t.depositPaid || 0) + '</b></div></div></div>';
  h += '<div class="card"><h2>Tenancy agreement</h2><p class="small muted" style="margin-top:0">' + (signedT && signedL ? 'Signed by both on ' + nice(t.signedTenant.at.slice(0, 10)) + '. The signed wording is fixed and cannot change.' : signedT || signedL ? 'Signed by ' + (signedT ? 'the tenant' : 'the landlord') + '. Waiting for the other signature.' : 'Not signed yet. Check the wording with the tenant, then both sign on this phone, or print it and sign on paper.') + '</p>' +
    '<div class="btn-row"><button class="btn gold" id="agPdf">View / share PDF</button>' + (mgr && !signedT ? '<button class="btn quiet" data-sign="tenant">Tenant signs</button>' : '') + (mgr && !signedL ? '<button class="btn quiet" data-sign="landlord">Landlord signs</button>' : '') + '<button class="btn quiet" id="agWa">WhatsApp</button></div></div>';
  if (mgr) {
    h += '<div class="btn-row" style="margin:12px 0">' + (t.status !== 'Ended' && !(signedT || signedL) ? '<button class="btn quiet" id="tnEd">Edit terms</button>' : '') + (t.status === 'Signed' ? '<button class="btn quiet" id="tnAct">Mark active (moved in)</button>' : '') +
      (t.status !== 'Ended' ? '<button class="btn gold" id="tnPay">Record a payment</button>' : '') + (t.status !== 'Ended' && (t.depositPaid || 0) < t.deposit ? '<button class="btn quiet" id="tnDep">Deposit received</button>' : '') + (t.status !== 'Ended' ? '<button class="btn link" id="tnEnd" style="color:var(--danger)">End tenancy</button>' : '') + '</div>';
  }
  h += '<div class="card"><h2>Details</h2><table><tbody>' + [['Phone', esc(t.tenant.phone || '–')], ['Email', esc(t.tenant.email || '–')], ['ID', esc([t.tenant.idType, t.tenant.idNumber].filter(Boolean).join(' ') || '–')], ['Also living there', esc(t.tenant.occupants || '–')], ['Rent due', 'Day ' + t.dueDay + ' of each month'], ['Included', esc(t.included || 'Nothing listed')], ['Deposit', ec(t.deposit) + (t.depositPaid ? ', ' + ec(t.depositPaid) + ' received' : ', not yet received')], ['Pets', t.pets ? 'Allowed' : 'Not without written consent']]
    .map(function (r) { return '<tr><td>' + r[0] + '</td><td class="n">' + r[1] + '</td></tr>'; }).join('') + '</tbody></table>' + (t.depositReturned ? '<p class="small" style="margin:8px 0 0">Deposit settled ' + nice(t.depositReturned.date) + ': ' + ec(t.depositReturned.amount) + ' returned, ' + ec(t.depositReturned.deducted) + ' kept' + (t.depositReturned.note ? ' (' + esc(t.depositReturned.note) + ')' : '') + '.</p>' : '') + '</div>';
  if ((t.credit || 0) > 0.009) h += '<div class="alert">' + ec2(t.credit) + ' paid in advance is held as credit. It is used automatically when the next rent is raised.</div>';
  if ((t.payLog || []).length) h += '<div class="card"><h2>Payments received</h2><ul class="list">' + t.payLog.slice().reverse().slice(0, 12).map(function (x) { return '<li class="row-btn" style="display:flex;justify-content:space-between;gap:8px"><span><span class="t">' + nice(x.date) + ' · ' + esc(x.method) + '</span><br><span class="m">' + (x.reference ? esc(x.reference) + ' · ' : '') + 'recorded by ' + esc(x.by) + (x.credit ? ' · ' + ec2(x.credit) + ' held as credit' : '') + '</span></span><span class="money">' + ec2(x.amount) + '</span></li>'; }).join('') + '</ul></div>';
  h += '<div class="card"><h2>Rent</h2>' + (invs.length ? '<ul class="list">' + invs.map(function (i) { return '<li><button class="row-btn" data-inv="' + i.id + '"><span><span class="t">' + esc((i.lines[0] || {}).title || 'Invoice') + '</span><br><span class="m">#' + pad3(i.no) + ' · due ' + niceShort(i.dueDate) + ' · ' + invStatus(i) + '</span></span><span class="money ' + (invStatus(i) === 'Overdue' ? 'neg' : '') + '">' + ec(invTotal(i)) + '</span></button></li>'; }).join('') + '</ul>' : '<p class="small muted">No rent invoiced yet. Use “Raise rent” on the Cozy Apartments screen each month.</p>') + '</div>';
  $('view').innerHTML = h;
  qa('[data-inv]').forEach(function (b) { b.onclick = function () { go('invoice', b.dataset.inv); }; });
  $('agPdf').onclick = function () { agreementPdf(t).then(function (r) { shareDoc(r.blob, r.name, 'Tenancy agreement for ' + u.name); }).catch(function () {}); };
  $('agWa').onclick = function () { var a = aS(); window.open(waLink(t.tenant.phone, 'Hello ' + t.tenant.name.split(' ')[0] + ', here is your tenancy agreement for ' + u.name + ' at ' + a.name + '. Rent is EC$' + F2.format(t.rent) + ' a month, due on day ' + t.dueDay + '. Please read it and let us know if anything needs changing before you sign.'), '_blank'); toast('Attach the PDF from “View / share PDF”.'); };
  qa('[data-sign]').forEach(function (b) { b.onclick = function () { signSheet(t, b.dataset.sign); }; });
  if ($('tnEd')) $('tnEd').onclick = function () { tenancyEditor(t); };
  if ($('tnPay')) $('tnPay').onclick = function () { tenantPaySheet(t); };
  if ($('tnAct')) $('tnAct').onclick = function () { api('setTenancyStatus', { id: t.id, status: 'Active' }, 'Saving…').then(render).catch(function () {}); };
  if ($('tnDep')) $('tnDep').onclick = function () {
    openSheet('Deposit received', '<div class="cols"><label class="f"><span>Amount (EC$)</span><input id="dpA" inputmode="decimal" value="' + Math.max(0, t.deposit - (t.depositPaid || 0)) + '"></label><label class="f"><span>Date</span><input id="dpD" type="date" value="' + today() + '"></label></div><label class="f"><span>Method</span><select id="dpM">' + opts(['Bank transfer', 'Cash', 'Cheque'], 'Bank transfer') + '</select></label><p class="small muted">A deposit is held for the tenant. It is not income and does not appear in the profit figures.</p>', 'Save');
    $('sheetGo').onclick = function () { api('recordDeposit', { id: t.id, amount: $('dpA').value, date: $('dpD').value, method: $('dpM').value }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); };
  };
  if ($('tnEnd')) $('tnEnd').onclick = function () {
    openSheet('End tenancy', '<label class="f"><span>Last day of the tenancy</span><input id="teD" type="date" value="' + today() + '"></label><p class="small muted">Deposit held: ' + ec2(t.depositPaid || 0) + '. Inspect the unit with the tenant before deciding any deductions.</p>' +
      '<label class="f"><span>Kept from the deposit (EC$)</span><input id="teK" inputmode="decimal" value="0"></label><label class="f"><span>Reason for any deduction</span><input id="teN" placeholder="e.g. broken window, unpaid water bill"></label><label class="f"><span>Balance returned by</span><select id="teM">' + opts(['Bank transfer', 'Cash', 'Cheque'], 'Bank transfer') + '</select></label>', 'End tenancy');
    $('sheetGo').onclick = function () { api('endTenancy', { id: t.id, endDate: $('teD').value, deductions: $('teK').value, note: $('teN').value, method: $('teM').value }, 'Saving…').then(function () { closeSheet(); toast('Tenancy ended.'); render(); }).catch(function () {}); };
  };
};
function shareDoc(blob, name, title) {
  var file = null; try { file = new File([blob], name, { type: 'application/pdf' }); } catch (e) {}
  if (file && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: title }).catch(function () {}); return; }
  var url = URL.createObjectURL(blob), w = window.open(url, '_blank');
  if (!w) { var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); }
  setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
}
/* ---- the agreement wording ---- */
function agreementSections(t) {
  var a = aS(), u = unitById(t.unitId), fmt = function (n) { return 'EC$' + F2.format(Number(n || 0)); }, ord = function (n) { return n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)] || 'th'); };
  var landlord = a.landlord + (a.landlord !== a.name ? ', trading as ' + a.name : '');
  var prop = buildings().find(function (b) { return b.id === unitPropId(u); }) || {}, where = prop.address || a.address;
  var bank = 'in one of the ways set out in section 4A,';
  var term = t.end ? 'The tenancy starts on ' + longDate(t.start) + ' and ends on ' + longDate(t.end) + ' (the fixed term). If neither party has given notice and the Tenant stays on with the Landlord’s agreement after that date, the tenancy continues from month to month on the same terms until ended under section 12.' : 'The tenancy starts on ' + longDate(t.start) + ' and continues from month to month until ended under section 12.';
  var S2 = [
    ['1. The parties', ['This agreement is between ' + landlord + ', of ' + (a.address || '[landlord’s address]') + ' (the Landlord), and ' + t.tenant.name + (t.tenant.idNumber ? ', ' + (t.tenant.idType || 'ID') + ' number ' + t.tenant.idNumber : '') + ' (the Tenant).' + (t.tenant.occupants ? ' The following people may also live at the property with the Tenant: ' + t.tenant.occupants + '.' : '')]],
    ['2. The property', [u.name + (u.type ? ', a ' + u.type.toLowerCase() + ' apartment' : '') + ' at ' + (prop.name && prop.name !== a.name ? prop.name + ', ' : '') + (where || a.name) + ' (the Property), ' + (u.furnished === false ? 'unfurnished' : 'furnished') + ', together with shared areas such as paths, stairs and parking that the Landlord makes available to all tenants. The furniture, appliances and fittings are listed in the check-in inventory, which forms part of this agreement.']],
    ['3. Length of the tenancy', [term]],
    ['4. Rent', ['The rent is ' + fmt(t.rent) + ' a month, payable in advance on the ' + ord(t.dueDay) + ' day of each month, ' + bank + ' The first payment, covering the period to the next rent day, is due before the Tenant receives the keys. The Landlord will give a receipt for every payment.' +
      (a.lateFee ? ' If rent is more than ' + (a.graceDays || 0) + ' days late, a late payment charge of ' + fmt(a.lateFee) + ' is added for that month.' : ''), 'The Landlord may review the rent once a year, giving the Tenant at least ' + a.noticeDays + ' days’ written notice before any increase takes effect. Rent cannot be increased during a fixed term.']],
    ['4A. How to pay', payWays('Unit ' + u.name.replace(/^unit\s*/i, ''))],
    ['5. Deposit', ['The Tenant pays a deposit of ' + fmt(t.deposit) + ' before moving in. The Landlord holds it as security for the Tenant’s obligations; it is not rent and the Tenant may not use it as the last month’s rent without the Landlord’s written agreement.', 'Within ' + a.depositDays + ' days after the tenancy ends and the keys are returned, the Landlord will return the deposit, less only reasonable deductions for unpaid rent or bills, damage beyond fair wear and tear, cleaning needed to return the Property to the condition recorded at check-in, and missing items. The Landlord will give the Tenant a written list of any deductions.']],
    ['6. Bills and utilities', [(t.included ? 'Included in the rent: ' + t.included + '. ' : '') + 'Unless included above, the Tenant pays for electricity, water, telephone, internet and any other services used at the Property during the tenancy, and must not leave any bill unpaid when the tenancy ends.']],
    ['7. Using the property', ['The Tenant will use the Property as a private home only, for no more than ' + t.maxOccupants + (t.maxOccupants === 1 ? ' person' : ' people') + ' in total, and will not run a business from it, sub-let it, take in lodgers, list it for short stays or hand it to anyone else without the Landlord’s written consent.', t.pets ? 'Pets are allowed. The Tenant is responsible for any damage, mess or nuisance they cause.' : 'No pets may be kept at the Property without the Landlord’s written consent.', 'The Tenant will be considerate to neighbours, keep noise down between 10pm and 7am, not smoke inside the Property, keep shared areas clear, and put rubbish out only in the places provided.']],
    ['8. Looking after the property', ['The Tenant will keep the Property clean and in good order, take reasonable care of the furniture and fittings, and report any damage, leak or fault to the Landlord promptly so that it can be repaired before it gets worse. The Tenant will pay for repairing damage caused by the Tenant, the people living with the Tenant or their visitors, other than fair wear and tear.', 'The Tenant will not make alterations, paint, change locks or fix anything to the walls without the Landlord’s written consent, and will not keep anything dangerous, flammable or illegal at the Property.', 'The Tenant will lock up when the Property is empty. Lost keys and access cards will be replaced at the Tenant’s cost.']],
    ['9. The Landlord’s responsibilities', ['The Landlord will let the Tenant live in the Property without interference, keep the structure and exterior (including the roof, walls, windows and drains) in repair, keep the water, sanitation and electrical installations in working order, and carry out repairs reported by the Tenant within a reasonable time, starting promptly on anything urgent or unsafe.', 'The Landlord insures the building. The Tenant is responsible for insuring the Tenant’s own belongings.']],
    ['10. Access', ['The Landlord, or someone acting for the Landlord, may enter the Property at reasonable times to inspect it, carry out repairs or show it to a future tenant, after giving the Tenant at least 24 hours’ notice. In an emergency, such as a fire, flood or burst pipe, the Landlord may enter at any time without notice.']],
    ['11. If things go wrong', ['If rent is unpaid for more than 30 days, or the Tenant seriously or repeatedly breaks this agreement, the Landlord may give the Tenant written notice to put it right or to leave, and may end the tenancy as the law of St Vincent and the Grenadines allows. Nothing in this agreement removes any protection the law gives the Tenant.']],
    ['12. Ending the tenancy', [t.end ? 'Neither party may end the tenancy before the end of the fixed term unless both agree in writing, or as section 11 allows. After the fixed term, either party may end the tenancy by giving at least ' + a.noticeDays + ' days’ written notice.' : 'Either party may end the tenancy by giving the other at least ' + a.noticeDays + ' days’ written notice.', 'When the tenancy ends, the Tenant will leave the Property clean and in the same condition as at the start (apart from fair wear and tear), remove all belongings and rubbish, and return all keys. The Landlord and the Tenant will inspect the Property together against the check-in inventory.']],
    ['13. Notices', ['Notices under this agreement must be in writing. They may be handed over, sent to the addresses above, or sent by email or WhatsApp to ' + (a.email || a.phone) + ' for the Landlord and ' + (t.tenant.email || t.tenant.phone || 'the Tenant’s contact details above') + ' for the Tenant.']],
    ['14. General', ['This agreement, the check-in inventory and any house rules given to the Tenant in writing make up the whole agreement. Any change must be in writing and signed by both parties. If any part of this agreement is found to be unenforceable, the rest still applies. This agreement is governed by the law of St Vincent and the Grenadines.']]
  ];
  if (t.special || a.extraTerms) S2.push(['15. Special terms', [t.special, a.extraTerms].filter(Boolean)]);
  return S2;
}
function agreementPlain(t) { return agreementSections(t).map(function (s) { return s[0] + '\n' + s[1].join('\n'); }).join('\n\n'); }
/** Builds the agreement PDF in the Cozy Apartments style. Signed agreements use the frozen wording. */
function agreementPdf(t) {
  if (!window.jspdf) { toast('The PDF tool is still loading. Try again in a moment.', true); return Promise.reject(new Error('jspdf')); }
  var a = aS(), u = unitById(t.unitId), doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' }), W = 595.28, H = 841.89, M = 54;
  var clean = function (s) { return String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x00-\xFF]/g, ''); };
  var TEAL = [1, 45, 35], SAND = [212, 169, 75], INK = [30, 36, 40], MUTED = [110, 118, 124];
  var LX = COZY_LOGO ? M + 80 : M;
  var head = function () { doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]); doc.rect(0, 0, W, 86, 'F'); doc.setFillColor(SAND[0], SAND[1], SAND[2]); doc.rect(0, 86, W, 4, 'F'); if (COZY_LOGO) doc.addImage(COZY_LOGO, 'PNG', M, 8, 70, 70);
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(COZY_LOGO ? 16 : 20); doc.text(clean(a.name.toUpperCase()), LX, 44); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(222, 232, 230); doc.text(clean([a.phone, a.email].filter(Boolean).join('  |  ')), LX, 62);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(SAND[0], SAND[1], SAND[2]); doc.text('RESIDENTIAL TENANCY AGREEMENT', W - M, 44, { align: 'right' }); doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(222, 232, 230); doc.text(clean(u.name + '  |  ' + t.tenant.name), W - M, 62, { align: 'right' }); };
  var y = 120, page = 1;
  var foot = function () { doc.setFontSize(8); doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]); doc.text(clean(a.name + ' | Tenancy agreement, ' + u.name), M, H - 28); doc.text('Page ' + page, W - M, H - 28, { align: 'right' }); };
  var need = function (h) { if (y + h > H - 60) { foot(); doc.addPage(); page++; head(); y = 120; doc.setFont('helvetica', 'normal'); doc.setFontSize(9.8); doc.setTextColor(INK[0], INK[1], INK[2]); } };
  head();
  var sections = t.agreementText ? t.agreementText.split('\n\n').map(function (b) { var ls = b.split('\n'); return [ls[0], ls.slice(1)]; }) : agreementSections(t);
  var summary = [['Unit', u.name], ['Tenant', t.tenant.name], ['Start', longDate(t.start)], ['End', t.end ? longDate(t.end) : 'Rolling, month to month'], ['Rent', 'EC$' + F2.format(t.rent) + ' a month, due day ' + t.dueDay], ['Deposit', 'EC$' + F2.format(t.deposit)]];
  doc.setFillColor(244, 241, 235); doc.rect(M, y - 14, W - 2 * M, 20 + summary.length * 15, 'F');
  summary.forEach(function (r, i) { doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(INK[0], INK[1], INK[2]); doc.text(r[0], M + 12, y + 4 + i * 15); doc.setFont('helvetica', 'normal'); doc.text(clean(r[1]), M + 90, y + 4 + i * 15); });
  y += 20 + summary.length * 15 + 12;
  sections.forEach(function (s) {
    need(40); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]); doc.text(clean(s[0]), M, y); y += 16;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.8); doc.setTextColor(INK[0], INK[1], INK[2]);
    s[1].forEach(function (p) { doc.splitTextToSize(clean(p), W - 2 * M).forEach(function (ln) { need(14); doc.text(ln, M, y); y += 13.5; }); y += 5; });
    y += 4;
  });
  need(170); y += 6; doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]); doc.text('Signatures', M, y); y += 14;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]); doc.text('By signing, both parties agree to the terms above.', M, y); y += 18;
  var col = function (x, label, sig, nameDefault) {
    doc.setDrawColor(150, 150, 150); doc.line(x, y + 60, x + 210, y + 60);
    if (sig && sig.image) try { doc.addImage(sig.image, 'PNG', x, y, 180, 54); } catch (e) {}
    doc.setFontSize(9); doc.setTextColor(INK[0], INK[1], INK[2]); doc.text(clean(label), x, y + 74); doc.text(clean('Name: ' + (sig ? sig.name : nameDefault)), x, y + 88); doc.text(sig ? 'Signed: ' + longDate(sig.at.slice(0, 10)) : 'Date: ____________________', x, y + 102);
  };
  col(M, 'Tenant', t.signedTenant, t.tenant.name); col(W / 2 + 10, 'For and on behalf of the Landlord', t.signedLandlord, '');
  y += 120; need(60); doc.setFontSize(9); doc.setTextColor(INK[0], INK[1], INK[2]); doc.text('Witness: ______________________________   Name: ______________________________', M, y + 20);
  foot();
  var name = 'Tenancy-agreement-' + safeName(u.name) + '-' + safeName(t.tenant.name) + '.pdf';
  return Promise.resolve({ blob: doc.output('blob'), name: name });
}
function signSheet(t, who) {
  openSheet(who === 'tenant' ? 'Tenant signature' : 'Landlord signature', '<p class="small muted" style="margin-top:0">' + (who === 'tenant' ? esc(t.tenant.name) + ' signs below with a finger. Make sure they have read the agreement first.' : 'Sign for ' + esc(aS().landlord) + '.') + '</p>' +
    (who === 'landlord' ? '<label class="f"><span>Signing as</span><input id="sgN" value="' + v(S.data.me.name) + '"></label>' : '') +
    '<canvas id="sgC" width="600" height="200" style="width:100%;height:160px;border:1px dashed var(--line,#bbb);border-radius:10px;background:#fff;touch-action:none"></canvas><button class="btn link" id="sgClr" type="button">Clear</button>', 'Save signature');
  var c = $('sgC'), ctx = c.getContext('2d'), drawn = false, last = null;
  ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.strokeStyle = '#111';
  var pos = function (e) { var r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; };
  c.onpointerdown = function (e) { c.setPointerCapture(e.pointerId); last = pos(e); };
  c.onpointermove = function (e) { if (!last) return; var p = pos(e); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; drawn = true; };
  c.onpointerup = c.onpointercancel = function () { last = null; };
  $('sgClr').onclick = function () { ctx.clearRect(0, 0, c.width, c.height); drawn = false; };
  $('sheetGo').onclick = function () {
    if (!drawn) { toast('Sign in the box first.', true); return; }
    api('signTenancy', { id: t.id, who: who, signer: who === 'landlord' ? $('sgN').value : t.tenant.name, image: c.toDataURL('image/png'), text: agreementPlain(t) }, 'Saving…').then(function () { closeSheet(); toast('Signature saved.'); render(); }).catch(function () {});
  };
}
/* ---- short stays ---- */
VIEWS.stays = function () {
  var t = today(), mgr = aptMgr(), us = units().filter(function (u) { return u.active !== false && u.use !== 'Long-term'; });
  var days = []; for (var i = 0; i < 14; i++) days.push(addDays(t, i));
  var h = mgr ? '<div class="toolbar"><button class="btn gold" id="syNew">+ Short stay</button></div>' : '';
  h += '<div class="card"><h2>Next two weeks</h2><div class="scroll-x"><table class="occ"><thead><tr><th></th>' + days.map(function (d) { return '<th>' + +d.slice(8) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    us.map(function (u) { return '<tr><td><button class="btn link" data-unit="' + u.id + '">' + esc(u.name) + '</button></td>' + days.map(function (d) { var o = occupant(u, d); return '<td class="' + (o ? o.kind : '') + '" title="' + esc(o ? o.name : 'Free') + '"></td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>' +
    '<p class="small muted" style="margin:8px 0 0"><span class="dot guest"></span> Short-stay guest <span class="dot tenant"></span> Long-term tenant</p></div>';
  var list = stays().filter(function (s) { return s.status !== 'Cancelled' && s.checkOut >= t; }).sort(function (a, b) { return a.checkIn < b.checkIn ? -1 : 1; });
  h += '<div class="card"><h2>Current and coming up</h2>' + (list.length ? '<ul class="list">' + list.map(function (s) { var inv = s.invoiceId && (S.data.invoices || []).find(function (i) { return i.id === s.invoiceId && !i.void; });
    return '<li><button class="row-btn" data-stay="' + s.id + '"><span><span class="t">' + esc(unitById(s.unitId).name) + ' · ' + esc(s.guest.name) + '</span><br><span class="m">' + niceShort(s.checkIn) + ' to ' + niceShort(s.checkOut) + ' · ' + s.nights + (s.nights === 1 ? ' night' : ' nights') + ' · ' + s.status + ' · ' + esc(s.source) + (isDriver() ? '' : ' · ' + (inv ? invStatus(inv) : 'not invoiced')) + '</span></span><span class="chev">›</span></button></li>'; }).join('') + '</ul>' : '<p class="small muted">No stays booked.</p>') + '</div>';
  $('view').innerHTML = h;
  qa('[data-unit]').forEach(function (b) { b.onclick = function () { go('unit', b.dataset.unit); }; });
  if ($('syNew')) $('syNew').onclick = function () { stayEditor(); };
  bindAptRows();
};
function stayEditor(s) {
  var mgr = aptMgr(); s = s ? JSON.parse(JSON.stringify(s)) : { checkIn: today(), checkOut: addDays(today(), 2), guests: 1, source: 'Direct', status: 'Booked' }; s.guest = s.guest || {};
  var us = units().filter(function (u) { return u.active !== false && u.use !== 'Long-term'; });
  if (!us.length) { toast('Add the units first.', true); return; }
  var inv = s.invoiceId && (S.data.invoices || []).find(function (i) { return i.id === s.invoiceId && !i.void; });
  if (!mgr) {
    openSheet(unitById(s.unitId).name + ' · ' + s.guest.name, '<p>' + nice(s.checkIn) + ' to ' + nice(s.checkOut) + ' · ' + s.guests + (s.guests === 1 ? ' guest' : ' guests') + '</p>' + (s.notes ? '<p class="small">' + esc(s.notes) + '</p>' : '') + '<label class="f"><span>Status</span><select id="syS">' + opts(['Booked', 'Checked in', 'Checked out'], s.status) + '</select></label>', 'Save');
    $('sheetGo').onclick = function () { api('setStayStatus', { id: s.id, status: $('syS').value }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); }; return;
  }
  openSheet(s.id ? 'Stay, ' + s.guest.name : 'New short stay', '<label class="f"><span>Unit</span><select id="syU">' + us.map(function (u) { return '<option value="' + u.id + '" data-r="' + (u.nightlyRate || '') + '"' + (u.id === s.unitId ? ' selected' : '') + '>' + esc(u.name + (u.type ? ' · ' + u.type : '')) + '</option>'; }).join('') + '</select></label>' +
    '<div class="cols"><label class="f"><span>Check-in</span><input id="syI" type="date" value="' + v(s.checkIn) + '"></label><label class="f"><span>Check-out</span><input id="syO" type="date" value="' + v(s.checkOut) + '"></label></div>' +
    '<label class="f"><span>Guest name</span><input id="syN" list="syCl" value="' + v(s.guest.name) + '" autocomplete="off"></label>' + datalist('syCl', S.data.clients.map(function (c) { return c.name; })) +
    '<div class="cols"><label class="f"><span>Phone / WhatsApp</span><input id="syP" type="tel" value="' + v(s.guest.phone) + '"></label><label class="f"><span>Guests</span><input id="syG" inputmode="numeric" value="' + v(s.guests) + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Nightly rate (EC$)</span><input id="syR" inputmode="decimal" value="' + v(s.rate) + '"></label><label class="f"><span>Cleaning fee (EC$)</span><input id="syC" inputmode="decimal" value="' + v(s.cleaning) + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Booked through</span><select id="syB">' + opts(['Direct', 'WhatsApp', 'Airbnb', 'Booking.com', 'Expedia', 'Other'], s.source) + '</select></label><label class="f"><span>Status</span><select id="syS">' + opts(['Booked', 'Checked in', 'Checked out', 'Cancelled'], s.status) + '</select></label></div>' +
    '<label class="f"><span>Notes</span><input id="syX" value="' + v(s.notes) + '" placeholder="e.g. arriving on the late ferry"></label>' + '<p class="small" id="syT"></p>' +
    (s.id ? '<div class="btn-row">' + (inv ? '<button class="btn quiet" id="syInvO" type="button">Invoice #' + pad3(inv.no) + '</button>' : '<button class="btn quiet" id="syInv" type="button">Create invoice</button>') + '<button class="btn quiet" id="syPay" type="button">Record a payment</button><button class="btn quiet" id="syPdf" type="button">Booking confirmation</button></div>' : ''), 'Save');
  var tot = function () { var n = Math.max(0, Math.round((parseIso($('syO').value) - parseIso($('syI').value)) / 864e5)); $('syT').innerHTML = n ? n + (n === 1 ? ' night' : ' nights') + ' · total <b>' + ec2(n * num($('syR').value) + num($('syC').value)) + '</b>' : ''; };
  ['syI', 'syO', 'syR', 'syC'].forEach(function (k) { $(k).oninput = tot; }); tot();
  $('syU').onchange = function () { if (!$('syR').value) $('syR').value = $('syU').selectedOptions[0].dataset.r; tot(); };
  $('syN').oninput = function () { var c = S.data.clients.find(function (z) { return z.name.toLowerCase() === $('syN').value.trim().toLowerCase(); }); if (c && !$('syP').value) $('syP').value = c.phone || ''; };
  $('sheetGo').onclick = function () { api('saveStay', { stay: { id: s.id, unitId: $('syU').value, checkIn: $('syI').value, checkOut: $('syO').value, guest: { name: $('syN').value, phone: $('syP').value }, guests: $('syG').value, rate: $('syR').value, cleaning: $('syC').value, source: $('syB').value, status: $('syS').value, notes: $('syX').value } }, 'Saving…').then(function () { closeSheet(); toast('Saved.'); render(); }).catch(function () {}); };
  if ($('syInv')) $('syInv').onclick = function () { api('invoiceStay', { id: s.id }, 'Creating…').then(function (res) { closeSheet(); go('invoice', res.result.id); }).catch(function () {}); };
  if ($('syInvO')) $('syInvO').onclick = function () { closeSheet(); go('invoice', inv.id); };
  if ($('syPay')) $('syPay').onclick = function () { closeSheet(); stayPaySheet(s); };
  if ($('syPdf')) $('syPdf').onclick = function () { stayPdf(s).then(function (r) { shareDoc(r.blob, r.name, 'Booking confirmation'); }); };
}
function stayPdf(s) {
  var a = aS(), u = unitById(s.unitId), doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' }), W = 595.28, M = 54, y = 130;
  var clean = function (x) { return String(x == null ? '' : x).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x00-\xFF]/g, ''); };
  doc.setFillColor(1, 45, 35); doc.rect(0, 0, W, 86, 'F'); doc.setFillColor(212, 169, 75); doc.rect(0, 86, W, 4, 'F'); if (COZY_LOGO) doc.addImage(COZY_LOGO, 'PNG', M, 8, 70, 70);
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.text(clean(a.name.toUpperCase()), COZY_LOGO ? M + 80 : M, 44); doc.setFontSize(12); doc.setTextColor(212, 169, 75); doc.text('BOOKING CONFIRMATION', W - M, 44, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30, 36, 40);
  var rows = [['Guest', s.guest.name], ['Apartment', u.name + (u.type ? ', ' + u.type : '')], ['Arrive', longDate(s.checkIn) + ', from ' + a.checkIn], ['Leave', longDate(s.checkOut) + ', by ' + a.checkOut], ['Nights', String(s.nights)], ['Guests', String(s.guests)], ['Total', 'EC$' + F2.format(s.nights * s.rate + (s.cleaning || 0)) + (s.cleaning ? ' including EC$' + F2.format(s.cleaning) + ' cleaning' : '')]];
  rows.forEach(function (r) { doc.setFont('helvetica', 'bold'); doc.text(r[0], M, y); doc.setFont('helvetica', 'normal'); doc.text(clean(r[1]), M + 100, y); y += 18; });
  y += 10; doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(1, 45, 35); doc.text('House rules and terms', M, y); y += 16; doc.setFont('helvetica', 'normal'); doc.setFontSize(9.8); doc.setTextColor(30, 36, 40);
  var terms = (a.houseRules || 'No smoking inside the apartment.\nNo parties or events, and quiet hours from 10pm to 7am.\nOnly the guests named on the booking may stay overnight.\nPlease report any damage or breakage before you leave; damage beyond normal use may be charged.') + '\n' +
    (a.cancelDays ? 'Cancellations made at least ' + a.cancelDays + ' days before arrival are refunded in full. Later cancellations may be charged for the booked nights.' : 'Payment is due before or on arrival unless agreed otherwise.') + '\nYour booking is with ' + a.landlord + (a.landlord !== a.name ? ', trading as ' + a.name : '') + '. Questions: ' + [a.phone, a.email].filter(Boolean).join(' or ') + '.';
  terms.split('\n').forEach(function (p) { doc.splitTextToSize(clean('- ' + p), W - 2 * M).forEach(function (ln) { doc.text(ln, M, y); y += 13.5; }); y += 3; });
  return Promise.resolve({ blob: doc.output('blob'), name: 'Booking-' + safeName(u.name) + '-' + s.checkIn + '.pdf' });
}
/* ---- repairs (done by NV Construction) ---- */
VIEWS.repairs = function () {
  var rs = repairs().slice().sort(function (a, b) { return (a.status === 'Done' ? 1 : 0) - (b.status === 'Done' ? 1 : 0) || (['Urgent', 'Soon', 'When convenient'].indexOf(a.priority) - ['Urgent', 'Soon', 'When convenient'].indexOf(b.priority)) || (a.reported < b.reported ? 1 : -1); });
  var cost = rs.filter(function (r) { return r.done && r.done.slice(0, 4) === today().slice(0, 4); }).reduce(function (a, r) { return a + (r.labour || 0) + (r.materials || 0); }, 0);
  $('view').innerHTML = (isViewOnly() ? '' : '<div class="toolbar"><button class="btn gold" id="rpNew">+ Report a repair</button></div>') + (aptMgr() ? '<p class="small muted">NV Construction carries out repairs. Their labour and materials count as Apartments costs: ' + ec(cost) + ' so far this year.</p>' : '') +
    (rs.length ? '<div class="card flush"><ul class="list">' + rs.slice(0, 80).map(repairRow).join('') + '</ul></div>' : '<div class="card empty">No repairs reported.</div>');
  if ($('rpNew')) $('rpNew').onclick = function () { repairEditor(); };
  bindAptRows();
};
function repairEditor(r) {
  r = r || { priority: 'Soon', status: 'Open' }; var mgr = aptMgr(), us = units();
  if (!us.length) { toast('Add the units first.', true); return; }
  openSheet(r.id ? 'Repair' : 'Report a repair', '<label class="f"><span>Unit</span><select id="rpU">' + us.map(function (u) { return '<option value="' + u.id + '"' + (u.id === r.unitId ? ' selected' : '') + '>' + esc(u.name) + '</option>'; }).join('') + '</select></label>' +
    '<label class="f"><span>What is wrong</span><textarea id="rpI" placeholder="e.g. Kitchen tap leaking under the sink">' + esc(r.issue || '') + '</textarea></label>' +
    '<div class="cols"><label class="f"><span>How urgent</span><select id="rpP">' + opts(['Urgent', 'Soon', 'When convenient'], r.priority) + '</select></label><label class="f"><span>Status</span><select id="rpS">' + opts(['Open', 'In progress', 'Done'], r.status) + '</select></label></div>' +
    '<label class="f"><span>Who is doing it</span><input id="rpA" list="rpAl" value="' + v(r.assigned) + '"></label>' + datalist('rpAl', drivers().map(function (d) { return d.name; })) +
    (mgr ? '<div class="cols"><label class="f"><span>Labour cost (EC$)</span><input id="rpL" inputmode="decimal" value="' + v(r.labour) + '"></label><label class="f"><span>Materials (EC$)</span><input id="rpM" inputmode="decimal" value="' + v(r.materials) + '"></label></div>' : '') +
    '<label class="f"><span>Notes</span><input id="rpN" value="' + v(r.notes) + '"></label>', 'Save');
  $('sheetGo').onclick = function () { api('saveRepair', { repair: { id: r.id, unitId: $('rpU').value, issue: $('rpI').value, priority: $('rpP').value, status: $('rpS').value, assigned: $('rpA').value, labour: mgr ? $('rpL').value : undefined, materials: mgr ? $('rpM').value : undefined, notes: $('rpN').value, done: r.done } }, 'Saving…').then(function () { closeSheet(); toast('Saved.'); render(); }).catch(function () {}); };
}
/* ---- apartment settings ---- */
VIEWS.aptsettings = function () {
  var a = aS(), d = S.data.aptSettings || {};
  $('view').innerHTML = '<div class="card"><h2>Cozy Apartments details</h2><p class="small muted" style="margin-top:0">Used on rent invoices, tenancy agreements and booking confirmations. Cozy Apartments and NV Construction are one business, so the bank details come from Business Settings.</p>' +
    '<label class="f"><span>Trading name</span><input id="asN" value="' + v(a.name) + '"></label><label class="f"><span>Landlord’s legal name (on agreements)</span><input id="asL" value="' + v(d.landlord || '') + '" placeholder="' + v(S.data.settings.businessName) + '"></label>' +
    '<label class="f"><span>Address of the apartments</span><textarea id="asA">' + esc(d.address || '') + '</textarea></label><div class="cols"><label class="f"><span>Phone</span><input id="asP" value="' + v(d.phone || '') + '"></label><label class="f"><span>Email</span><input id="asE" value="' + v(d.email || '') + '"></label></div>' +
    '<h3 class="rep-h">Long-term tenancies</h3><div class="cols"><label class="f"><span>Notice period (days)</span><input id="asNd" inputmode="numeric" value="' + a.noticeDays + '"></label><label class="f"><span>Deposit returned within (days)</span><input id="asDd" inputmode="numeric" value="' + a.depositDays + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Late fee (EC$, 0 for none)</span><input id="asLf" inputmode="decimal" value="' + a.lateFee + '"></label><label class="f"><span>Days late before the fee</span><input id="asGd" inputmode="numeric" value="' + a.graceDays + '"></label></div>' +
    '<label class="f"><span>Extra terms added to every agreement (optional)</span><textarea id="asX">' + esc(a.extraTerms) + '</textarea></label>' +
    '<h3 class="rep-h">Short stays</h3><div class="cols"><label class="f"><span>Check-in from</span><input id="asCi" value="' + v(a.checkIn) + '"></label><label class="f"><span>Check-out by</span><input id="asCo" value="' + v(a.checkOut) + '"></label></div>' +
    '<label class="f"><span>Free cancellation up to (days before arrival, 0 for none)</span><input id="asCd" inputmode="numeric" value="' + a.cancelDays + '"></label><label class="f"><span>House rules (one per line)</span><textarea id="asH" rows="5">' + esc(a.houseRules) + '</textarea></label>' +
    '<div class="alert">The tenancy agreement is a plain-English starting point, not legal advice. Have a lawyer in St Vincent and the Grenadines check the wording before the first tenant signs.</div>' +
    (aptMgr() ? '<button class="btn gold block" id="asSave">Save</button>' : '') + '</div>';
  if ($('asSave')) $('asSave').onclick = function () { api('saveAptSettings', { settings: { name: $('asN').value, landlord: $('asL').value, address: $('asA').value, phone: $('asP').value, email: $('asE').value, noticeDays: $('asNd').value, depositDays: $('asDd').value, lateFee: $('asLf').value, graceDays: $('asGd').value, extraTerms: $('asX').value, checkIn: $('asCi').value, checkOut: $('asCo').value, cancelDays: $('asCd').value, houseRules: $('asH').value } }, 'Saving…').then(function () { toast('Saved.'); render(); }).catch(function () {}); };
};
TITLES.aptsettings = 'Apartment Settings';
/* ---- Home and Needs Attention ---- */
var apDash = VIEWS.dashboard;
VIEWS.dashboard = function () {
  apDash();
  var us = units().filter(function (u) { return u.active !== false; }); if (!us.length) return;
  var t = today(), occ = us.filter(function (u) { return occupant(u, t); }).length, arr = stays().filter(function (s) { return s.status === 'Booked' && s.checkIn === t; }).length, dep = stays().filter(function (s) { return s.status !== 'Cancelled' && s.status !== 'Checked out' && s.checkOut === t; }).length;
  var arrears = isDriver() ? 0 : (S.data.invoices || []).filter(function (i) { return !i.void && isCozyInv(i) && invStatus(i) === 'Overdue'; }).reduce(function (a, i) { return a + invBalance(i); }, 0);
  var body = '<div class="rt-c-row"><div><span class="small muted">Occupied</span><b>' + occ + ' / ' + us.length + '</b></div><div><span class="small muted">Arriving / leaving today</span><b>' + arr + ' / ' + dep + '</b></div>' + (isDriver() ? '' : '<div><span class="small muted">Rent arrears</span><b class="' + (arrears ? 'neg' : '') + '">' + ec(arrears) + '</b></div>') + '</div>';
  var anchor = document.querySelector('[data-sec="projects"]') || document.querySelector('[data-sec="needs"]');
  var html = sec('cozy', 'Cozy Apartments', body, ['apts', 'Open']); if (anchor) anchor.insertAdjacentHTML('afterend', html); bindGo();
};
var apNeeds = needsAttention;
needsAttention = function () {
  var items = apNeeds(), t = today();
  var urgent = repairs().filter(function (r) { return r.status !== 'Done' && r.priority === 'Urgent'; });
  if (urgent.length) items.splice(1, 0, ['alarm', 'danger', urgent.length + (urgent.length === 1 ? ' urgent repair' : ' urgent repairs'), urgent.slice(0, 2).map(function (r) { return unitById(r.unitId).name + ': ' + r.issue; }).join(' · '), 'repairs']);
  var arrive = stays().filter(function (s) { return s.status === 'Booked' && s.checkIn === t; });
  if (arrive.length) items.push(['calendar', 'warn', arrive.length + (arrive.length === 1 ? ' guest arriving today' : ' guests arriving today'), arrive.map(function (s) { return unitById(s.unitId).name + ', ' + s.guest.name; }).slice(0, 2).join(' · '), 'stays']);
  if (!isDriver()) {
    var m = t.slice(0, 7), live = tenancies().filter(function (x) { return ['Signed', 'Active'].indexOf(x.status) >= 0 && x.start <= m + '-28' && (!x.end || x.end >= m + '-01'); });
    var billed = live.filter(function (x) { return (S.data.invoices || []).some(function (i) { return !i.void && i.tenancyId === x.id && i.rentMonth === m; }); }).length;
    if (live.length > billed) items.push(['invoice', 'warn', 'Rent to raise for ' + MON_LONG[+m.slice(5) - 1], (live.length - billed) + (live.length - billed === 1 ? ' tenancy has' : ' tenancies have') + ' no rent invoice this month', 'apts']);
    var unsigned = tenancies().filter(function (x) { return x.status === 'Draft' && x.start <= addDays(t, 7); });
    if (unsigned.length) items.push(['file', 'warn', unsigned.length + (unsigned.length === 1 ? ' agreement not signed' : ' agreements not signed'), unsigned.map(function (x) { return unitById(x.unitId).name + ', ' + x.tenant.name; }).slice(0, 2).join(' · '), 'tenancies']);
    var ending = tenancies().filter(function (x) { return x.end && ['Signed', 'Active'].indexOf(x.status) >= 0 && x.end >= t && x.end <= addDays(t, aS().noticeDays); });
    if (ending.length) items.push(['calendar', 'info', ending.length + (ending.length === 1 ? ' tenancy ending soon' : ' tenancies ending soon'), ending.map(function (x) { return unitById(x.unitId).name + ' on ' + niceShort(x.end); }).slice(0, 2).join(' · '), 'tenancies']);
  }
  return items;
};

/* ==================== buildings, adding units in bulk, and taking payments ==================== */
TITLES.paysettings = 'How Customers Pay';
var PAY_METHODS = ['Cash', 'Local bank transfer', 'International transfer', 'Card', 'Cheque', 'Other'];
function buildings() { var ps = (S.data.properties || []).slice(); if (!ps.length) ps = [{ id: '', name: aS().name, address: aS().address }]; return ps; }
function unitPropId(u) { var ps = buildings(); return u && u.propertyId && ps.some(function (p) { return p.id === u.propertyId; }) ? u.propertyId : ps[0].id; }
function paySet() { return S.data.paySettings || {}; }
/** The payment instructions used on agreements, invoices and reminders. */
function payWays(ref) {
  var st = S.data.settings, p = paySet(), out = [];
  if (st.bankName && st.accountNumber) out.push('From a bank in St Vincent and the Grenadines: transfer to ' + (st.accountName || st.businessName) + ', ' + st.bankName + ', account ' + st.accountNumber + ', quoting ' + ref + ' as the reference.');
  else out.push('By bank transfer to the account the Landlord gives in writing, quoting ' + ref + ' as the reference.');
  if (p.swift) out.push('From a bank outside St Vincent and the Grenadines: send an international transfer to the same account. SWIFT/BIC ' + p.swift + (p.bankAddress ? ', bank address ' + p.bankAddress : '') + (p.corrBank ? '. For US dollar transfers, the correspondent bank is ' + p.corrBank + (p.corrSwift ? ' (SWIFT ' + p.corrSwift + ')' : '') : '') + '. Any fees charged by the sending bank are paid by the sender.' + (p.intlNote ? ' ' + p.intlNote : ''));
  if (p.cash !== false) out.push('In cash' + (p.cashWhere ? ' at ' + p.cashWhere : '') + ', against a written receipt.');
  out.push('A receipt is given for every payment.');
  return out;
}
var nvPayLines = payLines;
payLines = function (ref) {
  var st = S.data.settings, p = paySet(), lines = nvPayLines(ref);
  if (p.swift) lines = lines.concat(['From abroad: SWIFT/BIC ' + p.swift + (p.bankAddress ? ', ' + p.bankAddress : ''), p.corrBank ? 'US dollar correspondent bank: ' + p.corrBank + (p.corrSwift ? ' (SWIFT ' + p.corrSwift + ')' : '') : '']);
  if (p.cash !== false && p.cashWhere) lines.push('Cash is accepted at ' + p.cashWhere + '.');
  return lines.filter(Boolean);
};
function propertyEditor(pr) {
  pr = pr && pr.id ? pr : {};
  openSheet(pr.id ? 'Edit ' + pr.name : 'Add a building', '<label class="f"><span>Name</span><input id="prN" value="' + v(pr.name) + '" placeholder="e.g. Cozy Apartments, Arnos Vale"></label><label class="f"><span>Address (used on tenancy agreements)</span><textarea id="prA">' + esc(pr.address || '') + '</textarea></label><label class="f"><span>Notes</span><input id="prO" value="' + v(pr.notes) + '"></label>' +
    (pr.id && S.data.me.role === 'owner' ? '<button class="btn link" id="prDel" style="color:var(--danger)">Delete this building</button>' : ''), 'Save');
  $('sheetGo').onclick = function () { api('saveProperty', { property: { id: pr.id, name: $('prN').value, address: $('prA').value, notes: $('prO').value } }, 'Saving…').then(function () { closeSheet(); toast('Saved.'); render(); }).catch(function () {}); };
  if ($('prDel')) $('prDel').onclick = function () { if (confirm('Delete ' + pr.name + '?')) api('deleteProperty', { id: pr.id }, 'Deleting…').then(function () { closeSheet(); render(); }).catch(function () {}); };
}
function bulkUnitsSheet(propId) {
  var pr = buildings().find(function (b) { return b.id === propId; }) || buildings()[0];
  var nums = units().map(function (u) { var m = /(\d+)\s*$/.exec(u.name); return m ? +m[1] : 0; }), next = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
  openSheet('Add units to ' + pr.name, '<p class="small muted" style="margin-top:0">Add the new units in one go. They are numbered in sequence and start with the rent and rates below; any unit can be changed later.</p>' +
    '<div class="cols"><label class="f"><span>How many</span><input id="buC" inputmode="numeric" value="12"></label><label class="f"><span>First number</span><input id="buS" inputmode="numeric" value="' + next + '"></label></div>' +
    '<label class="f"><span>Name before the number</span><input id="buP" value="Unit "></label><p class="small" id="buX"></p>' +
    '<div class="cols"><label class="f"><span>Type</span><input id="buT" list="buTl" placeholder="1-bedroom"></label><label class="f"><span>Bedrooms</span><input id="buB" inputmode="numeric"></label></div>' + datalist('buTl', ['1-bedroom', '2-bedroom', '3-bedroom']) +
    '<label class="f"><span>Used for</span><select id="buU">' + opts(['Either', 'Long-term', 'Short stays'], 'Either') + '</select></label>' +
    '<div class="cols"><label class="f"><span>Monthly rent (EC$)</span><input id="buR" inputmode="decimal"></label><label class="f"><span>Nightly rate (EC$)</span><input id="buN" inputmode="decimal"></label></div>' +
    '<div class="cols"><label class="f"><span>Usual deposit (EC$)</span><input id="buD" inputmode="decimal"></label><label class="f"><span>Most guests</span><input id="buG" inputmode="numeric" value="2"></label></div>', 'Add units');
  var preview = function () { var n = parseInt($('buC').value, 10) || 0, s0 = parseInt($('buS').value, 10) || 0, pre = $('buP').value; $('buX').textContent = n > 0 ? 'Creates ' + (pre + s0).trim() + (n > 1 ? ' to ' + (pre + (s0 + n - 1)).trim() : '') + ' (' + n + (n === 1 ? ' unit' : ' units') + ').' : ''; };
  ['buC', 'buS', 'buP'].forEach(function (k) { $(k).oninput = preview; }); preview();
  $('sheetGo').onclick = function () { api('addUnits', { propertyId: pr.id, count: $('buC').value, start: $('buS').value, prefix: $('buP').value, template: { type: $('buT').value, bedrooms: $('buB').value, use: $('buU').value, monthlyRent: $('buR').value, nightlyRate: $('buN').value, deposit: $('buD').value, maxGuests: $('buG').value } }, 'Adding units…')
    .then(function (res) { closeSheet(); toast(res.result.ids.length + ' units added to ' + pr.name + '.'); render(); }).catch(function () {}); };
}
function payFields(amount, hint) {
  return '<div class="cols"><label class="f"><span>Amount received (EC$)</span><input id="ppA" inputmode="decimal" value="' + (amount > 0 ? amount.toFixed(2) : '') + '"></label><label class="f"><span>Date</span><input id="ppD" type="date" value="' + today() + '"></label></div>' +
    '<label class="f"><span>How it was paid</span><select id="ppM">' + opts(PAY_METHODS, 'Cash') + '</select></label>' +
    '<label class="f"><span id="ppRl">Receipt number (optional)</span><input id="ppR"></label>' + (hint ? '<p class="small muted">' + hint + '</p>' : '');
}
function bindPayFields() { var f = function () { var m = $('ppM').value; $('ppRl').textContent = m === 'Cash' ? 'Receipt number (optional)' : m === 'Cheque' ? 'Cheque number' : 'Bank reference (optional)'; }; $('ppM').onchange = f; f(); }
function tenantPaySheet(t) {
  var owed = tenancyInvoices(t).reduce(function (a, i) { return a + invBalance(i); }, 0);
  openSheet('Payment from ' + t.tenant.name, '<p class="muted" style="margin-top:0">' + esc(unitById(t.unitId).name) + ' · owed now ' + ec2(owed) + ((t.credit || 0) > 0.009 ? ' · ' + ec2(t.credit) + ' already in credit' : '') + '</p>' +
    payFields(owed, 'The payment pays off the oldest rent first. Anything over what is owed is kept as credit and used when the next rent is raised.'), 'Save payment');
  bindPayFields();
  $('sheetGo').onclick = function () { api('recordTenantPayment', { tenancyId: t.id, amount: $('ppA').value, date: $('ppD').value, method: $('ppM').value, reference: $('ppR').value }, 'Saving…').then(function (res) {
    closeSheet(); var r = res.result, n = r.allocations.length;
    toast('Payment saved' + (n ? ' against ' + n + (n === 1 ? ' invoice' : ' invoices') : '') + (r.credit ? '; ' + ec2(r.credit) + ' kept as credit' : '') + '.');
    render(); if (n) { var last = r.allocations[n - 1], inv = (S.data.invoices || []).find(function (i) { return i.id === last.invoiceId; }), p = inv && inv.payments.find(function (x) { return x.id === last.paymentId; }); if (inv && p) setTimeout(function () { pdfSheet('Receipt for ' + invNo(inv), function () { return receiptPdf(inv, p); }, clientOf(inv)); }, 300); }
  }).catch(function () {}); };
}
function stayPaySheet(s) {
  var inv = s.invoiceId && (S.data.invoices || []).find(function (i) { return i.id === s.invoiceId && !i.void; }), due = inv ? invBalance(inv) : s.nights * s.rate + (s.cleaning || 0);
  openSheet('Payment from ' + s.guest.name, '<p class="muted" style="margin-top:0">' + esc(unitById(s.unitId).name) + ' · ' + nice(s.checkIn) + ' to ' + nice(s.checkOut) + ' · ' + (inv ? 'balance ' : 'total ') + ec2(due) + '</p>' + payFields(due, inv ? '' : 'An invoice for the stay is created first, so the payment has something to go against.'), 'Save payment');
  bindPayFields();
  $('sheetGo').onclick = function () { api('recordStayPayment', { stayId: s.id, amount: $('ppA').value, date: $('ppD').value, method: $('ppM').value, reference: $('ppR').value }, 'Saving…').then(function (res) {
    closeSheet(); toast('Payment saved.'); render(); var i2 = (S.data.invoices || []).find(function (i) { return i.id === res.result.invoiceId; }), p = i2 && i2.payments.find(function (x) { return x.id === res.result.paymentId; });
    if (i2 && p) setTimeout(function () { pdfSheet('Receipt for ' + invNo(i2), function () { return receiptPdf(i2, p); }, clientOf(i2)); }, 300);
  }).catch(function () {}); };
}
/** Who is paying? Tenants with rent owed come first, then guests staying now or soon. */
function paymentPicker() {
  var t0 = today(), ts = tenancies().filter(function (x) { return ['Signed', 'Active'].indexOf(x.status) >= 0; }).map(function (x) { return { t: x, owed: tenancyInvoices(x).reduce(function (a, i) { return a + invBalance(i); }, 0) }; }).sort(function (a, b) { return b.owed - a.owed; });
  var ss = stays().filter(function (x) { return x.status !== 'Cancelled' && x.checkOut >= addDays(t0, -14) && x.checkIn <= addDays(t0, 30); }).filter(function (x) { var i = x.invoiceId && (S.data.invoices || []).find(function (q) { return q.id === x.invoiceId && !q.void; }); return !i || invBalance(i) > 0.009; });
  openSheet('Record a payment', '<p class="small muted" style="margin-top:0">Cash at the office, a local bank transfer or a transfer from abroad.</p><h3 class="rep-h">Tenants</h3><ul class="list">' + (ts.length ? ts.map(function (x) { return '<li><button class="row-btn" data-pt="' + x.t.id + '"><span><span class="t">' + esc(unitById(x.t.unitId).name) + ' · ' + esc(x.t.tenant.name) + '</span><br><span class="m">' + (x.owed > 0.009 ? ec2(x.owed) + ' owed' : 'Nothing owed; extra is kept as credit') + '</span></span><span class="chev">›</span></button></li>'; }).join('') : '<li class="small muted">No current tenancies.</li>') + '</ul>' +
    '<h3 class="rep-h">Guests</h3><ul class="list">' + (ss.length ? ss.map(function (x) { return '<li><button class="row-btn" data-ps="' + x.id + '"><span><span class="t">' + esc(unitById(x.unitId).name) + ' · ' + esc(x.guest.name) + '</span><br><span class="m">' + niceShort(x.checkIn) + ' to ' + niceShort(x.checkOut) + '</span></span><span class="chev">›</span></button></li>'; }).join('') : '<li class="small muted">No guests with a balance.</li>') + '</ul>', 'Close');
  $('sheetGo').onclick = closeSheet;
  qa('[data-pt]').forEach(function (b) { b.onclick = function () { closeSheet(); tenantPaySheet(tenancies().find(function (x) { return x.id === b.dataset.pt; })); }; });
  qa('[data-ps]').forEach(function (b) { b.onclick = function () { closeSheet(); stayPaySheet(stays().find(function (x) { return x.id === b.dataset.ps; })); }; });
}
VIEWS.paysettings = function () {
  var st = S.data.settings, p = paySet(), mgr = aptMgr();
  $('view').innerHTML = '<div class="card"><h2>Local bank transfer</h2><p class="small muted" style="margin-top:0">From Business Settings, shared by both businesses.</p><table><tbody>' + [['Bank', st.bankName || 'Not set'], ['Account name', st.accountName || st.businessName], ['Account number', st.accountNumber || 'Not set']].map(function (r) { return '<tr><td>' + r[0] + '</td><td class="n">' + esc(r[1]) + '</td></tr>'; }).join('') + '</tbody></table>' + (S.data.me.role === 'owner' ? '<button class="btn link" id="psBiz" style="padding-left:0">Change in Business Settings</button>' : '') + '</div>' +
    '<div class="card"><h2>From abroad</h2><p class="small muted" style="margin-top:0">For tenants and clients overseas. Your bank gives you these details; the money arrives in the same account.</p>' +
    '<div class="cols"><label class="f"><span>SWIFT/BIC code</span><input id="psS" value="' + v(p.swift) + '"></label><label class="f"><span>Bank address</span><input id="psA" value="' + v(p.bankAddress) + '" placeholder="Branch, Kingstown"></label></div>' +
    '<div class="cols"><label class="f"><span>US dollar correspondent bank</span><input id="psC" value="' + v(p.corrBank) + '"></label><label class="f"><span>Its SWIFT code</span><input id="psCs" value="' + v(p.corrSwift) + '"></label></div>' +
    '<label class="f"><span>Extra note (optional)</span><input id="psN" value="' + v(p.intlNote) + '" placeholder="e.g. Send in US dollars or EC dollars."></label></div>' +
    '<div class="card"><h2>Card payments</h2><p class="small muted" style="margin-top:0">When BOSVG Merchant iServices gives you a payment page link, paste it here. Tenants see a Pay by card button in the tenant app.</p><label class="f"><span>Card payment link (https://…)</span><input id="psL" value="' + v(p.cardLink) + '"></label></div>' +
    '<div class="card"><h2>Cash</h2><label class="check"><input type="checkbox" id="psK"' + (p.cash !== false ? ' checked' : '') + '> Cash is accepted</label><label class="f"><span>Where to pay cash</span><input id="psW" value="' + v(p.cashWhere) + '" placeholder="e.g. the office at Arnos Vale, 9am to 4pm"></label></div>' +
    '<div class="card"><h2>Where these appear</h2><p class="small" style="margin:0">Section 4A of every tenancy agreement, the payment instructions on invoices and statements, and rent reminders.</p></div>' +
    (mgr ? '<button class="btn gold block" id="psSave">Save</button>' : '');
  if ($('psBiz')) $('psBiz').onclick = function () { go('settings'); };
  if ($('psSave')) $('psSave').onclick = function () { api('savePaySettings', { pay: { swift: $('psS').value, bankAddress: $('psA').value, corrBank: $('psC').value, corrSwift: $('psCs').value, intlNote: $('psN').value, cash: $('psK').checked, cashWhere: $('psW').value, cardLink: $('psL').value } }, 'Saving…').then(function () { toast('Saved.'); render(); }).catch(function () {}); };
};


/* ==================== two businesses in one app ==================== */
// The menu switches between NV Construction, Cozy Apartments and (for the owner and managers) a view of both.
// S.full is everything the server sent; S.data is the part for the business on screen, so every screen and report shows that business only.
var BIZ_NAME = { nv: 'NV Construction', cozy: 'Cozy Apartments', owner: 'Both businesses' };
var CHANNELS = ['Airbnb', 'Booking.com'];
S.biz = lsGet('nv_biz', '');
function bizAccess() { var d = S.full || S.data; return (d && d.me && d.me.biz) || 'both'; }
function bizChoices() {
  var d = S.full || S.data, a = bizAccess(); if (a === 'nv' || a === 'cozy') return [a];
  return d && d.me && (d.me.role === 'owner' || d.me.role === 'member') ? ['nv', 'cozy', 'owner'] : ['nv', 'cozy'];
}
function scopeData(d, biz) {
  if (!d || biz === 'owner') return d;
  var v = Object.assign({}, d);
  if (biz === 'nv') {
    ['units', 'tenancies', 'stays', 'repairs', 'properties'].forEach(function (k) { v[k] = []; });
    v.invoices = (d.invoices || []).filter(function (i) { return i.brand !== 'cozy'; });
    v.expenses = (d.expenses || []).filter(function (e) { return e.biz !== 'cozy'; });
  } else {
    ['bookings', 'projects', 'bins', 'hires', 'hours', 'hourPlans', 'fuel', 'incidents', 'quotes', 'driverPay'].forEach(function (k) { v[k] = []; });
    v.invoices = (d.invoices || []).filter(function (i) { return i.brand === 'cozy'; });
    v.expenses = (d.expenses || []).filter(function (e) { return e.biz === 'cozy'; });
  }
  v.requests = (d.requests || []).filter(function (r) { return r.biz === biz; });
  return v;
}
function setData(d) {
  S.full = d;
  if (!d) { S.data = d; return; }
  if (bizChoices().indexOf(S.biz) < 0) S.biz = bizChoices()[0];
  S.data = scopeData(d, S.biz);
  applyBizTheme();
}
function applyBizTheme() { ['nv', 'cozy', 'owner'].forEach(function (b) { document.body.classList.toggle('biz-' + b, S.biz === b); }); }
function homeFor(b) { if (isDriver()) return b === 'cozy' ? 'stays' : 'bookings'; return b === 'cozy' ? 'cozyhome' : b === 'owner' ? 'owner' : 'dashboard'; }
function switchBiz(b) {
  if (bizChoices().indexOf(b) < 0) return;
  S.biz = b; lsSet('nv_biz', b); S.data = scopeData(S.full, b); applyBizTheme();
  if ($('menuPop')) $('menuPop').remove();
  shell(); go(homeFor(b));
}
var BIZ_TABS = {
  nv: [['dashboard', 'Home'], ['projects', 'Projects'], ['+'], ['reports', 'Reports'], ['more', 'Manage']],
  cozy: [['cozyhome', 'Home'], ['apts', 'Units'], ['+'], ['reports', 'Reports'], ['more', 'Manage']],
  owner: [['owner', 'Overview'], ['invoices', 'Invoices'], ['+'], ['reports', 'Reports'], ['more', 'Manage']],
  nvCrew: [['bookings', 'Jobs'], ['+'], ['fuel', 'Fuel'], ['more', 'Manage']],
  cozyCrew: [['stays', 'Stays'], ['+'], ['repairs', 'Repairs'], ['more', 'Manage']]
};
function bizTabList() { return isDriver() ? BIZ_TABS[S.biz === 'cozy' ? 'cozyCrew' : 'nvCrew'] : BIZ_TABS[S.biz] || BIZ_TABS.nv; }
function bizTabs() { return bizTabList().map(function (t) { return t[0] === '+' ? '<button class="plus" id="plus" aria-label="New"><span class="circle">+</span></button>' : tab(t[0], t[1]); }).join(''); }
topTabs = function () { return bizTabList().map(function (t) { return t[0]; }).filter(function (x) { return x !== '+'; }); };
ICONS.projects = ICONS.projects || icon('calendar'); ICONS.apts = icon('key'); ICONS.cozyhome = ICONS.dashboard; ICONS.owner = icon('pie'); ICONS.stays = ICONS.bookings; ICONS.repairs = icon('alarm');
var HOUSE_SVG = '<img src="/cozy-logo.png" alt="Cozy Apartments" width="38" height="38" style="border-radius:8px;display:block">';
// the logo, loaded once for documents (agreements, confirmations, invoices, payslips)
var COZY_LOGO = null;
try { fetch('/cozy-logo.png').then(function (r) { return r.ok ? r.blob() : null; }).then(function (bl) { if (!bl) return; var fr = new FileReader(); fr.onload = function () { COZY_LOGO = fr.result; }; fr.readAsDataURL(bl); }).catch(function () {}); } catch (e) {}
function bizLogo() { return S.biz === 'cozy' ? HOUSE_SVG : '<img src="/logo.jpg" alt="">'; }
function bizSwitchHtml() {
  var ch = bizChoices(); if (ch.length < 2) return '';
  var sub = { nv: 'Projects, jobs, equipment and skip bins', cozy: 'Units, tenants, guests and rent', owner: 'Both businesses side by side' };
  return '<div class="mp-label">Switch business</div><div class="biz-pick">' + ch.map(function (b) {
    return '<button class="biz-opt biz-' + b + (S.biz === b ? ' on' : '') + '" data-biz="' + b + '"><span class="bo-ic">' + (b === 'cozy' ? HOUSE_SVG : b === 'nv' ? '<img src="/logo.jpg" alt="">' : icon('pie', 'gi-menu')) + '</span><span><b>' + BIZ_NAME[b] + '</b><br><span class="small">' + sub[b] + '</span></span>' + (S.biz === b ? '<span class="bo-tick">✓</span>' : '') + '</button>';
  }).join('') + '</div>';
}
document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('[data-biz]'); if (b && $('menuPop') && $('menuPop').contains(b)) { e.stopPropagation(); switchBiz(b.dataset.biz); } }, true);
function bizQuick(q, drv) {
  if (S.biz !== 'cozy') return q;
  return drv ? [['stays', 'calendar', 'Stays'], ['repairs', 'alarm', 'Repairs'], ['apts', 'key', 'Units']] : [['tenancies', 'file', 'Tenancies'], ['stays', 'calendar', 'Short stays'], ['requests', 'user', 'Requests']];
}
/* Menus show only what belongs to the business on screen */
var VIEW_BIZ = { projreport: 'nv', routes: 'nv', loads: 'nv', trucks: 'nv', bookings: 'nv', projects: 'nv', bins: 'nv', hours: 'nv', fleet: 'nv', fuel: 'nv', reminders: 'nv', driverpay: 'nv', capital: 'nv', insights: 'nv',
  apts: 'cozy', tenancies: 'cozy', stays: 'cozy', repairs: 'cozy', aptsettings: 'cozy', channels: 'cozy', aptperf: 'cozy', paysettings: 'both' };
function bizItemOk(v) { var b = VIEW_BIZ[v]; return S.biz === 'owner' || !b || b === 'both' || b === S.biz; }
var nvGroupMenu = groupMenu;
groupMenu = function (groups) {
  var seen = {};
  return nvGroupMenu(groups.map(function (g) { return { title: g.title, sub: g.sub, items: g.items.filter(function (i) { if (!bizItemOk(i[0]) || seen[i[0] + g.title]) return false; seen[i[0] + g.title] = 1; return true; }) }; }));
};
var nvNewMenu = newMenu;
newMenu = function () {
  nvNewMenu();
  if (isDriver() || S.biz === 'owner') return;
  var hide = S.biz === 'cozy' ? ['mBk', 'mPj', 'mBin', 'mRem', 'mFuel', 'mSu', 'mQuo', 'mInv', 'mJob'] : ['mTen', 'mStay', 'mRep'];
  hide.forEach(function (id) { var el = $(id); if (el) { var li = el.closest('li'); (li || el).remove(); } });
  if (S.biz === 'cozy' && aptMgr() && document.querySelector('.sheet .menu')) {
    document.querySelector('.sheet .menu').insertAdjacentHTML('afterbegin', menuItem('mPayIn', 'wallet', 'Record a payment', 'Cash, a local transfer or a transfer from abroad'));
    $('mPayIn').onclick = function () { closeSheet(); paymentPicker(); };
  }
};
TITLES.cozyhome = 'Cozy Apartments'; TITLES.owner = 'Both Businesses'; TITLES.requests = 'Website Requests'; TITLES.channels = 'Booking Sites'; TITLES.aptperf = 'Occupancy and Revenue'; TITLES.access = 'Business Access';
REPORT_VIEWS.push('aptperf');
document.head.insertAdjacentHTML('beforeend', '<style>' +
  'body.biz-cozy{--navy:#0e3d2f;--navy-2:#0a2e23;--navy-3:#1b4a3b;--gold:#d4a94b;--gold-soft:#f4ead3}' +
  'body.biz-owner{--gold:#b8b2a4}' +
  '.biz-pick{display:grid;gap:8px;padding:0 12px 10px}.biz-opt{display:flex;align-items:center;gap:12px;text-align:left;width:100%;border:1px solid var(--rule);background:var(--card);border-radius:12px;padding:10px 12px;cursor:pointer}' +
  '.biz-opt .bo-ic{width:40px;height:40px;display:grid;place-items:center;flex:none}.biz-opt .bo-ic img{width:40px;height:40px;border-radius:8px}.biz-opt .small{color:var(--muted)}' +
  '.biz-opt.on.biz-nv{background:#141414;color:#fff;border:2px solid #c5a35a}.biz-opt.on.biz-cozy{background:#0e3d2f;color:#fff;border:2px solid #d4a94b}.biz-opt.on.biz-owner{background:#2b2b2b;color:#fff;border:2px solid #b8b2a4}.biz-opt.on .small{color:#d8d2c4}.bo-tick{margin-left:auto;font-weight:700}' +
  '.who .biz-tag{display:block;font-size:.72rem;opacity:.75}.kpi-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px}.kpi-grid .card{margin:0}.kpi-grid .v{font-family:var(--display);font-size:1.6rem;font-weight:600}' +
  '.pill.est{background:var(--amber-soft);color:var(--amber)}.req{border-left:4px solid var(--gold)}.chip-row{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}' +
  '.owner-split{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:560px){.owner-split{grid-template-columns:1fr}}.owner-split .card{margin:0}.ob-nv{border-top:4px solid #c5a35a}.ob-cozy{border-top:4px solid #0e3d2f}' +
  '.copyrow{display:flex;gap:8px;align-items:center}.copyrow input{flex:1;font-size:.82rem}' +
  '</style>');

/* ---------- money helpers that work on any slice of the data ---------- */
function bizRange(p) {
  var t = today(), y = t.slice(0, 4), m = +t.slice(5, 7);
  if (p === 'y') return [y + '-01-01', y + '-12-31', 'This year'];
  if (p === 'q') { var q0 = Math.floor((m - 1) / 3) * 3 + 1; return [y + '-' + String(q0).padStart(2, '0') + '-01', isoOf(new Date(+y, q0 + 2, 0)), 'This quarter']; }
  if (p === 'lm') { var d = new Date(+y, m - 2, 1); return [isoOf(d), isoOf(new Date(d.getFullYear(), d.getMonth() + 1, 0)), 'Last month']; }
  return [t.slice(0, 7) + '-01', isoOf(new Date(+y, m, 0)), MON_LONG[m - 1]];
}
function bizSummary(b, a, z) { var f = Calc.facts(scopeData(S.full, b), function (j) { j.loadN = normalizeLoad(j.load) || 'Not set'; }); return Calc.summarise(f, a, z); }
function needsPayout(s) { return CHANNELS.indexOf(s.source) >= 0 && s.estimated && s.status !== 'Cancelled' && !s.payout && s.checkIn <= today(); }
function chFees() { return (S.full && S.full.aptSettings && S.full.aptSettings.channelFees) || (S.data.aptSettings || {}).channelFees || {}; }

/* ---------- the owner’s view of both ---------- */
S.ownerP = 'm';
VIEWS.owner = function () {
  var r = bizRange(S.ownerP), nv = bizSummary('nv', r[0], r[1]), cz = bizSummary('cozy', r[0], r[1]);
  var rep = (S.full.repairs || []).filter(function (x) { return x.done && x.done >= r[0] && x.done <= r[1]; }).reduce(function (a, x) { return a + (+x.labour || 0) + (+x.materials || 0); }, 0);
  var all = S.full.invoices || [], overdue = all.filter(function (i) { return !i.void && invStatus(i) === 'Overdue'; });
  var reqs = (S.full.requests || []).filter(function (q) { return q.status === 'New'; }), pay = (S.full.stays || []).filter(needsPayout);
  var urgent = (S.full.repairs || []).filter(function (x) { return x.status !== 'Done' && x.priority === 'Urgent'; });
  var box = function (b, s, label) { return '<button class="card row-btn ob-' + b + '" data-biz-go="' + b + '" style="display:block;text-align:left"><h2 style="margin-bottom:6px">' + BIZ_NAME[b] + '</h2>' +
    '<div class="small muted">Revenue</div><div class="fig num">' + ec(s.revenue) + '</div><div class="small muted" style="margin-top:6px">Costs</div><div class="fig num">' + ec(s.directCosts + s.operatingExpenses) + '</div>' +
    '<div class="small muted" style="margin-top:6px">' + label + '</div><div class="fig num ' + (s.operatingProfit >= 0 ? 'pos' : 'neg') + '">' + ec(s.operatingProfit) + '</div><div class="small muted">' + (s.revenue ? pct(s.operatingProfit / s.revenue) + ' margin' : 'No revenue yet') + '</div></button>'; };
  var tot = nv.operatingProfit + cz.operatingProfit;
  $('view').innerHTML = '<div class="seg" role="tablist">' + [['m', 'This month'], ['q', 'Quarter'], ['y', 'Year']].map(function (p) { return '<button data-op="' + p[0] + '" aria-pressed="' + (S.ownerP === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div>' +
    '<div class="card" style="background:var(--navy);color:#fff;border:0"><div class="kicker" style="color:#d8d2c4">Both businesses · ' + esc(r[2]) + '</div><div class="fig num" style="font-size:2.4rem;color:var(--gold)">' + ec(tot) + '</div><div class="small" style="color:#d8d2c4">Operating profit, after every cost. Cash collected ' + ec(nv.cashCollected + cz.cashCollected) + '.</div></div>' +
    '<div class="owner-split">' + box('nv', nv, 'Operating profit') + box('cozy', cz, 'Net operating income') + '</div>' +
    '<div class="card" style="margin-top:14px"><h2>Repairs NV did for Cozy</h2><p class="small muted" style="margin-top:0">Charged at cost: Cozy carries the labour and materials, NV makes nothing on them, and nothing is counted twice.</p><div class="kv"><span>Repairs finished, ' + esc(r[2].toLowerCase()) + '</span><b class="num">' + ec(rep) + '</b></div></div>' +
    '<div class="card"><h2>Needs you</h2><ul class="list">' +
      [[overdue.length, overdue.length + (overdue.length === 1 ? ' overdue invoice' : ' overdue invoices'), ec(overdue.reduce(function (a, i) { return a + invBalance(i); }, 0)), 'invoices'],
       [reqs.length, reqs.length + (reqs.length === 1 ? ' new website request' : ' new website requests'), '', 'requests'],
       [pay.length, pay.length + (pay.length === 1 ? ' booking site payout to enter' : ' booking site payouts to enter'), '', 'cozyhome'],
       [urgent.length, urgent.length + (urgent.length === 1 ? ' urgent repair' : ' urgent repairs'), '', 'repairs']].filter(function (x) { return x[0]; }).map(function (x) {
        return '<li><button class="row-btn" data-owner-go="' + x[3] + '"><span class="t">' + x[1] + '</span><span class="num">' + x[2] + '</span><span class="chev">›</span></button></li>'; }).join('') +
      (overdue.length + reqs.length + pay.length + urgent.length ? '' : '<li class="small muted" style="padding:8px 2px">Nothing waiting.</li>') + '</ul></div>';
  qa('[data-op]').forEach(function (b) { b.onclick = function () { S.ownerP = b.dataset.op; render(); }; });
  qa('[data-biz-go]').forEach(function (b) { b.onclick = function () { switchBiz(b.dataset.bizGo); }; });
  qa('[data-owner-go]').forEach(function (b) { b.onclick = function () { var v = b.dataset.ownerGo; if (v === 'invoices') go('invoices'); else { S.biz = v === 'requests' ? (reqs[0] ? reqs[0].biz : 'cozy') : 'cozy'; lsSet('nv_biz', S.biz); S.data = scopeData(S.full, S.biz); applyBizTheme(); shell(); go(v); } }; });
};

/* ---------- Cozy Apartments home ---------- */
VIEWS.cozyhome = function () {
  var t = today(), us = units().filter(function (u) { return u.active !== false; }), mgr = aptMgr(), h = '';
  var occ = us.filter(function (u) { return occupant(u, t); }).length;
  var reqs = (S.data.requests || []).filter(function (q) { return q.status === 'New'; });
  var pay = stays().filter(needsPayout), sync = S.full.channelSync;
  var desk = typeof myDuty === 'function' && myDuty() === 'desk';
  if (mgr && desk) h += '<div class="kpi-grid"><button class="card row-btn" data-go="apts" style="display:block;text-align:left"><div class="small muted">Occupied tonight</div><div class="v">' + occ + ' of ' + us.length + '</div></button><button class="card row-btn" data-go="requests" style="display:block;text-align:left"><div class="small muted">New requests</div><div class="v">' + reqs.length + '</div></button></div><div class="btn-row" style="margin-bottom:14px"><button class="btn gold" id="chPay">Record a payment</button><button class="btn quiet" id="chStay">+ Short stay</button><button class="btn quiet" id="chRep">+ Repair</button></div>';
  if (mgr && !desk) {
    var m = t.slice(0, 7), r = bizRange('m'), sm = bizSummary('cozy', r[0], r[1]);
    var rentInv = (S.data.invoices || []).filter(function (i) { return !i.void && i.rentMonth === m; }), billed = rentInv.reduce(function (a, i) { return a + invTotal(i); }, 0), paid = rentInv.reduce(function (a, i) { return a + invPaid(i); }, 0);
    var arrears = tenancies().reduce(function (a, x) { return a + tenancyArrears(x); }, 0);
    h += '<div class="kpi-grid">' +
      '<button class="card row-btn" data-go="apts" style="display:block;text-align:left"><div class="small muted">Occupied tonight</div><div class="v">' + occ + ' of ' + us.length + '</div></button>' +
      '<button class="card row-btn" data-go="tenancies" style="display:block;text-align:left"><div class="small muted">' + esc(MON_LONG[+m.slice(5) - 1]) + ' rent collected</div><div class="v">' + (billed ? pct(paid / billed) : '–') + '</div><div class="small muted">' + ec(paid) + ' of ' + ec(billed) + '</div></button>' +
      '<button class="card row-btn" data-go="aptperf" style="display:block;text-align:left"><div class="small muted">Net operating income</div><div class="v ' + (sm.operatingProfit >= 0 ? 'pos' : 'neg') + '">' + ec(sm.operatingProfit) + '</div><div class="small muted">This month so far</div></button>' +
      '<button class="card row-btn" data-go="tenancies" style="display:block;text-align:left"><div class="small muted">Rent arrears</div><div class="v ' + (arrears > 0 ? 'neg' : '') + '">' + ec(arrears) + '</div></button></div>' +
      '<div class="btn-row" style="margin-bottom:14px"><button class="btn gold" id="chRent">Raise rent</button><button class="btn quiet" id="chPay">Record a payment</button><button class="btn quiet" id="chStay">+ Short stay</button><button class="btn quiet" id="chRep">+ Repair</button></div>';
  } else if (!mgr) h += '<div class="card"><div class="small muted">Occupied tonight</div><div class="fig">' + occ + ' of ' + us.length + '</div></div>';
  if (reqs.length && mgr) h += '<div class="card req"><h2>New from the website</h2><ul class="list">' + reqs.slice(0, 5).map(function (q) { return '<li><button class="row-btn" data-go="requests"><span><span class="t">' + esc(q.name) + ' · ' + esc(q.kind) + '</span><br><span class="m">' + (q.arrive ? niceShort(q.arrive) + ' to ' + niceShort(q.leave) + ' · ' + q.nights + (q.nights === 1 ? ' night' : ' nights') : q.moveIn ? 'Move in ' + niceShort(q.moveIn) : '') + (q.people ? ' · ' + esc(q.people) + ' people' : '') + '</span></span><span class="chev">›</span></button></li>'; }).join('') + '</ul></div>';
  var arr = stays().filter(function (s) { return s.status !== 'Cancelled' && s.checkIn === t; }), dep = stays().filter(function (s) { return s.status !== 'Cancelled' && s.checkOut === t; });
  h += '<div class="card"><h2>Today</h2>' + (arr.length || dep.length ? '<ul class="list">' + arr.map(function (s) { return '<li class="kv"><span>Arriving: ' + esc(unitById(s.unitId).name) + ', ' + esc(s.guest.name) + '</span><span class="pill">' + esc(s.source) + '</span></li>'; }).join('') + dep.map(function (s) { return '<li class="kv"><span>Leaving: ' + esc(unitById(s.unitId).name) + ' · clean before the next guest</span><span class="pill">' + esc(s.source) + '</span></li>'; }).join('') + '</ul>' : '<p class="small muted" style="margin:0">No arrivals or departures today.</p>') + '</div>';
  if (mgr && pay.length) h += '<div class="card"><h2>Payouts to enter</h2><p class="small muted" style="margin-top:0">These bookings came from Airbnb or Booking.com. Their income is estimated from the nightly rate until you enter what the guest paid and what the site paid you.</p><ul class="list">' + pay.slice(0, 6).map(function (s) { return '<li><button class="row-btn" data-payout="' + s.id + '"><span><span class="t">' + esc(unitById(s.unitId).name) + ' · ' + esc(s.source) + '</span><br><span class="m">' + niceShort(s.checkIn) + ' to ' + niceShort(s.checkOut) + ' · estimated ' + ec(s.nights * s.rate) + '</span></span><span class="pill est">Enter payout</span></button></li>'; }).join('') + '</ul></div>';
  var linked = units().filter(function (u) { return u.channels && (u.channels.airbnb || u.channels.booking); }).length;
  h += '<div class="card"><div class="kv"><h2 style="margin:0">Airbnb and Booking.com</h2>' + (mgr && linked ? '<button class="btn quiet" id="chSync">Sync now</button>' : '') + '</div>' +
    (linked ? '<p class="small muted" style="margin:6px 0 0">' + linked + (linked === 1 ? ' unit is' : ' units are') + ' linked. Bookings come in every 30 minutes' + (sync ? '; last checked ' + new Date(sync.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + (sync.added ? ', ' + sync.added + ' new' : '') + ((sync.results || []).some(function (x) { return !x.ok; }) ? '. <b class="neg">Some links could not be read.</b>' : '.') : '.') + '</p>'
      : '<p class="small muted" style="margin:6px 0 0">Not linked yet. Add each unit’s calendar link in Manage, then Booking Sites, and their bookings will appear here with the occupancy and figures updated.</p>') +
    (mgr ? '<button class="btn link" data-go="channels" style="padding-left:0">Booking Sites</button>' : '') + '</div>';
  var open = repairs().filter(function (x) { return x.status !== 'Done'; });
  h += '<div class="card"><h2>Repairs <span class="small muted">' + open.length + ' open</span></h2>' + (open.length ? '<ul class="list">' + open.slice(0, 5).map(function (x) { return '<li class="kv"><span>' + esc(unitById(x.unitId).name) + ': ' + esc(x.issue) + '</span><span class="pill ' + (x.priority === 'Urgent' ? 'bad' : '') + '">' + esc(x.priority) + '</span></li>'; }).join('') + '</ul>' : '<p class="small muted" style="margin:0">Nothing to fix.</p>') + '</div>';
  $('view').innerHTML = h; bindGo();
  if ($('chRent')) $('chRent').onclick = function () { rentSheet(); };
  if ($('chPay')) $('chPay').onclick = function () { paymentPicker(); };
  if ($('chStay')) $('chStay').onclick = function () { stayEditor(); };
  if ($('chRep')) $('chRep').onclick = function () { repairEditor(); };
  if ($('chSync')) $('chSync').onclick = function () { api('syncChannels', {}, 'Checking Airbnb and Booking.com…').then(function (res) { var r = res.result; toast(r.added ? r.added + (r.added === 1 ? ' new booking' : ' new bookings') + ' added.' : 'Up to date.'); render(); }).catch(function () {}); };
  qa('[data-payout]').forEach(function (b) { b.onclick = function () { payoutSheet(stays().find(function (s) { return s.id === b.dataset.payout; })); }; });
};
function payoutSheet(s) {
  var fee = chFees()[s.source], est = s.nights * s.rate;
  openSheet(s.source + ' payout', '<p class="muted" style="margin-top:0">' + esc(unitById(s.unitId).name) + ' · ' + nice(s.checkIn) + ' to ' + nice(s.checkOut) + (s.extCode ? ' · ' + esc(s.extCode) : '') + '</p>' +
    '<div class="cols"><label class="f"><span>The guest paid (EC$)</span><input id="poG" inputmode="decimal" value="' + (est ? est.toFixed(2) : '') + '"></label><label class="f"><span>' + esc(s.source) + ' paid you (EC$)</span><input id="poP" inputmode="decimal" value="' + (est && fee != null ? (est * (1 - fee / 100)).toFixed(2) : '') + '"></label></div>' +
    '<label class="f"><span>Payout date</span><input id="poD" type="date" value="' + today() + '"></label>' +
    '<p class="small muted">Both figures are on the reservation in ' + esc(s.source) + '. The guest’s price becomes income and what the site kept is recorded as a booking site commission.</p>' +
    (s.extUrl ? '<a class="btn link" href="' + esc(s.extUrl) + '" target="_blank" rel="noopener" style="padding-left:0">Open the reservation</a>' : ''), 'Save payout');
  $('sheetGo').onclick = function () { api('recordPayout', { stayId: s.id, guestPaid: $('poG').value, payout: $('poP').value, date: $('poD').value }, 'Saving…').then(function () { closeSheet(); toast('Payout saved. Income and commission updated.'); render(); }).catch(function () {}); };
}
var nvStayEditor = stayEditor;
stayEditor = function (s) {
  nvStayEditor(s);
  if (!s || !s.id || CHANNELS.indexOf(s.source) < 0 || !$('syPdf')) return;
  var row = $('syPdf').parentNode;
  row.insertAdjacentHTML('beforebegin', '<div class="alert" style="margin:10px 0">' + (s.payout ? 'Payout entered: the guest paid ' + ec(s.guestPaid) + ', ' + esc(s.source) + ' paid ' + ec(s.payout) + '.' : 'From the ' + esc(s.source) + ' calendar. The price is an estimate until the payout is entered.') + (s.extUrl ? ' <a href="' + esc(s.extUrl) + '" target="_blank" rel="noopener">Open the reservation</a>' : '') + '</div>' +
    (!s.payout && aptMgr() ? '<button class="btn gold" id="syPayout" type="button" style="margin-bottom:8px">Enter payout</button>' : ''));
  if ($('syPayout')) $('syPayout').onclick = function () { closeSheet(); payoutSheet(s); };
};

/* ---------- website requests ---------- */
S.reqTab = 'New';
VIEWS.requests = function () {
  var all = (S.data.requests || []).slice().reverse(), mgr = S.data.me.role === 'owner' || S.data.me.role === 'member';
  var tabs = ['New', 'Contacted', 'Accepted', 'Declined', 'Closed'];
  var list = all.filter(function (q) { return q.status === S.reqTab; });
  var h = '<div class="chip-row">' + tabs.map(function (t) { var n = all.filter(function (q) { return q.status === t; }).length; return '<button class="btn ' + (S.reqTab === t ? 'gold' : 'quiet') + '" data-rt="' + t + '">' + t + (n ? ' · ' + n : '') + '</button>'; }).join('') + '</div>';
  h += list.length ? list.map(function (q) {
    var lines = [q.arrive ? nice(q.arrive) + ' to ' + nice(q.leave) + ' (' + q.nights + (q.nights === 1 ? ' night' : ' nights') + ')' : '', q.moveIn ? 'Move in ' + nice(q.moveIn) + (q.length ? ', for ' + esc(q.length) : '') : '', q.people ? q.people + ' people' : '', q.apartment && q.apartment !== 'Any' ? esc(q.apartment) : '',
      q.project ? esc(q.project) : '', q.location ? esc(q.location) : '', q.hire ? esc(q.hire) + (q.hireFrom ? ' from ' + nice(q.hireFrom) : '') : ''].filter(Boolean).join(' · ');
    var wa = (q.phone || '').replace(/[^0-9]/g, '');
    return '<div class="card req"><div class="kv"><h2 style="margin:0">' + esc(q.name) + '</h2><span class="pill">' + esc(q.kind) + '</span></div><p class="small muted" style="margin:4px 0 8px">' + new Date(q.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' · ' + esc(q.phone) + (q.email ? ' · ' + esc(q.email) : '') + '</p>' +
      (lines ? '<p style="margin:0 0 6px">' + lines + '</p>' : '') + (q.message ? '<p class="small" style="margin:0 0 8px">“' + esc(q.message) + '”</p>' : '') +
      (mgr ? '<div class="btn-row">' + (q.kind === 'Short stay' && q.status !== 'Accepted' && S.biz !== 'nv' ? '<button class="btn gold" data-rq-ok="' + q.id + '">Book it</button>' : '') +
        (wa ? '<a class="btn quiet" href="https://wa.me/' + wa + '?text=' + encodeURIComponent('Hi ' + q.name.split(' ')[0] + ', thank you for your enquiry. ') + '" target="_blank" rel="noopener" data-rq-wa="' + q.id + '">WhatsApp</a>' : '') +
        (q.status === 'New' ? '<button class="btn quiet" data-rq-st="' + q.id + ':Contacted">Mark contacted</button>' : '') + (['Accepted', 'Declined', 'Closed'].indexOf(q.status) < 0 ? '<button class="btn link" data-rq-st="' + q.id + ':Declined">Decline</button>' : '') + '</div>' : '') + '</div>';
  }).join('') : '<div class="card"><p class="muted" style="margin:0">Nothing here. Requests sent from the website’s enquiry form appear here as soon as they are sent.</p></div>';
  $('view').innerHTML = h;
  qa('[data-rt]').forEach(function (b) { b.onclick = function () { S.reqTab = b.dataset.rt; render(); }; });
  qa('[data-rq-st]').forEach(function (b) { b.onclick = function () { var p = b.dataset.rqSt.split(':'); api('setRequestStatus', { id: p[0], status: p[1] }, 'Saving…').then(function () { render(); }).catch(function () {}); }; });
  qa('[data-rq-wa]').forEach(function (b) { b.addEventListener('click', function () { var q = all.find(function (x) { return x.id === b.dataset.rqWa; }); if (q && q.status === 'New') api('setRequestStatus', { id: q.id, status: 'Contacted' }).then(function () { render(); }).catch(function () {}); }); });
  qa('[data-rq-ok]').forEach(function (b) { b.onclick = function () { acceptSheet(all.find(function (x) { return x.id === b.dataset.rqOk; })); }; });
};
function unitFree(u, a, z) { return !tenancies().some(function (x) { return x.unitId === u.id && ['Draft', 'Signed', 'Active'].indexOf(x.status) >= 0 && x.start < z && (!x.end || x.end >= a); }) && !stays().some(function (s) { return s.unitId === u.id && s.status !== 'Cancelled' && s.checkIn < z && s.checkOut > a; }); }
function acceptSheet(q) {
  var free = units().filter(function (u) { return u.active !== false && u.use !== 'Long-term' && unitFree(u, q.arrive, q.leave); });
  var want = (q.apartment || '').toLowerCase().replace('one', '1').replace('two', '2');
  free.sort(function (a, b) { var ma = want && (a.type || '').toLowerCase().indexOf(want.split(' ')[0]) >= 0 ? 0 : 1, mb = want && (b.type || '').toLowerCase().indexOf(want.split(' ')[0]) >= 0 ? 0 : 1; return ma - mb; });
  if (!free.length) { openSheet('No unit is free', '<p>No unit is free from ' + nice(q.arrive) + ' to ' + nice(q.leave) + '. Reply to ' + esc(q.name) + ' with other dates.</p>', 'Close'); $('sheetGo').onclick = closeSheet; return; }
  openSheet('Book ' + esc(q.name), '<p class="muted" style="margin-top:0">' + nice(q.arrive) + ' to ' + nice(q.leave) + ' · ' + q.nights + (q.nights === 1 ? ' night' : ' nights') + (q.people ? ' · ' + esc(q.people) + ' people' : '') + '</p>' +
    '<label class="f"><span>Unit (only free units are listed)</span><select id="aqU">' + free.map(function (u) { return '<option value="' + u.id + '" data-rate="' + (u.nightlyRate || '') + '">' + esc(u.name) + (u.type ? ' · ' + esc(u.type) : '') + '</option>'; }).join('') + '</select></label>' +
    '<div class="cols"><label class="f"><span>Nightly rate (EC$)</span><input id="aqR" inputmode="decimal" value="' + (free[0].nightlyRate || '') + '"></label><label class="f"><span>Cleaning fee (EC$)</span><input id="aqC" inputmode="decimal" value="0"></label></div>' +
    '<p class="small muted" id="aqT"></p>', 'Book it');
  var upd = function () { var n = q.nights * (parseFloat($('aqR').value) || 0) + (parseFloat($('aqC').value) || 0); $('aqT').textContent = 'Total ' + ec(n) + '. The calendar, occupancy and figures update straight away, and the nights close on Airbnb and Booking.com at their next check.'; };
  $('aqU').onchange = function () { $('aqR').value = $('aqU').selectedOptions[0].dataset.rate || ''; upd(); }; $('aqR').oninput = upd; $('aqC').oninput = upd; upd();
  $('sheetGo').onclick = function () { api('acceptStayRequest', { id: q.id, unitId: $('aqU').value, rate: $('aqR').value, cleaning: $('aqC').value }, 'Booking…').then(function () { closeSheet(); toast('Booked. Send ' + q.name.split(' ')[0] + ' the confirmation from the stay.'); S.reqTab = 'Accepted'; render(); }).catch(function () {}); };
}

/* ---------- Booking Sites: Airbnb and Booking.com calendar links ---------- */
VIEWS.channels = function () {
  var fees = chFees(), mgr = aptMgr(), base = location.origin, sync = S.full.channelSync, res = {};
  ((sync && sync.results) || []).forEach(function (r) { res[r.unitId + r.source] = r; });
  var h = '<div class="card"><h2>How it works</h2><p class="small" style="margin:0 0 6px">For each unit, paste the <b>Export calendar</b> link from Airbnb and from Booking.com. The app checks them every 30 minutes: new bookings are added, changed dates are moved, and bookings that disappear are cancelled. Occupancy and the reports update with them.</p>' +
    '<p class="small" style="margin:0">Then give each site this app’s link for the unit (under <b>Import calendar</b> on Airbnb and Booking.com), so nights booked here or on the other site are closed there too.</p></div>' +
    '<div class="alert">Airbnb and Booking.com share dates through these links, not guest names or prices. Each booking’s income is estimated from the unit’s nightly rate until you enter the payout, which takes a few seconds per booking.</div>' +
    '<div class="card"><h2>What the sites keep</h2><div class="cols"><label class="f"><span>Airbnb fee (%)</span><input id="feA" inputmode="decimal" value="' + (fees.Airbnb != null ? fees.Airbnb : 3) + '"></label><label class="f"><span>Booking.com commission (%)</span><input id="feB" inputmode="decimal" value="' + (fees['Booking.com'] != null ? fees['Booking.com'] : 15) + '"></label></div><p class="small muted" style="margin:0">Used only to estimate payouts before they arrive. Check the figures in your own Airbnb and Booking.com accounts.</p></div>';
  h += units().filter(function (u) { return u.active !== false; }).map(function (u) {
    var ch = u.channels || {}, st = function (src) { var r = res[u.id + src]; return r ? (r.ok ? '<span class="small pos">Read ' + r.events + (r.events === 1 ? ' booking' : ' bookings') + '</span>' : '<span class="small neg">' + esc(r.error) + '</span>') : ''; };
    var exp = u.icalToken ? '<div class="small muted" style="margin:8px 0 4px">This app’s calendar for ' + esc(u.name) + ':</div>' +
      '<div class="copyrow"><input readonly value="' + esc(base + '/ical/' + u.icalToken + '?for=airbnb') + '" aria-label="Link to give Airbnb"><button class="btn quiet" data-copy>Copy for Airbnb</button></div>' +
      '<div class="copyrow" style="margin-top:6px"><input readonly value="' + esc(base + '/ical/' + u.icalToken + '?for=booking') + '" aria-label="Link to give Booking.com"><button class="btn quiet" data-copy>Copy for Booking.com</button></div>' : '<div class="small muted">Save once to create this unit’s own calendar link.</div>';
    return '<div class="card"><h2>' + esc(u.name) + (u.use === 'Long-term' ? ' <span class="small muted">long-term only</span>' : '') + '</h2>' +
      '<label class="f"><span>Airbnb export link ' + st('Airbnb') + '</span><input data-ch="' + u.id + ':airbnb" value="' + v(ch.airbnb) + '" placeholder="https://www.airbnb.com/calendar/ical/…"' + (mgr ? '' : ' disabled') + '></label>' +
      '<label class="f"><span>Booking.com export link ' + st('Booking.com') + '</span><input data-ch="' + u.id + ':booking" value="' + v(ch.booking) + '" placeholder="https://ical.booking.com/v1/export?t=…"' + (mgr ? '' : ' disabled') + '></label>' + exp + '</div>';
  }).join('');
  if (mgr) h += '<div class="btn-row"><button class="btn gold" id="chSave">Save links</button><button class="btn quiet" id="chNow">Sync now</button></div>';
  $('view').innerHTML = h;
  qa('[data-copy]').forEach(function (b) { b.onclick = function () { var i = b.parentNode.querySelector('input'); i.select(); try { navigator.clipboard.writeText(i.value).then(function () { toast('Copied.'); }); } catch (e) { document.execCommand('copy'); toast('Copied.'); } }; });
  if ($('chSave')) $('chSave').onclick = function () {
    var links = {}; qa('[data-ch]').forEach(function (i) { var p = i.dataset.ch.split(':'); links[p[0]] = links[p[0]] || { unitId: p[0] }; links[p[0]][p[1]] = i.value.trim(); });
    api('saveChannels', { links: Object.keys(links).map(function (k) { return links[k]; }), fees: { Airbnb: $('feA').value, 'Booking.com': $('feB').value } }, 'Saving…').then(function () { toast('Saved.'); render(); }).catch(function () {});
  };
  if ($('chNow')) $('chNow').onclick = function () { api('syncChannels', {}, 'Checking Airbnb and Booking.com…').then(function (res) { var r = res.result; toast((r.added || 0) + ' added, ' + (r.updated || 0) + ' changed, ' + (r.cancelled || 0) + ' cancelled.'); render(); }).catch(function () {}); };
};

/* ---------- Occupancy and Revenue (Cozy report) ---------- */
S.occP = 'm';
VIEWS.aptperf = function () {
  var r = bizRange(S.occP), a = r[0], z = r[1], days = Math.round((Date.parse(z) - Date.parse(a)) / 864e5) + 1;
  var us = units().filter(function (u) { return u.active !== false; }), avail = us.length * days;
  var nightsIn = function (from, to) { var s = from > a ? from : a, e = to < addDays(z, 1) ? to : addDays(z, 1); return Math.max(0, Math.round((Date.parse(e) - Date.parse(s)) / 864e5)); };
  var live = stays().filter(function (s) { return s.status !== 'Cancelled'; });
  var stayNights = 0, tenNights = 0, src = {}, per = {};
  us.forEach(function (u) { per[u.id] = { n: 0, inc: 0, rep: 0 }; });
  live.forEach(function (s) {
    var n = nightsIn(s.checkIn, s.checkOut); if (!n) return; stayNights += n;
    var gross = s.guestPaid ? s.guestPaid * n / s.nights : (s.rate * n) + (s.checkIn >= a && s.checkIn <= z ? (s.cleaning || 0) : 0);
    var fee = s.payout ? (s.commission || 0) * n / s.nights : CHANNELS.indexOf(s.source) >= 0 && s.estimated ? gross * ((chFees()[s.source] || 0) / 100) : 0;
    var k = s.source || 'Direct'; src[k] = src[k] || { b: 0, n: 0, g: 0, f: 0, est: 0 }; src[k].b++; src[k].n += n; src[k].g += gross; src[k].f += fee; if (s.estimated && !s.payout) src[k].est++;
    if (per[s.unitId]) { per[s.unitId].n += n; per[s.unitId].inc += gross - fee; }
  });
  tenancies().filter(function (t) { return ['Signed', 'Active', 'Ended'].indexOf(t.status) >= 0; }).forEach(function (t) { var n = nightsIn(t.start, t.end ? addDays(t.end, 1) : addDays(z, 1)); tenNights += n; if (per[t.unitId]) per[t.unitId].n += n; });
  (S.data.invoices || []).filter(function (i) { return !i.void && i.tenancyId; }).forEach(function (i) { (i.lines || []).forEach(function (l) { if (l.date >= a && l.date <= z) { var t = tenancies().find(function (x) { return x.id === i.tenancyId; }); if (t && per[t.unitId]) per[t.unitId].inc += (+l.qty || 1) * (+l.price || 0); } }); });
  repairs().filter(function (x) { return x.done && x.done >= a && x.done <= z; }).forEach(function (x) { if (per[x.unitId]) per[x.unitId].rep += (+x.labour || 0) + (+x.materials || 0); });
  var sm = bizSummary('cozy', a, z), stayRev = Object.keys(src).reduce(function (t, k) { return t + src[k].g; }, 0);
  var h = '<div class="seg">' + [['m', 'This month'], ['lm', 'Last month'], ['q', 'Quarter'], ['y', 'Year']].map(function (p) { return '<button data-oc="' + p[0] + '" aria-pressed="' + (S.occP === p[0]) + '">' + p[1] + '</button>'; }).join('') + '</div>' +
    '<div class="kpi-grid"><div class="card"><div class="small muted">Occupancy</div><div class="v">' + pct((stayNights + tenNights) / avail) + '</div><div class="small muted">' + (stayNights + tenNights) + ' of ' + avail + ' unit nights</div></div>' +
    '<div class="card"><div class="small muted">Average nightly rate</div><div class="v">' + (stayNights ? ec(stayRev / stayNights) : '–') + '</div><div class="small muted">Short stays</div></div>' +
    '<div class="card"><div class="small muted">Income per available unit night</div><div class="v">' + ec(sm.revenue / Math.max(1, avail)) + '</div></div>' +
    '<div class="card"><div class="small muted">Net operating income</div><div class="v ' + (sm.operatingProfit >= 0 ? 'pos' : 'neg') + '">' + ec(sm.operatingProfit) + '</div><div class="small muted">' + esc(r[2]) + '</div></div></div>' +
    '<div class="card"><h2>Booking channels</h2><table><thead><tr><th>Source</th><th class="n">Nights</th><th class="n">Guests paid</th><th class="n">Site kept</th><th class="n">Net</th></tr></thead><tbody>' +
      (Object.keys(src).length ? Object.keys(src).sort().map(function (k) { var x = src[k]; return '<tr><td>' + esc(k) + (x.est ? ' <span class="pill est">' + x.est + ' estimated</span>' : '') + '</td><td class="n">' + x.n + '</td><td class="n">' + ec(x.g) + '</td><td class="n">' + ec(x.f) + '</td><td class="n">' + ec(x.g - x.f) + '</td></tr>'; }).join('') : '<tr><td colspan="5" class="muted">No short stays in this period.</td></tr>') + '</tbody></table>' +
      '<p class="small muted" style="margin:8px 0 0">Every direct booking keeps the site’s commission in the business. Estimated figures firm up when the payout is entered.</p></div>' +
    '<div class="card"><h2>Each unit</h2><table><thead><tr><th>Unit</th><th class="n">Nights</th><th class="n">Income</th><th class="n">Repairs</th></tr></thead><tbody>' +
      us.map(function (u) { var p = per[u.id]; return '<tr><td>' + esc(u.name) + '</td><td class="n">' + p.n + ' / ' + days + '</td><td class="n">' + ec(p.inc) + '</td><td class="n">' + (p.rep ? ec(p.rep) : '–') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  $('view').innerHTML = h;
  qa('[data-oc]').forEach(function (b) { b.onclick = function () { S.occP = b.dataset.oc; render(); }; });
};

/* ---------- who works in which business ---------- */
VIEWS.access = function () {
  var us = (S.full.users || []).filter(function (u) { return u.active !== false; });
  $('view').innerHTML = '<div class="card"><p class="small" style="margin:0">Choose which business each person works in. People see, and can change, only that business’s records. Crew never see money in either business, whichever they work in.</p></div>' +
    '<div class="card flush"><ul class="list">' + us.map(function (u) {
      return '<li class="kv" style="padding:12px 14px"><span><b>' + esc(u.name) + '</b><br><span class="small muted">' + esc(roleLabel(u.role)) + '</span></span>' + (u.role === 'owner' ? '<span class="small muted">Both, always</span>' :
        '<select data-acc="' + u.id + '" aria-label="Business for ' + esc(u.name) + '">' + [['both', 'Both businesses'], ['nv', 'NV Construction'], ['cozy', 'Cozy Apartments']].map(function (o) { return '<option value="' + o[0] + '"' + ((u.biz || 'both') === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>') + '</li>';
    }).join('') + '</ul></div><p class="small muted">New people join through an invitation in Team &amp; Permissions; set their business here once they have joined.</p>';
  qa('[data-acc]').forEach(function (s) { s.onchange = function () { api('setUserBiz', { userId: s.dataset.acc, biz: s.value }, 'Saving…').then(function () { toast('Saved. They will see the change next time they open the app.'); }).catch(function () { render(); }); }; });
};

/* ---------- needs attention: website requests and payouts ---------- */
var nvNeedsBiz = needsAttention;
needsAttention = function () {
  var items = nvNeedsBiz();
  if (isDriver()) return items;
  var reqs = (S.data.requests || []).filter(function (q) { return q.status === 'New'; });
  if (reqs.length) items.unshift(['user', 'warn', reqs.length + (reqs.length === 1 ? ' new request from the website' : ' new requests from the website'), reqs.slice(0, 2).map(function (q) { return q.name + ', ' + q.kind.toLowerCase(); }).join(' · '), 'requests']);
  var pay = stays().filter(needsPayout);
  if (pay.length) items.push(['wallet', 'info', pay.length + (pay.length === 1 ? ' booking site payout to enter' : ' booking site payouts to enter'), 'Income is estimated until then', 'cozyhome']);
  var bad = ((S.full && S.full.channelSync && S.full.channelSync.results) || []).filter(function (r) { return !r.ok; });
  if (bad.length && S.biz !== 'nv') items.push(['alarm', 'danger', bad.length + (bad.length === 1 ? ' booking site link is not working' : ' booking site links are not working'), 'Check them in Booking Sites', 'channels']);
  return items;
};
/* Opening a screen that belongs to the other business takes you to this business’s home instead */
var nvRenderBiz = render;
render = function () {
  if (S.data && S.full && S.data.me) {
    if (S.view === 'dashboard' && S.biz !== 'nv' && !isDriver()) S.view = homeFor(S.biz);
    else if (S.view === 'owner' && S.biz !== 'owner') S.view = homeFor(S.biz);
    else if (VIEW_BIZ[S.view] && VIEW_BIZ[S.view] !== 'both' && S.biz !== 'owner' && VIEW_BIZ[S.view] !== S.biz && ['projects', 'stays', 'repairs', 'apts', 'bookings', 'fuel'].indexOf(S.view) < 0) S.view = homeFor(S.biz);
  }
  nvRenderBiz();
};
/* The sign-in screens show both businesses, side by side and the same size */
function authBrand(sub) {
  return '<div class="duo-logos"><div class="dl dl-nv"><img src="/logo.jpg" alt="NV Construction"></div><div class="dl dl-cz"><img src="/cozy-logo.png" alt="Cozy Apartments SVG"></div></div>' +
    '<div class="duo-names"><span class="n-nv">NV Construction</span><span class="amp">and</span><span class="n-cz">Cozy Apartments</span></div><div class="sub">' + sub + '</div>';
}
document.head.insertAdjacentHTML('beforeend', '<style>' +
  '.auth.duo{background:linear-gradient(160deg,#141414 0%,#141414 45%,#0a2e23 100%)}' +
  '.duo-logos{display:flex;gap:14px;justify-content:center}' +
  '.duo-logos .dl{width:120px;height:120px;border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.35);overflow:hidden;display:grid;place-items:center}' +
  '.auth .duo-logos img{width:120px;height:120px;border-radius:0;box-shadow:none}' +
  '.duo-logos .dl-cz{background:#002d23}' +
  '.duo-logos .dl-cz span{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:.95rem;line-height:1.1;text-align:center;color:#fff}' +
  '.duo-names{display:flex;flex-wrap:wrap;justify-content:center;align-items:baseline;gap:6px 10px;margin-top:18px;text-align:center}' +
  '.duo-names .n-nv{font-family:var(--brand);font-size:2rem;letter-spacing:.05em;color:#c5a35a;line-height:1}' +
  '.duo-names .n-cz{font-family:Fraunces,Georgia,serif;font-weight:600;font-size:1.75rem;color:#d4a94b;line-height:1}' +
  '.duo-names .amp{color:#d8d2c4;font-size:1rem}' +
  '.auth.duo .lane{background:repeating-linear-gradient(90deg,#c5a35a 0 22px,transparent 22px 34px,#d4a94b 34px 56px,transparent 56px 68px)}' +
  '</style>');


/* ==================== staff duties, the site programme, quality and safety, turnovers, payroll, the tenant app ==================== */
var DUTY = { office: ['nv', 'Office and accounts'], pm: ['nv', 'Project manager'], foreman: ['nv', 'Site foreman'], crew: ['nv', 'Crew'], manager: ['cozy', 'Property manager'], desk: ['cozy', 'Front desk'], maint: ['cozy', 'Maintenance'], cleaner: ['cozy', 'Cleaner'] };
function myDuty() { var d = S.full || S.data; return (d && d.me && d.me.duty) || ''; }
function isTenant() { var d = S.full || S.data; return !!(d && d.me && d.me.role === 'tenant'); }
TITLES.turnovers = 'Turnovers and Cleaning'; TITLES.notices = 'Tenants and Notices'; TITLES.payroll = 'Payroll'; TITLES.payrun = 'Pay Run'; TITLES.thome = 'My Home'; TITLES.trepair = 'Report a Problem'; TITLES.tdocs = 'Documents and Receipts'; TITLES.tpay = 'How to Pay';
VIEW_BIZ.turnovers = 'cozy'; VIEW_BIZ.notices = 'cozy'; VIEW_BIZ.payroll = 'both'; VIEW_BIZ.payrun = 'both';
BIZ_TABS.foreman = [['projects', 'Projects'], ['+'], ['bookings', 'Jobs'], ['more', 'Manage']];
BIZ_TABS.cleaner = [['turnovers', 'Turnovers'], ['+'], ['repairs', 'Repairs'], ['more', 'Manage']];
BIZ_TABS.maint = [['repairs', 'Repairs'], ['+'], ['turnovers', 'Turnovers'], ['more', 'Manage']];
BIZ_TABS.desk = [['cozyhome', 'Home'], ['apts', 'Units'], ['+'], ['stays', 'Stays'], ['more', 'Manage']];
BIZ_TABS.tenant = [['thome', 'Home'], ['tpay', 'Pay'], ['trepair', 'Repairs'], ['tdocs', 'Documents']];
ICONS.turnovers = icon('checkc'); ICONS.thome = ICONS.dashboard; ICONS.tpay = icon('wallet'); ICONS.trepair = icon('alarm'); ICONS.tdocs = ICONS.invoices;
bizTabList = function () {
  if (isTenant()) return BIZ_TABS.tenant;
  var d = myDuty();
  if (BIZ_TABS[d] && (DUTY[d] || [])[0] === S.biz) return BIZ_TABS[d];
  return isDriver() ? BIZ_TABS[S.biz === 'cozy' ? 'cozyCrew' : 'nvCrew'] : BIZ_TABS[S.biz] || BIZ_TABS.nv;
};
var nvHomeFor = homeFor;
homeFor = function (b) { if (isTenant()) return 'thome'; var t = bizTabList(); return t[0][0] !== '+' && DUTY[myDuty()] ? t[0][0] : nvHomeFor(b); };
var nvRenderS4 = render;
render = function () {
  if (S.data && S.data.me && isTenant()) {
    S.biz = 'cozy'; applyBizTheme();
    if (['thome', 'tpay', 'trepair', 'tdocs', 'security', 'password', 'notify', 'passkeys', 'appearance'].indexOf(S.view) < 0) S.view = 'thome';
  } else if (S.data && S.data.me && DUTY[myDuty()] && ['dashboard', 'bookings', 'fuel', 'cozyhome', 'stays'].indexOf(S.view) >= 0 && topTabs().indexOf(S.view) < 0) S.view = homeFor(S.biz);
  nvRenderS4();
};
var nvShellS4 = shell;
shell = function () {
  nvShellS4();
  if (isTenant()) { var w = $('whoName'); if (w) w.innerHTML = esc(S.data.me.name) + '<span class="biz-tag">Cozy Apartments</span>'; }
};
var nvBizQuick = bizQuick;
bizQuick = function (q, drv) { return isTenant() ? [['thome', 'key', 'My home'], ['trepair', 'alarm', 'Report a problem'], ['tdocs', 'invoice', 'Documents']] : nvBizQuick(q, drv); };
var nvNewMenuS4 = newMenu;
newMenu = function () {
  if (isTenant()) { go('trepair'); return; }
  nvNewMenuS4();
  var d = myDuty(), m = document.querySelector('.sheet .menu'); if (!m) return;
  if (d === 'cleaner' || d === 'maint') { m.innerHTML = menuItem('mClean', 'checkc', 'Turnover checklist', 'Tick off the clean between guests') + menuItem('mRepS', 'alarm', 'Report a problem', 'Something broken or missing in a unit'); $('mClean').onclick = function () { closeSheet(); go('turnovers'); }; $('mRepS').onclick = function () { closeSheet(); repairEditor(); }; }
  if (d === 'foreman') { m.insertAdjacentHTML('afterbegin', menuItem('mLog', 'checkc', 'Today’s site log', 'Labour, weather, deliveries, progress and photos')); $('mLog').onclick = function () { closeSheet(); var p = (S.data.projects || []).find(function (x) { return x.status === 'On site'; }) || (S.data.projects || [])[0]; if (p) { S.projTab = 'site'; go('project', p.id); } }; }
};
/* Business Access gains each person’s duty */
var nvAccess = VIEWS.access;
VIEWS.access = function () {
  nvAccess();
  qa('[data-acc]').forEach(function (sel) {
    var u = (S.full.users || []).find(function (x) { return x.id === sel.dataset.acc; }); if (!u || u.role === 'tenant') return;
    sel.insertAdjacentHTML('afterend', '<select data-duty="' + u.id + '" aria-label="Duty for ' + esc(u.name) + '" style="margin-left:6px"><option value="">Duty: not set</option>' + Object.keys(DUTY).map(function (k) { return '<option value="' + k + '"' + (u.duty === k ? ' selected' : '') + '>' + (DUTY[k][0] === 'nv' ? 'NV: ' : 'Cozy: ') + DUTY[k][1] + '</option>'; }).join('') + '</select>');
  });
  $('view').insertAdjacentHTML('beforeend', '<div class="card"><h2>What each duty sees</h2><table><tbody>' + [['Office and accounts', 'NV Construction, including money and reports'], ['Project manager', 'NV projects and their costs; no payroll'], ['Site foreman', 'Projects, site log, programme, quality and safety; no money'], ['Crew', 'Jobs, fuel, site log and snags; no money'],
    ['Property manager', 'Cozy Apartments, including money and reports'], ['Front desk', 'Bookings, tenants and payments taken; no costs, profit or payroll'], ['Maintenance', 'Repairs and turnovers; no money'], ['Cleaner', 'Turnovers and checklists, and reporting problems; no money']].map(function (r) { return '<tr><td><b>' + r[0] + '</b></td><td>' + r[1] + '</td></tr>'; }).join('') + '</tbody></table><p class="small muted" style="margin:8px 0 0">Choosing a duty also sets the business and the access level. They are signed out once so the change applies.</p></div>');
  qa('[data-duty]').forEach(function (s) { s.onchange = function () { api('setUserDuty', { userId: s.dataset.duty, duty: s.value }, 'Saving…').then(function () { toast('Saved.'); render(); }).catch(function () { render(); }); }; });
};

/* ---------- the site programme: a timeline with the tasks that decide the finish date ---------- */
function workDaysAdd(d, n) { var t = new Date(d + 'T12:00:00Z'), k = 0; while (k < n) { t.setUTCDate(t.getUTCDate() + 1); var w = t.getUTCDay(); if (w !== 0) k++; } return t.toISOString().slice(0, 10); }
function workDaysBetween(a, z) { var t = new Date(a + 'T12:00:00Z'), e = new Date(z + 'T12:00:00Z'), k = 0; while (t < e) { t.setUTCDate(t.getUTCDate() + 1); if (t.getUTCDay() !== 0) k++; } return k; }
/** Earliest start and finish for each task, from its own start date or the tasks it waits for, then which tasks have no slack (the critical path). Working days are Monday to Saturday. */
function planTasks(p) {
  var ts = (p.tasks || []).map(function (t) { return Object.assign({}, t); }), by = {}; ts.forEach(function (t) { by[t.id] = t; });
  var start0 = p.start || today(), done = {}, guard = 0;
  var td = today();
  // unfinished work cannot happen in the past: what is left of each task is planned from today
  var es = function (t) { if (done[t.id]) return t.es; if (guard++ > 5000) return start0; var s = t.start || start0; (t.after || []).forEach(function (a) { if (by[a]) { var f = es(by[a]) && by[a].ef; if (f > s) s = f; } });
    if (t.progress < 100 && !t.progress && s < td) s = td;
    var ef = workDaysAdd(s, t.days); if (t.progress < 100) { var rem = workDaysAdd(s > td ? s : td, Math.max(1, Math.ceil(t.days * (100 - t.progress) / 100))); if (rem > ef) ef = rem; }
    t.es = s; t.ef = ef; done[t.id] = 1; return t.es; };
  ts.forEach(es);
  var finish = ts.reduce(function (m, t) { return t.ef > m ? t.ef : m; }, start0);
  ts.forEach(function (t) { t.lf = finish; }); // latest finish: backwards through the tasks that wait for each one
  for (var i = 0; i < ts.length + 2; i++) ts.forEach(function (t) { ts.forEach(function (s) { if ((s.after || []).indexOf(t.id) >= 0) { var ls = workDaysAdd(s.lf, -0) && shiftBack(s.lf, s.days); if (ls < t.lf) t.lf = ls; } }); });
  ts.forEach(function (t) { t.slack = workDaysBetween(t.ef, t.lf); t.critical = t.slack === 0; t.late = t.progress < 100 && t.ef < today(); t.expected = expectedPct(t); t.behind = t.progress + 10 < t.expected; });
  return { tasks: ts.sort(function (a, b) { return a.es < b.es ? -1 : a.es > b.es ? 1 : 0; }), finish: finish, start: start0 };
}
function shiftBack(d, n) { var t = new Date(d + 'T12:00:00Z'), k = 0; while (k < n) { t.setUTCDate(t.getUTCDate() - 1); if (t.getUTCDay() !== 0) k++; } return t.toISOString().slice(0, 10); }
function expectedPct(t) { var td = today(); if (td <= t.es) return 0; if (td >= t.ef) return 100; return Math.round(workDaysBetween(t.es, td) / Math.max(1, t.days) * 100); }
function progHtml(p, ro, foreman) {
  var pl = planTasks(p), ts = pl.tasks, h = '';
  if (!ts.length) return '<div class="card empty">No programme yet. Add the main tasks with how long each takes and what each waits for; the timeline, the critical path and the finish date are worked out for you.</div>' + (!ro && (projMgr() || foreman) ? '<button class="btn gold" id="tkAdd">+ Task</button>' : '');
  var a = pl.start, z = pl.finish, span = Math.max(1, (Date.parse(z) - Date.parse(a)) / 864e5), pos = function (d) { return Math.max(0, Math.min(100, (Date.parse(d) - Date.parse(a)) / 864e5 / span * 100)); };
  var behind = ts.filter(function (t) { return t.critical && (t.late || t.behind); });
  h += '<div class="card" style="background:var(--navy);color:#fff;border:0"><div class="kicker" style="color:#d8d2c4">Forecast finish</div><div class="fig" style="color:var(--gold);font-size:1.8rem">' + nice(z) + '</div><div class="small" style="color:#d8d2c4">' + (p.finish ? (z > p.finish ? workDaysBetween(p.finish, z) + ' working days after the planned finish of ' + nice(p.finish) : 'On or before the planned finish of ' + nice(p.finish)) : 'Set a planned finish on the project to compare') + '.' + (behind.length ? ' ' + behind.length + (behind.length === 1 ? ' task on the critical path is' : ' tasks on the critical path are') + ' behind.' : '') + '</div></div>';
  if (!ro && (projMgr() || foreman)) h += '<div class="toolbar"><button class="btn gold" id="tkAdd">+ Task</button></div>';
  var tdx = pos(today());
  h += '<div class="card"><div style="position:relative">' + (tdx > 0 && tdx < 100 ? '<div style="position:absolute;left:calc(40% + 60% * ' + (tdx / 100) + ');top:0;bottom:0;width:2px;background:var(--danger);z-index:2" aria-hidden="true"></div>' : '') +
    ts.map(function (t) { var l = pos(t.es), w = Math.max(1.5, pos(t.ef) - l);
      return '<button class="row-btn" data-tk="' + t.id + '" style="display:flex;align-items:center;gap:0;padding:6px 0;border-bottom:1px solid var(--rule);width:100%;text-align:left"><span style="width:40%;padding-right:8px;font-size:.88rem;line-height:1.2"><b>' + esc(t.name) + '</b><br><span class="small muted">' + niceShort(t.es) + ' · ' + t.days + 'd · ' + t.progress + '%' + (t.late ? ' · <span class="neg">late</span>' : t.behind ? ' · <span class="neg">behind</span>' : '') + '</span></span>' +
        '<span style="position:relative;width:60%;height:20px"><span style="position:absolute;left:' + l + '%;width:' + w + '%;top:3px;height:14px;border-radius:4px;background:' + (t.critical ? 'var(--navy)' : 'var(--gold)') + ';overflow:hidden;box-shadow:0 0 0 1px var(--gold)"><span style="display:block;height:100%;width:' + t.progress + '%;background:rgba(255,255,255,.45)"></span></span></span></button>'; }).join('') +
    '</div><div class="small muted" style="margin-top:8px;display:flex;gap:14px;flex-wrap:wrap"><span><span style="display:inline-block;width:14px;height:9px;background:var(--navy);border-radius:2px"></span> Critical path: a delay here moves the finish</span><span><span style="display:inline-block;width:14px;height:9px;background:var(--gold);border-radius:2px"></span> Has slack</span><span><span style="display:inline-block;width:2px;height:11px;background:var(--danger)"></span> Today</span></div></div>';
  var look = ts.filter(function (t) { return t.progress < 100 && t.es <= addDays(today(), 14); });
  h += '<div class="card"><h2>Next two weeks</h2>' + (look.length ? '<ul class="list">' + look.map(function (t) { return '<li class="kv"><span>' + esc(t.name) + (t.who ? ' · ' + esc(t.who) : '') + '</span><span class="small">' + niceShort(t.es) + ' to ' + niceShort(t.ef) + '</span></li>'; }).join('') + '</ul>' : '<p class="small muted" style="margin:0">Nothing starting in the next two weeks.</p>') + '</div>';
  return h;
}
function taskEditor(p, t) {
  t = t || { progress: 0, days: 5, after: [] };
  var full = projMgr() && !isDriver() || myDuty() === 'foreman', others = (p.tasks || []).filter(function (x) { return x.id !== t.id; });
  if (!full) { openSheet(t.name, '<label class="f"><span>How far along (%)</span><input id="tkP" type="range" min="0" max="100" step="5" value="' + (t.progress || 0) + '"><b id="tkPv">' + (t.progress || 0) + '%</b></label>', 'Save');
    $('tkP').oninput = function () { $('tkPv').textContent = $('tkP').value + '%'; };
    $('sheetGo').onclick = function () { api('saveTask', { projectId: p.id, task: { id: t.id, progress: $('tkP').value } }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); }; return; }
  openSheet(t.id ? 'Edit task' : 'Add a task', '<label class="f"><span>Task</span><input id="tkN" value="' + v(t.name) + '" placeholder="e.g. Roof sheeting"></label>' +
    '<div class="cols"><label class="f"><span>Stage</span><input id="tkS" value="' + v(t.phase) + '" list="tkSl" placeholder="e.g. Roof"></label><label class="f"><span>Working days</span><input id="tkD" inputmode="numeric" value="' + (t.days || '') + '"></label></div>' + datalist('tkSl', ['Site preparation', 'Foundations', 'Structure', 'Roof', 'Services', 'Finishes', 'Handover']) +
    '<label class="f"><span>Waits for (it starts when these finish)</span><select id="tkA" multiple size="' + Math.min(6, Math.max(2, others.length)) + '">' + others.map(function (x) { return '<option value="' + x.id + '"' + ((t.after || []).indexOf(x.id) >= 0 ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' +
    '<div class="cols"><label class="f"><span>Or starts on (if it waits for nothing)</span><input id="tkSt" type="date" value="' + v(t.start) + '"></label><label class="f"><span>Who</span><input id="tkW" value="' + v(t.who) + '" placeholder="Crew or subcontractor"></label></div>' +
    '<label class="f"><span>How far along: <b id="tkPv">' + (t.progress || 0) + '%</b></span><input id="tkP" type="range" min="0" max="100" step="5" value="' + (t.progress || 0) + '"></label>' +
    (t.id && projMgr() ? '<button class="btn link" id="tkDel" style="color:var(--danger)">Delete this task</button>' : ''), 'Save');
  $('tkP').oninput = function () { $('tkPv').textContent = $('tkP').value + '%'; };
  if ($('tkDel')) $('tkDel').onclick = function () { if (confirm('Delete this task?')) api('deleteTask', { projectId: p.id, taskId: t.id }, 'Deleting…').then(function () { closeSheet(); render(); }).catch(function () {}); };
  $('sheetGo').onclick = function () { api('saveTask', { projectId: p.id, task: { id: t.id, name: $('tkN').value, phase: $('tkS').value, days: $('tkD').value, start: $('tkSt').value, who: $('tkW').value, progress: $('tkP').value, after: [].map.call($('tkA').selectedOptions, function (o) { return o.value; }) } }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); };
}
/* ---------- quality and safety ---------- */
function qualityHtml(p, ro) {
  var q = p.quality || {}, ins = q.inspections || [], rfi = q.rfis || [], saf = q.safety || [], t = today();
  var lastInc = saf.filter(function (x) { return x.kind === 'Incident'; }).map(function (x) { return x.date; }).sort().pop();
  var daysSafe = lastInc ? Math.round((Date.parse(t) - Date.parse(lastInc)) / 864e5) : null;
  var pill = function (txt, cls) { return '<span class="pill ' + (cls || '') + '">' + txt + '</span>'; };
  var h = '<div class="kpi-grid"><div class="card"><div class="small muted">Open questions</div><div class="v">' + rfi.filter(function (x) { return x.status === 'Open'; }).length + '</div><div class="small muted">' + rfi.filter(function (x) { return x.status === 'Open' && x.due && x.due < t; }).length + ' overdue</div></div>' +
    '<div class="card"><div class="small muted">' + (daysSafe == null ? 'Incidents' : 'Days since an incident') + '</div><div class="v">' + (daysSafe == null ? 'None' : daysSafe) + '</div><div class="small muted">' + saf.filter(function (x) { return x.kind === 'Toolbox talk'; }).length + ' toolbox talks recorded</div></div></div>';
  var sec = function (title, kind, list, row, empty) { return '<div class="card"><div class="card-head"><h2 style="margin:0">' + title + '</h2>' + (ro ? '' : '<button class="btn quiet" data-qadd="' + kind + '">+ Add</button>') + '</div>' + (list.length ? '<ul class="list">' + list.slice(0, 30).map(function (x) { return '<li><button class="row-btn" data-qed="' + kind + ':' + x.id + '" style="width:100%;text-align:left">' + row(x) + '</button></li>'; }).join('') + '</ul>' : '<p class="small muted" style="margin:0">' + empty + '</p>') + '</div>'; };
  h += sec('Inspections', 'inspection', ins, function (x) { return '<span class="kv" style="width:100%"><span><span class="t">' + esc(x.title) + '</span><br><span class="m">' + nice(x.date) + (x.by ? ' · ' + esc(x.by) : '') + '</span></span>' + pill(x.result, x.result === 'Passed' ? 'good' : x.result === 'Failed' ? 'bad' : '') + '</span>'; }, 'Building authority inspections and your own checks, with the result.');
  h += sec('Questions (RFIs)', 'rfi', rfi, function (x) { return '<span class="kv" style="width:100%"><span><span class="t">' + esc(x.no) + ' · ' + esc(x.question.slice(0, 70)) + '</span><br><span class="m">To ' + esc(x.to || 'client') + (x.due ? ' · answer by ' + niceShort(x.due) : '') + '</span></span>' + pill(x.status === 'Open' && x.due && x.due < t ? 'Overdue' : x.status, x.status === 'Answered' ? 'good' : x.due && x.due < t ? 'bad' : '') + '</span>'; }, 'Questions to the client, architect or engineer, and their answers, so nothing is decided by memory.');
  h += sec('Safety', 'safety', saf, function (x) { return '<span class="kv" style="width:100%"><span><span class="t">' + esc(x.kind) + ' · ' + esc(x.detail.slice(0, 60)) + '</span><br><span class="m">' + nice(x.date) + (x.people ? ' · ' + x.people + ' signed' : '') + (x.expires ? ' · expires ' + niceShort(x.expires) : '') + '</span></span>' + pill(x.kind === 'Permit' && x.expires && x.expires < t ? 'Expired' : x.status, x.status === 'Closed' ? 'good' : x.kind === 'Near miss' || x.kind === 'Incident' ? 'bad' : '') + '</span>'; }, 'Toolbox talks, near misses, incidents, permits and safety checks.');
  return h;
}
function qualityEditor(p, kind, x) {
  x = x || {}; var t = today(), body;
  if (kind === 'inspection') body = '<label class="f"><span>What is inspected</span><input id="qT" value="' + v(x.title) + '" placeholder="e.g. Foundations before the pour"></label><div class="cols"><label class="f"><span>Date</span><input id="qD" type="date" value="' + (x.date || t) + '"></label><label class="f"><span>By</span><input id="qB" value="' + v(x.by) + '" placeholder="Building inspector, engineer, NV"></label></div><label class="f"><span>Result</span><select id="qR">' + opts(['Booked', 'Passed', 'Failed', 'Re-inspect'], x.result || 'Booked') + '</select></label><label class="f"><span>Notes</span><textarea id="qN">' + esc(x.notes || '') + '</textarea></label>';
  if (kind === 'rfi') body = '<label class="f"><span>Question</span><textarea id="qQ">' + esc(x.question || '') + '</textarea></label><div class="cols"><label class="f"><span>To</span><input id="qTo" value="' + v(x.to) + '" placeholder="Client, architect, engineer"></label><label class="f"><span>Answer needed by</span><input id="qDue" type="date" value="' + v(x.due) + '"></label></div><label class="f"><span>Answer (when it comes)</span><textarea id="qA">' + esc(x.answer || '') + '</textarea></label>';
  if (kind === 'safety') body = '<div class="cols"><label class="f"><span>Type</span><select id="qK">' + opts(['Toolbox talk', 'Near miss', 'Incident', 'Permit', 'Safety check'], x.kind || 'Toolbox talk') + '</select></label><label class="f"><span>Date</span><input id="qD" type="date" value="' + (x.date || t) + '"></label></div><label class="f"><span>What happened, or the topic</span><textarea id="qX">' + esc(x.detail || '') + '</textarea></label><div class="cols"><label class="f"><span>People who signed</span><input id="qPp" inputmode="numeric" value="' + (x.people || '') + '"></label><label class="f"><span>Permit expires</span><input id="qE" type="date" value="' + v(x.expires) + '"></label></div><label class="f"><span>Status</span><select id="qS">' + opts(['Open', 'Closed'], x.status || 'Open') + '</select></label>';
  openSheet({ inspection: 'Inspection', rfi: 'Question (RFI)', safety: 'Safety record' }[kind], body + (x.id && projMgr() && !isDriver() ? '<button class="btn link" id="qDel" style="color:var(--danger)">Delete</button>' : ''), 'Save');
  if ($('qDel')) $('qDel').onclick = function () { if (confirm('Delete this record?')) api('deleteQuality', { projectId: p.id, kind: kind, id: x.id }, 'Deleting…').then(function () { closeSheet(); render(); }).catch(function () {}); };
  $('sheetGo').onclick = function () {
    var item = { id: x.id };
    if (kind === 'inspection') Object.assign(item, { title: $('qT').value, date: $('qD').value, by: $('qB').value, result: $('qR').value, notes: $('qN').value });
    if (kind === 'rfi') Object.assign(item, { question: $('qQ').value, to: $('qTo').value, due: $('qDue').value, answer: $('qA').value, raised: x.raised });
    if (kind === 'safety') Object.assign(item, { kind: $('qK').value, date: $('qD').value, detail: $('qX').value, people: $('qPp').value, expires: $('qE').value, status: $('qS').value });
    api('saveQuality', { projectId: p.id, kind: kind, item: item }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {});
  };
}
/* ---------- the daily site log ---------- */
function diaryExtra(e) {
  var bits = [e.labour ? e.labour + ' on site' : '', e.hoursLost ? e.hoursLost + ' h lost' : '', e.deliveries ? 'Deliveries: ' + esc(e.deliveries) : '', e.plant ? 'Machines: ' + esc(e.plant) : '', e.visitors ? 'Visitors: ' + esc(e.visitors) : '', e.toolbox ? 'Toolbox talk: ' + esc(e.toolbox) : ''].filter(Boolean);
  return bits.length ? '<p class="small muted" style="margin:6px 0 0">' + bits.join(' · ') + '</p>' : '';
}
function siteLogEditor(p, e) {
  e = e || { date: today() };
  var open = (p.tasks || []).filter(function (t) { return t.progress < 100; }).slice(0, 8);
  openSheet(e.id ? 'Edit site log' : 'Today on site', '<div class="cols"><label class="f"><span>Date</span><input id="slD" type="date" value="' + v(e.date) + '"></label><label class="f"><span>Weather</span><input id="slW" value="' + v(e.weather) + '" list="slWl" placeholder="Sunny, showers after 2pm"></label></div>' + datalist('slWl', ['Sunny', 'Cloudy', 'Showers', 'Heavy rain', 'Windy', 'Storm warning']) +
    '<div class="cols"><label class="f"><span>People on site</span><input id="slL" inputmode="numeric" value="' + (e.labour || '') + '"></label><label class="f"><span>Hours lost (weather, delays)</span><input id="slH" inputmode="decimal" value="' + (e.hoursLost || '') + '"></label></div>' +
    '<label class="f"><span>Who was on site</span><input id="slC" value="' + v(e.crew) + '" placeholder="Names, trades and subcontractors"></label>' +
    '<label class="f"><span>Work done today</span><textarea id="slN">' + esc(e.notes || '') + '</textarea></label>' +
    (open.length ? '<div class="f"><span style="font-weight:600">Progress on the programme</span>' + open.map(function (t) { return '<label class="kv" style="gap:8px"><span class="small" style="flex:1">' + esc(t.name) + '</span><input type="range" min="0" max="100" step="5" value="' + t.progress + '" data-tkp="' + t.id + '" style="flex:1"><b class="small" data-tkv="' + t.id + '" style="width:3em;text-align:right">' + t.progress + '%</b></label>'; }).join('') + '</div>' : '') +
    '<label class="f"><span>Deliveries</span><input id="slDl" value="' + v(e.deliveries) + '" placeholder="What arrived, and anything missing"></label>' +
    '<div class="cols"><label class="f"><span>Machines and hours</span><input id="slPl" value="' + v(e.plant) + '" placeholder="Mini excavator 5 h"></label><label class="f"><span>Visitors</span><input id="slV" value="' + v(e.visitors) + '" placeholder="Client, inspector"></label></div>' +
    '<label class="f"><span>Toolbox talk (topic)</span><input id="slT" value="' + v(e.toolbox) + '" placeholder="Working at height"></label>' +
    '<label class="f"><span>Problems</span><input id="slI" value="' + v(e.issues) + '"></label><label class="f"><span>Overall progress (%)</span><input id="slP" inputmode="numeric" value="' + (e.progress != null ? e.progress : '') + '"></label>' +
    '<p class="small muted">Add photos to the project after saving.</p>', 'Save');
  qa('[data-tkp]').forEach(function (r) { r.oninput = function () { document.querySelector('[data-tkv="' + r.dataset.tkp + '"]').textContent = r.value + '%'; }; });
  $('sheetGo').onclick = function () {
    var tasks = qa('[data-tkp]').map ? qa('[data-tkp]').map(function (r) { return { id: r.dataset.tkp, progress: r.value }; }) : [].map.call(qa('[data-tkp]'), function (r) { return { id: r.dataset.tkp, progress: r.value }; });
    api('saveDiary', { projectId: p.id, entry: { id: e.id, date: $('slD').value, weather: $('slW').value, crew: $('slC').value, notes: $('slN').value, issues: $('slI').value, progress: $('slP').value, labour: $('slL').value, hoursLost: $('slH').value, deliveries: $('slDl').value, plant: $('slPl').value, visitors: $('slV').value, toolbox: $('slT').value, tasks: tasks } }, 'Saving…').then(function () { closeSheet(); toast('Site log saved.'); render(); }).catch(function () {});
  };
}
var nvProjectView = VIEWS.project;
VIEWS.project = function () {
  nvProjectView();
  var p = projById(S.param); if (!p) return;
  var ro = isViewOnly(), fm = myDuty() === 'foreman', ex = $('pjExtra');
  if (ex) {
    ex.innerHTML = ex.dataset.tab === 'prog' ? progHtml(p, ro, fm) : qualityHtml(p, ro);
    if ($('tkAdd')) $('tkAdd').onclick = function () { taskEditor(p); };
    qa('[data-tk]').forEach(function (b) { b.onclick = function () { if (!ro) taskEditor(p, (p.tasks || []).find(function (x) { return x.id === b.dataset.tk; })); }; });
    qa('[data-qadd]').forEach(function (b) { b.onclick = function () { qualityEditor(p, b.dataset.qadd); }; });
    qa('[data-qed]').forEach(function (b) { b.onclick = function () { if (ro) return; var k = b.dataset.qed.split(':'), list = { inspection: 'inspections', rfi: 'rfis', safety: 'safety' }[k[0]]; qualityEditor(p, k[0], ((p.quality || {})[list] || []).find(function (x) { return x.id === k[1]; })); }; });
  }
  if ($('pjDy')) $('pjDy').onclick = function () { siteLogEditor(p); };
  qa('[data-dy]').forEach(function (b) { b.onclick = function () { siteLogEditor(p, p.diary.find(function (x) { return x.id === b.dataset.dy; })); }; });
};

/* ---------- turnovers: cleans between guests ---------- */
var CLEAN_DEFAULT = ['Strip the beds and put on fresh linen', 'Clean and restock the bathroom', 'Clean the kitchen and empty the fridge', 'Sweep and mop the floors', 'Empty the bins', 'Check for damage or anything missing', 'Lock up and leave the key'];
function cleanList() { var a = (S.data.aptSettings || {}).cleanList; return a && a.length ? a : CLEAN_DEFAULT; }
VIEWS.turnovers = function () {
  var t = today(), outs = stays().filter(function (s) { return s.status !== 'Cancelled' && s.checkOut >= addDays(t, -1) && s.checkOut <= addDays(t, 7); }).sort(function (a, b) { return a.checkOut < b.checkOut ? -1 : 1; });
  var next = function (s) { return stays().filter(function (x) { return x.unitId === s.unitId && x.status !== 'Cancelled' && x.checkIn >= s.checkOut && x.id !== s.id; }).sort(function (a, b) { return a.checkIn < b.checkIn ? -1 : 1; })[0]; };
  var h = '<div class="card"><p class="small" style="margin:0">Every guest check-out needs a clean before the next arrival. Open one, tick off the checklist as you go, and report anything broken. The office sees when each unit is ready.</p></div>';
  h += outs.length ? outs.map(function (s) { var n = next(s), c = s.clean || null, same = n && n.checkIn === s.checkOut;
    return '<button class="card row-btn" data-cl="' + s.id + '" style="display:block;text-align:left;width:100%"><div class="kv"><b>' + esc(unitById(s.unitId).name) + '</b><span class="pill ' + (c && c.done ? 'good' : s.checkOut <= t ? 'bad' : '') + '">' + (c && c.done ? 'Ready' : c ? 'Started' : s.checkOut < t ? 'Not cleaned' : 'To clean') + '</span></div>' +
      '<div class="small muted" style="margin-top:4px">Guest leaves ' + (s.checkOut === t ? 'today' : nice(s.checkOut)) + ' by ' + esc(aS().checkOut || '11am') + (n ? ' · next guest ' + (same ? '<b>the same day</b>' : nice(n.checkIn)) : ' · no one booked next') + (c ? ' · ' + c.items.filter(function (i) { return i.done; }).length + ' of ' + c.items.length + ' done by ' + esc(c.by) : '') + '</div></button>'; }).join('') : '<div class="card empty">No check-outs in the next week.</div>';
  $('view').innerHTML = h;
  qa('[data-cl]').forEach(function (b) { b.onclick = function () { cleanSheet(stays().find(function (s) { return s.id === b.dataset.cl; })); }; });
};
function cleanSheet(s) {
  var c = s.clean || {}, prev = {}; (c.items || []).forEach(function (i) { prev[i.text] = i.done; });
  openSheet(unitById(s.unitId).name + ' turnover', '<p class="muted" style="margin-top:0">Guest leaves ' + nice(s.checkOut) + '.</p>' + cleanList().map(function (txt, k) { return '<label class="check" style="padding:9px 0;border-bottom:1px solid var(--rule)"><input type="checkbox" data-ci="' + k + '"' + (prev[txt] ? ' checked' : '') + '> ' + esc(txt) + '</label>'; }).join('') +
    '<label class="f"><span>Notes for the office</span><input id="clN" value="' + v(c.note) + '" placeholder="e.g. One towel missing"></label><button class="btn link" id="clRep" style="padding-left:0">Something broken? Report it</button>', 'Save');
  $('clRep').onclick = function () { closeSheet(); repairEditor({ unitId: s.unitId }); };
  $('sheetGo').onclick = function () { var items = cleanList().map(function (txt, k) { return { text: txt, done: document.querySelector('[data-ci="' + k + '"]').checked }; });
    api('markCleaned', { stayId: s.id, items: items, note: $('clN').value }, 'Saving…').then(function () { closeSheet(); toast(items.every(function (i) { return i.done; }) ? 'Unit marked ready for the next guest.' : 'Saved. Finish the list to mark the unit ready.'); render(); }).catch(function () {}); };
}

/* ---------- tenants: payments they report, notices, and invitations to the tenant app ---------- */
VIEWS.notices = function () {
  var pn = (S.data.payNotices || []).filter(function (n) { return n.status === 'New'; }), ns = S.data.notices || [], mgr = aptMgr();
  var tenants = (S.full.users || []).filter(function (u) { return u.role === 'tenant'; });
  var h = '<div class="card"><h2>Payments tenants say they have made</h2>' + (pn.length ? '<ul class="list">' + pn.map(function (n) { var t = tenancies().find(function (x) { return x.id === n.tenancyId; }) || { unitId: '' };
      return '<li style="padding:10px 0;border-bottom:1px solid var(--rule)"><div class="kv"><b>' + esc(n.name) + ' · ' + esc(unitById(t.unitId).name) + '</b><b class="num">' + ec2(n.amount) + '</b></div><div class="small muted">' + nice(n.date) + ' · ' + esc(n.method) + (n.reference ? ' · ref ' + esc(n.reference) : '') + '</div>' +
        (mgr ? '<div class="btn-row" style="margin-top:8px"><button class="btn gold" data-pnok="' + n.id + '">It arrived: record it</button><button class="btn quiet" data-pnno="' + n.id + '">Not received</button></div>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="small muted" style="margin:0">None waiting. When a tenant taps “I have paid” in the tenant app, it appears here for you to check against the bank.</p>') + '</div>';
  h += '<div class="card"><div class="card-head"><h2 style="margin:0">Notices to tenants</h2>' + (mgr ? '<button class="btn quiet" id="ntAdd">+ Notice</button>' : '') + '</div>' + (ns.length ? '<ul class="list">' + ns.map(function (n) { return '<li class="kv" style="padding:8px 0"><span><span class="small muted">' + nice(n.date) + '</span><br>' + esc(n.text) + '</span>' + (mgr ? '<button class="btn link" data-ntx="' + n.id + '">Remove</button>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="small muted" style="margin:0">Notices appear on every tenant’s home screen in the tenant app.</p>') + '</div>';
  h += '<div class="card"><h2>Tenant app</h2><p class="small" style="margin:0 0 8px">' + tenants.length + (tenants.length === 1 ? ' tenant uses' : ' tenants use') + ' the tenant app. Invite a tenant from their tenancy: open the tenancy and tap <b>Invite to the tenant app</b>. They see only their own home, rent, receipts and repairs.</p></div>';
  $('view').innerHTML = h;
  qa('[data-pnok]').forEach(function (b) { b.onclick = function () { api('confirmPayNotice', { id: b.dataset.pnok }, 'Recording…').then(function () { toast('Payment recorded and the receipt is ready.'); render(); }).catch(function () {}); }; });
  qa('[data-pnno]').forEach(function (b) { b.onclick = function () { var r = prompt('Why? The tenant will see this.', 'Not in the bank yet'); if (r != null) api('rejectPayNotice', { id: b.dataset.pnno, reason: r }, 'Saving…').then(function () { render(); }).catch(function () {}); }; });
  qa('[data-ntx]').forEach(function (b) { b.onclick = function () { api('deleteNotice', { id: b.dataset.ntx }, 'Removing…').then(function () { render(); }).catch(function () {}); }; });
  if ($('ntAdd')) $('ntAdd').onclick = function () { openSheet('Notice to all tenants', '<label class="f"><span>Notice</span><textarea id="ntT" placeholder="Water will be off on Saturday from 8am to 12pm while the tanks are cleaned."></textarea></label>', 'Post notice'); $('sheetGo').onclick = function () { api('saveNotice', { text: $('ntT').value }, 'Posting…').then(function () { closeSheet(); render(); }).catch(function () {}); }; };
};
var nvTenancyView = VIEWS.tenancy;
VIEWS.tenancy = function () {
  nvTenancyView();
  var t = tenancies().find(function (x) { return x.id === S.param; }); if (!t || !aptMgr() || ['Draft', 'Signed', 'Active'].indexOf(t.status) < 0) return;
  var has = (S.full.users || []).some(function (u) { return u.role === 'tenant' && u.tenancyId === t.id; });
  $('view').insertAdjacentHTML('afterbegin', '<div class="card"><div class="kv"><span><b>Tenant app</b><br><span class="small muted">' + (has ? esc(t.tenant.name) + ' has joined.' : 'Lets ' + esc(t.tenant.name.split(' ')[0]) + ' see their rent and receipts, report problems and tell you when they have paid.') + '</span></span>' + (has ? '' : '<button class="btn quiet" id="tnInv">Invite to the tenant app</button>') + '</div></div>');
  if ($('tnInv')) $('tnInv').onclick = function () { var code = newCode();
    api('createInvite', { name: t.tenant.name, role: 'tenant', code: code, tenancyId: t.id }, 'Creating…').then(function () {
      var link = location.origin + '/#/invite/' + code, msg = 'Hi ' + t.tenant.name.split(' ')[0] + ', here is your link to the ' + aS().name + ' tenant app, where you can see your rent and receipts and report anything that needs fixing. Open it to choose a username and password (it works once, within 72 hours): ' + link;
      openSheet('Invitation ready', '<p>Send this to <b>' + esc(t.tenant.name) + '</b>. It works once and expires in 72 hours.</p><textarea rows="4" readonly>' + esc(link) + '</textarea><div class="btn-row"><button class="btn gold" id="tiWa">Send on WhatsApp</button></div>', 'Done');
      $('tiWa').onclick = function () { window.open('https://wa.me/' + String(t.tenant.phone || '').replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(msg), '_blank'); };
      $('sheetGo').onclick = closeSheet;
    }).catch(function () {}); };
};
var nvCozyHomeS4 = VIEWS.cozyhome;
VIEWS.cozyhome = function () {
  nvCozyHomeS4();
  var pn = (S.data.payNotices || []).filter(function (n) { return n.status === 'New'; }), t = today();
  var outs = stays().filter(function (s) { return s.status !== 'Cancelled' && s.checkOut === t; });
  var extra = '';
  if (pn.length && aptMgr()) extra += '<button class="card row-btn req" data-go="notices" style="display:block;text-align:left;width:100%"><b>' + pn.length + (pn.length === 1 ? ' tenant says they have paid' : ' tenants say they have paid') + '</b><br><span class="small muted">Check the bank, then record it in one tap</span></button>';
  if (outs.length) extra += '<button class="card row-btn" data-go="turnovers" style="display:block;text-align:left;width:100%"><b>Cleans today</b><br><span class="small muted">' + outs.map(function (s) { return esc(unitById(s.unitId).name) + ': ' + (s.clean && s.clean.done ? 'ready' : 'to clean'); }).join(' · ') + '</span></button>';
  if (extra) { var first = $('view').querySelector('.card'); if (first) first.insertAdjacentHTML('beforebegin', extra); else $('view').insertAdjacentHTML('afterbegin', extra); bindGo(); }
};

/* ---------- the tenant app ---------- */
VIEWS.thome = function () {
  var t = S.data.tenancy, u = (S.data.units || [])[0] || { name: '' }, inv = (S.data.invoices || []).slice().sort(function (a, b) { return a.issueDate < b.issueDate ? 1 : -1; });
  if (!t) { $('view').innerHTML = '<div class="card">Your tenancy could not be found. Please contact ' + esc(aS().name) + '.</div>'; return; }
  var owed = inv.reduce(function (a, i) { return a + invBalance(i); }, 0), next = inv.find(function (i) { return invBalance(i) > 0.009; });
  var h = '<div class="card" style="background:var(--navy);color:#fff;border:0"><div class="kicker" style="color:#d8d2c4">' + esc(u.name) + '</div><div class="fig" style="font-size:1.9rem;color:#fff">Hello ' + esc(t.tenant.name.split(' ')[0]) + '</div><div class="small" style="color:#dbe9e6">Rent ' + ec2(t.rent) + ' a month, due on day ' + t.dueDay + '.' + ((t.credit || 0) > 0.009 ? ' You have ' + ec2(t.credit) + ' in credit.' : '') + '</div></div>';
  h += '<div class="card"><div class="small muted">' + (owed > 0.009 ? 'You owe' : 'You are up to date') + '</div><div class="fig num">' + ec2(owed) + '</div>' + (next ? '<div class="small muted">Oldest due ' + nice(next.dueDate || next.issueDate) + '</div>' : '') +
    '<div class="btn-row" style="margin-top:10px"><button class="btn gold" data-go="tpay">How to pay</button><button class="btn quiet" id="tPaid">I have paid</button></div></div>';
  var pn = (S.data.payNotices || []).slice(-3).reverse();
  if (pn.length) h += '<div class="card"><h2>Payments you told us about</h2><ul class="list">' + pn.map(function (n) { return '<li class="kv"><span>' + nice(n.date) + ' · ' + ec2(n.amount) + '</span><span class="pill ' + (n.status === 'Confirmed' ? 'good' : n.status === 'New' ? '' : 'bad') + '">' + (n.status === 'New' ? 'Being checked' : n.status === 'Confirmed' ? 'Received' : 'Not received' + (n.reason ? ': ' + esc(n.reason) : '')) + '</span></li>'; }).join('') + '</ul></div>';
  var ns = S.data.notices || [];
  if (ns.length) h += '<div class="card"><h2>From the building</h2>' + ns.slice(0, 3).map(function (n) { return '<p style="margin:0 0 8px"><span class="small muted">' + nice(n.date) + '</span><br>' + esc(n.text) + '</p>'; }).join('') + '</div>';
  var reps = (S.data.repairs || []).filter(function (r) { return r.status !== 'Done'; });
  h += '<button class="card row-btn" data-go="trepair" style="display:block;text-align:left;width:100%"><b>Report a problem</b><br><span class="small muted">' + (reps.length ? reps.length + (reps.length === 1 ? ' request open' : ' requests open') : 'Water, electrics, locks, appliances, anything that needs fixing') + '</span></button>';
  $('view').innerHTML = h; bindGo();
  $('tPaid').onclick = tenantPaidSheet;
};
function tenantPaidSheet() {
  openSheet('I have paid', '<p class="small muted" style="margin-top:0">Tell us about a payment and we will check it and send your receipt.</p><div class="cols"><label class="f"><span>Amount (EC$)</span><input id="tpA" inputmode="decimal"></label><label class="f"><span>Date paid</span><input id="tpD" type="date" value="' + today() + '"></label></div>' +
    '<label class="f"><span>How</span><select id="tpM">' + opts(['Local bank transfer', 'International transfer', 'Cash', 'Other'], 'Local bank transfer') + '</select></label><label class="f"><span>Reference or receipt number</span><input id="tpR"></label>', 'Send');
  $('sheetGo').onclick = function () { api('tenantPaid', { amount: $('tpA').value, date: $('tpD').value, method: $('tpM').value, reference: $('tpR').value }, 'Sending…').then(function () { closeSheet(); toast('Thank you. We will confirm it shortly.'); render(); }).catch(function () {}); };
}
VIEWS.tpay = function () {
  var t = S.data.tenancy, u = (S.data.units || [])[0] || { name: 'your unit' };
  $('view').innerHTML = '<div class="card"><h2>How to pay</h2>' + payWays(u.name).map(function (l) { return '<p style="margin:0 0 10px">' + esc(l) + '</p>'; }).join('') + ((paySet().cardLink) ? '<a class="btn gold" href="' + esc(paySet().cardLink) + '" target="_blank" rel="noopener">Pay by card</a>' : '') + '</div><button class="btn gold block" id="tPaid2">I have paid</button>';
  $('tPaid2').onclick = tenantPaidSheet;
};
VIEWS.trepair = function () {
  var reps = (S.data.repairs || []).slice().reverse();
  $('view').innerHTML = '<div class="card"><h2>Report a problem</h2><label class="f"><span>What is wrong?</span><textarea id="trI" placeholder="e.g. Water leaking under the kitchen sink"></textarea></label><label class="f"><span>How urgent?</span><select id="trP">' + opts(['Urgent', 'Soon', 'When convenient'], 'Soon') + '</select></label>' +
    '<p class="small muted" style="margin:0 0 8px">Urgent means water, electrics, security or anything unsafe. In an emergency, call the emergency services first, then us.</p><label class="check"><input type="checkbox" id="trE" checked> The repair team can come in if I am out</label><button class="btn gold block" id="trGo" style="margin-top:12px">Send</button></div>' +
    '<div class="card"><h2>Your requests</h2>' + (reps.length ? '<ul class="list">' + reps.map(function (r) { return '<li class="kv"><span>' + esc(r.issue) + '<br><span class="small muted">' + nice(r.reported) + '</span></span><span class="pill ' + (r.status === 'Done' ? 'good' : '') + '">' + (r.status === 'Done' ? 'Fixed' : r.status === 'In progress' ? 'Being fixed' : 'Received') + '</span></li>'; }).join('') + '</ul>' : '<p class="small muted" style="margin:0">None yet.</p>') + '</div>';
  $('trGo').onclick = function () { api('tenantRepair', { issue: $('trI').value, priority: $('trP').value, enter: $('trE').checked }, 'Sending…').then(function () { toast('Sent. We will be in touch.'); render(); }).catch(function () {}); };
};
VIEWS.tdocs = function () {
  var t = S.data.tenancy, inv = (S.data.invoices || []).slice().sort(function (a, b) { return a.issueDate < b.issueDate ? 1 : -1; });
  var h = '<div class="card"><h2>Tenancy agreement</h2><p class="small muted" style="margin:0 0 8px">' + (t && t.signedTenant && t.signedLandlord ? 'Signed by you and the landlord.' : 'Not fully signed yet.') + '</p><button class="btn quiet" id="tdAg">Open the agreement</button></div>';
  h += '<div class="card"><h2>Rent and receipts</h2>' + (inv.length ? '<ul class="list">' + inv.map(function (i) { var bal = invBalance(i); return '<li class="kv" style="padding:8px 0"><span>' + esc((i.lines[0] || {}).title || 'Rent') + '<br><span class="small muted">' + nice(i.issueDate) + ' · ' + ec2(invTotal(i)) + '</span></span>' + (bal > 0.009 ? '<span class="pill bad">' + ec2(bal) + ' due</span>' : '<button class="btn link" data-rc="' + i.id + '">Receipt</button>') + '</li>'; }).join('') + '</ul>' : '<p class="small muted" style="margin:0">Nothing yet.</p>') + '</div>';
  $('view').innerHTML = h;
  $('tdAg').onclick = function () { try { agreementPdf(t).then(function (r) { shareDoc(r.blob, r.name, 'Tenancy agreement'); }); } catch (e) { toast('The agreement could not be opened. Ask the office for a copy.', true); } };
  qa('[data-rc]').forEach(function (b) { b.onclick = function () { var i = inv.find(function (x) { return x.id === b.dataset.rc; }), p = i.payments[i.payments.length - 1]; try { pdfSheet('Receipt', function () { return receiptPdf(i, p); }); } catch (e) { toast('The receipt could not be opened.', true); } }; });
};

/* ---------- payroll ---------- */
function pr() { return S.data.payroll || { people: [], runs: [], settings: {} }; }
VIEWS.payroll = function () {
  if (!S.data.payroll) { $('view').innerHTML = '<div class="card">Payroll is for the owner and the office.</div>'; return; }
  var biz = S.biz === 'owner' ? '' : S.biz, people = pr().people.filter(function (x) { return !biz || x.biz === biz; }), runs = pr().runs.filter(function (r) { return !biz || r.biz === biz; }).slice().reverse();
  var h = '<div class="card"><p class="small" style="margin:0">Pay is worked out from timesheets or a fixed wage. NIS is taken off automatically (in 2026, 6.5% from the employee and 7.5% from the business on earnings up to EC$5,200 a month; 7% and 8% from 1 January 2027). PAYE is taken off at the rate your accountant gives for each person. When a run is paid, the app makes the BOSVG direct deposit file and each person’s payslip.</p></div>';
  h += '<div class="card"><div class="card-head"><h2 style="margin:0">People</h2><button class="btn quiet" id="ppAdd">+ Person</button></div>' + (people.length ? '<ul class="list">' + people.map(function (x) { return '<li><button class="row-btn" data-pp="' + x.id + '"><span><span class="t">' + esc(x.name) + (x.active === false ? ' (left)' : '') + '</span><br><span class="m">' + (x.biz === 'cozy' ? 'Cozy Apartments' : 'NV Construction') + (x.job ? ' · ' + esc(x.job) : '') + ' · ' + (x.type === 'timesheet' ? 'paid from timesheets' : ec2(x.wage) + ' a pay period') + (x.account ? ' · direct deposit' : ' · cash') + '</span></span><span class="chev">›</span></button></li>'; }).join('') + '</ul>' : '<p class="small muted" style="margin:0">Add each person you pay, with their bank details for direct deposit.</p>') + '</div>';
  h += '<div class="card"><div class="card-head"><h2 style="margin:0">Pay runs</h2><button class="btn gold" id="prNew">+ Pay run</button></div>' + (runs.length ? '<ul class="list">' + runs.map(function (r) { var net = r.lines.reduce(function (a, l) { return a + l.net; }, 0); return '<li><button class="row-btn" data-run="' + r.id + '"><span><span class="t">Pay run ' + r.no + ' · ' + (r.biz === 'cozy' ? 'Cozy' : 'NV') + '</span><br><span class="m">' + niceShort(r.from) + ' to ' + niceShort(r.to) + ' · paid ' + nice(r.payDate) + ' · net ' + ec2(net) + '</span></span><span class="pill ' + (r.status === 'Paid' ? 'good' : '') + '">' + r.status + '</span></button></li>'; }).join('') + '</ul>' : '<p class="small muted" style="margin:0">No pay runs yet.</p>') + '</div>';
  if (S.data.me.role === 'owner') h += '<div class="card"><h2>Bank file settings</h2><p class="small muted" style="margin-top:0">BOSVG asks for the bank routing (transit) number with each payment. Enter BOSVG’s number here (from the bank’s EFT agreement); people at other banks have their own on their record.</p><label class="f"><span>BOSVG routing/transit number</span><input id="prRt" value="' + v(pr().settings.routing) + '"></label><button class="btn quiet" id="prSv">Save</button></div>';
  $('view').innerHTML = h;
  $('ppAdd').onclick = function () { payPersonEditor(); };
  qa('[data-pp]').forEach(function (b) { b.onclick = function () { payPersonEditor(pr().people.find(function (x) { return x.id === b.dataset.pp; })); }; });
  qa('[data-run]').forEach(function (b) { b.onclick = function () { go('payrun', b.dataset.run); }; });
  if ($('prSv')) $('prSv').onclick = function () { api('savePaySettingsPayroll', { settings: Object.assign({}, pr().settings, { routing: $('prRt').value }) }, 'Saving…').then(function () { toast('Saved.'); }).catch(function () {}); };
  $('prNew').onclick = function () { var t = today(), m0 = t.slice(0, 7) + '-01';
    openSheet('New pay run', '<label class="f"><span>Business</span><select id="rnB">' + (biz ? '<option value="' + biz + '">' + BIZ_NAME[biz] + '</option>' : '<option value="nv">NV Construction</option><option value="cozy">Cozy Apartments</option>') + '</select></label><div class="cols"><label class="f"><span>From</span><input id="rnF" type="date" value="' + addDays(t, -6) + '"></label><label class="f"><span>To</span><input id="rnT" type="date" value="' + t + '"></label></div><label class="f"><span>Pay date</span><input id="rnP" type="date" value="' + t + '"></label><p class="small muted">Crew paid from timesheets get what they earned in these dates; everyone else gets their usual wage. You can change any line before paying.</p>', 'Work it out');
    $('sheetGo').onclick = function () { api('createPayRun', { biz: $('rnB').value, from: $('rnF').value, to: $('rnT').value, payDate: $('rnP').value }, 'Working out pay…').then(function (res) { closeSheet(); go('payrun', res.result.id); }).catch(function () {}); }; };
};
function payPersonEditor(x) {
  x = x || { biz: S.biz === 'cozy' ? 'cozy' : 'nv', type: 'wage', nis: true, accountType: 'SAV', bank: 'BOSVG' };
  var crew = (S.full.settings.drivers || []);
  openSheet(x.id ? x.name : 'Add a person', '<div class="cols"><label class="f"><span>Name</span><input id="ppN" value="' + v(x.name) + '"></label><label class="f"><span>Job</span><input id="ppJ" value="' + v(x.job) + '" placeholder="Labourer, cleaner"></label></div>' +
    '<div class="cols"><label class="f"><span>Business</span><select id="ppB"><option value="nv"' + (x.biz !== 'cozy' ? ' selected' : '') + '>NV Construction</option><option value="cozy"' + (x.biz === 'cozy' ? ' selected' : '') + '>Cozy Apartments</option></select></label><label class="f"><span>Paid</span><select id="ppT"><option value="wage"' + (x.type !== 'timesheet' ? ' selected' : '') + '>A set wage each run</option><option value="timesheet"' + (x.type === 'timesheet' ? ' selected' : '') + '>From timesheets (crew)</option></select></label></div>' +
    '<div class="cols"><label class="f"><span>Wage each pay run (EC$)</span><input id="ppW" inputmode="decimal" value="' + (x.wage || '') + '"></label><label class="f"><span>Crew member (for timesheets)</span><select id="ppL"><option value="">Not linked</option>' + crew.map(function (d) { return '<option value="' + d.id + '"' + (x.linkId === d.id ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('') + '</select></label></div>' +
    '<div class="cols"><label class="f"><span>NIS number</span><input id="ppNi" value="' + v(x.nisNo) + '"></label><label class="f"><span>PAYE (% of pay, from your accountant)</span><input id="ppPr" inputmode="decimal" value="' + (x.payeRate || '') + '"></label></div>' +
    '<label class="check"><input type="checkbox" id="ppNs"' + (x.nis !== false ? ' checked' : '') + '> Take off NIS</label>' +
    '<h3 class="rep-h">Direct deposit</h3><div class="cols"><label class="f"><span>Bank</span><input id="ppBk" value="' + v(x.bank) + '" list="ppBl"></label><label class="f"><span>Account type</span><select id="ppAt"><option value="SAV"' + (x.accountType !== 'DDA' ? ' selected' : '') + '>Savings (SAV)</option><option value="DDA"' + (x.accountType === 'DDA' ? ' selected' : '') + '>Chequing (DDA)</option></select></label></div>' + datalist('ppBl', ['BOSVG', 'First Citizens', 'Republic Bank', 'CIBC FirstCaribbean', 'St Vincent Co-operative Bank']) +
    '<div class="cols"><label class="f"><span>Account number</span><input id="ppAc" value="' + v(x.account) + '" inputmode="numeric"></label><label class="f"><span>Routing number (other banks only)</span><input id="ppRt" value="' + v(x.routing) + '"></label></div><p class="small muted">Leave the account number empty to pay this person in cash.</p>' +
    (x.id ? '<label class="check"><input type="checkbox" id="ppAct"' + (x.active === false ? ' checked' : '') + '> Has left (stop including in pay runs)</label>' : ''), 'Save');
  $('sheetGo').onclick = function () { api('savePayPerson', { person: { id: x.id, name: $('ppN').value, job: $('ppJ').value, biz: $('ppB').value, type: $('ppT').value, wage: $('ppW').value, linkId: $('ppL').value, nisNo: $('ppNi').value, payeRate: $('ppPr').value, nis: $('ppNs').checked, bank: $('ppBk').value, accountType: $('ppAt').value, account: $('ppAc').value, routing: $('ppRt').value, active: $('ppAct') ? !$('ppAct').checked : true } }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); };
}
VIEWS.payrun = function () {
  var r = pr().runs.find(function (x) { return x.id === S.param; }); if (!r) { $('view').innerHTML = '<div class="card">Pay run not found.</div>'; return; }
  var draft = r.status === 'Draft', s = function (k) { return r.lines.reduce(function (a, l) { return a + l[k]; }, 0); };
  var h = '<div class="card" style="background:var(--navy);color:#fff;border:0"><div class="kicker" style="color:#d8d2c4">Pay run ' + r.no + ' · ' + (r.biz === 'cozy' ? 'Cozy Apartments' : 'NV Construction') + ' · ' + r.status + '</div><div class="fig" style="color:var(--gold);font-size:1.8rem">' + ec2(s('net')) + ' to pay</div><div class="small" style="color:#d8d2c4">' + nice(r.from) + ' to ' + nice(r.to) + ', paid ' + nice(r.payDate) + '. NIS at ' + r.rates.ee + '% and ' + r.rates.er + '% on up to ' + ec2(r.rates.ceiling) + ' each.</div></div>';
  h += '<div class="card"><div class="scroll-x"><table><thead><tr><th>Person</th><th class="n">Gross</th><th class="n">NIS</th><th class="n">PAYE</th><th class="n">Other</th><th class="n">Net</th><th></th></tr></thead><tbody>' + r.lines.map(function (l) { return '<tr><td>' + esc(l.name) + '<br><span class="small muted">' + (l.account ? 'Direct deposit' : 'Cash') + '</span></td><td class="n">' + ec2(l.gross) + '</td><td class="n">' + ec2(l.nisEe) + '</td><td class="n">' + ec2(l.paye) + '</td><td class="n">' + ec2(l.other) + '</td><td class="n"><b>' + ec2(l.net) + '</b></td><td>' + (draft ? '<button class="btn link" data-pl="' + l.personId + '">Change</button>' : '<button class="btn link" data-ps="' + l.personId + '">Payslip</button>') + '</td></tr>'; }).join('') +
    '<tr><td><b>Total</b></td><td class="n"><b>' + ec2(s('gross')) + '</b></td><td class="n"><b>' + ec2(s('nisEe')) + '</b></td><td class="n"><b>' + ec2(s('paye')) + '</b></td><td class="n"><b>' + ec2(s('other')) + '</b></td><td class="n"><b>' + ec2(s('net')) + '</b></td><td></td></tr></tbody></table></div>' +
    '<p class="small muted" style="margin:8px 0 0">Employer NIS on top: ' + ec2(s('nisEr')) + '. To pay NIS this month: ' + ec2(s('nisEe') + s('nisEr')) + '. PAYE withheld: ' + ec2(s('paye')) + '.</p></div>';
  var dd = r.lines.filter(function (l) { return l.account && l.net > 0; });
  h += '<div class="btn-row">' + (draft ? '<button class="btn gold" id="prPay">Mark as paid</button><button class="btn quiet" id="prDel">Delete draft</button>' : '') + (dd.length ? '<button class="btn quiet" id="prCsv">BOSVG direct deposit file (' + dd.length + ')</button>' : '') + '</div>' +
    '<p class="small muted">Upload the file in BOSVG online banking under ECACH EFT and approve it there. ' + (r.lines.length - dd.length ? (r.lines.length - dd.length) + ' to pay in cash.' : '') + '</p>';
  $('view').innerHTML = h;
  qa('[data-pl]').forEach(function (b) { b.onclick = function () { var l = r.lines.find(function (x) { return x.personId === b.dataset.pl; });
    openSheet(l.name, '<div class="cols"><label class="f"><span>Gross pay (EC$)</span><input id="plG" inputmode="decimal" value="' + l.gross.toFixed(2) + '"></label><label class="f"><span>Other deductions (EC$)</span><input id="plO" inputmode="decimal" value="' + l.other.toFixed(2) + '"></label></div><p class="small muted">NIS and PAYE are worked out again from the gross.</p>', 'Save');
    $('sheetGo').onclick = function () { api('savePayLine', { runId: r.id, personId: l.personId, gross: $('plG').value, other: $('plO').value }, 'Saving…').then(function () { closeSheet(); render(); }).catch(function () {}); }; }; });
  if ($('prPay')) $('prPay').onclick = function () { if (confirm('Mark pay run ' + r.no + ' as paid? Wages and employer NIS are recorded as costs, and crew paid from timesheets are marked as paid.')) api('finalisePayRun', { runId: r.id }, 'Saving…').then(function () { toast('Paid. Payslips and the bank file are ready.'); render(); }).catch(function () {}); };
  if ($('prDel')) $('prDel').onclick = function () { if (confirm('Delete this draft pay run?')) api('deletePayRun', { runId: r.id }, 'Deleting…').then(function () { go('payroll'); }).catch(function () {}); };
  if ($('prCsv')) $('prCsv').onclick = function () { var rows = [['Employee Name', 'Employee Account Number', 'Amount', 'Employee Account Type', 'Bank Routing/Transit Number', 'Reference #', 'Effective Date']];
    dd.forEach(function (l) { rows.push([l.name, l.account, l.net.toFixed(2), l.accountType || 'SAV', l.routing || pr().settings.routing || '', 'PAY' + r.no + '-' + r.payDate.replace(/-/g, ''), r.payDate]); });
    var csv = rows.map(function (row) { return row.map(function (c) { c = String(c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\r\n') + '\r\n';
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'BOSVG-payroll-' + r.no + '-' + r.payDate + '.csv'; document.body.appendChild(a); a.click(); a.remove();
    if (!pr().settings.routing && dd.some(function (l) { return !l.routing; })) toast('Add BOSVG’s routing number in Payroll first; the file has a blank column.', true); };
  qa('[data-ps]').forEach(function (b) { b.onclick = function () { var l = r.lines.find(function (x) { return x.personId === b.dataset.ps; }); shareDoc(payslipPdf(r, l), 'Payslip-' + safeName(l.name) + '-' + r.payDate + '.pdf', 'Payslip'); }; });
};
function payslipPdf(r, l) {
  var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a5' }), st = S.full.settings, nm = r.biz === 'cozy' ? aS().name : st.businessName, y = 50;
  doc.setFillColor.apply(doc, r.biz === 'cozy' ? [1, 45, 35] : [20, 20, 20]); doc.rect(0, 0, 420, 70, 'F');
  var px = r.biz === 'cozy' && COZY_LOGO ? 84 : 28; if (px > 28) doc.addImage(COZY_LOGO, 'PNG', 20, 6, 58, 58);
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.text(nm, px, 32); doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.text('Payslip, pay run ' + r.no, px, 50);
  doc.setTextColor(30, 30, 30); y = 100; doc.setFontSize(12); doc.setFont('helvetica', 'bold'); doc.text(l.name, 28, y); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
  doc.text('Period ' + r.from + ' to ' + r.to + ', paid ' + r.payDate, 28, y + 16);
  var rows = [['Gross pay', l.gross], ['NIS (employee, ' + r.rates.ee + '%)', -l.nisEe], ['PAYE', -l.paye], ['Other deductions', -l.other]];
  y += 46; rows.forEach(function (x) { doc.text(x[0], 28, y); doc.text((x[1] < 0 ? '-' : '') + 'EC$' + Math.abs(x[1]).toFixed(2), 390, y, { align: 'right' }); y += 18; });
  doc.setDrawColor(200, 200, 200); doc.line(28, y - 8, 392, y - 8); doc.setFont('helvetica', 'bold'); doc.text('Net pay', 28, y + 6); doc.text('EC$' + l.net.toFixed(2), 390, y + 6, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(100, 100, 100);
  doc.text('Paid ' + (l.account ? 'by direct deposit to account ending ' + l.account.slice(-4) : 'in cash') + '. Employer NIS paid on top: EC$' + l.nisEr.toFixed(2) + '.', 28, y + 34);
  return doc.output('blob');
}

/* ---------- website bookings waiting for payment ---------- */
function holds() { return stays().filter(function (s) { return s.hold && !s.hold.paid && s.status !== 'Cancelled'; }).sort(function (a, b) { return a.hold.until < b.hold.until ? -1 : 1; }); }
var nvCozyHomeHold = VIEWS.cozyhome;
VIEWS.cozyhome = function () {
  nvCozyHomeHold();
  var hs = holds(); if (!hs.length || !aptMgr()) return;
  var html = '<div class="card req"><h2>Booked on the website, waiting for payment</h2><ul class="list">' + hs.map(function (s) {
    var until = new Date(s.hold.until), gp = s.hold.guestSaysPaid;
    return '<li style="padding:10px 0;border-bottom:1px solid var(--rule)"><div class="kv"><b>' + esc(s.guest.name) + ' · ' + esc(unitById(s.unitId).name) + '</b><b class="num">' + ec2(s.hold.due) + '</b></div>' +
      '<div class="small muted">' + esc(s.hold.ref) + ' · ' + niceShort(s.checkIn) + ' to ' + niceShort(s.checkOut) + ' · held until ' + until.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) + '</div>' +
      (gp ? '<div class="small" style="margin-top:4px"><b>Guest says paid</b> by ' + esc(gp.method || 'transfer') + (gp.reference ? ', ref ' + esc(gp.reference) : '') + '. Check the bank.</div>' : '') +
      '<div class="btn-row" style="margin-top:8px"><button class="btn gold" data-hpay="' + s.id + '">Payment received</button><a class="btn quiet" href="https://wa.me/' + String(s.guest.phone || '').replace(/[^0-9]/g, '') + '" target="_blank" rel="noopener">WhatsApp</a><button class="btn link" data-hrel="' + s.id + '">Release</button></div></li>'; }).join('') +
    '</ul><p class="small muted" style="margin:6px 0 0">Unpaid bookings are released automatically when their time runs out, and the nights go back on sale.</p></div>';
  var first = $('view').querySelector('.kpi-grid') || $('view').firstChild; if (first) first.insertAdjacentHTML('afterend', html); else $('view').insertAdjacentHTML('afterbegin', html);
  qa('[data-hpay]').forEach(function (b) { b.onclick = function () { stayPaySheet(stays().find(function (s) { return s.id === b.dataset.hpay; })); }; });
  qa('[data-hrel]').forEach(function (b) { b.onclick = function () { if (confirm('Release this booking? The nights go back on sale.')) api('releaseOnlineHold', { stayId: b.dataset.hrel }, 'Releasing…').then(function () { render(); }).catch(function () {}); }; });
};
var nvChannelsView = VIEWS.channels;
VIEWS.channels = function () {
  nvChannelsView();
  var o = (S.data.aptSettings || {}).online || {}, mgr = aptMgr();
  $('view').insertAdjacentHTML('afterbegin', '<div class="card"><h2>Booking on your website</h2><p class="small" style="margin:0 0 8px">Guests choose dates on the website, see only units that are free in this app, reserve, and pay. The unit is held for them while they pay; unpaid holds are released automatically. Units marked long-term only, or without a nightly rate, are never offered.</p>' +
    '<label class="check"><input type="checkbox" id="obOn"' + (o.on !== false ? ' checked' : '') + (mgr ? '' : ' disabled') + '> Take bookings on the website</label>' +
    '<div class="cols"><label class="f"><span>Hold for (hours)</span><input id="obH" inputmode="numeric" value="' + (o.holdHours || 24) + '"></label><label class="f"><span>Pay now (% of the total)</span><input id="obD" inputmode="numeric" value="' + (o.depositPct || 100) + '"></label></div>' +
    '<div class="cols"><label class="f"><span>Cleaning fee per stay (EC$)</span><input id="obC" inputmode="decimal" value="' + (o.cleaning || 0) + '"></label><label class="f"><span>Shortest stay (nights)</span><input id="obM" inputmode="numeric" value="' + (o.minNights || 1) + '"></label></div>' +
    '<p class="small muted" style="margin:0 0 8px">Guests pay by bank transfer, or by card through the link in How Customers Pay once BOSVG provides it.</p>' + (mgr ? '<button class="btn quiet" id="obSave">Save website booking</button>' : '') + '</div>');
  if ($('obSave')) $('obSave').onclick = function () { api('saveOnlineBooking', { online: { on: $('obOn').checked, holdHours: $('obH').value, depositPct: $('obD').value, cleaning: $('obC').value, minNights: $('obM').value } }, 'Saving…').then(function () { toast('Saved.'); render(); }).catch(function () {}); };
};
var nvNeedsHold = needsAttention;
needsAttention = function () {
  var items = nvNeedsHold(); if (isDriver() || isTenant()) return items;
  var hs = holds(), said = hs.filter(function (s) { return s.hold.guestSaysPaid; });
  if (said.length) items.unshift(['wallet', 'warn', said.length + (said.length === 1 ? ' website guest says they have paid' : ' website guests say they have paid'), 'Check the bank and confirm', 'cozyhome']);
  else if (hs.length) items.push(['calendar', 'info', hs.length + (hs.length === 1 ? ' website booking waiting for payment' : ' website bookings waiting for payment'), 'Held until paid or released', 'cozyhome']);
  return items;
};

S.period.anchor = today();
if ('serviceWorker' in navigator && !window.PREVIEW && location.protocol === 'https:') {
  window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
}
start();
})();
