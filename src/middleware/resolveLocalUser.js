const { findByEmailLite } = require("../modules/auth/auth.repository");

async function resolveLocalUserFromEntra(entra) {
  const email = String(entra?.upn || "").trim().toLowerCase();
  if (!email) return null;
  return findByEmailLite(email);
}

module.exports = { resolveLocalUserFromEntra };
