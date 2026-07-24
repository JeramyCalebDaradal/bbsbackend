const { pool } = require("../../db/pool");

async function listRoleConfigsByTenant({ tid }) {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        tid,
        role_name,
        allowed_pages_json,
        description,
        updated_at,
        updated_by_user_id
      FROM bbs_role_config
      WHERE tid = ?
      ORDER BY role_name ASC, id ASC
    `,
    [tid]
  );
  return rows;
}

async function getRoleConfigByTenantAndRole({ tid, roleName }) {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        tid,
        role_name,
        allowed_pages_json,
        description,
        updated_at,
        updated_by_user_id
      FROM bbs_role_config
      WHERE tid = ?
        AND role_name = ?
      LIMIT 1
    `,
    [tid, roleName]
  );
  return rows?.[0] || null;
}

async function upsertRoleConfig({ tid, roleName, allowedPagesJson, description, updatedByUserId }) {
  const [result] = await pool.query(
    `
      INSERT INTO bbs_role_config
        (tid, role_name, allowed_pages_json, description, updated_by_user_id)
      VALUES
        (?, ?, CAST(? AS JSON), ?, ?)
      ON DUPLICATE KEY UPDATE
        allowed_pages_json = VALUES(allowed_pages_json),
        description = VALUES(description),
        updated_by_user_id = VALUES(updated_by_user_id),
        updated_at = CURRENT_TIMESTAMP
    `,
    [tid, roleName, allowedPagesJson, description, updatedByUserId]
  );
  return Number(result.insertId || 0);
}

async function deleteRoleConfig({ tid, roleName }) {
  const [result] = await pool.query(
    `
      DELETE FROM bbs_role_config
      WHERE tid = ?
        AND role_name = ?
      LIMIT 1
    `,
    [tid, roleName]
  );
  return Number(result.affectedRows || 0);
}

module.exports = { listRoleConfigsByTenant, getRoleConfigByTenantAndRole, upsertRoleConfig, deleteRoleConfig };
