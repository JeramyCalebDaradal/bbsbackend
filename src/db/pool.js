const crypto = require("crypto");
const fs = require("fs");
const mysql = require("mysql2/promise");

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    const err = new Error(`Missing required env var: ${name}`);
    err.code = "MISSING_ENV";
    throw err;
  }
  return value;
}

function bytesFromBase64(b64) {
  return Buffer.from(String(b64 || ""), "base64");
}

function decryptDbEnv({ encrypted, passphrase }) {
  const text = String(encrypted || "").trim();
  if (!text.startsWith("bbsenc:v1:")) {
    const err = new Error("DB_ENC is not in a supported format");
    err.code = "DB_ENC_FORMAT";
    throw err;
  }

  const raw = text.slice("bbsenc:v1:".length);
  const parts = raw.split(":");
  if (parts.length !== 3) {
    const err = new Error("DB_ENC is not in a supported format");
    err.code = "DB_ENC_FORMAT";
    throw err;
  }

  const salt = bytesFromBase64(parts[0]);
  const iv = bytesFromBase64(parts[1]);
  const cipherAll = bytesFromBase64(parts[2]);

  if (salt.length !== 16 || iv.length !== 12 || cipherAll.length < 17) {
    const err = new Error("DB_ENC is not in a supported format");
    err.code = "DB_ENC_FORMAT";
    throw err;
  }

  const key = crypto.pbkdf2Sync(String(passphrase || ""), salt, 120000, 32, "sha256");
  const tag = cipherAll.subarray(cipherAll.length - 16);
  const cipher = cipherAll.subarray(0, cipherAll.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(cipher), decipher.final()]);
  return plain.toString("utf8");
}

function parseDbConfigFromDecryptedText(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    const err = new Error("Decrypted DB config is empty");
    err.code = "DB_ENC_EMPTY";
    throw err;
  }

  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    obj = null;
  }

  if (!obj || typeof obj !== "object") {
    obj = {};
    const cleaned = raw.replace(/^\s*\{/, "").replace(/\}\s*$/, "");
    const parts = cleaned.split(/[\r\n,]+/);
    for (const part of parts) {
      const line = String(part || "").trim();
      if (!line) continue;
      const m = line.match(/^"?(DB_[A-Z0-9_]+)"?\s*[:=]\s*(.+)$/);
      if (!m) continue;
      const key = String(m[1] || "").trim();
      let value = String(m[2] || "").trim();
      if (value.endsWith(",")) value = value.slice(0, -1).trim();
      value = value.replace(/^"+/, "").replace(/"+$/, "");
      value = value.replace(/^'+/, "").replace(/'+$/, "");
      obj[key] = value;
    }
  }

  const host = String(obj?.DB_HOST || "").trim();
  const user = String(obj?.DB_USER || "").trim();
  const database = String(obj?.DB_DATABASE || "").trim();
  const port = Number(obj?.DB_PORT || 3306);
  const password = obj?.DB_PASS ?? "";

  const sslRequiredRaw = obj?.DB_SSL_REQUIRED ?? obj?.DB_SSL ?? obj?.DB_SSL_MODE ?? "";
  const sslCaPathRaw = obj?.DB_SSL_CA_PATH ?? obj?.DB_SSL_CA ?? "";
  const sslCaB64Raw = obj?.DB_SSL_CA_B64 ?? "";
  const sslRejectRaw = obj?.DB_SSL_REJECT_UNAUTHORIZED ?? obj?.DB_SSL_VERIFY ?? "";
  const sslVerifyServerCertRaw = obj?.DB_SSL_VERIFY_SERVER_CERT ?? "";

  if (!host || !user || !database || !Number.isFinite(port)) {
    const err = new Error("Decrypted DB config is missing required fields");
    err.code = "DB_ENC_FIELDS";
    throw err;
  }

  let sslRequired = false;
  const sslText = String(sslRequiredRaw || "").trim().toLowerCase();
  if (sslText) {
    if (sslText === "true" || sslText === "1" || sslText === "required") sslRequired = true;
    if (sslText === "verify_ca" || sslText === "verify_identity") sslRequired = true;
  }

  let ca = "";
  const caPath = String(sslCaPathRaw || "").trim();
  const caB64 = String(sslCaB64Raw || "").trim();
  if (caB64) {
    try {
      ca = Buffer.from(caB64, "base64").toString("utf8");
    } catch {}
  } else if (caPath) {
    try {
      ca = fs.readFileSync(caPath, "utf8");
    } catch {}
  }

  let rejectUnauthorized = false;
  const rejectText = String(sslRejectRaw || "").trim().toLowerCase();
  if (rejectText === "true" || rejectText === "1") rejectUnauthorized = true;
  if (rejectText === "false" || rejectText === "0") rejectUnauthorized = false;
  if (!rejectText && ca) rejectUnauthorized = true;

  const verifyServerCertText = String(sslVerifyServerCertRaw || "").trim().toLowerCase();
  if (verifyServerCertText === "true" || verifyServerCertText === "1") rejectUnauthorized = true;

  const ssl = sslRequired
    ? {
        ...(ca ? { ca } : null),
        rejectUnauthorized,
      }
    : undefined;

  return { host, port, user, password: String(password), database, ssl };
}

function normalizePassphrase(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  return v.replace("NCieO", "NCiO");
}

