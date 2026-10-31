// Year-end pack (PDF), full Excel export, and the emails that carry them.
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { sendMail, mailConfigured } from './mail.mjs';
import * as Calc from './calc.mjs';
import { saveToDrive, driveConfigured } from './drive.mjs';

const r2 = n => Math.round((n || 0) * 100) / 100;
const lineAmt = Calc.lineAmount;
const lineCost = Calc.lineCosts;
const paidOf = Calc.invPaid;
const clientName = (db, id) => (db.clients.find(c => c.id === id) || { name: 'Unknown customer' }).name;
const no3 = n => '#' + String(n).padStart(3, '0');
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ec = n => (n < 0 ? '-' : '') + 'EC$' + Math.abs(r2(n)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ec0 = n => (n < 0 ? '-' : '') + 'EC$' + Math.round(Math.abs(n)).toLocaleString('en-GB');

function allJobs(db) {
  const out = [];
  db.invoices.filter(i => !i.void).forEach(i => i.lines.forEach(l => out.push({ ...l, inv: i, client: clientName(db, i.clientId), amount: lineAmt(l), cost: lineCost(l) })));
  return out;
}

/** Only one truck's jobs and expenses, for reports scoped to a vehicle. */
export function scopeDb(db, truck) {
  if (!truck || truck === 'all') return db;
  return Object.assign({}, db, {
    invoices: db.invoices.map(i => Object.assign({}, i, { lines: i.lines.filter(l => l.truck === truck) })).filter(i => i.lines.length),
    expenses: db.expenses.filter(e => e.truck === truck)
  });
}
/** Final once every month in the period is closed in Business Settings; otherwise Provisional. */
/** The month of the first job or expense: months before it have nothing in them to close. */
export function firstActivityMonth(db) {
  const d = [].concat((db.invoices || []).filter(i => !i.void).flatMap(i => (i.lines || []).map(l => l.date)), (db.expenses || []).filter(e => !e.void).map(e => e.date)).filter(Boolean).sort()[0];
  return d ? d.slice(0, 7) : '';
}
export function periodStatus(db, to, from) {
  const closed = (db.settings.closedMonths || []), first = firstActivityMonth(db);
  let m = (from || to).slice(0, 7); const end = to.slice(0, 7);
  if (first && m < first) m = first;   // months before the business started trading count as closed
  if (first && end < first) return 'Final';
  while (m <= end) { if (!closed.includes(m)) return 'Provisional'; const [y, mo] = m.split('-').map(Number); m = mo === 12 ? (y + 1) + '-01' : y + '-' + String(mo + 1).padStart(2, '0'); }
  return 'Final';
}
export function yearSummary(db, year) { return periodSummary(db, year + '-01-01', year + '-12-31'); }
export function periodSummary(db, from, to) {
  const year = Number(from.slice(0, 4));
  const inYear = d => d >= from && d <= to;
  const F = Calc.facts(db), P = Calc.summarise(F, from, to);
  const jobs = P.jobs, exps = P.exps;
  const income = P.revenue, jobCosts = P.directCosts, jc = P.directSplit;
  const running = Calc.expenseSplit(exps), runningTotal = P.operatingExpenses, net = P.operatingProfit;
  const months = [];
  const spanDays = Math.round((Date.parse(to) - Date.parse(from)) / 86400000) + 1;
  if (spanDays <= 31) {
    const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let d = new Date(from + 'T12:00:00Z'); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
      const dd = d.toISOString().slice(0, 10), M = Calc.summarise(F, dd, dd);
      months.push({ month: (spanDays <= 7 ? DAY[d.getUTCDay()] + ' ' : '') + d.getUTCDate() + (spanDays <= 7 ? '' : ' ' + MON[d.getUTCMonth()]), trips: M.trips, income: M.revenue, costs: M.costs, net: M.operatingProfit, daily: true });
    }
  } else
  for (let d = new Date(from + 'T12:00:00Z'); d.toISOString().slice(0, 7) <= to.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) {
    const mm = d.toISOString().slice(0, 7), M = Calc.summarise(F, mm + '-01', mm + '-31');
    months.push({ month: MON[d.getUTCMonth()] + (from.slice(0, 4) !== to.slice(0, 4) ? ' ' + mm.slice(2, 4) : ''), trips: M.trips, income: M.revenue, costs: M.costs, net: M.operatingProfit });
  }
  const partners = (db.settings.partners || []).map(p => {
    const paidOut = (db.capital || []).filter(k => k.type === 'drawing' && k.partner === p.name && k.date && inYear(k.date)).reduce((t, k) => t + k.amount, 0);
    return { name: p.name, share: p.share, amount: net * p.share / 100, paidOut };
  });
  const invested = (db.startup || []).reduce((t, s) => t + s.amount, 0);
  const allNetTo = Calc.summarise(F, null, to).operatingProfit;
  const owed = db.invoices.filter(i => !i.void && i.issueDate <= to).map(i => ({ no: i.no, client: clientName(db, i.clientId), date: i.issueDate, balance: r2(i.lines.reduce((t, l) => t + lineAmt(l), 0) - paidOf(i)) })).filter(x => x.balance > 0.009).sort((a, b) => a.date < b.date ? -1 : 1);
  const cust = {};
  jobs.forEach(j => { const c = cust[j.client] || (cust[j.client] = { name: j.client, trips: 0, income: 0 }); c.trips++; c.income += j.amount; });
  const customers = Object.values(cust).sort((a, b) => b.income - a.income);
  const received = P.cashCollected;
  return { year, label: '', from, to, income, jobCosts, jc, running, runningTotal, net, margin: income ? net / income : 0, trips: jobs.length,
    invoices: db.invoices.filter(i => !i.void && inYear(i.issueDate)).length, months, partners, invested, recovered: allNetTo, owed, customers, received };
}

