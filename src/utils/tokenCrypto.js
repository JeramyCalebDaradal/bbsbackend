const crypto = require("crypto");
const jwt = require("jsonwebtoken");

function normalizeTokenKey(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  return v.replace("jkye3HK", "jky3HK");
}

function bytesFromBase64(b64) {
  return Buffer.from(String(b64 || ""), "base64");
}

function encryptBbsEncV1(plainText, passphrase) {
  const pass = String(passphrase || "").trim();
  if (!pass) {
    const err = new Error("Missing required env var: TOKEN_KEY");
    err.code = "MISSING_ENV";
    throw err;
  }

  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(pass, salt, 120000, 32, "sha256");

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const cipherBytes = Buffer.concat([cipher.update(String(plainText || ""), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const cipherAll = Buffer.concat([cipherBytes, tag]);

  return `bbsenc:v1:${salt.toString("base64")}:${iv.toString("base64")}:${cipherAll.toString("base64")}`;
}

function decryptBbsEncV1(encryptedText, passphrase) {
  const text = String(encryptedText || "").trim();
  if (!text.startsWith("bbsenc:v1:")) {
    const err = new Error("Token is not in a supported format");
    err.code = "TOKEN_FORMAT";
    throw err;
  }

  const raw = text.slice("bbsenc:v1:".length);
  const parts = raw.split(":");
  if (parts.length !== 3) {
    const err = new Error("Token is not in a supported format");
    err.code = "TOKEN_FORMAT";
    throw err;
  }

  const salt = bytesFromBase64(parts[0]);
  const iv = bytesFromBase64(parts[1]);
  const cipherAll = bytesFromBase64(parts[2]);

  if (salt.length !== 16 || iv.length !== 12 || cipherAll.length < 17) {
    const err = new Error("Token is not in a supported format");
    err.code = "TOKEN_FORMAT";
    throw err;
  }

  const pass = String(passphrase || "").trim();
  if (!pass) {
    const err = new Error("Missing required env var: TOKEN_KEY");
    err.code = "MISSING_ENV";
    throw err;
  }

  const key = crypto.pbkdf2Sync(pass, salt, 120000, 32, "sha256");
  const tag = cipherAll.subarray(cipherAll.length - 16);
  const cipherBytes = cipherAll.subarray(0, cipherAll.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(cipherBytes), decipher.final()]);
  return plain.toString("utf8");
}

function getTokenTtlSeconds() {
  const raw = String(process.env.EXPIRY || "").trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return Math.trunc(n);
  }
  return 3 * 24 * 60 * 60;
}

function getJwtSecret() {
  const enc = String(process.env.TOKEN_ENC || "").trim();
  if (enc) {
    const keyRaw = process.env.TOKEN_ENC_KEY || process.env.TOKEN_KEY;
    const passphrase = normalizeTokenKey(keyRaw);
    if (!passphrase) {
      const err = new Error("Missing required env var: TOKEN_ENC_KEY");
      err.code = "MISSING_ENV";
      throw err;
    }
    const decrypted = decryptBbsEncV1(enc, passphrase);
    const secret = String(decrypted || "").trim();
    if (!secret) {
      const err = new Error("Decrypted token secret is empty");
      err.code = "TOKEN_ENC_EMPTY";
      throw err;
    }
    return secret;
  }

  const normalized = normalizeTokenKey(process.env.TOKEN_KEY);
  if (!normalized) {
    const err = new Error("Missing required env var: TOKEN_KEY");
    err.code = "MISSING_ENV";
    throw err;
  }
  return normalized;
}

function issueUserToken({ userId, role, firstName, lastName, email, sender }) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid <= 0) {
    const err = new Error("userId is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  const ttlSeconds = getTokenTtlSeconds();
  const secret = getJwtSecret();
  const senderValue = String(sender || "").trim();
  const token = jwt.sign(
    {
      role: String(role || ""),
      firstName: String(firstName || ""),
      lastName: String(lastName || ""),
      email: String(email || ""),
      sender: senderValue,
    },
    secret,
    { subject: String(uid), expiresIn: ttlSeconds }
  );

  const expiresAtMs = Date.now() + ttlSeconds * 1000;
  const tokenEnc = encryptBbsEncV1(token, secret);
  return { token, tokenEnc, ttlSeconds, expiresAtMs };
}

function verifyUserToken(token) {
  const secret = getJwtSecret();
  let rawToken = String(token || "").trim();
  if (rawToken.startsWith("bbsenc:v1:")) {
    rawToken = decryptBbsEncV1(rawToken, secret);
  }
  try {
    const payload = jwt.verify(rawToken, secret);
    const sub = payload?.sub;
    const userId = Number(sub);
    if (!Number.isFinite(userId) || userId <= 0) {
      const err = new Error("Invalid token");
      err.statusCode = 401;
      err.code = "TOKEN_INVALID";
      throw err;
    }
    return {
      userId,
      role: payload?.role,
      sender: payload?.sender,
      email: payload?.email,
      firstName: payload?.firstName,
      lastName: payload?.lastName,
    };
  } catch (e) {
    if (e && e.name === "TokenExpiredError") {
      const err = new Error("Token expired");
      err.statusCode = 401;
      err.code = "TOKEN_EXPIRED";
      throw err;
    }
    const err = new Error("Invalid token");
    err.statusCode = 401;
    err.code = "TOKEN_INVALID";
    throw err;
  }
}

module.exports = {
  normalizeTokenKey,
  encryptBbsEncV1,
  decryptBbsEncV1,
  getTokenTtlSeconds,
  issueUserToken,
  verifyUserToken,
};
