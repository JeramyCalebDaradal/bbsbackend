const { createEvent, getEventAttendees, getEvents, getEventsPaged, registerForEvent, updateEvent } = require("./events.service");
const { created, edited, recordLog } = require("../logs/logs.service");

async function listAdminEventsController(req, res, next) {
  try {
    const result = await getEventsPaged(req.query || {});
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function listPublicEventsController(req, res, next) {
  try {
    const events = await getEvents();
    res.status(200).json({ ok: true, events });
  } catch (err) {
    next(err);
  }
}

async function createEventController(req, res, next) {
  try {
    const event = await createEvent(req.body || {});
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: created(`a new event: ${event.title}`) });
      }
    } catch {}
    res.status(201).json({ ok: true, event });
  } catch (err) {
    next(err);
  }
}

async function updateEventController(req, res, next) {
  try {
    const event = await updateEvent(req.params.id, req.body || {});
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: edited(`an event: ${event.title}`) });
      }
    } catch {}
    res.status(200).json({ ok: true, event });
  } catch (err) {
    next(err);
  }
}

async function listEventAttendeesController(req, res, next) {
  try {
    const result = await getEventAttendees(req.params.id);
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function registerForEventController(req, res, next) {
  try {
    const result = await registerForEvent(req.params.id, req.body || {});
    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAdminEventsController,
  listPublicEventsController,
  createEventController,
  updateEventController,
  listEventAttendeesController,
  registerForEventController,
};
