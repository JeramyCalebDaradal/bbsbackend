const { listUsers, getUser } = require("./users.service");
const { getEnvDecrypted } = require("../../utils/envCrypto");

/**
 * GET /admin/users
 * List users from bbs_users with pagination and filters.
 * Query params: page, limit, search, account_enabled
 * Requires: Administrator role + users page access
 */
async function listUsersController(req, res) {
  try {
    const tid = getEnvDecrypted("ENTRA_TENANT_ID");
    
    const {
      page = 1,
      limit = 20,
      search = "",
      account_enabled = "",
    } = req.query;

    const result = await listUsers({
      tid,
      page: Math.max(1, parseInt(page)),
      limit: Math.min(100, Math.max(1, parseInt(limit))),
      search: String(search),
      account_enabled: String(account_enabled),
    });

    res.json(result);
  } catch (err) {
    console.error("[users] listUsers error:", err);
    res.status(500).json({ error: "Failed to list users" });
  }
}

/**
 * GET /admin/users/:oid
 * Get a single user by OID.
 * Requires: Administrator role + users page access
 */
async function getUserController(req, res) {
  try {
    const tid = getEnvDecrypted("ENTRA_TENANT_ID");
    const { oid } = req.params;

    if (!oid) {
      return res.status(400).json({ error: "OID is required" });
    }

    const user = await getUser(tid, oid);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("[users] getUser error:", err);
    res.status(500).json({ error: "Failed to get user" });
  }
}

module.exports = {
  listUsers: listUsersController,
  getUser: getUserController,
};