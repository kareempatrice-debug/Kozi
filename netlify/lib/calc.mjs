// NV Ops: the single calculation layer.
// Every figure in the app, the PDFs, the emails and the exports comes from these functions,
// so the same filters always give the same totals everywhere. Definitions: see CALCULATIONS.md.
// public/calc.js is generated from this file (do not edit that copy by hand).

/** Direct job cost headings for a construction business. None is compulsory; record what the business actually paid. */
export const COST_TYPES = [
  ['labour', 'Labour'],
  ['material', 'Materials'],
  ['subcontract', 'Subcontractors'],
  ['plant', 'Equipment hire'],
  ['fuel', 'Fuel & transport'],
  ['tipping', 'Tipping fees'],
  ['other', 'Other direct cost']
];
export const COST_KEYS = COST_TYPES.map(c => c[0]);

export const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
export const num = v => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
export const within = (d, a, b) => (!a || d >= a) && (!b || d <= b);

/** Revenue on one job line: quantity x price. */
export const lineAmount = l => round2((l.qty || 1) * (l.price || 0));
/** Direct costs on one job line: every recorded category. */
export const lineCosts = l => { const c = l.costs || {}; return COST_KEYS.reduce((t, k) => t + (Number(c[k]) || 0), 0); };

export const invTotal = inv => round2((inv.lines || []).reduce((t, l) => t + lineAmount(l), 0));
export const invPaid = inv => round2((inv.payments || []).reduce((t, p) => t + p.amount, 0));
export const invBalance = inv => inv.void ? 0 : round2(invTotal(inv) - invPaid(inv));
export const invCosts = inv => round2((inv.lines || []).reduce((t, l) => t + lineCosts(l), 0));
/** Paid, Part-paid, Overdue, Unpaid or Cancelled. */
export function invStatus(inv, today) {
  if (inv.void) return 'Cancelled';
  const bal = invBalance(inv), paid = invPaid(inv);
  if (bal <= 0.009) return 'Paid';
  if (inv.dueDate && inv.dueDate < today) return 'Overdue';
  return paid > 0 ? 'Part-paid' : 'Unpaid';
}
export const liveInvoices = db => (db.invoices || []).filter(i => !i.void);

/** Job profit on one invoice: revenue less that invoice's own direct job costs. */
export const invJobProfit = inv => round2(invTotal(inv) - invCosts(inv));
/** One partner's share of a paid invoice's job profit (the amount transferred when the customer pays). */
export const partnerShare = (inv, sharePct) => round2(invJobProfit(inv) * (Number(sharePct) || 0) / 100);

/**
 * Every job line and every running expense, as dated entries.
 * decorate(job, line, invoice) may add display-only fields (the app adds normalised load names).
 */
export function facts(db, decorate) {
  const jobs = [], expenses = [], clients = {};
  (db.clients || []).forEach(c => { clients[c.id] = c; });
  const invoices = liveInvoices(db);
  invoices.forEach(inv => {
    const client = (clients[inv.clientId] || { name: 'Unknown customer' }).name;
    (inv.lines || []).forEach(l => {
      const j = { date: l.date, amount: lineAmount(l), price: num(l.price), qty: l.qty || 1, costs: l.costs || {}, cost: lineCosts(l),
        truck: l.truck, route: l.route, category: l.category, load: l.load, title: l.title, driverId: l.driverId || '',
        client, clientId: inv.clientId, inv };
      if (decorate) decorate(j, l, inv);
      jobs.push(j);
    });
  });
  (db.expenses || []).forEach(e => { if (!e.void) expenses.push(e); });
  // NV: costs logged on building projects are direct costs of the work, kept apart from running expenses in summarise().
  // Repairs to the apartments (done by NV Construction) are direct costs of the Apartments line.
  (db.repairs || []).forEach(r => { if (!r.done) return; [['labour', r.labour], ['material', r.materials]].forEach(([h, a]) => { if (Number(a) > 0) expenses.push({ id: r.id + h, date: r.done, amount: Number(a), category: h, heading: h, description: 'Repair: ' + r.issue, truck: '', direct: true, repairId: r.id, type: 'Apartments maintenance' }); }); });
  (db.projects || []).forEach(p => (p.costs || []).forEach(c => expenses.push({ id: c.id, date: c.date, amount: Number(c.amount) || 0, category: c.heading, heading: c.heading, description: c.description, truck: '', direct: true, projectId: p.id, sector: p.sector, type: p.type })));
  return { jobs, expenses, invoices };
}

