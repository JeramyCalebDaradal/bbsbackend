const { insertLog, listLogs } = require("./logs.repository");

function ensurePositiveInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    const err = new Error(`${fieldName} is invalid`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  const int = Math.trunc(n);
  if (int <= 0) {
    const err = new Error(`${fieldName} must be > 0`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return int;
}

function normalizeActionFilter(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "";
  if (v === "created") return "Created";
  if (v === "edited") return "Edited";
  if (v === "removed") return "Removed";
  return "";
}

function normalizeDate(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const err = new Error("date must be YYYY-MM-DD");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function normalizeRole(value) {
  return String(value || "").trim();
}

function buildAction(verb, text) {
  const v = String(verb || "").trim();
  const t = String(text || "").trim();
  if (!v || !t) return "";
  return `${v} ${t}`;
}

function created(text) {
  return buildAction("Created", text);
}
function edited(text) {
  return buildAction("Edited", text);
}
function removed(text) {
  return buildAction("Removed", text);
}

async function recordLog({ userId, action }) {
  const uid = ensurePositiveInt(userId, "user_id");
  const a = String(action || "").trim();
  if (!a) {
    const err = new Error("action is required");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  await insertLog({ userId: uid, action: a.slice(0, 1024) });
}

async function getLogs(query) {
  const page = query?.page;
  const pageSize = query?.pageSize;
  const role = normalizeRole(query?.role);
  const action = normalizeActionFilter(query?.action);
  const fromDate = query?.from ? normalizeDate(query.from) : "";
  const toDate = query?.to ? normalizeDate(query.to) : "";
  const q = String(query?.q || "").trim();

  const result = await listLogs({
    page,
    pageSize,
    role: role || "",
    action: action || "",
    fromDate,
    toDate,
    query: q || "",
  });

  return {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    logs: result.rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      full_name: r.full_name,
      role: r.role,
      action: r.action,
      date: r.date,
      time: r.time,
    })),
  };
}

module.exports = { recordLog, getLogs, created, edited, removed };

