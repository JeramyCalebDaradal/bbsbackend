const { pool } = require("../../db/pool");

function normalizePaging({ page }) {
  const p = Number(page);
  const pageSafe = Number.isFinite(p) && p > 0 ? Math.trunc(p) : 1;
  const pageSize = 20;
  const offset = (pageSafe - 1) * pageSize;
  return { page: pageSafe, pageSize, offset };
}

async function listEvents() {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        title,
        preview_image,
        date,
        time,
        location_type,
        location_address,
        description,
        category,
        capacity,
        paid_event,
        tags,
        date_created,
        created_by,
        added_by,
        attendees_count
      FROM bbs_events_view
      ORDER BY id DESC
    `
  );
  return rows;
}

async function listEventsPaged({ page, query }) {
  const { page: pageSafe, pageSize, offset } = normalizePaging({ page });
  const where = [];
  const params = {};

  const q = String(query || "").trim();
  if (q) {
    where.push("(LOWER(title) LIKE :qLike OR LOWER(category) LIKE :qLike)");
    params.qLike = `%${q.toLowerCase()}%`;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT
        id,
        title,
        preview_image,
        date,
        time,
        location_type,
        location_address,
        description,
        category,
        capacity,
        paid_event,
        tags,
        date_created,
        created_by,
        added_by,
        attendees_count
      FROM bbs_events_view
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
      FROM bbs_events_view
      ${whereSql}
    `,
    params
  );

  const total = Number(countRows?.[0]?.total || 0);
  return { rows, page: pageSafe, pageSize, total };
}

async function findById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        title,
        preview_image,
        date,
        time,
        location_type,
        location_address,
        description,
        category,
        capacity,
        paid_event,
        tags,
        date_created,
        created_by,
        added_by,
        attendees_count
      FROM bbs_events_view
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

async function insertEvent({
  title,
  previewImage,
  date,
  time,
  locationType,
  locationAddress,
  description,
  category,
  capacity,
  paidEvent,
  tagsJson,
  createdBy,
  addedBy,
}) {
  const [result] = await pool.query(
    `
      INSERT INTO bbs_events
        (title, preview_image, date, time, location_type, location_address, description, category, capacity, paid_event, tags, created_by, added_by)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      title,
      previewImage,
      date,
      time,
      locationType,
      locationAddress,
      description,
      category,
      capacity,
      paidEvent ? 1 : 0,
      tagsJson,
      createdBy,
      addedBy ?? null,
    ]
  );

  return Number(result.insertId);
}

async function updateEventById(
  id,
  {
    title,
    previewImage,
    date,
    time,
    locationType,
    locationAddress,
    description,
    category,
    capacity,
    paidEvent,
    tagsJson,
  }
) {
  const [result] = await pool.query(
    `
      UPDATE bbs_events
      SET
        title = ?,
        preview_image = ?,
        date = ?,
        time = ?,
        location_type = ?,
        location_address = ?,
        description = ?,
        category = ?,
        capacity = ?,
        paid_event = ?,
        tags = ?
      WHERE id = ?
      LIMIT 1
    `,
    [
      title,
      previewImage,
      date,
      time,
      locationType,
      locationAddress,
      description,
      category,
      capacity,
      paidEvent ? 1 : 0,
      tagsJson,
      id,
    ]
  );

  return Number(result.affectedRows || 0);
}

async function listAttendeesByEventId(eventId) {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        event_id,
        first_name,
        last_name,
        email,
        contact_number,
        date_registered
      FROM bbs_events_attendees
      WHERE event_id = ?
      ORDER BY id ASC
    `,
    [eventId]
  );
  return rows;
}

async function insertAttendee({
  eventId,
  firstName,
  lastName,
  email,
  contactNumber,
}) {
  const [result] = await pool.query(
    `
      INSERT INTO bbs_events_attendees
        (event_id, first_name, last_name, email, contact_number)
      VALUES
        (?, ?, ?, ?, ?)
    `,
    [eventId, firstName, lastName, email, contactNumber]
  );
  return Number(result.insertId);
}

module.exports = {
  listEvents,
  listEventsPaged,
  findById,
  insertEvent,
  updateEventById,
  listAttendeesByEventId,
  insertAttendee,
};