function resolveDbConfig() {
  const enc = String(process.env.DB_ENC || "").trim();
  if (!enc) {
    const sslRequiredRaw = process.env.DB_SSL_REQUIRED ?? process.env.DB_SSL ?? process.env.DB_SSL_MODE ?? "";
    const sslCaPathRaw = process.env.DB_SSL_CA_PATH ?? process.env.DB_SSL_CA ?? "";
    const sslCaB64Raw = process.env.DB_SSL_CA_B64 ?? "";
    const sslRejectRaw = process.env.DB_SSL_REJECT_UNAUTHORIZED ?? process.env.DB_SSL_VERIFY ?? "";
    const sslVerifyServerCertRaw = process.env.DB_SSL_VERIFY_SERVER_CERT ?? "";

    let sslRequired = false;
    const sslText = String(sslRequiredRaw || "").trim().toLowerCase();
    if (sslText) {
      if (sslText === "true" || sslText === "1" || sslText === "required") sslRequired = true;
      if (sslText === "verify_ca" || sslText === "verify_identity") sslRequired = true;
    }

    let ca = "";
    const caPath = String(sslCaPathRaw || "").trim();
    const caB64 = String(sslCaB64Raw || "").trim();
    if (caB64) {
      try {
        ca = Buffer.from(caB64, "base64").toString("utf8");
      } catch {}
    } else if (caPath) {
      try {
        ca = fs.readFileSync(caPath, "utf8");
      } catch {}
    }

    let rejectUnauthorized = false;
    const rejectText = String(sslRejectRaw || "").trim().toLowerCase();
    if (rejectText === "true" || rejectText === "1") rejectUnauthorized = true;
    if (rejectText === "false" || rejectText === "0") rejectUnauthorized = false;
    if (!rejectText && ca) rejectUnauthorized = true;

    const verifyServerCertText = String(sslVerifyServerCertRaw || "").trim().toLowerCase();
    if (verifyServerCertText === "true" || verifyServerCertText === "1") rejectUnauthorized = true;

    const ssl = sslRequired
      ? {
          ...(ca ? { ca } : null),
          rejectUnauthorized,
        }
      : undefined;

    return {
      host: requireEnv("DB_HOST"),
      port: Number(process.env.DB_PORT || 3306),
      user: requireEnv("DB_USER"),
      password: process.env.DB_PASS ?? "",
      database: requireEnv("DB_DATABASE"),
      ssl,
    };
  }

  const passphraseRaw = process.env.DB_ENC_KEY || process.env.DB_KEY;
  const passphrase = normalizePassphrase(passphraseRaw);
  if (!passphrase) {
    const hasRaw =
      Boolean(process.env.DB_HOST) && Boolean(process.env.DB_USER) && Boolean(process.env.DB_DATABASE);
    if (hasRaw) {
      const sslRequiredRaw = process.env.DB_SSL_REQUIRED ?? process.env.DB_SSL ?? process.env.DB_SSL_MODE ?? "";
      const sslCaPathRaw = process.env.DB_SSL_CA_PATH ?? process.env.DB_SSL_CA ?? "";
      const sslCaB64Raw = process.env.DB_SSL_CA_B64 ?? "";
      const sslRejectRaw = process.env.DB_SSL_REJECT_UNAUTHORIZED ?? process.env.DB_SSL_VERIFY ?? "";
      const sslVerifyServerCertRaw = process.env.DB_SSL_VERIFY_SERVER_CERT ?? "";

      let sslRequired = false;
      const sslText = String(sslRequiredRaw || "").trim().toLowerCase();
      if (sslText) {
        if (sslText === "true" || sslText === "1" || sslText === "required") sslRequired = true;
        if (sslText === "verify_ca" || sslText === "verify_identity") sslRequired = true;
      }

      let ca = "";
      const caPath = String(sslCaPathRaw || "").trim();
      const caB64 = String(sslCaB64Raw || "").trim();
      if (caB64) {
        try {
          ca = Buffer.from(caB64, "base64").toString("utf8");
        } catch {}
      } else if (caPath) {
        try {
          ca = fs.readFileSync(caPath, "utf8");
        } catch {}
      }

      let rejectUnauthorized = false;
      const rejectText = String(sslRejectRaw || "").trim().toLowerCase();
      if (rejectText === "true" || rejectText === "1") rejectUnauthorized = true;
      if (rejectText === "false" || rejectText === "0") rejectUnauthorized = false;
      if (!rejectText && ca) rejectUnauthorized = true;

      const verifyServerCertText = String(sslVerifyServerCertRaw || "").trim().toLowerCase();
      if (verifyServerCertText === "true" || verifyServerCertText === "1") rejectUnauthorized = true;

      const ssl = sslRequired
        ? {
            ...(ca ? { ca } : null),
            rejectUnauthorized,
          }
        : undefined;

      return {
        host: requireEnv("DB_HOST"),
        port: Number(process.env.DB_PORT || 3306),
        user: requireEnv("DB_USER"),
        password: process.env.DB_PASS ?? "",
        database: requireEnv("DB_DATABASE"),
        ssl,
      };
    }
    const err = new Error("Missing required env var: DB_ENC_KEY");
    err.code = "MISSING_ENV";
    throw err;
  }

  const decrypted = decryptDbEnv({ encrypted: enc, passphrase });
  return parseDbConfigFromDecryptedText(decrypted);
}

const pool = {
  query: async (...args) => {
    const config = resolveDbConfig();
    const conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      ssl: config.ssl,
      namedPlaceholders: true,
    });
    try {
      return await conn.query(...args);
    } finally {
      try {
        await conn.end();
      } catch {}
    }
  },
  end: async () => {
    return;
  },
};

module.exports = { pool };
