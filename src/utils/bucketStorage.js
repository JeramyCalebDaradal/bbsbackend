const crypto = require("crypto");
const sharp = require("sharp");
const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { getBucketConfig } = require("../config/bucket");

// ── Image parser (no filesystem dependency) ──

function parseImageDataUrl(dataUrl, { contextLabel }) {
  const raw = String(dataUrl || "").trim();
  const m = raw.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!m) {
    const err = new Error(`${contextLabel}: invalid image payload`);
    err.statusCode = 400;
    err.code = "INVALID_IMAGE";
    throw err;
  }

  const mime = String(m[1] || "").toLowerCase();
  const base64 = String(m[2] || "");
  const sizeBytes = Buffer.byteLength(base64, "base64");
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    const err = new Error(`${contextLabel}: invalid image payload`);
    err.statusCode = 400;
    err.code = "INVALID_IMAGE";
    throw err;
  }

  const maxBytes = 5 * 1024 * 1024;
  if (sizeBytes > maxBytes) {
    const err = new Error(`${contextLabel}: image is too large`);
    err.statusCode = 413;
    err.code = "IMAGE_TOO_LARGE";
    throw err;
  }

  const ext =
    mime === "image/png"
      ? "png"
      : mime === "image/jpeg" || mime === "image/jpg"
        ? "jpg"
        : mime === "image/webp"
          ? "webp"
          : "";
  if (!ext) {
    const err = new Error(`${contextLabel}: unsupported image type`);
    err.statusCode = 400;
    err.code = "UNSUPPORTED_IMAGE";
    throw err;
  }

  const buffer = Buffer.from(base64, "base64");
  return { buffer, ext, mime };
}

// ── File parser (no filesystem dependency) ──

function parseFileDataUrl(dataUrl, { contextLabel, allowedMimes, maxBytes }) {
  const raw = String(dataUrl || "").trim();
  const m = raw.match(/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!m) {
    const err = new Error(`${contextLabel}: invalid file payload`);
    err.statusCode = 400;
    err.code = "INVALID_FILE";
    throw err;
  }

  const mime = String(m[1] || "").toLowerCase();
  const base64 = String(m[2] || "");

  const map = allowedMimes && typeof allowedMimes === "object" ? allowedMimes : {};
  const ext = String(map[mime] || "").trim();
  if (!ext) {
    const err = new Error(`${contextLabel}: unsupported file type`);
    err.statusCode = 400;
    err.code = "UNSUPPORTED_FILE";
    throw err;
  }

  const sizeBytes = Buffer.byteLength(base64, "base64");
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    const err = new Error(`${contextLabel}: invalid file payload`);
    err.statusCode = 400;
    err.code = "INVALID_FILE";
    throw err;
  }

  const max = Number.isFinite(Number(maxBytes)) ? Number(maxBytes) : 0;
  if (max > 0 && sizeBytes > max) {
    const err = new Error(`${contextLabel}: file is too large`);
    err.statusCode = 413;
    err.code = "FILE_TOO_LARGE";
    throw err;
  }

  const buffer = Buffer.from(base64, "base64");
  return { buffer, ext, mime, sizeBytes };
}

// ── S3 upload helper ──

async function uploadToS3({ bucketName, s3Client, key, body, contentType }) {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  await s3Client.send(command);
}

// ── S3 delete helper ──

async function deleteFromS3(s3Key) {
  if (!s3Key) return;
  const config = getBucketConfig();
  if (!config) return;
  try {
    const command = new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: s3Key,
    });
    await config.s3Client.send(command);
  } catch (err) {
    // Log but don't throw — cleanup is best-effort, never block the main operation
    console.error(`S3 cleanup failed for ${s3Key}: ${err.message}`);
  }
}

// ── Delete multiple S3 objects (batch, fire-and-forget) ──

function deleteFromS3IfDifferent(oldKey, newKey) {
  const old = String(oldKey || "").trim();
  const nw = String(newKey || "").trim();
  if (old && old !== nw) {
    deleteFromS3(old);
  }
}

// ── Persist image to S3 with resize + WebP optimization, returns S3 key ──

