const jwt = require("jsonwebtoken");
const { insertApiLog, listApiLogs } = require("./apiLogs.repository");
const { verifyUserToken } = require("../../utils/tokenCrypto");

/**
 * Try to extract user_id from a Bearer token.
 * Tries ACCESS_TOKEN_SECRET first, then legacy TOKEN_KEY.
 */
function resolveUserIdFromToken(token) {
  if (!token) return null;

  const parts = String(token).split(/\s+/);
  const raw = parts.length === 2 && /^bearer$/i.test(parts[0]) ? parts[1] : null;
  if (!raw) return null;

  try {
    const payload = jwt.verify(raw, process.env.ACCESS_TOKEN_SECRET);
    const userId = Number(payload?.sub);
    if (Number.isFinite(userId) && userId > 0) return userId;
  } catch {
    // Fall through to legacy check
  }

  try {
    const payload = verifyUserToken(raw);
    if (payload && Number.isFinite(payload.userId) && payload.userId > 0) {
      return payload.userId;
    }
  } catch {
    // Not a valid token
  }

  return null;
}

/**
 * Mask a Bearer token for safe storage.
 * Returns "Bearer abcdef...xyz" (first 10 + last 4 chars).
 */
function maskAuthHeader(header) {
  if (!header) return null;
  const raw = String(header).trim();
  if (!raw) return null;

  const prefix = raw.length > 14 ? `${raw.slice(0, 14)}...${raw.slice(-4)}` : raw.slice(0, 30);
  return prefix;
}

async function ingestLog({ method, url, ip, status, time, auth, ua, ms, referer }) {
  const userId = resolveUserIdFromToken(auth);
  const authMasked = maskAuthHeader(auth);

  const statusCode = Number(status);
  const responseTimeMs = Number(ms);

  const parsedUrl = String(url || "").trim().slice(0, 2048);
  const parsedMethod = String(method || "GET").trim().toUpperCase().slice(0, 10);
  const parsedIp = String(ip || "").trim().slice(0, 45);
  const parsedUa = String(ua || "").trim().slice(0, 512);
  const parsedReferer = String(referer || "").trim().slice(0, 2048);

  await insertApiLog({
    url: parsedUrl || "/",
    method: parsedMethod,
    ipAddress: parsedIp || "0.0.0.0",
    statusCode: Number.isFinite(statusCode) && statusCode > 0 ? statusCode : 0,
    userId: userId || null,
    authMasked,
    userAgent: parsedUa || null,
    responseTimeMs: Number.isFinite(responseTimeMs) && responseTimeMs >= 0 ? Math.round(responseTimeMs * 1000) : null,
    referer: parsedReferer || null,
  });
}

function normalizeDate(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const err = new Error("date must be YYYY-MM-DD");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

async function getApiLogs(query) {
  const page = query?.page;
  const pageSize = query?.pageSize;
  const fromDate = query?.from ? normalizeDate(query.from) : "";
  const toDate = query?.to ? normalizeDate(query.to) : "";
  const statusCode = String(query?.status || "").trim();
  const urlSearch = String(query?.url || "").trim();
  const ipSearch = String(query?.ip || "").trim();
  const q = String(query?.q || "").trim();

  const result = await listApiLogs({
    page,
    pageSize,
    fromDate,
    toDate,
    statusCode,
    urlSearch,
    ipSearch,
    query: q,
  });

  return {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    logs: result.rows.map((r) => ({
      id: r.id,
      url: r.url,
      method: r.method,
      ip_address: r.ip_address,
      status_code: r.status_code,
      user_id: r.user_id,
      user_email: r.user_email || null,
      authorization_masked: r.authorization_masked,
      user_agent: r.user_agent,
      response_time_ms: r.response_time_ms,
      referer: r.referer,
      time_sent: r.time_sent,
      date_sent: r.date_sent,
    })),
  };
}

module.exports = { ingestLog, getApiLogs };