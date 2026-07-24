const { getRoleConfigByTenantAndRole, listRoleConfigsByTenant, upsertRoleConfig, deleteRoleConfig } = require("./roleConfig.repository");

function normalizeTid(value) {
  const tid = String(value || "").trim();
  if (!tid) {
    const err = new Error("tid is required");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return tid;
}

function normalizeRoleName(value) {
  const roleName = String(value || "").trim();
  if (!roleName) {
    const err = new Error("role_name is required");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (roleName.length > 64) {
    const err = new Error("role_name is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return roleName;
}

function normalizePageKey(value) {
  const k = String(value || "").trim().toLowerCase();
  if (!k) return "";
  if (k.length > 64) return "";
  if (!/^[a-z0-9_-]+$/.test(k)) return "";
  return k;
}

function normalizeAllowedPages(value) {
  if (!Array.isArray(value)) {
    const err = new Error("allowed_pages must be an array");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const out = [];
  const seen = new Set();
  for (const item of value) {
    const k = normalizePageKey(item);
    if (!k) {
      const err = new Error("allowed_pages contains invalid page key");
      err.statusCode = 400;
      err.code = "VALIDATION_ERROR";
      throw err;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

function parseAllowedPagesJson(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  const text = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function roleConfigToDto(row) {
  if (!row) return null;
  return {
    id: row.id,
    tid: row.tid,
    role_name: row.role_name,
    allowed_pages: parseAllowedPagesJson(row.allowed_pages_json),
    description: row.description || null,
    updated_at: row.updated_at,
    updated_by_user_id: row.updated_by_user_id ?? null,
  };
}

async function getRoleConfigs({ tid }) {
  const t = normalizeTid(tid);
  const rows = await listRoleConfigsByTenant({ tid: t });
  return rows.map(roleConfigToDto);
}

async function getRoleConfig({ tid, roleName }) {
  const t = normalizeTid(tid);
  const rn = normalizeRoleName(roleName);
  const row = await getRoleConfigByTenantAndRole({ tid: t, roleName: rn });
  return roleConfigToDto(row);
}

async function saveRoleConfig({ tid, roleName, allowedPages, description, updatedByUserId }) {
  const t = normalizeTid(tid);
  const rn = normalizeRoleName(roleName);
  const allowed = normalizeAllowedPages(allowedPages);
  const desc = String(description || "").trim().slice(0, 255) || null;
  const allowedJson = JSON.stringify(allowed);
  await upsertRoleConfig({
    tid: t,
    roleName: rn,
    allowedPagesJson: allowedJson,
    description: desc,
    updatedByUserId: updatedByUserId ?? null,
  });
  return getRoleConfig({ tid: t, roleName: rn });
}

async function removeRoleConfig({ tid, roleName }) {
  const t = normalizeTid(tid);
  const rn = normalizeRoleName(roleName);
  const affected = await deleteRoleConfig({ tid: t, roleName: rn });
  return affected;
}

module.exports = { getRoleConfigs, getRoleConfig, saveRoleConfig, removeRoleConfig, parseAllowedPagesJson };
