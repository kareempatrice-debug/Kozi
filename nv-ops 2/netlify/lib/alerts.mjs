// Works out which notifications each person should get today.
import { latestOdometer } from './core.mjs';
import * as Calc from './calc.mjs';
const shortDay = d => +d.slice(8) + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+d.slice(5, 7) - 1];

const lineAmt = l => Math.round((l.qty || 1) * (l.price || 0) * 100) / 100;
const total = i => i.lines.reduce((t, l) => t + lineAmt(l), 0);
const paid = i => i.payments.reduce((t, p) => t + p.amount, 0);
const addDays = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const ec = n => (n < 0 ? '-' : '') + 'EC$' + Math.abs(Math.round(n)).toLocaleString('en-GB');

export function buildAlerts(db, user, today) {
  const out = [];
  const isDriver = user.role === 'driver';
  const client = id => (db.clients.find(c => c.id === id) || { name: 'a customer' }).name;

  if (!isDriver) {
    const yesterday = addDays(today, -1);
    const newlyOverdue = db.invoices.filter(i => !i.void && i.dueDate === yesterday && total(i) - paid(i) > 0.009);
    if (newlyOverdue.length) {
      const sum = newlyOverdue.reduce((t, i) => t + total(i) - paid(i), 0);
      out.push({ kind: 'overdue', title: newlyOverdue.length === 1 ? 'Invoice now overdue' : newlyOverdue.length + ' invoices now overdue',
        body: newlyOverdue.length === 1 ? '#' + String(newlyOverdue[0].no).padStart(3, '0') + ' to ' + client(newlyOverdue[0].clientId) + ', ' + ec(sum) + ' outstanding.' : ec(sum) + ' outstanding in total.',
        url: newlyOverdue.length === 1 ? '/#/invoice/' + newlyOverdue[0].id : '/#/invoices' });
    }
  }

  const rem = (db.reminders || []).filter(r => {
    const d = r.due ? days(today, r.due) : null;
    const odo = latestOdometer(db, r.truck), km = r.dueKm && odo ? r.dueKm - odo : null;
    const monday = new Date(today).getUTCDay() === 1;
    // Every truck reminder: 30, 14, 7, 3 and 1 days before, on the day, the day after if missed,
    // then every Monday while overdue. Mileage reminders: every Monday within 1,000 km, and daily once due.
    const lead = (db.settings.alertDays && db.settings.alertDays.length ? db.settings.alertDays : [30, 14, 7]).concat([3, 1, 0, -1]);
    return (d !== null && lead.includes(d)) || (d !== null && d < 0 && monday) || (km !== null && km <= 1000 && monday) || (km !== null && km <= 0);
  });
  rem.slice(0, 4).forEach(r => {
    const d = r.due ? days(today, r.due) : null, odo = latestOdometer(db, r.truck), km = r.dueKm && odo ? r.dueKm - odo : null;
    const when = d === null ? (km <= 0 ? 'due now (' + Math.abs(km).toLocaleString('en-GB') + ' km over)' : 'due in ' + km.toLocaleString('en-GB') + ' km')
      : d < 0 ? 'overdue by ' + (-d) + (d === -1 ? ' day' : ' days') : d === 0 ? 'due today' : d === 1 ? 'due tomorrow' : 'due in ' + d + ' days (' + r.due.slice(8) + '/' + r.due.slice(5, 7) + ')';
    out.push({ kind: 'reminders', title: r.type + ': ' + r.truck, body: when.charAt(0).toUpperCase() + when.slice(1) + '.' + (r.expectedCost ? ' Expected cost ' + ec(r.expectedCost) + '.' : ''), url: '/#/reminders' });
  });
  if (rem.length > 4) out.push({ kind: 'reminders', title: 'More truck admin due', body: (rem.length - 4) + (rem.length - 4 === 1 ? ' more reminder' : ' more reminders') + '. Open Truck reminders.', url: '/#/reminders' });

  const tomorrow = addDays(today, 1);
  const bk = (db.bookings || []).filter(b => b.status === 'Booked' && b.date === tomorrow && (!isDriver || !b.driverId || b.driverId === user.id));
  if (bk.length) out.push({ kind: 'bookings', title: bk.length === 1 ? '1 job booked for tomorrow' : bk.length + ' jobs booked for tomorrow',
    body: bk.slice(0, 3).map(b => (b.time ? b.time + ' ' : '') + b.client + (b.route ? ', ' + b.route : '')).join('; '), url: '/#/bookings' });

  if (!isDriver && new Date(today).getUTCDay() === 1) {
    const from = addDays(today, -7), to = addDays(today, -1);
    const W = Calc.summarise(Calc.facts(db), from, to);
    const income = W.revenue, costs = W.costs, trips = W.trips;
    const owed = db.invoices.filter(i => !i.void).reduce((t, i) => t + Math.max(0, total(i) - paid(i)), 0);
    out.push({ kind: 'weekly', title: 'Last week · ' + shortDay(from) + ' to ' + shortDay(to), body: trips + (trips === 1 ? ' job, ' : ' jobs, ') + ec(income) + ' revenue, ' + ec(income - costs) + ' operating profit. ' + ec(owed) + ' owed to you. Full report by email.', url: '/#/monthly' });
  }
  if (!isDriver && today.slice(8) === '01') {
    const d0 = new Date(today + 'T12:00:00Z'), s0 = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth() - 1, 1)), e0 = new Date(Date.UTC(d0.getUTCFullYear(), d0.getUTCMonth(), 0));
    const M = Calc.summarise(Calc.facts(db), s0.toISOString().slice(0, 10), e0.toISOString().slice(0, 10));
    const owedM = db.invoices.filter(i => !i.void).reduce((t, i) => t + Math.max(0, total(i) - paid(i)), 0);
    const mName = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][s0.getUTCMonth()];
    out.push({ kind: 'monthly', title: mName + ' summary', body: M.trips + (M.trips === 1 ? ' job, ' : ' jobs, ') + ec(M.revenue) + ' revenue, ' + ec(M.operatingProfit) + ' operating profit. ' + ec(owedM) + ' owed to you. Full report by email.', url: '/#/monthly' });
  }
  // ---- NV: building projects, skip bins and machine hours ----
  const monday = new Date(today).getUTCDay() === 1;
  if (!isDriver) {
    (db.projects || []).filter(p => ['Won', 'On site', 'Handed over', 'Defects period'].includes(p.status)).forEach(p => {
      const st = (p.stages || []).filter(s => !s.invoiceId && s.due && (s.due === today || (s.due < today && monday)));
      if (st.length) out.push({ kind: 'projects', title: p.name + ': stage to invoice', body: st[0].name + (st[0].due === today ? ' is due today.' : ' was due ' + shortDay(st[0].due) + ' and has not been invoiced.'), url: '/#/project/' + p.id });
      if (p.handover && p.defectsMonths) {
        const [y, m, d] = p.handover.split('-').map(Number); const end = new Date(Date.UTC(y, m - 1 + p.defectsMonths, d)).toISOString().slice(0, 10);
        const last = (p.valuations || []).slice(-1)[0], held = last ? last.retention - (p.retentionReleases || []).reduce((t, r) => t + r.amount, 0) : 0;
        if (held > 0.009 && (end === today || (end < today && monday))) out.push({ kind: 'projects', title: p.name + ': retention due back', body: 'The defects period ended ' + shortDay(end) + '. ' + ec(held) + ' of retention can now be invoiced.', url: '/#/project/' + p.id });
      }
      const late = (p.orders || []).filter(o => o.status === 'Ordered' && o.needed && (o.needed === addDays(today, -1) || (o.needed < today && monday)));
      if (late.length) out.push({ kind: 'projects', title: p.name + ': delivery late', body: 'PO-' + String(late[0].no).padStart(4, '0') + ' from ' + late[0].supplier + ' was needed ' + shortDay(late[0].needed) + '.', url: '/#/project/' + p.id });
      if (p.finish && p.status === 'On site' && (p.finish === addDays(today, 7) || (p.finish < today && monday))) out.push({ kind: 'projects', title: p.name + (p.finish < today ? ': past planned finish' : ': finish due in a week'), body: 'Planned finish ' + shortDay(p.finish) + '.', url: '/#/project/' + p.id });
      if (monday) {
        const budget = (p.budget || []).reduce((t, b) => t + b.amount, 0), cost = (p.costs || []).reduce((t, c) => t + c.amount, 0);
        if (budget && cost > budget) out.push({ kind: 'projects', title: p.name + ': over budget', body: ec(cost - budget) + ' over the ' + ec(budget) + ' budget.', url: '/#/project/' + p.id });
      }
    });
  }
  const binsDue = (db.hires || []).filter(h => h.status === 'Out' && h.collectBy === today);
  if (binsDue.length) out.push({ kind: 'bins', title: binsDue.length === 1 ? '1 bin to collect today' : binsDue.length + ' bins to collect today', body: binsDue.slice(0, 3).map(h => ((db.bins || []).find(b => b.id === h.binId) || { name: 'Bin' }).name + ', ' + h.client + (h.area ? ', ' + h.area : '')).join('; '), url: '/#/bins' });
  Object.keys(db.hourPlans || {}).forEach(truck => {
    const plan = db.hourPlans[truck], rs = (db.hours || []).filter(x => x.truck === truck).sort((a, b) => b.hours - a.hours);
    if (!plan || !plan.every || !rs.length) return;
    const svc = rs.find(x => x.serviced), left = (svc ? svc.hours : 0) + plan.every - rs[0].hours;
    if (left <= 25 && (monday || left <= 0)) out.push({ kind: 'reminders', title: truck + ': service ' + (left <= 0 ? 'overdue' : 'due soon'), body: left <= 0 ? Math.round(-left) + ' engine hours past the service point.' : Math.round(left) + ' engine hours to the next service.', url: '/#/hours' });
  });
  return out;
}