/** Excel workbook of records. With a year, only that year; without, everything (used for backups). */
export function buildWorkbook(db, year, from, to) {
  const inRange = d => from ? (d && d >= from && d <= to) : (!year || (d && d.startsWith(String(year))));
  const wb = XLSX.utils.book_new();
  const add = (name, rows) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'No records' }]), name);
  const jobs = allJobs(db);
  add('Jobs', jobs.filter(j => inRange(j.date)).map(j => ({ Date: j.date, Invoice: no3(j.inv.no), Customer: j.client, Truck: j.truck, Route: j.route, 'Type of work': j.category, Load: j.load,
    Description: j.title, Qty: j.qty, Price: j.price, Amount: j.amount, ...Object.fromEntries(Calc.COST_TYPES.map(([k, l]) => [l, (j.costs || {})[k] || 0])), 'Other direct': (j.costs || {}).other || 0, Net: r2(j.amount - j.cost) })));
  add('Invoices', db.invoices.filter(i => inRange(i.issueDate)).map(i => { const tot = i.lines.reduce((t, l) => t + lineAmt(l), 0), p = paidOf(i);
    return { Invoice: no3(i.no), Issued: i.issueDate, Due: i.dueDate, Customer: clientName(db, i.clientId), Total: r2(tot), Paid: r2(p), Balance: i.void ? 0 : r2(tot - p), Status: i.void ? 'Cancelled' : tot - p <= 0.009 ? 'Paid' : p > 0 ? 'Part-paid' : 'Unpaid', 'Private notes': i.internalNotes || '' }; }));
  const pays = []; db.invoices.forEach(i => (i.payments || []).forEach(p => { if (inRange(p.date)) pays.push({ Date: p.date, Invoice: no3(i.no), Customer: clientName(db, i.clientId), Amount: p.amount, Method: p.method, Note: p.note || '', 'Recorded by': p.by }); }));
  add('Payments', pays);
  add('Expenses', db.expenses.filter(e => inRange(e.date)).map(e => ({ Date: e.date, Truck: e.truck, Type: e.category, Description: e.description, Amount: e.amount, Workshop: e.workshop || '', Parts: e.parts || 0, Labour: e.labour || 0, 'Other cost': e.other || 0, Method: e.method, 'Who paid': e.paidBy || '', Cancelled: e.void ? e.void.reason : '' })));
  add('Equipment costs', (db.startup || []).map(s => ({ Truck: s.truck, Type: s.category, Description: s.description, 'Amount EC$': s.amount, Original: s.original || '', 'Who paid': s.paidBy || '' })));
  if ((db.capital || []).length) add('Partner capital', (db.capital || []).map(k => ({ Partner: k.partner, Type: k.type === 'drawing' ? 'Payout' : 'Contribution', Truck: k.truck || '', Item: k.item, 'GBP': k.gbp || '', 'EC$': k.amount, Date: k.date || '' })));
  add('Customers', db.clients.map(c => ({ Name: c.name, Phone: c.phone || '', Email: c.email || '', Address: c.address || '' })));
  if (!year) {
    add('Bookings', (db.bookings || []).map(b => ({ Date: b.date, Time: b.time || '', Truck: b.truck, Route: b.route, Customer: b.client, Load: b.load || '', Price: b.price || 0, Status: b.status })));
    add('Fuel', (db.fuel || []).map(f => ({ Date: f.date, Truck: f.truck, Litres: f.litres, Cost: f.cost, Odometer: f.odometer })));
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

/** The year-end pack as a PDF (Buffer). */
export function buildYearPdf(db, year, logo) { return buildPeriodPdf(db, { from: year + '-01-01', to: year + '-12-31', title: 'Annual Report', label: String(year) }, logo); }
export function buildPeriodPdf(db0, opt, logo) {
  const db = scopeDb(db0, opt.scope);
  const S = periodSummary(db, opt.from, opt.to), set = db.settings, year = opt.label;
  const status = periodStatus(db0, opt.to, opt.from), scopeTxt = opt.scope && opt.scope !== 'all' ? opt.scope : 'All operations';
  const range = (d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }));
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = 595.28, H = 841.89, M = 46;
  const NAVY = [20, 20, 20], GOLD = [197, 163, 90], INK = [27, 35, 51], MUTED = [107, 117, 136], RULE = [221, 226, 234], TINT = [244, 246, 250];
  const clean = t => String(t == null ? '' : t).replace(/→/g, 'to').replace(/[–—]/g, '-').replace(/[^\x00-\xFF]/g, '');
  const fill = c => doc.setFillColor(c[0], c[1], c[2]), color = c => doc.setTextColor(c[0], c[1], c[2]);
  let y = 0;
  const T = (t, x, yy, o) => doc.text(clean(t), x, yy, o);
  function header(first) {
    fill(NAVY); doc.rect(0, 0, W, first ? 130 : 56, 'F'); fill(GOLD); doc.rect(0, first ? 130 : 56, W, 3, 'F');
    if (first) {
      if (logo) { try { doc.addImage(logo, 'PNG', M - 6, 8, 114, 114); } catch (e) {} }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(255, 255, 255); T(String(opt.title || 'Financial Report').toUpperCase(), W - M, 58, { align: 'right' });
      doc.setFontSize(16); color(GOLD); T(String(year), W - M, 80, { align: 'right' });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(201, 210, 227); T(set.businessName + '  |  ' + range(opt.from) + ' to ' + range(opt.to) + '  |  ' + scopeTxt, W - M, 100, { align: 'right' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); color(status === 'Final' ? [126, 211, 140] : GOLD); T(status === 'Final' ? 'FINAL: ALL MONTHS CLOSED' : 'PROVISIONAL: PERIOD NOT YET CLOSED', W - M, 116, { align: 'right' });
      y = 160;
    } else { doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(255, 255, 255); T(set.businessName + '  |  ' + (opt.title || 'Financial Report') + ' ' + year, M, 34); y = 84; }
  }
  function need(h) { if (y + h > H - 60) { doc.addPage(); header(false); } }
  function h2(t) { y += 6; need(40); doc.setFont('helvetica', 'bold'); doc.setFontSize(12); color(NAVY); T(t.toUpperCase(), M, y); y += 8; fill(GOLD); doc.rect(M, y, 34, 2, 'F'); y += 16; }
  function row(cells, widths, opts) {
    opts = opts || {}; need(18);
    if (opts.head) { fill(NAVY); doc.rect(M, y - 12, W - 2 * M, 18, 'F'); doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); }
    else { doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); doc.setFontSize(9.5); color(opts.muted ? MUTED : INK); }
    let x = M + 6;
    cells.forEach((c, i) => { const w = widths[i]; if (i === 0) T(c, x, y); else T(c, x + w - 12, y, { align: 'right' }); x += w; });
    if (!opts.head) { doc.setDrawColor(RULE[0], RULE[1], RULE[2]); doc.setLineWidth(0.6); doc.line(M, y + 6, W - M, y + 6); }
    if (opts.bold && !opts.head) { doc.setDrawColor(INK[0], INK[1], INK[2]); doc.setLineWidth(1); doc.line(M, y - 12, W - M, y - 12); }
    y += 19;
  }
  // ---- chart helpers (drawn directly so the PDF stays sharp at any zoom) ----
  const GREY = [196, 205, 220], GREEN = [45, 122, 45], RED = [192, 57, 43], OCEAN = [26, 111, 168], SOFT = [234, 238, 245];
  const k = n => Math.abs(n) >= 1000 ? (n / 1000).toFixed(Math.abs(n) >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : String(Math.round(n));
  function niceMax(v) { if (v <= 0) return 1000; const p = Math.pow(10, Math.floor(Math.log10(v))); return Math.ceil(v / p * 2) / 2 * p; }
  function legend(items, x, yy) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8); items.forEach(it => { fill(it[1]); if (it[2] === 'line') { doc.setDrawColor(it[1][0], it[1][1], it[1][2]); doc.setLineWidth(2); doc.line(x, yy - 3, x + 12, yy - 3); } else doc.roundedRect(x, yy - 7, 9, 9, 2, 2, 'F'); color(INK); T(it[0], x + 15, yy); x += doc.getTextWidth(clean(it[0])) + 32; }); }
  function monthChart(months) {
    const hgt = 170, w = W - 2 * M, x0 = M + 34, w0 = w - 40; need(hgt + 40);
    const top = y, bot = y + hgt;
    const max = niceMax(Math.max(...months.map(m => Math.max(m.income, m.costs))));
    const minNet = Math.min(0, ...months.map(m => m.net)), lo = minNet < 0 ? -niceMax(-minNet) : 0, span = max - lo, Y = v => bot - (v - lo) / span * hgt;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5);
    for (let g = 0; g <= 4; g++) { const v = lo + span * g / 4, yy = Y(v); doc.setDrawColor(SOFT[0], SOFT[1], SOFT[2]); doc.setLineWidth(0.6); doc.line(x0, yy, x0 + w0, yy); color(MUTED); T(k(v), x0 - 6, yy + 2.5, { align: 'right' }); }
    const slot = w0 / months.length, bw = Math.min(11, slot * 0.3);
    months.forEach((m, i) => {
      const cx = x0 + slot * i + slot / 2;
      fill(NAVY); if (m.income > 0) doc.roundedRect(cx - bw - 1, Y(m.income), bw, Y(0) - Y(m.income), 1.5, 1.5, 'F');
      fill(GREY); if (m.costs > 0) doc.roundedRect(cx + 1, Y(m.costs), bw, Y(0) - Y(m.costs), 1.5, 1.5, 'F');
      color(MUTED); T(m.month, cx, bot + 12, { align: 'center' });
    });
    doc.setDrawColor(GOLD[0], GOLD[1], GOLD[2]); doc.setLineWidth(2);
    for (let i = 1; i < months.length; i++) doc.line(x0 + slot * (i - 0.5), Y(months[i - 1].net), x0 + slot * (i + 0.5), Y(months[i].net));
    months.forEach((m, i) => { fill(GOLD); doc.circle(x0 + slot * (i + 0.5), Y(m.net), 2.6, 'F'); fill([255, 255, 255]); doc.circle(x0 + slot * (i + 0.5), Y(m.net), 1.1, 'F'); });
    legend([['Revenue', NAVY], ['Costs', GREY], ['Operating profit', GOLD, 'line']], M, bot + 30);
    y = bot + 44;
  }
  function hBars(rows, opts) {
    opts = opts || {}; const lw = opts.labelW || 150, w = W - 2 * M, bx = M + lw, bwMax = w - lw - 132, max = Math.max(1, ...rows.map(r => Math.abs(r.value)));
    rows.forEach(r => {
      need(22); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); color(INK); T(r.label, M, y + 9);
      fill(SOFT); doc.roundedRect(bx, y, bwMax, 12, 3, 3, 'F');
      const bw = Math.max(2, bwMax * Math.abs(r.value) / max); fill(r.color || NAVY); doc.roundedRect(bx, y, bw, 12, 3, 3, 'F');
      doc.setFont('helvetica', 'bold'); color(INK); T(opts.fmt ? opts.fmt(r) : ec0(r.value), W - M, y + 9, { align: 'right' });
      y += 20;
    });
    y += 6;
  }
  function progress(frac, left, right) {
    need(46); const w = W - 2 * M; fill(SOFT); doc.roundedRect(M, y, w, 16, 8, 8, 'F');
    const f = Math.max(0, Math.min(1, frac)); if (f > 0) { fill(GREEN); doc.roundedRect(M, y, Math.max(16, w * f), 16, 8, 8, 'F'); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 255, 255); if (f > 0.12) T((f * 100).toFixed(1) + '%', M + 10, y + 11.5);
    doc.setFont('helvetica', 'normal'); color(MUTED); T(left, M, y + 30); T(right, W - M, y + 30, { align: 'right' }); y += 46;
  }
  function note(t) { need(30); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(MUTED); const ls = doc.splitTextToSize(clean(t), W - 2 * M); doc.text(ls, M, y); y += ls.length * 11 + 8; }

  header(true);
  // Headline tiles
  const tiles = [['Income', ec0(S.income)], ['Total costs', ec0(S.jobCosts + S.runningTotal)], ['Operating profit', ec0(S.net)], ['Margin', (S.margin * 100).toFixed(1) + '%'], ['Jobs', String(S.trips)]];
  const tw = (W - 2 * M - 4 * 8) / 5;
  tiles.forEach((t, i) => { const x = M + i * (tw + 8); fill(i === 2 ? NAVY : TINT); doc.roundedRect(x, y, tw, 54, 6, 6, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(i === 2 ? [201, 210, 227] : MUTED); T(t[0], x + 9, y + 18);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); color(i === 2 ? GOLD : NAVY); T(t[1], x + 9, y + 40); });
  y += 80;
  h2(S.months.length > 12 ? 'At a glance' : 'The period at a glance');
  monthChart(S.months);
  const best = S.months.slice().sort((a, b) => b.net - a.net)[0], busiest = S.months.slice().sort((a, b) => b.trips - a.trips)[0];
  note((S.months[0] && S.months[0].daily ? 'Best day for profit: ' : 'Best month for profit: ') + best.month + ' (' + ec0(best.net) + '). ' + (S.months[0] && S.months[0].daily ? 'Busiest day: ' : 'Busiest month: ') + busiest.month + ' (' + busiest.trips + ' jobs). Average income per job: ' + ec0(S.trips ? S.income / S.trips : 0) + '.');
  h2('Profit and loss');
  const PW = [W - 2 * M - 120, 120];
  row(['', 'EC$'], PW, { head: true });
  row(['Income from ' + S.trips + ' jobs (' + S.invoices + ' invoices)', ec(S.income)], PW, { bold: true });
  Calc.COST_TYPES.filter(([k]) => S.jc[k]).forEach(([k, lbl]) => row(['   less ' + lbl, ec(-S.jc[k])], PW, { muted: true }));
  row(['Profit after job costs', ec(S.income - S.jobCosts)], PW, { bold: true });
  Object.keys(S.running).sort((a, b) => S.running[b] - S.running[a]).forEach(kk => row(['   less ' + kk, ec(-S.running[kk])], PW, { muted: true }));
  row(['Operating profit', ec(S.net)], PW, { bold: true });
  y += 10;
  h2('Where the money went');
  const costRows = Calc.COST_TYPES.map(([k, lbl]) => [lbl, S.jc[k]]).concat(Object.keys(S.running).map(kk => [kk, S.running[kk]]))
    .filter(r => r[1] > 0).sort((a, b) => b[1] - a[1]);
  const costTotal = costRows.reduce((t, r) => t + r[1], 0) || 1;
  hBars(costRows.map((r, i) => ({ label: r[0], value: r[1], color: i === 0 ? GOLD : i < 3 ? NAVY : OCEAN })), { fmt: r => ec0(r.value) + '  ' + Math.round(r.value / costTotal * 100) + '%' });
  if (S.partners.length) { h2('Partner split');
  need(80);
  const pw = (W - 2 * M - 12 * (Math.max(1, S.partners.length) - 1)) / Math.max(1, S.partners.length);
  S.partners.forEach((p, i) => { const x = M + i * (pw + 12); fill(i === 0 ? NAVY : TINT); doc.roundedRect(x, y, pw, 64, 8, 8, 'F');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); color(i === 0 ? [201, 210, 227] : MUTED); T(p.name + '  ·  ' + p.share + '%', x + 12, y + 18);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); color(i === 0 ? GOLD : NAVY); T(ec0(p.amount), x + 12, y + 41);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); color(i === 0 ? [201, 210, 227] : MUTED); T('Share of operating profit for the period', x + 12, y + 56); });
  y += 84; }
  h2('Equipment investment');
  progress(S.invested ? S.recovered / S.invested : 0, 'Recovered ' + ec0(Math.max(0, S.recovered)) + ' of ' + ec0(S.invested) + ' invested', S.recovered >= S.invested ? 'Fully recovered, ' + ec0(S.recovered - S.invested) + ' surplus' : ec0(S.invested - S.recovered) + ' still to recover');
  h2('Customers');
  const custTop = S.customers.slice(0, 8);
  if (custTop.length) hBars(custTop.map((c, i) => ({ label: c.name.length > 26 ? c.name.slice(0, 25) + '…' : c.name, value: c.income, color: i === 0 ? GOLD : NAVY, trips: c.trips })), { fmt: r => ec0(r.value) + '  ·  ' + r.trips + (r.trips === 1 ? ' job' : ' jobs') });
  if (S.customers.length && S.income) note(S.customers[0].name + ' brought in ' + Math.round(S.customers[0].income / S.income * 100) + '% of income this year.');
  h2('Money owed at year end');
  if (!S.owed.length) { need(20); doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); color(MUTED); T('Nothing outstanding.', M, y); y += 20; }
  else {
    const OW = [W - 2 * M - 230, 110, 120];
    row(['Customer', 'Invoice', 'Balance'], OW, { head: true });
    S.owed.forEach(o => row([o.client + ' (' + o.date + ')', no3(o.no), ec(o.balance)], OW));
    row(['Total owed', '', ec(S.owed.reduce((t, o) => t + o.balance, 0))], OW, { bold: true });
  }
  y += 10;
  h2(S.months[0] && S.months[0].daily ? 'Day by day' : 'Month by month');
  const MW = [110, 60, 115, 115, 115].map((w, i, a) => i === 0 ? W - 2 * M - a.slice(1).reduce((s2, v) => s2 + v, 0) : w);
  row([S.months[0] && S.months[0].daily ? 'Day' : 'Month', 'Jobs', 'Income', 'Costs', 'Net'], MW, { head: true });
  S.months.forEach(m => row([m.month + (!m.daily && S.from.slice(0, 4) === S.to.slice(0, 4) ? ' ' + S.from.slice(0, 4) : ''), String(m.trips), ec(m.income), ec(m.costs), ec(m.net)], MW));
  row(['Total', String(S.trips), ec(S.income), ec(S.jobCosts + S.runningTotal), ec(S.net)], MW, { bold: true });
  y += 6;
  note('Cash received from customers in this period: ' + ec(S.received) + '. Profit is income less every job cost and running expense recorded in the app. Money owed reflects payments recorded up to the date this pack was produced. The attached spreadsheet holds every record for the year.');
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) { doc.setPage(p); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); color(MUTED);
    T('Produced by NV Ops on ' + new Date().toISOString().slice(0, 10), M, H - 30); T(p + ' of ' + pages, W - M, H - 30, { align: 'right' }); }
  return Buffer.from(doc.output('arraybuffer'));
}

