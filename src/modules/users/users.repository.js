const { pool } = require("../../db/pool");

/**
 * List users with pagination and filters.
 * @param {Object} options
 * @param {number} options.page - Page number (1-based)
 * @param {number} options.limit - Items per page
 * @param {string} options.search - Search term for upn, mail, display_name
 * @param {string} options.account_enabled - Filter by account_enabled (true/false)
 * @param {string} options.tid - Tenant ID
 * @returns {Promise<{users: Array, total: number, page: number, limit: number}>}
 */
async function listUsers({ page = 1, limit = 20, search = "", account_enabled = "", tid }) {
  const offset = (page - 1) * limit;
  const params = [tid];
  let whereClause = "WHERE tid = ? AND deleted_at IS NULL";

  if (search) {
    whereClause += " AND (upn LIKE ? OR mail LIKE ? OR display_name LIKE ?)";
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (account_enabled !== "") {
    whereClause += " AND account_enabled = ?";
    params.push(account_enabled === "true" ? 1 : 0);
  }

  // Get total count
  const [countResult] = await pool.query(
    `SELECT COUNT(*) as total FROM bbs_users ${whereClause}`,
    params
  );
  const total = countResult[0].total;

  // Get paginated users
  const [users] = await pool.query(
    `
    SELECT 
      tid, oid, upn, mail, display_name, given_name, surname,
      account_enabled, user_type, last_synced_at, deleted_at, created_at
    FROM bbs_users
    ${whereClause}
    ORDER BY last_synced_at DESC
    LIMIT ? OFFSET ?
    `,
    [...params, limit, offset]
  );

  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get a single user by tid and oid.
 * @param {string} tid
 * @param {string} oid
 * @returns {Promise<Object|null>}
 */
async function getUserByOid(tid, oid) {
  const [users] = await pool.query(
    `
    SELECT 
      tid, oid, upn, mail, display_name, given_name, surname,
      account_enabled, user_type, last_synced_at, deleted_at, created_at
    FROM bbs_users
    WHERE tid = ? AND oid = ? AND deleted_at IS NULL
    `,
    [tid, oid]
  );
  return users[0] || null;
}

module.exports = {
  listUsers,
  getUserByOid,
};