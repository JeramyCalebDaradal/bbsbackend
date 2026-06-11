const { pool } = require("../../db/pool");

async function getSettingsRow({ conn } = {}) {
  const db = conn || pool;
  const [rows] = await db.query(
    `
      SELECT
        id,
        company_name,
        contact_email,
        contact_number,
        email_notifications_enabled,
        auto_create_lead_from_appointment,
        auto_followup_reminders_enabled,
        updated_at
      FROM bbs_settings_view
      LIMIT 1
    `
  );
  return rows[0] || null;
}

async function updateSettings(
  { companyName, contactEmail, contactNumber, autoCreateLeadFromAppointment },
  { conn } = {}
) {
  const db = conn || pool;
  const [result] = await db.query(
    `
      UPDATE bbs_settings
      SET
        company_name = ?,
        contact_email = ?,
        contact_number = ?,
        auto_create_lead_from_appointment = ?
      WHERE id = 1
      LIMIT 1
    `,
    [companyName, contactEmail, contactNumber, autoCreateLeadFromAppointment ? 1 : 0]
  );
  return Number(result.affectedRows || 0);
}

module.exports = { getSettingsRow, updateSettings };