export async function logoDataUrl() {
  try {
    const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
    if (!base) return null;
    const r = await fetch(base + '/logo-soft.png'); if (!r.ok) return null;
    return 'data:image/png;base64,' + Buffer.from(await r.arrayBuffer()).toString('base64');
  } catch (e) { return null; }
}

export async function emailReport(db0, opt, to) {
  const db = scopeDb(db0, opt.scope), S = periodSummary(db, opt.from, opt.to), status = periodStatus(db0, opt.to, opt.from);
  const pdf = buildPeriodPdf(db0, opt, await logoDataUrl()), xlsx = buildWorkbook(db, null, opt.from, opt.to);
  const name = opt.title + ' ' + opt.label;
  const text = [db.settings.businessName + ': ' + name + ' (' + status + ')', '',
    'Revenue: ' + ec(S.income), 'Total recorded costs: ' + ec(S.jobCosts + S.runningTotal), 'Operating profit: ' + ec(S.net) + ' (' + (S.margin * 100).toFixed(1) + '% margin)', 'Completed jobs: ' + S.trips,
    'Cash received: ' + ec(S.received), '', status === 'Final' ? 'Every month in this period is closed, so these figures are final.' : 'Provisional: not every month in this period has been closed in Business Settings, so figures may still change.',
    '', 'The report is attached as a PDF, with the records in the spreadsheet.', '', 'Sent by NV Ops.'].join('\n');
  await sendMail({ to, subject: 'NV Construction Ltd: ' + name + (status === 'Final' ? '' : ' (provisional)'), text,
    attachments: [{ filename: 'NV-' + name.replace(/\s+/g, '-') + '.pdf', content: pdf }, { filename: 'NV-Records-' + name.replace(/\s+/g, '-') + '.xlsx', content: xlsx }] });
  if (driveConfigured()) {
    try { await saveToDrive([{ name: name + '.pdf', mimeType: 'application/pdf', content: pdf }]); } catch (e) { console.error('Report not saved to Drive:', e.message); }
  }
  return { status, to };
}
export function lastQuarter(now) {
  const d = new Date(now || Date.now()), q = Math.floor(d.getUTCMonth() / 3), y = q === 0 ? d.getUTCFullYear() - 1 : d.getUTCFullYear(), qq = q === 0 ? 4 : q;
  const from = y + '-' + String((qq - 1) * 3 + 1).padStart(2, '0') + '-01', end = new Date(Date.UTC(y, qq * 3, 0)).toISOString().slice(0, 10);
  return { from, to: end, label: 'Q' + qq + ' ' + y, title: 'Quarterly Report' };
}

