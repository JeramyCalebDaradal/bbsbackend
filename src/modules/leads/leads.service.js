const {
  deleteLeadById,
  findById,
  insertLead,
  listLeads,
  updateLeadById,
} = require("./leads.repository");

const allowedSources = new Set([
  "Website contact",
  "Event Registration",
  "Newsletter signup",
  "Referral",
  "LinkedIn",
]);

const allowedStatuses = new Set(["new", "contacted", "qualified", "converted", "lost"]);

function ensureString(value, fieldName) {
  const v = String(value || "").trim();
  if (!v) {
    const err = new Error(`${fieldName} is required`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function ensureEmail(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v || !v.includes("@")) {
    const err = new Error("email is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

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

function normalizeSource(value) {
  const v = String(value || "").trim();
  if (!v) {
    const err = new Error("source is required");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (!allowedSources.has(v)) {
    const err = new Error("source is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function normalizeStatus(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "new";
  if (!allowedStatuses.has(v)) {
    const err = new Error("status is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function normalizeFollowUp(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const err = new Error("follow_up must be YYYY-MM-DD");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function normalizeNotes(value) {
  const v = String(value || "").trim();
  return v ? v : "";
}

function publicLead(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    contact: row.contact,
    source: row.source,
    status: row.status,
    follow_up: row.follow_up,
    notes: row.notes || "",
    created_at: row.created_at,
    added_by: row.added_by,
  };
}

function normalizePage(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.trunc(n);
}

function normalizeStatusFilter(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "all";
  if (v === "all") return "all";
  if (allowedStatuses.has(v)) return v;
  const err = new Error("status is invalid");
  err.statusCode = 400;
  err.code = "VALIDATION_ERROR";
  throw err;
}

async function getLeads(query) {
  const page = normalizePage(query?.page);
  const status = normalizeStatusFilter(query?.status);
  const q = String(query?.q || "").trim();

  const result = await listLeads({ page, status, query: q });
  return {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    leads: result.rows.map(publicLead),
  };
}

async function createLead(payload) {
  const fullName = ensureString(payload?.full_name, "full_name");
  const email = ensureEmail(payload?.email);
  const contact = ensureString(payload?.contact, "contact");
  const source = normalizeSource(payload?.source);
  const status = normalizeStatus(payload?.status);
  const followUp = normalizeFollowUp(payload?.follow_up);
  const notes = normalizeNotes(payload?.notes);
  const addedBy = ensurePositiveInt(payload?.added_by, "added_by");

  const id = await insertLead({ fullName, email, contact, source, status, followUp, notes, addedBy });
  const created = await findById(id);
  return publicLead(created);
}

async function updateLead(id, payload) {
  const leadId = ensurePositiveInt(id, "id");
  const existing = await findById(leadId);
  if (!existing) {
    const err = new Error("Lead not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const fullName = ensureString(payload?.full_name, "full_name");
  const email = ensureEmail(payload?.email);
  const contact = ensureString(payload?.contact, "contact");
  const source = normalizeSource(payload?.source);
  const status = normalizeStatus(payload?.status);
  const followUp = normalizeFollowUp(payload?.follow_up);
  const notes = normalizeNotes(payload?.notes);

  await updateLeadById(leadId, { fullName, email, contact, source, status, followUp, notes });
  const updated = await findById(leadId);
  return publicLead(updated);
}

async function deleteLead(id) {
  const leadId = ensurePositiveInt(id, "id");
  const existing = await findById(leadId);
  if (!existing) {
    const err = new Error("Lead not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }
  await deleteLeadById(leadId);
  return publicLead(existing);
}

module.exports = { getLeads, createLead, updateLead, deleteLead };