async function persistImageDataUrl({ dataUrl, dirKey, contextLabel }) {
  const config = getBucketConfig();
  if (!config) {
    const err = new Error(`${contextLabel}: storage is not configured`);
    err.statusCode = 500;
    err.code = "STORAGE_NOT_CONFIGURED";
    throw err;
  }

  const subDir = String(config.dirs?.[dirKey] || "").trim();
  if (!subDir) {
    const err = new Error(`${contextLabel}: storage directory is not configured`);
    err.statusCode = 500;
    err.code = "STORAGE_DIR_NOT_CONFIGURED";
    throw err;
  }

  const { buffer } = parseImageDataUrl(dataUrl, { contextLabel });

  // Optimize: resize to max 1200px width, convert to WebP @ quality 80
  const optimized = await sharp(buffer)
    .resize({ width: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();

  const fileName = `${crypto.randomUUID()}.webp`;
  const key = `${subDir}/${fileName}`;

  await uploadToS3({
    bucketName: config.bucket,
    s3Client: config.s3Client,
    key,
    body: optimized,
    contentType: "image/webp",
  });

  return key;
}

// ── Persist file to S3, returns S3 key + size ──

async function persistFileDataUrl({ dataUrl, dirKey, contextLabel, allowedMimes, maxBytes }) {
  const config = getBucketConfig();
  if (!config) {
    const err = new Error(`${contextLabel}: storage is not configured`);
    err.statusCode = 500;
    err.code = "STORAGE_NOT_CONFIGURED";
    throw err;
  }

  const subDir = String(config.dirs?.[dirKey] || "").trim();
  if (!subDir) {
    const err = new Error(`${contextLabel}: storage directory is not configured`);
    err.statusCode = 500;
    err.code = "STORAGE_DIR_NOT_CONFIGURED";
    throw err;
  }

  const { buffer, ext, mime, sizeBytes } = parseFileDataUrl(dataUrl, { contextLabel, allowedMimes, maxBytes });
  const fileName = `${crypto.randomUUID()}.${ext}`;
  const key = `${subDir}/${fileName}`;

  await uploadToS3({
    bucketName: config.bucket,
    s3Client: config.s3Client,
    key,
    body: buffer,
    contentType: mime,
  });

  return { key, sizeBytes };
}

// ── Detection helpers ──

function isImageDataUrl(value) {
  const v = String(value || "").trim();
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(v);
}

function isDataUrl(value) {
  const v = String(value || "").trim();
  return /^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,/i.test(v);
}

// ── Extract S3 key from a value (handles old full URLs) ──

function extractS3Key(value) {
  const v = String(value || "").trim();
  if (!v) return "";

  // Strip query string (e.g. from presigned S3 URLs like ?X-Amz-Signature=...)
  const base = v.split("?")[0];

  // If it contains /uploads/, extract everything after it
  const uploadsIdx = base.indexOf("/uploads/");
  if (uploadsIdx !== -1) {
    return base.slice(uploadsIdx + 9);
  }

  // If it contains a known dir prefix, extract from there
  const knownDirs = [
    "articles/featured/",
    "events/preview/",
    "datasheets/files/",
    "info-videos/files/",
  ];
  for (const dir of knownDirs) {
    const idx = base.indexOf(dir);
    if (idx !== -1) {
      return base.slice(idx);
    }
  }

  // Assume it's already a clean S3 key
  return base;
}

// ── Normalize image field (upload if data URL, extract key otherwise) ──

async function normalizeImageField({ value, dirKey, contextLabel }) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (isImageDataUrl(v)) {
    return persistImageDataUrl({ dataUrl: v, dirKey, contextLabel });
  }
  return extractS3Key(v);
}

// ── Normalize file field (upload if data URL, extract key otherwise) ──

async function normalizeFileField({ value, dirKey, contextLabel, allowedMimes, maxBytes }) {
  const v = String(value || "").trim();
  if (!v) return { filePath: "", sizeBytes: null };
  if (isDataUrl(v)) {
    const res = await persistFileDataUrl({ dataUrl: v, dirKey, contextLabel, allowedMimes, maxBytes });
    return { filePath: res.key, sizeBytes: res.sizeBytes };
  }
  return { filePath: extractS3Key(v), sizeBytes: null };
}

// ── Presigned URL generation ──

async function signUrl(s3Key) {
  if (!s3Key) return "";
  const config = getBucketConfig();
  if (!config) return s3Key;

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: s3Key,
  });

  try {
    return await getSignedUrl(config.s3Client, command, { expiresIn: 3600 });
  } catch {
    return s3Key;
  }
}

// ── Batch sign URLs on an array of objects ──

async function signUrls(items, fields) {
  if (!items || !items.length) return items;
  const config = getBucketConfig();
  if (!config) return items;

  for (const item of items) {
    for (const field of fields) {
      const value = item[field];
      if (value && typeof value === "string") {
        item[field] = await signUrl(value);
      }
    }
  }
  return items;
}

module.exports = { normalizeImageField, normalizeFileField, signUrl, signUrls, deleteFromS3, deleteFromS3IfDifferent };