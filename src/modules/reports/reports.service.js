const { listReportRows } = require("./reports.repository");

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function monthLabel(monthKey) {
  const v = String(monthKey || "").trim();
  const m = v.match(/^(\d{4})-(\d{2})$/);
  if (!m) return v;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("en-US", { month: "short" });
}

function lastMonthKeys(count = 6) {
  const now = new Date();
  const keys = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = String(d.getFullYear());
    const m = String(d.getMonth() + 1).padStart(2, "0");
    keys.push(`${y}-${m}`);
  }
  return keys;
}

async function getReports() {
  const rows = await listReportRows();

  const kpis = {
    completion_rate: 0,
    lead_conversion_rate: 0,
    event_registrations_total: 0,
    published_articles_total: 0,
  };

  const monthKeys = lastMonthKeys(6);
  const appointmentsMonthlyMap = new Map();
  const leadsMonthlyMap = new Map();
  const registrationsMonthlyMap = new Map();

  for (const key of monthKeys) {
    appointmentsMonthlyMap.set(key, { month: monthLabel(key), completed: 0, cancelled: 0, pending: 0, confirmed: 0 });
    leadsMonthlyMap.set(key, { month: monthLabel(key), leads: 0, converted: 0 });
    registrationsMonthlyMap.set(key, { month: monthLabel(key), registered: 0 });
  }

  const articlesByCategory = [];
  const eventsRegistration = [];

  for (const row of rows) {
    const type = String(row.report_type || "");
    const key1 = String(row.key1 || "");
    const key2 = row.key2 === null || row.key2 === undefined ? null : String(row.key2);
    const value1 = toNumber(row.value1);

    if (type === "kpi") {
      if (Object.prototype.hasOwnProperty.call(kpis, key1)) {
        kpis[key1] = value1;
      }
      continue;
    }

    if (type === "appointments_monthly") {
      if (!appointmentsMonthlyMap.has(key1)) continue;
      const status = String(key2 || "").toLowerCase();
      const target = appointmentsMonthlyMap.get(key1);
      if (status === "completed") target.completed = value1;
      else if (status === "cancelled") target.cancelled = value1;
      else if (status === "pending") target.pending = value1;
      else if (status === "confirmed") target.confirmed = value1;
      continue;
    }

    if (type === "leads_monthly") {
      if (!leadsMonthlyMap.has(key1)) continue;
      const metric = String(key2 || "").toLowerCase();
      const target = leadsMonthlyMap.get(key1);
      if (metric === "leads") target.leads = value1;
      else if (metric === "converted") target.converted = value1;
      continue;
    }

    if (type === "registrations_monthly") {
      if (!registrationsMonthlyMap.has(key1)) continue;
      const target = registrationsMonthlyMap.get(key1);
      target.registered = value1;
      continue;
    }

    if (type === "articles_by_category") {
      if (value1 <= 0) continue;
      articlesByCategory.push({ category: key1, count: value1 });
      continue;
    }

    if (type === "events_registration") {
      eventsRegistration.push({ event: key1, registered: value1 });
      continue;
    }
  }

  articlesByCategory.sort((a, b) => b.count - a.count);
  eventsRegistration.sort((a, b) => b.registered - a.registered);

  return {
    kpis: {
      completionRate: kpis.completion_rate,
      leadConversionRate: kpis.lead_conversion_rate,
      eventRegistrationsTotal: kpis.event_registrations_total,
      publishedArticlesTotal: kpis.published_articles_total,
    },
    appointmentData: monthKeys.map((k) => appointmentsMonthlyMap.get(k)),
    leadConversionData: monthKeys.map((k) => leadsMonthlyMap.get(k)),
    registrationTrendData: monthKeys.map((k) => registrationsMonthlyMap.get(k)),
    blogPerformanceData: articlesByCategory.map((c) => ({ category: c.category, value: c.count })),
    eventRegistrationData: eventsRegistration,
  };
}

module.exports = { getReports };

