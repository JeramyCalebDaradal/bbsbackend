const { listUsers: repoListUsers, getUserByOid } = require("./users.repository");

/**
 * List users with pagination and filters.
 * @param {Object} options
 * @returns {Promise<{users: Array, total: number, page: number, limit: number, totalPages: number}>}
 */
async function listUsers(options) {
  return repoListUsers(options);
}

/**
 * Get a single user by tid and oid.
 * @param {string} tid
 * @param {string} oid
 * @returns {Promise<Object|null>}
 */
async function getUser(tid, oid) {
  return getUserByOid(tid, oid);
}

module.exports = {
  listUsers,
  getUser,
};