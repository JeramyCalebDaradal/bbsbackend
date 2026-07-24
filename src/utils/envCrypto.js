const crypto = require("crypto");

function bytesFromBase64(b64) {
  return Buffer.from(String(b64 || ""), "base64");
}

/**
 * Decrypts a value encrypted with bbsenc:v1 format.
 * Format: bbsenc:v1:<base64salt>:<base64iv>:<base64ciphertext+tag>
 * If the value is not encrypted (doesn't start with bbsenc:v1:), returns it as-is.
 */
function decryptEnv({ encrypted, passphrase }) {
  const text = String(encrypted || "").trim();
  // Not encrypted - return as-is
  if (!text.startsWith("bbsenc:v1:")) {
    return text;
  }

  const raw = text.slice("bbsenc:v1:".length);
  const parts = raw.split(":");
  if (parts.length !== 3) {
    const err = new Error("Encrypted value is not in a supported format");
    err.code = "ENV_ENC_FORMAT";
    throw err;
  }

  const salt = bytesFromBase64(parts[0]);
  const iv = bytesFromBase64(parts[1]);
  const cipherAll = bytesFromBase64(parts[2]);

  if (salt.length !== 16 || iv.length !== 12 || cipherAll.length < 17) {
    const err = new Error("Encrypted value is not in a supported format");
    err.code = "ENV_ENC_FORMAT";
    throw err;
  }

  const key = crypto.pbkdf2Sync(String(passphrase || ""), salt, 120000, 32, "sha256");
  const tag = cipherAll.subarray(cipherAll.length - 16);
  const cipher = cipherAll.subarray(0, cipherAll.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(cipher), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * Gets an environment variable, decrypting it if it's in bbsenc:v1 format.
 * Uses DB_ENC_KEY as the passphrase.
 */
function getEnvDecrypted(name) {
  const value = process.env[name];
  if (!value) return undefined;

  const passphrase = process.env.DB_ENC_KEY || process.env.DB_KEY;
  if (!passphrase) return value; // Can't decrypt, return as-is

  try {
    return decryptEnv({ encrypted: value, passphrase });
  } catch {
    // If decryption fails, return as-is (might be plaintext)
    return value;
  }
}

module.exports = { decryptEnv, getEnvDecrypted, bytesFromBase64 };