/**
 * tokenService.js
 *
 * Complete token rotation system with strict rotation + reuse detection.
 *
 * Architecture:
 *   - Access token:  short-lived JWT (15 min), signed with ACCESS_TOKEN_SECRET
 *   - Refresh token: opaque random hex (64 chars), bcrypt-hashed in DB
 *   - Family chain:  all rotations share a family_id (UUID v4)
 *   - Reuse detection: if a stale refresh token is presented, the ENTIRE
 *     family is revoked — both attacker and legitimate user lose access.
 */

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { pool } = require("../db/pool");

const BCRYPT_ROUNDS = 12;
const REFRESH_TOKEN_BYTES = 64;

// ──────────────────────────────────────────────
//  Internal helpers
// ──────────────────────────────────────────────

/**
 * Look up the latest non-expired refresh token row.
 * We query by family_id derived from the token's cookie, but since we don't
 * know the family_id until we match the hash, we instead look at the latest
 * row for this user. A more precise approach would store an encrypted family_id
 * in the cookie, but the current design keeps it simple for security auditability:
 *
 *   1. Pull the most recent row (by created_at DESC) that isn't expired.
 *   2. bcrypt.compare the provided token against its hash.
 *   3. If match → rotate. If mismatch → reuse detected.
 */
async function findLatestToken(userId) {
  const [rows] = await pool.query(
    `SELECT id, token_hash, family_id, user_id, revoked
     FROM refresh_tokens
     WHERE user_id = ? AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );
  return rows?.[0] || null;
}

/**
 * Find a non-expired, non-revoked token by bcrypt-comparing the provided
 * refresh token value against all candidate rows.
 *
 * This is used as a fallback when the userId is not known (e.g., the frontend
 * couldn't decode the expired access token). It scans all valid tokens, which
 * is O(n) but acceptable for a small admin panel (typically < 50 rows).
 */
async function findTokenByValue(providedToken) {
  const [rows] = await pool.query(
    `SELECT id, token_hash, family_id, user_id, revoked
     FROM refresh_tokens
     WHERE revoked = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC`
  );

  for (const row of rows) {
    const match = await bcrypt.compare(providedToken, row.token_hash);
    if (match) return row;
  }

  return null;
}

/**
 * Find the latest non-expired token by family_id (used during logout).
 */
async function findLatestByFamily(familyId) {
  const [rows] = await pool.query(
    `SELECT id, token_hash, family_id, user_id, revoked
     FROM refresh_tokens
     WHERE family_id = ? AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [familyId]
  );
  return rows?.[0] || null;
}

// ──────────────────────────────────────────────
//  ISSUE:  called on login
// ──────────────────────────────────────────────

async function issueTokens(user) {
  const familyId = crypto.randomUUID();

  // 1. Access token: short-lived JWT
  const accessTtl = String(process.env.ACCESS_TOKEN_TTL || "900").trim();
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role, familyId },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: `${accessTtl}s` }
  );

  // 2. Refresh token: opaque random hex
  const refreshToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const tokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);

  // 3. Persist refresh token hash to DB
  const refreshTtl = String(process.env.REFRESH_TOKEN_TTL || "259200").trim();
  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND))`,
    [user.id, tokenHash, familyId, Number(refreshTtl)]
  );

  return { accessToken, refreshToken, familyId };
}

// ──────────────────────────────────────────────
//  ROTATE:  called on /auth/refresh
//  Implements strict rotation + reuse detection
// ──────────────────────────────────────────────

async function rotateRefreshToken(userId, providedToken, ipHint) {
  // If userId is provided, look up by userId (efficient).
  // Otherwise, fall back to scanning all valid tokens (O(n) but acceptable).
  let current;
  if (userId) {
    current = await findLatestToken(userId);
  } else {
    current = await findTokenByValue(providedToken);
  }

  if (!current) {
    const err = new Error("Session expired — please log in again");
    err.statusCode = 401;
    err.code = "SESSION_EXPIRED";
    throw err;
  }

  if (current.revoked) {
    const err = new Error("Session revoked — please log in again");
    err.statusCode = 401;
    err.code = "SESSION_REVOKED";
    throw err;
  }

  // Compare provided token against stored hash
  const isValid = await bcrypt.compare(providedToken, current.token_hash);

  if (!isValid) {
    // ── REUSE DETECTED ──
    // Someone presented an old/stale token from this family.
    // Kill the ENTIRE family — both attacker and legitimate user lose access.
    await pool.query(
      `UPDATE refresh_tokens SET revoked = TRUE WHERE family_id = ?`,
      [current.family_id]
    );

    // Log for security monitoring
    console.error(
      "[TOKEN_REUSE] family=%s user=%d ip=%s",
      current.family_id,
      current.user_id,
      ipHint || "unknown"
    );

    const err = new Error("Session revoked — please log in again");
    err.statusCode = 401;
    err.code = "SESSION_REVOKED";
    throw err;
  }

  // ── LEGITIMATE ROTATION ──
  // Issue new token in the same family, revoke the old one.
  const newToken = crypto.randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const newHash = await bcrypt.hash(newToken, BCRYPT_ROUNDS);

  // Fixed window: all tokens in the family share the same expires_at,
  // calculated from the FIRST token's creation time.
  const [[firstToken]] = await pool.query(
    `SELECT created_at FROM refresh_tokens
     WHERE family_id = ? AND id = (SELECT MIN(id) FROM refresh_tokens WHERE family_id = ?)`,
    [current.family_id, current.family_id]
  );

  const refreshTtl = String(process.env.REFRESH_TOKEN_TTL || "259200").trim();
  let expiresAt;
  if (firstToken?.created_at) {
    const base = new Date(firstToken.created_at).getTime();
    expiresAt = new Date(base + Number(refreshTtl) * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
  } else {
    // Fallback (shouldn't happen): use NOW()
    expiresAt = new Date(Date.now() + Number(refreshTtl) * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
  }

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, family_id, expires_at)
     VALUES (?, ?, ?, ?)`,
    [current.user_id, newHash, current.family_id, expiresAt]
  );

  await pool.query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE id = ?`,
    [current.id]
  );

  // Issue fresh access token — must include role for requireRole middleware
  const [[userRow]] = await pool.query(
    `SELECT role FROM auth WHERE id = ? LIMIT 1`,
    [current.user_id]
  );

  const accessTtl = String(process.env.ACCESS_TOKEN_TTL || "900").trim();
  const accessToken = jwt.sign(
    {
      sub: current.user_id,
      role: userRow?.role || "",
      familyId: current.family_id,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: `${accessTtl}s` }
  );

  return { accessToken, refreshToken: newToken };
}

// ──────────────────────────────────────────────
//  REVOKE:  called on logout / password change / admin demotion
// ──────────────────────────────────────────────

/**
 * Revoke ALL families for a user — kills every device/session.
 */
async function revokeAllSessions(userId) {
  await pool.query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE user_id = ? AND revoked = FALSE`,
    [userId]
  );
}

/**
 * Revoke a specific family (used after reuse detection or targeted logout).
 */
async function revokeFamily(familyId) {
  await pool.query(
    `UPDATE refresh_tokens SET revoked = TRUE WHERE family_id = ?`,
    [familyId]
  );
}

module.exports = {
  issueTokens,
  rotateRefreshToken,
  revokeAllSessions,
  revokeFamily,
  findLatestByFamily,
  findTokenByValue,
};