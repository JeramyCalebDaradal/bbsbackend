const {
  deleteInfoVideoById,
  findById,
  insertInfoVideo,
  listInfoVideos,
  updateInfoVideoById,
} = require("./infoVideos.repository");

const allowedStatuses = new Set(["active", "inactive"]);

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

function normalizeDescription(value) {
  const v = String(value || "").trim();
  return v ? v : null;
}

function ensurePositiveInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) {
    const err = new Error(`${fieldName} is invalid`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return n;
}

function normalizePage(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.trunc(n);
}

function normalizeStatus(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "active";
  if (allowedStatuses.has(v)) return v;
  const err = new Error("status is invalid");
  err.statusCode = 400;
  err.code = "VALIDATION_ERROR";
  throw err;
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

function publicInfoVideo(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    file_path: row.file_path,
    status: String(row.status || "active").toLowerCase(),
    date_created: row.date_created,
    added_by: row.added_by,
  };
}

async function getInfoVideos(query) {
  const page = normalizePage(query?.page);
  const status = normalizeStatusFilter(query?.status);
  const q = String(query?.q || "").trim();

  const result = await listInfoVideos({ page, status, query: q, onlyActive: false });
  return {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    videos: result.rows.map(publicInfoVideo),
  };
}

async function getPublicInfoVideos(query) {
  const page = normalizePage(query?.page);
  const q = String(query?.q || "").trim();

  const result = await listInfoVideos({ page, status: "active", query: q, onlyActive: true });
  return {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    videos: result.rows.map(publicInfoVideo),
  };
}

async function createInfoVideo(payload) {
  const title = ensureString(payload?.title, "title");
  const filePath = ensureString(payload?.file_path, "file_path");
  const description = normalizeDescription(payload?.description);
  const status = normalizeStatus(payload?.status);
  const addedBy = ensurePositiveInt(payload?.added_by, "added_by");

  const id = await insertInfoVideo({ title, description, filePath, status, addedBy });
  const created = await findById(id);
  return publicInfoVideo(created);
}

async function updateInfoVideo(id, payload) {
  const targetId = ensurePositiveInt(id, "id");
  const existing = await findById(targetId);
  if (!existing) {
    const err = new Error("Informational video not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const title = ensureString(payload?.title, "title");
  const filePath = ensureString(payload?.file_path, "file_path");
  const description = normalizeDescription(payload?.description);
  const status = normalizeStatus(payload?.status);

  await updateInfoVideoById(targetId, { title, description, filePath, status });
  const updated = await findById(targetId);
  return publicInfoVideo(updated);
}

async function deleteInfoVideo(id) {
  const targetId = ensurePositiveInt(id, "id");
  const existing = await findById(targetId);
  if (!existing) {
    const err = new Error("Informational video not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const affected = await deleteInfoVideoById(targetId);
  if (!affected) {
    const err = new Error("Informational video not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }
  return publicInfoVideo(existing);
}

module.exports = { getInfoVideos, getPublicInfoVideos, createInfoVideo, updateInfoVideo, deleteInfoVideo };
