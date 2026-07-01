const crypto = require("crypto");
const { S3Client } = require("@aws-sdk/client-s3");

function requireEnvValue(name, value) {
  const v = String(value || "").trim();
  if (!v) {
    const err = new Error(`Missing required env var: ${name}`);
    err.statusCode = 500;
    err.code = "MISSING_ENV";
    throw err;
  }
  return v;
}

function normalizePassphrase(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  return v.replace("NCieO", "NCiO");
}

function bytesFromBase64(b64) {
  return Buffer.from(String(b64 || ""), "base64");
}

function decryptBbsEncV1({ encrypted, passphrase }) {
  const text = String(encrypted || "").trim();
  if (!text.startsWith("bbsenc:v1:")) {
    const err = new Error("BUCKET is not in a supported format");
    err.statusCode = 500;
    err.code = "BUCKET_FORMAT";
    throw err;
  }

  const raw = text.slice("bbsenc:v1:".length);
  const parts = raw.split(":");
  if (parts.length !== 3) {
    const err = new Error("BUCKET is not in a supported format");
    err.statusCode = 500;
    err.code = "BUCKET_FORMAT";
    throw err;
  }

  const salt = bytesFromBase64(parts[0]);
  const iv = bytesFromBase64(parts[1]);
  const cipherAll = bytesFromBase64(parts[2]);

  if (salt.length !== 16 || iv.length !== 12 || cipherAll.length < 17) {
    const err = new Error("BUCKET is not in a supported format");
    err.statusCode = 500;
    err.code = "BUCKET_FORMAT";
    throw err;
  }

  const pass = String(passphrase || "").trim();
  if (!pass) {
    const err = new Error("Missing required env var: BUCKET_ENC_KEY");
    err.statusCode = 500;
    err.code = "MISSING_ENV";
    throw err;
  }

  const key = crypto.pbkdf2Sync(pass, salt, 120000, 32, "sha256");
  const tag = cipherAll.subarray(cipherAll.length - 16);
  const cipher = cipherAll.subarray(0, cipherAll.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(cipher), decipher.final()]);
  return plain.toString("utf8");
}

function parseBucketConfigText(text) {
  const raw = String(text || "").trim();
  if (!raw) {
    const err = new Error("BUCKET config is empty");
    err.statusCode = 500;
    err.code = "BUCKET_EMPTY";
    throw err;
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}

  const obj = {};
  const cleaned = raw.replace(/^\s*\{/, "").replace(/\}\s*$/, "");
  const parts = cleaned.split(/[\r\n,]+/);
  for (const part of parts) {
    const line = String(part || "").trim();
    if (!line) continue;
    const m = line.match(/^"?(S3_BUCKET|S3_REGION|S3_ACCESS_KEY|S3_SECRET_KEY)"?\s*[:=]\s*(.+)$/);
    if (!m) continue;
    const key = String(m[1] || "").trim();
    let value = String(m[2] || "").trim();
    if (value.endsWith(",")) value = value.slice(0, -1).trim();
    value = value.replace(/^"+/, "").replace(/"+$/, "");
    value = value.replace(/^'+/, "").replace(/'+$/, "");
    obj[key] = value;
  }
  return obj;
}

const BUCKET_DIRS = Object.freeze({
  articlesFeaturedImage: "articles/featured",
  eventsPreviewImage: "events/preview",
  datasheetsFiles: "datasheets/files",
  infoVideosFiles: "info-videos/files",
});

let cachedConfig = undefined;

function getBucketConfig() {
  if (cachedConfig !== undefined) return cachedConfig;

  const enc =
    String(process.env.BUCKET || "").trim() ||
    String(process.env.BUCKET_ENC || "").trim();

  if (!enc) {
    cachedConfig = null;
    return null;
  }

  const keyRaw =
    process.env.BUCKET_ENC_KEY ||
    process.env.BUCKET_KEY ||
    process.env.DB_ENC_KEY ||
    process.env.DB_KEY;
  const passphrase = normalizePassphrase(keyRaw);
  const decrypted = decryptBbsEncV1({ encrypted: enc, passphrase });
  const obj = parseBucketConfigText(decrypted);

  const bucket = requireEnvValue("S3_BUCKET", obj?.S3_BUCKET);
  const region = requireEnvValue("S3_REGION", obj?.S3_REGION);

  const s3Config = { region };
  const accessKey = String(obj?.S3_ACCESS_KEY || "").trim();
  const secretKey = String(obj?.S3_SECRET_KEY || "").trim();
  if (accessKey && secretKey) {
    s3Config.credentials = { accessKeyId: accessKey, secretAccessKey: secretKey };
  }

  const s3Client = new S3Client(s3Config);

  cachedConfig = { s3Client, bucket, dirs: BUCKET_DIRS };
  return cachedConfig;
}

module.exports = { getBucketConfig, BUCKET_DIRS };