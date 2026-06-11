const { getSettingsRow, updateSettings } = require("./settings.repository");

function ensureString(value, fieldName) {
  const v = String(value || "").trim();
  if (!v) {
    const err = new Error(`${fieldName} is required`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function ensureEmail(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v || !v.includes("@")) {
    const err = new Error("contact_email is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function normalizeBool(value) {
  if (typeof value === "boolean") return value;
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes" || v === "on") return true;
  if (v === "false" || v === "0" || v === "no" || v === "off") return false;
  return Boolean(value);
}

function publicSettings(row) {
  return {
    company_name: row.company_name,
    contact_email: row.contact_email,
    contact_number: row.contact_number,
  };
}

function adminSettings(row) {
  return {
    id: row.id,
    company_name: row.company_name,
    contact_email: row.contact_email,
    contact_number: row.contact_number,
    email_notifications_enabled: Boolean(row.email_notifications_enabled),
    auto_create_lead_from_appointment: Boolean(row.auto_create_lead_from_appointment),
    auto_followup_reminders_enabled: Boolean(row.auto_followup_reminders_enabled),
    updated_at: row.updated_at,
  };
}

async function getPublicWebsiteSettings() {
  const row = await getSettingsRow();
  if (!row) {
    const err = new Error("Settings not found");
    err.statusCode = 500;
    err.code = "SETTINGS_MISSING";
    throw err;
  }
  return publicSettings(row);
}

async function getAdminSettings() {
  const row = await getSettingsRow();
  if (!row) {
    const err = new Error("Settings not found");
    err.statusCode = 500;
    err.code = "SETTINGS_MISSING";
    throw err;
  }
  return adminSettings(row);
}

async function updateAdminSettings(payload) {
  const body = payload && typeof payload === "object" ? payload : {};
  const keys = Object.keys(body);
  const allowed = new Set([
    "company_name",
    "contact_email",
    "contact_number",
    "auto_create_lead_from_appointment",
  ]);

  for (const key of keys) {
    if (!allowed.has(key)) {
      const err = new Error(`Field not allowed: ${key}`);
      err.statusCode = 400;
      err.code = "FIELD_NOT_ALLOWED";
      throw err;
    }
  }

  const existing = await getSettingsRow();
  if (!existing) {
    const err = new Error("Settings not found");
    err.statusCode = 500;
    err.code = "SETTINGS_MISSING";
    throw err;
  }

  const nextCompanyName =
    "company_name" in body ? ensureString(body.company_name, "company_name") : String(existing.company_name || "");
  const nextContactEmail =
    "contact_email" in body ? ensureEmail(body.contact_email) : String(existing.contact_email || "");
  const nextContactNumber =
    "contact_number" in body ? ensureString(body.contact_number, "contact_number") : String(existing.contact_number || "");
  const nextAutoCreate =
    "auto_create_lead_from_appointment" in body
      ? normalizeBool(body.auto_create_lead_from_appointment)
      : Boolean(existing.auto_create_lead_from_appointment);

  await updateSettings({
    companyName: nextCompanyName,
    contactEmail: nextContactEmail,
    contactNumber: nextContactNumber,
    autoCreateLeadFromAppointment: nextAutoCreate,
  });

  return getAdminSettings();
}

module.exports = { getPublicWebsiteSettings, getAdminSettings, updateAdminSettings };
