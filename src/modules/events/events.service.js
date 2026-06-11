const {
  findById,
  insertAttendee,
  insertEvent,
  listAttendeesByEventId,
  listEvents,
  listEventsPaged,
  updateEventById,
} = require("./events.repository");

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

function ensureNumber(value, fieldName) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    const err = new Error(`${fieldName} is invalid`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return n;
}

function ensurePositiveInt(value, fieldName) {
  const n = ensureNumber(value, fieldName);
  const int = Math.trunc(n);
  if (int < 0) {
    const err = new Error(`${fieldName} must be >= 0`);
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return int;
}

function normalizeLocationType(value) {
  const v = String(value || "").trim().toLowerCase();
  if (v === "online") return "online";
  if (v === "in person") return "in person";
  const err = new Error("location_type must be 'online' or 'in person'");
  err.statusCode = 400;
  err.code = "VALIDATION_ERROR";
  throw err;
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((t) => String(t || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
  }
  return [];
}

function parseTagsField(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  if (typeof tags === "string") {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return [];
}

function normalizePreviewImage(value) {
  return String(value || "").trim();
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function ensureEmail(email) {
  const v = normalizeEmail(email);
  if (!v || !v.includes("@")) {
    const err = new Error("email is invalid");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }
  return v;
}

function normalizePhone(value) {
  return String(value || "").trim();
}

function isEventInPast(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d < today;
}

function publicEvent(row) {
  return {
    id: row.id,
    title: row.title,
    preview_image: row.preview_image,
    date: row.date,
    time: row.time,
    location_type: row.location_type,
    location_address: row.location_address,
    description: row.description,
    category: row.category,
    capacity: row.capacity,
    paid_event: Boolean(row.paid_event),
    tags: parseTagsField(row.tags),
    date_created: row.date_created,
    created_by: row.created_by,
    added_by: row.added_by,
    attendees_count: Number(row.attendees_count || 0),
  };
}

function normalizePage(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return Math.trunc(n);
}

async function getEvents() {
  const rows = await listEvents();
  return rows.map(publicEvent);
}

async function getEventsPaged(query) {
  const page = normalizePage(query?.page);
  const q = String(query?.q || "").trim();
  const result = await listEventsPaged({ page, query: q });
  return {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    events: result.rows.map(publicEvent),
  };
}

async function createEvent(payload) {
  const title = ensureString(payload?.title, "title");
  const previewImage = normalizePreviewImage(payload?.preview_image);
  const date = ensureString(payload?.date, "date");
  const time = ensureString(payload?.time, "time");
  const locationType = normalizeLocationType(payload?.location_type);
  const locationAddress = ensureString(payload?.location_address, "location_address");
  const description = ensureString(payload?.description, "description");
  const category = ensureString(payload?.category, "category");
  const capacity = ensurePositiveInt(payload?.capacity, "capacity");
  const paidEvent = Boolean(payload?.paid_event);
  const tags = normalizeTags(payload?.tags);
  const createdBy = ensurePositiveInt(payload?.created_by, "created_by");
  const addedBy = createdBy;

  const id = await insertEvent({
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
    tagsJson: JSON.stringify(tags),
    createdBy,
    addedBy,
  });

  const created = await findById(id);
  return publicEvent(created);
}

async function updateEvent(id, payload) {
  const eventId = ensurePositiveInt(id, "id");
  const existing = await findById(eventId);
  if (!existing) {
    const err = new Error("Event not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const title = ensureString(payload?.title, "title");
  const previewImage = normalizePreviewImage(payload?.preview_image);
  const date = ensureString(payload?.date, "date");
  const time = ensureString(payload?.time, "time");
  const locationType = normalizeLocationType(payload?.location_type);
  const locationAddress = ensureString(payload?.location_address, "location_address");
  const description = ensureString(payload?.description, "description");
  const category = ensureString(payload?.category, "category");
  const capacity = ensurePositiveInt(payload?.capacity, "capacity");
  const paidEvent = Boolean(payload?.paid_event);
  const tags = normalizeTags(payload?.tags);

  await updateEventById(eventId, {
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
    tagsJson: JSON.stringify(tags),
  });

  const updated = await findById(eventId);
  return publicEvent(updated);
}

async function getEventAttendees(id) {
  const eventId = ensurePositiveInt(id, "id");
  const existing = await findById(eventId);
  if (!existing) {
    const err = new Error("Event not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }

  const rows = await listAttendeesByEventId(eventId);
  const attendees = rows.map((r) => ({
    id: r.id,
    name: `${String(r.first_name || "").trim()} ${String(r.last_name || "").trim()}`.trim(),
    email: r.email,
    contact_number: r.contact_number,
    date_registered: r.date_registered,
  }));
  return { total: attendees.length, attendees };
}

async function registerForEvent(id, payload) {
  const eventId = ensurePositiveInt(id, "id");
  const event = await findById(eventId);
  if (!event) {
    const err = new Error("Event not found");
    err.statusCode = 404;
    err.code = "NOT_FOUND";
    throw err;
  }
  if (isEventInPast(event.date)) {
    const err = new Error("Event registration is closed");
    err.statusCode = 400;
    err.code = "REGISTRATION_CLOSED";
    throw err;
  }

  const firstName = ensureString(payload?.first_name, "first_name");
  const lastName = ensureString(payload?.last_name, "last_name");
  const email = ensureEmail(payload?.email);
  const contactNumber = normalizePhone(payload?.contact_number);
  if (!contactNumber) {
    const err = new Error("contact_number is required");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    throw err;
  }

  try {
    const attendeeId = await insertAttendee({
      eventId,
      firstName,
      lastName,
      email,
      contactNumber,
    });
    return { id: attendeeId };
  } catch (err) {
    if (err && (err.code === "ER_DUP_ENTRY" || err.errno === 1062)) {
      const e = new Error("Email or contact number already registered");
      e.statusCode = 409;
      e.code = "DUPLICATE";
      throw e;
    }
    throw err;
  }
}

module.exports = { getEvents, getEventsPaged, createEvent, updateEvent, getEventAttendees, registerForEvent };
