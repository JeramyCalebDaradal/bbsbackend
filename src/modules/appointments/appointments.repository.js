const { pool } = require("../../db/pool");

function normalizePaging({ page }) {
  const p = Number(page);
  const pageSafe = Number.isFinite(p) && p > 0 ? Math.trunc(p) : 1;
  const pageSize = 20;
  const offset = (pageSafe - 1) * pageSize;
  return { page: pageSafe, pageSize, offset };
}

async function listAppointments({ page, status, query }) {
  const { page: pageSafe, pageSize, offset } = normalizePaging({ page });
  const where = [];
  const params = {};

  const statusValue = String(status || "").trim();
  if (statusValue && statusValue.toLowerCase() !== "all") {
    where.push("LOWER(status) = LOWER(:status)");
    params.status = statusValue;
  }

  const q = String(query || "").trim();
  if (q) {
    where.push("(LOWER(full_name) LIKE :qLike OR LOWER(email) LIKE :qLike)");
    params.qLike = `%${q.toLowerCase()}%`;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT
        id,
        full_name,
        email,
        contact_number,
        service,
        date_set,
        time_set,
        status,
        location,
        duration,
        notes,
        date_created,
        added_by
      FROM bbs_appointments_view
      ${whereSql}
      ORDER BY id DESC
      LIMIT :limit
      OFFSET :offset
    `,
    { ...params, limit: pageSize, offset }
  );

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM bbs_appointments_view
      ${whereSql}
    `,
    params
  );

  const total = Number(countRows?.[0]?.total || 0);
  return { rows, page: pageSafe, pageSize, total };
}

async function findById(id, { conn } = {}) {
  const db = conn || pool;
  const [rows] = await db.query(
    `
      SELECT
        id,
        full_name,
        email,
        contact_number,
        service,
        date_set,
        time_set,
        status,
        location,
        duration,
        notes,
        date_created,
        added_by
      FROM bbs_appointments
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

async function insertAppointment({
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
}, { conn } = {}) {
  const db = conn || pool;
  const [result] = await db.query(
    `
      INSERT INTO bbs_appointments
        (full_name, email, contact_number, service, date_set, time_set, status, location, duration, notes, added_by)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
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
    ]
  );
  return Number(result.insertId);
}

async function updateAppointmentById(
  id,
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
  }
) {
  const [result] = await pool.query(
    `
      UPDATE bbs_appointments
      SET
        full_name = ?,
        email = ?,
        contact_number = ?,
        service = ?,
        date_set = ?,
        time_set = ?,
        status = ?,
        location = ?,
        duration = ?,
        notes = ?
      WHERE id = ?
      LIMIT 1
    `,
    [
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
      id,
    ]
  );
  return Number(result.affectedRows || 0);
}

module.exports = { listAppointments, findById, insertAppointment, updateAppointmentById };
