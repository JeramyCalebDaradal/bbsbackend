const jwt = require("jsonwebtoken");
const { verifyUserToken } = require("../utils/tokenCrypto");

function normalizeOrigin(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  try {
    return new URL(v).origin;
  } catch {
    return v.replace(/\/+$/, "");
  }
}

function requestOrigin(req) {
  const origin = normalizeOrigin(req.get("origin"));
  if (origin) return origin;
  const ref = String(req.get("referer") || "").trim();
  if (!ref) return "";
  try {
    return new URL(ref).origin;
  } catch {
    return "";
  }
}

/**
 * Verify a JWT using the new ACCESS_TOKEN_SECRET.
 * Returns { userId, role, familyId } or null on failure.
 */
function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const userId = Number(payload?.sub);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    return {
      userId,
      role: payload?.role || "",
      familyId: payload?.familyId || "",
    };
  } catch {
    return null;
  }
}

/**
 * Verify a JWT using the legacy TOKEN_KEY.
 * Returns { userId, role, sender } or null on failure.
 */
function verifyLegacyToken(token) {
  try {
    const payload = verifyUserToken(token);
    return payload || null;
  } catch {
    return null;
  }
}

/**
 * Extract Bearer token from the Authorization header.
 */
function extractBearerToken(req) {
  const header = String(req.get("authorization") || "").trim();
  const parts = header.split(/\s+/);
  if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
    return parts[1];
  }
  return "";
}

/**
 * requireAuth — authenticates requests using the Bearer token.
 *
 * Resolution order:
 *   1. Try ACCESS_TOKEN_SECRET (new token rotation system)
 *   2. Fall back to TOKEN_KEY (legacy system, backward compat)
 *   3. If both fail → 401
 */
function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    // Attempt 1: New access token (ACCESS_TOKEN_SECRET)
    const accessPayload = verifyAccessToken(token);
    if (accessPayload) {
      req.userId = accessPayload.userId;
      req.userRole = accessPayload.role;
      req.tokenFamilyId = accessPayload.familyId;
      return next();
    }

    // Attempt 2: Legacy token (TOKEN_KEY, backward compat)
    const legacyPayload = verifyLegacyToken(token);
    if (legacyPayload) {
      const origin = requestOrigin(req);
      const sender = String(legacyPayload?.sender || "").trim();
      if (sender && !origin) {
        process.stdout.write(
          `${new Date().toISOString()} sender_missing userId=${legacyPayload.userId} sender=${sender} path=${req.originalUrl}\n`
        );
        const err = new Error("Unauthorized");
        err.statusCode = 401;
        err.code = "SENDER_MISSING";
        throw err;
      }
      if (origin && sender && origin !== sender) {
        process.stdout.write(
          `${new Date().toISOString()} sender_mismatch userId=${legacyPayload.userId} sender=${sender} origin=${origin} path=${req.originalUrl}\n`
        );
        const err = new Error("Unauthorized");
        err.statusCode = 401;
        err.code = "SENDER_MISMATCH";
        throw err;
      }
      req.userId = legacyPayload.userId;
      req.userRole = legacyPayload.role;
      req.tokenSender = sender || null;
      return next();
    }

    // Neither worked
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    err.code = "UNAUTHORIZED";
    throw err;
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth };