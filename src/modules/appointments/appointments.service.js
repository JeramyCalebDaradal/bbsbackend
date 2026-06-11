const {
  findById,
  insertAppointment,
  listAppointments,
  updateAppointmentById,
} = require("./appointments.repository");
const { pool } = require("../../db/pool");
const { getSettingsRow } = require("../settings/settings.repository");
const { insertLead } = require("../leads/leads.repository");

const allowedServices = new Set([
  "Security Assessment",
  "Penetration Testing",
  "Compliance Consultation",
  "Annual Security Review",
  "Risk Assessment",
]);

const allowedStatuses = new Set(["pending", "confirmed", "completed", "cancelled"]);

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
    const err = new Error("email is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function ensurePositiveInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    const err = new Error(`${fieldName} is invalid`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  const int = Math.trunc(n);
  if (int <= 0) {
    const err = new Error(`${fieldName} must be > 0`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return int;
}

function ensureNonNegativeInt(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    const err = new Error(`${fieldName} is invalid`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  const int = Math.trunc(n);
  if (int < 0) {
    const err = new Error(`${fieldName} must be >= 0`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return int;
}

function normalizeService(value) {
  const v = String(value || "").trim();
  if (!v) {
    const err = new Error("service is required");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  if (!allowedServices.has(v)) {
    const err = new Error("service is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function normalizeStatus(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "pending";
  if (!allowedStatuses.has(v)) {
    const err = new Error("status is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function normalizeNotes(value) {
  const v = String(value || "").trim();
  return v ? v : "";
}

function publicAppointment(row) {
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    contact_number: row.contact_number,
    service: row.service,
    date_set: row.date_set,
    time_set: row.time_set,
    status: row.status,
    location: row.location,
    duration: Number(row.duration || 0),
    notes: row.notes || "",
    date_created: row.date_created,
    added_by: row.added_by,
  };
}

function normalizePage(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.trunc(n);
}

function normalizeStatusFilter(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "all";
  if (v === "all") return "all";
  if (allowedStatuses.has(v)) return v;
  const err = new Error("status is invalid");
  err.statusCode = 400;
  err.code = "VALIDATION_ERROR";
  throw err;
}

async function getAppointments(query) {
  const page = normalizePage(query?.page);
  const status = normalizeStatusFilter(query?.status);
  const q = String(query?.q || "").trim();

  const result = await listAppointments({ page, status, query: q });
  return {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    appointments: result.rows.map(publicAppointment),
  };
}

async function createAppointment(payload) {
  const fullName = ensureString(payload?.full_name, "full_name");
  const email = ensureEmail(payload?.email);
  const contactNumber = ensureString(payload?.contact_number, "contact_number");
  const service = normalizeService(payload?.service);
  const dateSet = ensureString(payload?.date_set, "date_set");
  const timeSet = ensureString(payload?.time_set, "time_set");
  const status = normalizeStatus(payload?.status);
  const location = ensureString(payload?.location, "location");
  const duration = ensureNonNegativeInt(payload?.duration ?? 0, "duration");
  const notes = normalizeNotes(payload?.notes);
  const addedBy = ensurePositiveInt(payload?.added_by, "added_by");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const id = await insertAppointment(
      {
        fullName,
        email,
        contactNumber,
        service,
        dateSet,
        timeSet,
        status,
        location,
        duration,
        notes,
        addedBy,
      },
      { conn }
    );

    const created = await findById(id, { conn });
    if (!created) {
      const err = new Error("Appointment not found");
      err.statusCode = 500;
      err.code = "APPOINTMENT_MISSING";
      throw err;
    }

    const settings = await getSettingsRow({ conn });
    const autoCreateLead = Boolean(settings?.auto_create_lead_from_appointment);

    let leadId = 0;
    if (autoCreateLead) {
      const leadNotes = [
        `Auto-created from appointment #${created.id}`,
        `Service: ${created.service}`,
        `Date: ${created.date_set}`,
        `Time: ${created.time_set}`,
        created.location ? `Location: ${created.location}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      leadId = await insertLead(
        {
          fullName: created.full_name,
          email: created.email,
          contact: created.contact_number,
          source: "Appointment",
          status: "new",
          followUp: null,
          notes: leadNotes,
          addedBy,
        },
        { conn }
      );
    }

    await conn.commit();
    return { appointment: publicAppointment(created), leadId: leadId || null };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    throw err;
  } finally {
    conn.release();
  }
}

async function updateAppointment(id, payload) {
  const appointmentId = ensurePositiveInt(id, "id");
  const existing = await findById(appointmentId);
  if (!existing) {
    const err = new Error("Appointment not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const fullName = ensureString(payload?.full_name, "full_name");
  const email = ensureEmail(payload?.email);
  const contactNumber = ensureString(payload?.contact_number, "contact_number");
  const service = normalizeService(payload?.service);
  const dateSet = ensureString(payload?.date_set, "date_set");
  const timeSet = ensureString(payload?.time_set, "time_set");
  const status = normalizeStatus(payload?.status);
  const location = ensureString(payload?.location, "location");
  const duration = ensureNonNegativeInt(payload?.duration ?? 0, "duration");
  const notes = normalizeNotes(payload?.notes);

  await updateAppointmentById(appointmentId, {
    fullName,
    email,
    contactNumber,
    service,
    dateSet,
    timeSet,
    status,
    location,
    duration,
    notes,
  });

  const updated = await findById(appointmentId);
  return publicAppointment(updated);
}

module.exports = { getAppointments, createAppointment, updateAppointment };
