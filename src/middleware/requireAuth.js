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

function requireAuth(req, res, next) {
  try {
    const header = String(req.get("authorization") || "").trim();
    const parts = header.split(/\s+/);
    const token = parts.length === 2 && /^bearer$/i.test(parts[0]) ? parts[1] : "";
    if (!token) {
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }
    const verified = verifyUserToken(token);
    const origin = requestOrigin(req);
    const sender = String(verified?.sender || "").trim();
    if (sender && !origin) {
      process.stdout.write(
        `${new Date().toISOString()} sender_missing userId=${verified.userId} sender=${sender} path=${req.originalUrl}\n`
      );
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      err.code = "SENDER_MISSING";
      throw err;
    }
    if (origin && sender && origin !== sender) {
      process.stdout.write(
        `${new Date().toISOString()} sender_mismatch userId=${verified.userId} sender=${sender} origin=${origin} path=${req.originalUrl}\n`
      );
      const err = new Error("Unauthorized");
      err.statusCode = 401;
      err.code = "SENDER_MISMATCH";
      throw err;
    }
    req.userId = verified.userId;
    req.userRole = verified.role;
    req.tokenSender = sender || null;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuth };
