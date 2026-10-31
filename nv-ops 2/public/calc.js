/* GENERATED from netlify/lib/calc.mjs - do not edit by hand. */
var Calc = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // out/netlify/lib/calc.mjs
  var calc_exports = {};
  __export(calc_exports, {
    COST_KEYS: () => COST_KEYS,
    COST_TYPES: () => COST_TYPES,
    costSplit: () => costSplit,
    expenseFunding: () => expenseFunding,
    expenseSplit: () => expenseSplit,
    facts: () => facts,
    fundsUse: () => fundsUse,
    invBalance: () => invBalance,
    invCosts: () => invCosts,
    invJobProfit: () => invJobProfit,
    invPaid: () => invPaid,
    invStatus: () => invStatus,
    invTotal: () => invTotal,
    lineAmount: () => lineAmount,
    lineCosts: () => lineCosts,
    liveInvoices: () => liveInvoices,
    num: () => num,
    partnerShare: () => partnerShare,
    receivables: () => receivables,
    round2: () => round2,
    startupTotal: () => startupTotal,
    summarise: () => summarise,
    transferDue: () => transferDue,
    within: () => within
  });
  var COST_TYPES = [
    ["labour", "Labour"],
    ["material", "Materials"],
    ["subcontract", "Subcontractors"],
    ["plant", "Equipment hire"],
    ["fuel", "Fuel & transport"],
    ["tipping", "Tipping fees"],
    ["other", "Other direct cost"]
  ];
  var COST_KEYS = COST_TYPES.map((c) => c[0]);
  var round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
  var num = (v) => {
    const n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, ""));
    return isFinite(n) ? n : 0;
  };
  var within = (d, a, b) => (!a || d >= a) && (!b || d <= b);
  var lineAmount = (l) => round2((l.qty || 1) * (l.price || 0));
  var lineCosts = (l) => {
    const c = l.costs || {};
    return COST_KEYS.reduce((t, k) => t + (Number(c[k]) || 0), 0);
  };
  var invTotal = (inv) => round2((inv.lines || []).reduce((t, l) => t + lineAmount(l), 0));
  var invPaid = (inv) => round2((inv.payments || []).reduce((t, p) => t + p.amount, 0));
  var invBalance = (inv) => inv.void ? 0 : round2(invTotal(inv) - invPaid(inv));
  var invCosts = (inv) => round2((inv.lines || []).reduce((t, l) => t + lineCosts(l), 0));
  function invStatus(inv, today) {
    if (inv.void) return "Cancelled";
    const bal = invBalance(inv), paid = invPaid(inv);
    if (bal <= 9e-3) return "Paid";
    if (inv.dueDate && inv.dueDate < today) return "Overdue";
    return paid > 0 ? "Part-paid" : "Unpaid";
  }
  var liveInvoices = (db) => (db.invoices || []).filter((i) => !i.void);
  var invJobProfit = (inv) => round2(invTotal(inv) - invCosts(inv));
  var partnerShare = (inv, sharePct) => round2(invJobProfit(inv) * (Number(sharePct) || 0) / 100);
  function facts(db, decorate) {
    const jobs = [], expenses = [], clients = {};
    (db.clients || []).forEach((c) => {
      clients[c.id] = c;
    });
    const invoices = liveInvoices(db);
    invoices.forEach((inv) => {
      const client = (clients[inv.clientId] || { name: "Unknown customer" }).name;
      (inv.lines || []).forEach((l) => {
        const j = {
          date: l.date,
          amount: lineAmount(l),
          price: num(l.price),
          qty: l.qty || 1,
          costs: l.costs || {},
          cost: lineCosts(l),
          truck: l.truck,
          route: l.route,
          category: l.category,
          load: l.load,
          title: l.title,
          driverId: l.driverId || "",
          client,
          clientId: inv.clientId,
          inv
        };
        if (decorate) decorate(j, l, inv);
        jobs.push(j);
      });
    });
    (db.expenses || []).forEach((e) => {
      if (!e.void) expenses.push(e);
    });
    (db.repairs || []).forEach((r) => {
      if (!r.done) return;
      [["labour", r.labour], ["material", r.materials]].forEach(([h, a]) => {
        if (Number(a) > 0) expenses.push({ id: r.id + h, date: r.done, amount: Number(a), category: h, heading: h, description: "Repair: " + r.issue, truck: "", direct: true, repairId: r.id, type: "Apartments maintenance" });
      });
    });
    (db.projects || []).forEach((p) => (p.costs || []).forEach((c) => expenses.push({ id: c.id, date: c.date, amount: Number(c.amount) || 0, category: c.heading, heading: c.heading, description: c.description, truck: "", direct: true, projectId: p.id, sector: p.sector, type: p.type })));
    return { jobs, expenses, invoices };
  }
  function summarise(f, a, b) {
    const jobs = f.jobs.filter((j) => within(j.date, a, b));
    const allExps = f.expenses.filter((e) => within(e.date, a, b));
    const exps = allExps.filter((e) => !e.direct), projectCosts = allExps.filter((e) => e.direct);
    const income = jobs.reduce((t, j) => t + j.amount, 0);
    const jobCosts = jobs.reduce((t, j) => t + j.cost, 0) + projectCosts.reduce((t, e) => t + e.amount, 0);
    const overheads = exps.reduce((t, e) => t + e.amount, 0);
    let received = 0;
    (f.invoices || []).forEach((inv) => (inv.payments || []).forEach((p) => {
      if (within(p.date, a, b)) received += p.amount;
    }));
    const costs = jobCosts + overheads, net = income - costs;
    const split = costSplit(jobs);
    projectCosts.forEach((e) => {
      split[e.heading] = (split[e.heading] || 0) + e.amount;
    });
    return {
      jobs,
      exps,
      projectCosts,
      income,
      jobCosts,
      overheads,
      costs,
      net,
      received,
      margin: income ? net / income : NaN,
      trips: jobs.length,
      perTrip: jobs.length ? income / jobs.length : NaN,
      revenue: income,
      directCosts: jobCosts,
      directSplit: split,
      grossContribution: income - jobCosts,
      operatingExpenses: overheads,
      operatingProfit: net,
      cashCollected: received
    };
  }
  function costSplit(jobs) {
    const c = {};
    COST_KEYS.forEach((k) => {
      c[k] = 0;
    });
    jobs.forEach((j) => {
      COST_KEYS.forEach((k) => {
        c[k] += Number((j.costs || {})[k]) || 0;
      });
    });
    return c;
  }
  function expenseSplit(exps) {
    const out = {};
    exps.forEach((e) => {
      const k = e.category || "Other";
      out[k] = (out[k] || 0) + e.amount;
    });
    return out;
  }
  var startupTotal = (db) => (db.startup || []).reduce((t, s) => t + s.amount, 0);
  function receivables(db, today) {
    let total = 0, overdue = 0, count = 0, overdueCount = 0;
    liveInvoices(db).forEach((i) => {
      const b = invBalance(i);
      if (b <= 9e-3) return;
      total += b;
      count++;
      if (i.dueDate && i.dueDate < today) {
        overdue += b;
        overdueCount++;
      }
    });
    return { total: round2(total), overdue: round2(overdue), count, overdueCount };
  }
  function fundsUse(inv, db) {
    const u = inv.useOfFunds || {}, mode = ["part", "all"].includes(u.mode) ? u.mode : "full";
    const live = {};
    (db.expenses || []).forEach((e) => {
      if (!e.void) live[e.id] = e;
    });
    const links = (u.links || []).filter((l) => live[l.expenseId] && l.amount > 0);
    const linked = round2(links.reduce((t, l) => t + l.amount, 0)), profit = invJobProfit(inv);
    const used = mode === "full" ? 0 : mode === "all" ? Math.max(0, profit) : Math.min(linked, Math.max(0, profit));
    return { mode, links, linked, used: round2(used), left: round2(Math.max(0, profit - used)), profit };
  }
  var transferDue = (inv, db, sharePct) => round2(fundsUse(inv, db).left * (Number(sharePct) || 0) / 100);
  function expenseFunding(db, expenseId, exceptInvoiceId) {
    let total = 0;
    const from = [];
    liveInvoices(db).forEach((inv) => {
      if (inv.id === exceptInvoiceId) return;
      ((inv.useOfFunds || {}).links || []).forEach((l) => {
        if (l.expenseId === expenseId && l.amount > 0 && (inv.useOfFunds.mode === "part" || inv.useOfFunds.mode === "all")) {
          total += l.amount;
          from.push({ inv, amount: l.amount });
        }
      });
    });
    return { total: round2(total), from };
  }
  return __toCommonJS(calc_exports);
})();