/**
 * Totals for a period (inclusive dates; blank means open-ended).
 *   revenue            = sum of job line amounts dated in the period
 *   directCosts        = sum of all direct job costs on those lines
 *   grossContribution  = revenue - directCosts
 *   operatingExpenses  = running expenses dated in the period (not start-up capital, not partner transfers)
 *   operatingProfit    = grossContribution - operatingExpenses
 *   cashCollected      = customer payments dated in the period
 * The older names (income, jobCosts, overheads, net, received) are kept as aliases so nothing that relies on them changes.
 */
export function summarise(f, a, b) {
  const jobs = f.jobs.filter(j => within(j.date, a, b));
  const allExps = f.expenses.filter(e => within(e.date, a, b));
  const exps = allExps.filter(e => !e.direct), projectCosts = allExps.filter(e => e.direct);
  const income = jobs.reduce((t, j) => t + j.amount, 0);
  const jobCosts = jobs.reduce((t, j) => t + j.cost, 0) + projectCosts.reduce((t, e) => t + e.amount, 0);
  const overheads = exps.reduce((t, e) => t + e.amount, 0);
  let received = 0;
  (f.invoices || []).forEach(inv => (inv.payments || []).forEach(p => { if (within(p.date, a, b)) received += p.amount; }));
  const costs = jobCosts + overheads, net = income - costs;
  const split = costSplit(jobs);
  projectCosts.forEach(e => { split[e.heading] = (split[e.heading] || 0) + e.amount; });
  return {
    jobs, exps, projectCosts, income, jobCosts, overheads, costs, net, received,
    margin: income ? net / income : NaN, trips: jobs.length, perTrip: jobs.length ? income / jobs.length : NaN,
    revenue: income, directCosts: jobCosts, directSplit: split, grossContribution: income - jobCosts,
    operatingExpenses: overheads, operatingProfit: net, cashCollected: received
  };
}

/** Direct costs by category for a list of jobs. */
export function costSplit(jobs) {
  const c = {}; COST_KEYS.forEach(k => { c[k] = 0; });
  jobs.forEach(j => { COST_KEYS.forEach(k => { c[k] += Number((j.costs || {})[k]) || 0; }); });
  return c;
}

/** Running expenses by category. */
export function expenseSplit(exps) {
  const out = {};
  exps.forEach(e => { const k = e.category || 'Other'; out[k] = (out[k] || 0) + e.amount; });
  return out;
}

export const startupTotal = db => (db.startup || []).reduce((t, s) => t + s.amount, 0);

/** Money owed now, across all live invoices. */
export function receivables(db, today) {
  let total = 0, overdue = 0, count = 0, overdueCount = 0;
  liveInvoices(db).forEach(i => { const b = invBalance(i); if (b <= 0.009) return; total += b; count++; if (i.dueDate && i.dueDate < today) { overdue += b; overdueCount++; } });
  return { total: round2(total), overdue: round2(overdue), count, overdueCount };
}

/**
 * How a paid invoice's money was used (agreed rule):
 *   'full' = shared as normal; 'part' = linked business expenses come off the job profit first;
 *   'all'  = kept in the business, no transfer.
 * Links to expenses that are cancelled or deleted are ignored.
 */
export function fundsUse(inv, db) {
  const u = inv.useOfFunds || {}, mode = ['part', 'all'].includes(u.mode) ? u.mode : 'full';
  const live = {}; (db.expenses || []).forEach(e => { if (!e.void) live[e.id] = e; });
  const links = (u.links || []).filter(l => live[l.expenseId] && l.amount > 0);
  const linked = round2(links.reduce((t, l) => t + l.amount, 0)), profit = invJobProfit(inv);
  const used = mode === 'full' ? 0 : mode === 'all' ? Math.max(0, profit) : Math.min(linked, Math.max(0, profit));
  return { mode, links, linked, used: round2(used), left: round2(Math.max(0, profit - used)), profit };
}
/** One partner's transfer for a paid invoice after any business costs paid from it. */
export const transferDue = (inv, db, sharePct) => round2(fundsUse(inv, db).left * (Number(sharePct) || 0) / 100);
/** How much of an expense has been paid from invoices, and from which. */
export function expenseFunding(db, expenseId, exceptInvoiceId) {
  let total = 0; const from = [];
  liveInvoices(db).forEach(inv => { if (inv.id === exceptInvoiceId) return; ((inv.useOfFunds || {}).links || []).forEach(l => { if (l.expenseId === expenseId && l.amount > 0 && (inv.useOfFunds.mode === 'part' || inv.useOfFunds.mode === 'all')) { total += l.amount; from.push({ inv, amount: l.amount }); } }); });
  return { total: round2(total), from };
}
