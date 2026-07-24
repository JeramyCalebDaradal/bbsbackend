const { pool } = require("../db/pool");
const { getGraphAccessToken, graphGet, getUserByOid, listAllUsers } = require("./graphClient");

/**
 * Normalizes a Microsoft Graph user object into bbs_users fields.
 */
function mapGraphUserToBbs(graphUser, tid) {
  const now = new Date();
  const relevantFields = [
    "id",
    "userPrincipalName",
    "mail",
    "displayName",
    "givenName",
    "surname",
    "accountEnabled",
    "userType",
    "onPremisesImmutableId",
    "employeeId",
    "jobTitle",
    "department",
    "officeLocation",
    "preferredLanguage",
    "mobilePhone",
    "businessPhones",
    "createdDateTime",
    "lastPasswordChangeDateTime",
  ];

  const syncHash = Buffer.from(JSON.stringify(
    Object.fromEntries(
      Object.entries(graphUser).filter(([k]) => relevantFields.includes(k))
    )
  )).toString("base64");

  return {
    tid,
    oid: graphUser.id,
    upn: graphUser.userPrincipalName || "",
    mail: graphUser.mail || null,
    display_name: graphUser.displayName || "",
    given_name: graphUser.givenName || null,
    surname: graphUser.surname || null,
    account_enabled: graphUser.accountEnabled === true,
    user_type: graphUser.userType || "Member",
    last_synced_at: now,
    sync_hash: syncHash,
    deleted_at: graphUser.accountEnabled === false ? now : null,
  };
}

/**
 * Upserts a user into bbs_users.
 * Returns the affected row count.
 */
async function upsertBbsUser(userData) {
  const {
    tid, oid, upn, mail, display_name, given_name, surname,
    account_enabled, user_type, last_synced_at, sync_hash, deleted_at
  } = userData;

  const [result] = await pool.query(
    `
    INSERT INTO bbs_users
      (tid, oid, upn, mail, display_name, given_name, surname, account_enabled, user_type, last_synced_at, sync_hash, deleted_at, created_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM bbs_users WHERE tid = ? AND oid = ?), NOW()))
    ON DUPLICATE KEY UPDATE
      upn = VALUES(upn),
      mail = VALUES(mail),
      display_name = VALUES(display_name),
      given_name = VALUES(given_name),
      surname = VALUES(surname),
      account_enabled = VALUES(account_enabled),
      user_type = VALUES(user_type),
      last_synced_at = VALUES(last_synced_at),
      sync_hash = VALUES(sync_hash),
      deleted_at = VALUES(deleted_at)
    `,
    [tid, oid, upn, mail, display_name, given_name, surname, account_enabled, user_type, last_synced_at, sync_hash, deleted_at, tid, oid]
  );

  return result.affectedRows;
}

/**
 * Soft-deletes a user (marks deleted_at) in bbs_users.
 */
async function softDeleteBbsUser(tid, oid) {
  const [result] = await pool.query(
    "UPDATE bbs_users SET deleted_at = NOW() WHERE tid = ? AND oid = ? AND deleted_at IS NULL",
    [tid, oid]
  );
  return result.affectedRows;
}

/**
 * Reconciles a single user by OID: fetches from Graph, upserts to bbs_users.
 * Returns { success: boolean, user: object|null, error: string|null }
 */
async function reconcileUserByOid(tid, oid) {
  try {
    const graphUser = await getUserByOid(tid, oid);
    if (!graphUser) {
      // User not found in Graph — soft delete in our DB
      await softDeleteBbsUser(tid, oid);
      return { success: true, user: null, action: "soft_deleted" };
    }

    const bbsUser = mapGraphUserToBbs(graphUser, tid);
    await upsertBbsUser(bbsUser);
    return { success: true, user: bbsUser, action: "upserted" };
  } catch (err) {
    return { success: false, user: null, error: err.message };
  }
}

/**
 * Full reconciliation: fetches all users from Graph, upserts to bbs_users.
 * Returns { processed: number, upserted: number, softDeleted: number, errors: string[] }
 */
async function fullReconcile(tid) {
  const results = { processed: 0, upserted: 0, softDeleted: 0, errors: [] };
  const graphOids = new Set();

  try {
    // Fetch all users from Graph (handles pagination)
    await listAllUsers(async (users) => {
      for (const graphUser of users) {
        results.processed++;
        graphOids.add(graphUser.id);

        const bbsUser = mapGraphUserToBbs(graphUser, tid);
        await upsertBbsUser(bbsUser);
        results.upserted++;
      }
    });

    // Find users in bbs_users that are no longer in Graph -> soft delete
    const [dbUsers] = await pool.query(
      "SELECT oid FROM bbs_users WHERE tid = ? AND deleted_at IS NULL",
      [tid]
    );

    for (const { oid } of dbUsers) {
      if (!graphOids.has(oid)) {
        await softDeleteBbsUser(tid, oid);
        results.softDeleted++;
      }
    }

    return results;
  } catch (err) {
    results.errors.push(err.message);
    return results;
  }
}

/**
 * Processes a Graph change notification for a user resource.
 * The notification contains the changed user's OID in the resource URL.
 */
async function processNotification(notification, tid) {
  // notification.resource looks like: "users/6963c620-5569-4b53-9cc9-595cef8c1780"
  const resource = notification.resource || "";
  const match = resource.match(/^users\/(.+)$/i);
  if (!match) {
    return { success: false, reason: "not a user resource", resource };
  }

  const oid = match[1];
  return reconcileUserByOid(tid, oid);
}

module.exports = {
  mapGraphUserToBbs,
  upsertBbsUser,
  softDeleteBbsUser,
  reconcileUserByOid,
  fullReconcile,
  processNotification,
};