/** The period a summary covers, from "today" in St Vincent: last Monday to Sunday, or last calendar month. */
export function summaryPeriod(kind, today) {
  const t = new Date((today || new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10)) + 'T12:00:00Z');
  const iso = d => d.toISOString().slice(0, 10), fmt = d => d.getUTCDate() + ' ' + MON[d.getUTCMonth()];
  if (kind === 'weekly') {
    const end = new Date(t); end.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) - 1);   // last Sunday
    const start = new Date(end); start.setUTCDate(end.getUTCDate() - 6);
    const ps = new Date(start); ps.setUTCDate(start.getUTCDate() - 7); const pe = new Date(start); pe.setUTCDate(start.getUTCDate() - 1);
    return { kind, from: iso(start), to: iso(end), prevFrom: iso(ps), prevTo: iso(pe), title: 'Weekly Report', label: fmt(start) + ' to ' + fmt(end) + ' ' + end.getUTCFullYear(), prevName: 'the week before' };
  }
  const start = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1)), end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
  const ps = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 2, 1)), pe = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 0));
  return { kind, from: iso(start), to: iso(end), prevFrom: iso(ps), prevTo: iso(pe), title: 'Monthly Report', label: MONTHS[start.getUTCMonth()] + ' ' + start.getUTCFullYear(), prevName: MONTHS[ps.getUTCMonth()] };
}
/** A branded email (HTML with a plain-text copy) plus the PDF report for the period. */
export async function emailSummary(db, kind, to, today) {
  const P = summaryPeriod(kind, today), F = Calc.facts(db), cur = Calc.summarise(F, P.from, P.to), prev = Calc.summarise(F, P.prevFrom, P.prevTo);
  const tday = today || new Date(Date.now() - 4 * 3600000).toISOString().slice(0, 10), set = db.settings;
  const live = Calc.liveInvoices(db), owed = live.reduce((a, i) => a + Calc.invBalance(i), 0), od = live.filter(i => Calc.invBalance(i) > 0.009 && i.dueDate && i.dueDate < tday);
  const odAmt = od.reduce((a, i) => a + Calc.invBalance(i), 0), clients = {}; (db.clients || []).forEach(c => { clients[c.id] = c.name; });
  const group = key => { const m = {}; cur.jobs.forEach(j => { const k = (j[key] || 'Not set'); m[k] = m[k] || { k, n: 0, rev: 0, net: 0 }; m[k].n++; m[k].rev += j.amount; m[k].net += j.amount - j.cost; }); return Object.values(m).sort((a, b) => b.rev - a.rev); };
  const routes = group('route').slice(0, 5), custs = group('client').slice(0, 5);
  const in7 = new Date(tday + 'T12:00:00Z'); in7.setUTCDate(in7.getUTCDate() + 7); const next7 = in7.toISOString().slice(0, 10);
  const upcoming = (db.bookings || []).filter(b => (b.status === 'Booked' || b.status === 'Tentative') && b.date >= tday && b.date <= next7).sort((a, b) => a.date < b.date ? -1 : 1);
  const admin = (db.reminders || []).filter(r => r.due && r.due <= next7).sort((a, b) => a.due < b.due ? -1 : 1);
  const exp = Calc.expenseSplit(cur.exps), expRows = Object.keys(exp).sort((a, b) => exp[b] - exp[a]).slice(0, 6);
  const status = periodStatus(db, P.to, P.from), margin = cur.income ? cur.net / cur.income : null;
  const chg = (c, p, inv) => { if (!p && !c) return ''; if (!p) return ''; const d = (c - p) / Math.abs(p) * 100, good = inv ? d < 0 : d > 0; return '<div style="font-size:12px;color:' + (good ? '#2d7a2d' : '#b03a2e') + ';margin-top:2px">' + (d >= 0 ? '▲ ' : '▼ ') + Math.abs(Math.round(d)) + '% vs ' + P.prevName + '</div>'; };
  const tile = (lbl, val, sub) => '<td style="width:33%;padding:6px"><div style="background:#f4f6fa;border-radius:10px;padding:12px 14px"><div style="font-size:12px;color:#566179">' + lbl + '</div><div style="font-size:20px;font-weight:700;color:#141414;margin-top:2px">' + val + '</div>' + (sub || '') + '</div></td>';
  const sec = (t, body) => '<h2 style="font-family:Arial,sans-serif;font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#141414;margin:22px 0 4px">' + t + '</h2><div style="width:46px;height:3px;background:#c5a35a;margin-bottom:10px"></div>' + body;
  const tbl = (head, rows, nums) => { const al = i => (nums || []).includes(i) ? 'right' : 'left';
    return '<table style="width:100%;border-collapse:collapse;font-size:13px"><tr>' + head.map((h, i) => '<th style="background:#141414;color:#fff;text-align:' + al(i) + ';padding:7px 8px;font-weight:600">' + h + '</th>').join('') + '</tr>' +
    rows.map(r => '<tr>' + r.map((c, i) => '<td style="border-bottom:1px solid #dfe4ec;padding:7px 8px;text-align:' + al(i) + ';color:#14203d">' + c + '</td>').join('') + '</tr>').join('') + '</table>'; };
  const esc = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = '<div style="background:#eef1f6;padding:20px 0;font-family:Arial,Helvetica,sans-serif"><div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">' +
    '<div style="background:#141414;padding:22px 26px;border-bottom:4px solid #c5a35a"><div style="color:#c5a35a;font-size:12px;letter-spacing:.12em;text-transform:uppercase">' + esc(set.businessName) + '</div>' +
    '<div style="color:#fff;font-size:26px;font-weight:700;margin-top:4px">' + P.title + '</div><div style="color:#c3cde3;font-size:14px;margin-top:2px">' + P.label + (kind === 'monthly' ? ' · ' + status : '') + '</div></div>' +
    '<div style="padding:18px 20px 24px">' +
    '<table style="width:100%;border-collapse:collapse"><tr>' + tile('Revenue', ec0(cur.income), chg(cur.income, prev.income)) + tile('Operating profit', ec0(cur.net), chg(cur.net, prev.net)) + tile('Completed jobs', String(cur.trips), chg(cur.trips, prev.trips)) + '</tr><tr>' +
    tile('Recorded costs', ec0(cur.costs), chg(cur.costs, prev.costs, true)) + tile('Profit margin', margin == null ? '–' : Math.round(margin * 1000) / 10 + '%') + tile('Cash received', ec0(cur.received)) + '</tr></table>' +
    sec('Money owed', '<p style="font-size:14px;color:#14203d;margin:0">' + ec(owed) + ' is owed to the business today' + (od.length ? ', of which <b style="color:#b03a2e">' + ec(odAmt) + '</b> is overdue on ' + od.length + (od.length === 1 ? ' invoice' : ' invoices') + '.' : '. Nothing is overdue.') + '</p>' +
      (od.length ? tbl(['Customer', 'Invoice', 'Days late', 'Balance'], od.sort((a, b) => a.dueDate < b.dueDate ? -1 : 1).slice(0, 6).map(i => [esc(clients[i.clientId] || ''), '#' + String(i.no).padStart(3, '0'), String(Math.round((Date.parse(tday) - Date.parse(i.dueDate)) / 86400000)), ec(Calc.invBalance(i))]), [1, 2, 3]) : '')) +
    (routes.length ? sec('Areas', tbl(['Area', 'Jobs', 'Revenue', 'Direct profit'], routes.map(r => [esc(r.k), String(r.n), ec0(r.rev), ec0(r.net)]), [1, 2, 3])) : '') +
    (custs.length ? sec('Customers', tbl(['Customer', 'Jobs', 'Revenue'], custs.map(r => [esc(r.k), String(r.n), ec0(r.rev)]), [1, 2])) : '') +
    (expRows.length ? sec('Running costs', tbl(['Category', 'Amount'], expRows.map(k => [esc(k), ec(exp[k])]), [1])) : '') +
    sec('Next 7 days', (upcoming.length ? tbl(['Date', 'Customer', 'Area', 'Truck'], upcoming.slice(0, 8).map(b => [b.date.slice(8) + ' ' + MON[+b.date.slice(5, 7) - 1] + (b.status === 'Tentative' ? ' (tentative)' : ''), esc(b.client || ''), esc(b.route || ''), esc(b.truck || '')])) : '<p style="font-size:14px;color:#566179;margin:0">No jobs booked.</p>') +
      (admin.length ? '<p style="font-size:14px;color:#14203d;margin:10px 0 0"><b>Truck admin due:</b> ' + admin.slice(0, 5).map(r => esc(r.type) + ' (' + esc(r.truck) + ', ' + r.due.slice(8) + ' ' + MON[+r.due.slice(5, 7) - 1] + ')').join('; ') + '</p>' : '')) +
    '<p style="font-size:12px;color:#566179;margin:22px 0 0;line-height:1.5">' + (kind === 'monthly' ? (status === 'Final' ? 'Every month in this report is closed, so these figures are final.' : 'Provisional: close the month in Business Settings to make these figures final.') + ' ' : '') +
    'Operating profit is revenue less every job cost and running expense recorded in the app. The full report with charts is attached as a PDF.</p></div>' +
    '<div style="background:#141414;color:#c3cde3;font-size:12px;padding:12px 26px">Sent automatically by NV Ops · nv-ops.netlify.app</div></div></div>';
  const text = [set.businessName + ': ' + P.title + ', ' + P.label, '', 'Revenue: ' + ec(cur.income), 'Operating profit: ' + ec(cur.net), 'Completed jobs: ' + cur.trips, 'Recorded costs: ' + ec(cur.costs), 'Cash received: ' + ec(cur.received),
    'Owed today: ' + ec(owed) + (od.length ? ' (' + ec(odAmt) + ' overdue)' : ''), '', 'The full report is attached as a PDF.', '', 'Sent automatically by NV Ops.'].join('\n');
  const pdf = buildPeriodPdf(db, { from: P.from, to: P.to, title: P.title, label: P.label }, await logoDataUrl());
  await sendMail({ to, subject: 'NV Construction Ltd: ' + P.title + ', ' + P.label + (kind === 'monthly' && status !== 'Final' ? ' (provisional)' : ''), text, html,
    attachments: [{ filename: ('NV ' + P.title + ' ' + P.label).replace(/\s+/g, '-') + '.pdf', content: pdf }] });
  return { label: P.label, to };
}

