const {
  deleteDatasheetById,
  findById,
  insertDatasheet,
  listDatasheets,
  updateDatasheetById,
} = require("./datasheets.repository");
const { normalizeFileField, signUrl, signUrls, deleteFromS3 } = require("../../utils/bucketStorage");

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

function normalizeSize(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    const err = new Error("size is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return Math.floor(n);
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

function publicDatasheet(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    file_path: row.file_path,
    size: row.size === null || row.size === undefined ? null : Number(row.size),
    status: String(row.status || "active").toLowerCase(),
    date_created: row.date_created,
    added_by: row.added_by,
  };
}

async function getDatasheets(query) {
  const page = normalizePage(query?.page);
  const status = normalizeStatusFilter(query?.status);
  const q = String(query?.q || "").trim();

  const result = await listDatasheets({ page, status, query: q, onlyActive: false });
  const datasheets = result.rows.map(publicDatasheet);
  await signUrls(datasheets, ["file_path"]);
  return {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    datasheets,
  };
}

async function getPublicDatasheets(query) {
  const page = normalizePage(query?.page);
  const q = String(query?.q || "").trim();

  const result = await listDatasheets({ page, status: "active", query: q, onlyActive: true });
  const datasheets = result.rows.map(publicDatasheet);
  await signUrls(datasheets, ["file_path"]);
  return {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    datasheets,
  };
}

async function createDatasheet(payload) {
  const title = ensureString(payload?.title, "title");
  const fileInput = ensureString(payload?.file_path, "file_path");
  const description = normalizeDescription(payload?.description);
  let size = normalizeSize(payload?.size);
  const status = normalizeStatus(payload?.status);
  const addedBy = ensurePositiveInt(payload?.added_by, "added_by");

  const normalized = await normalizeFileField({
    value: fileInput,
    dirKey: "datasheetsFiles",
    contextLabel: "Datasheet error",
    allowedMimes: { "application/pdf": "pdf" },
    maxBytes: 20 * 1024 * 1024,
  });
  const filePath = normalized.filePath;
  if (normalized.sizeBytes !== null) {
    size = normalized.sizeBytes;
  }

  const id = await insertDatasheet({ title, description, filePath, size, status, addedBy });
  const created = await findById(id);
  const ds = publicDatasheet(created);
  if (ds.file_path) ds.file_path = await signUrl(ds.file_path);
  return ds;
}

async function updateDatasheet(id, payload) {
  const targetId = ensurePositiveInt(id, "id");
  const existing = await findById(targetId);
  if (!existing) {
    const err = new Error("Datasheet not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const title = ensureString(payload?.title, "title");
  const fileInput = ensureString(payload?.file_path, "file_path");
  const description = normalizeDescription(payload?.description);
  let size = normalizeSize(payload?.size);
  const status = normalizeStatus(payload?.status);

  const normalized = await normalizeFileField({
    value: fileInput,
    dirKey: "datasheetsFiles",
    contextLabel: "Datasheet error",
    allowedMimes: { "application/pdf": "pdf" },
    maxBytes: 20 * 1024 * 1024,
  });
  const filePath = normalized.filePath;
  if (normalized.sizeBytes !== null) {
    size = normalized.sizeBytes;
  }

  // Clean up old S3 file if replaced
  const oldFilePath = String(existing?.file_path || "").trim();
  if (oldFilePath && oldFilePath !== filePath) {
    deleteFromS3(oldFilePath);
  }

  await updateDatasheetById(targetId, { title, description, filePath, size, status });
  const updated = await findById(targetId);
  const ds = publicDatasheet(updated);
  if (ds.file_path) ds.file_path = await signUrl(ds.file_path);
  return ds;
}

async function deleteDatasheet(id) {
  const targetId = ensurePositiveInt(id, "id");
  const existing = await findById(targetId);
  if (!existing) {
    const err = new Error("Datasheet not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  // Clean up S3 file before deleting record
  const fileKey = String(existing?.file_path || "").trim();
  if (fileKey) {
    deleteFromS3(fileKey);
  }

  const affected = await deleteDatasheetById(targetId);
  if (!affected) {
    const err = new Error("Datasheet not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }
  return publicDatasheet(existing);
}

module.exports = { getDatasheets, getPublicDatasheets, createDatasheet, updateDatasheet, deleteDatasheet };
