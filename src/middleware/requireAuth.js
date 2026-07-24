const jwt = require("jsonwebtoken");
const https = require("https");
const crypto = require("crypto");
const { verifyUserToken } = require("../utils/tokenCrypto");
const { getEnvDecrypted } = require("../utils/envCrypto");

const entraCache = {
  openIdConfigByTid: new Map(),
  jwksByTid: new Map(),
};

function readResponseBody(res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.on("data", (d) => chunks.push(d));
    res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    res.on("error", reject);
  });
}

async function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "GET" }, async (res) => {
      try {
        const body = await readResponseBody(res);
        const statusCode = Number(res.statusCode || 0);
        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`HTTP_${statusCode}`));
          return;
        }
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
    req.end();
  });
}

async function getOpenIdConfiguration(tenantId) {
  const now = Date.now();
  const cached = entraCache.openIdConfigByTid.get(tenantId);
  if (cached && cached.expiresAt > now) return cached.value;

  const url = `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`;
  const value = await fetchJson(url);
  entraCache.openIdConfigByTid.set(tenantId, { value, expiresAt: now + 60 * 60 * 1000 });
  return value;
}

async function getJwks(tenantId, jwksUri) {
  const now = Date.now();
  const cached = entraCache.jwksByTid.get(tenantId);
  if (cached && cached.expiresAt > now) return cached.value;

  const value = await fetchJson(jwksUri);
  entraCache.jwksByTid.set(tenantId, { value, expiresAt: now + 60 * 60 * 1000 });
  return value;
}

function getExpectedEntraAudience() {
  return (
    String(getEnvDecrypted("ENTRA_API_AUDIENCE") || "").trim() ||
    String(getEnvDecrypted("ENTRA_AUDIENCE") || "").trim() ||
    String(getEnvDecrypted("ENTRA_CLIENT_ID") || "").trim()
  );
}

function decodeJwtHeader(token) {
  try {
    const decoded = jwt.decode(token, { complete: true });
    return decoded?.header || null;
  } catch {
    return null;
  }
}

async function verifyEntraAccessToken(token) {
  const tenantId = String(getEnvDecrypted("ENTRA_TENANT_ID") || "").trim();
  const expectedAudience = getExpectedEntraAudience();

  process.stderr.write(`[requireAuth] tenantId="${tenantId}" audience="${expectedAudience}"\n`);

  if (!tenantId || !expectedAudience) {
    process.stderr.write(`[requireAuth] Missing config — aborting\n`);
    return null;
  }

  const header = decodeJwtHeader(token);
  const alg = String(header?.alg || "");
  const kid = String(header?.kid || "");
  if (!kid || !/^RS/i.test(alg)) return null;

  const openId = await getOpenIdConfiguration(tenantId);
  const jwks = await getJwks(tenantId, openId.jwks_uri);
  const jwk = Array.isArray(jwks?.keys) ? jwks.keys.find((k) => String(k?.kid || "") === kid) : null;
  if (!jwk) return null;

  let publicKeyPem = "";
  try {
    const keyObj = crypto.createPublicKey({ key: jwk, format: "jwk" });
    publicKeyPem = keyObj.export({ format: "pem", type: "spki" });
  } catch {
    return null;
  }

  let payload;
  try {
    payload = jwt.verify(token, publicKeyPem, {
      algorithms: [alg],
      audience: expectedAudience,
      clockTolerance: 5,
    });
  } catch {
    return null;
  }

  const tid = String(payload?.tid || "").trim();
  if (!tid || tid !== tenantId) return null;

  const iss = String(payload?.iss || "").trim();
  const expectedIssV2 = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  const expectedIssV1 = `https://sts.windows.net/${tenantId}/`;
  const expectedIssV1NoSlash = `https://sts.windows.net/${tenantId}`;
  if (iss !== expectedIssV2 && iss !== expectedIssV1 && iss !== expectedIssV1NoSlash) return null;

  const oid = String(payload?.oid || "").trim();
  const roles = Array.isArray(payload?.roles) ? payload.roles : [];
  const upn =
    String(payload?.preferred_username || "").trim() ||
    String(payload?.upn || "").trim() ||
    String(payload?.email || "").trim();

  return {
    tid,
    oid,
    roles,
    upn,
  };
}

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

async function requireAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    const accessPayload = verifyAccessToken(token);
    if (accessPayload) {
      req.userId = accessPayload.userId;
      req.userRole = accessPayload.role;
      req.tokenFamilyId = accessPayload.familyId;
      return next();
    }

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

    const err = new Error("Unauthorized");
    err.statusCode = 401;
    err.code = "UNAUTHORIZED";
    throw err;
  } catch (err) {
    return next(err);
  }
}

async function requireEntraAuth(req, res, next) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    const entraPayload = await verifyEntraAccessToken(token);
    if (!entraPayload) {
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    req.entra = entraPayload;
    const roles = Array.isArray(entraPayload.roles) ? entraPayload.roles : [];
    if (roles.length > 1) {
      const err = new Error("Forbidden");
      err.statusCode = 403;
      err.code = "ROLE_CONFLICT";
      throw err;
    }
    req.userRole = roles[0] || "Default";
    next();
  } catch (err) {
    next(err);
  }
}

function requireDashboardAuth(req, res, next) {
  return requireEntraAuth(req, res, (err) => {
    if (err) return next(err);
    if (String(req.userRole || "") === "Default") {
      const e = new Error("Forbidden");
      e.statusCode = 403;
      e.code = "FORBIDDEN";
      return next(e);
    }
    return next();
  });
}

module.exports = { requireAuth, requireEntraAuth, requireDashboardAuth };