export async function emailYearEnd(db, year, to) {
  const S = yearSummary(db, year);
  const pdf = buildYearPdf(db, year, await logoDataUrl());
  const xlsx = buildWorkbook(db, year);
  const text = [db.settings.businessName + ': year-end pack for ' + year, '',
    'Income: ' + ec(S.income), 'Total costs: ' + ec(S.jobCosts + S.runningTotal), 'Net profit: ' + ec(S.net) + ' (' + (S.margin * 100).toFixed(1) + '% margin)', 'Jobs: ' + S.trips,
    ...S.partners.map(p => p.name + "'s share (" + p.share + '%): ' + ec(p.amount)),
    'Money still owed: ' + ec(S.owed.reduce((t, o) => t + o.balance, 0)), '',
    'The full pack is attached as a PDF, with every record for the year in the spreadsheet.', '', 'Sent automatically by NV Ops.'].join('\n');
  await sendMail({ to, subject: 'NV Construction Ltd: year-end pack ' + year, text,
    attachments: [{ filename: 'NV-Year-End-' + year + '.pdf', content: pdf }, { filename: 'NV-Records-' + year + '.xlsx', content: xlsx }] });
  if (driveConfigured()) {
    try { await saveToDrive([{ name: 'Year-End Pack ' + year + '.pdf', mimeType: 'application/pdf', content: pdf }, { name: 'Year-End Records ' + year + '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: xlsx }], { shareWith: db.settings.driveShare || '' }); }
    catch (e) { console.error('Year-end pack not saved to Drive:', e.message); }
  }
  return S;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** "October 2026 Back Up" for the month containing the given date (St Vincent time). */
export function monthLabel(d) { const t = new Date(d.getTime() - 4 * 3600000); return MONTHS[t.getUTCMonth()] + ' ' + t.getUTCFullYear() + ' Back Up'; }

/** Monthly backup: saved to Google Drive (or emailed if Drive is not set up). Same name replaces the earlier copy. */
export async function monthlyBackup(db, label) {
  const { users, pushSubs, ...rest } = db; // passwords and device keys never leave the server
  const files = [
    { name: label + '.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', content: buildWorkbook(db) },
    { name: label + ' (restore copy).json', mimeType: 'application/json', content: JSON.stringify(rest) }
  ];
  if (driveConfigured()) {
    const r = await saveToDrive(files, { shareWith: db.settings.driveShare || '' });
    return { where: 'Google Drive', label, folder: r.folder || '' };
  }
  if (!mailConfigured()) { const e = new Error('Neither Google Drive nor email is set up, so the backup could not be saved.'); e.driveError = true; throw e; }
  await sendMail({ to: db.settings.backupEmails, subject: 'NV Ops ' + label, text: label + ' of NV Ops, attached. The spreadsheet is for reading; the .json file can restore the app if ever needed.',
    attachments: files.map(f => ({ filename: f.name, content: f.content })) });
  return { where: 'email', label, to: db.settings.backupEmails };
}

export async function emailBackup(db, to) {
  const day = new Date().toISOString().slice(0, 10);
  const { users, pushSubs, ...rest } = db; // passwords and device keys are never emailed
  const xlsx = buildWorkbook(db);
  const text = ['Weekly backup of NV Ops, ' + day + '.', '',
    db.invoices.length + ' invoices, ' + db.expenses.length + ' expenses, ' + db.clients.length + ' customers.', '',
    'The spreadsheet is for reading. The .json file is a complete copy that can be used to restore the app if ever needed. Keep this email.', '', 'Sent automatically by NV Ops.'].join('\n');
  await sendMail({ to, subject: 'NV Ops weekly backup ' + day, text,
    attachments: [{ filename: 'NV-backup-' + day + '.xlsx', content: xlsx }, { filename: 'NV-backup-' + day + '.json', content: JSON.stringify(rest) }] });
  return day;
}
