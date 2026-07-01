const express = require("express");
const {
  createEventController,
  listEventAttendeesController,
  listAdminEventsController,
  listPublicEventsController,
  registerForEventController,
  updateEventController,
} = require("./events.controller");
const { validate } = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");
const { createEventSchema, updateEventSchema, registerForEventSchema } = require("../../validators/eventSchemas");

const adminEventsRouter = express.Router();
const publicEventsRouter = express.Router();

const EVENT_ROLES = ["Super Admin", "Content Manager", "Event Coordinator"];

adminEventsRouter.get("/", requireAuth, requireRole(...EVENT_ROLES), listAdminEventsController);
adminEventsRouter.post("/", validate(createEventSchema), createEventController);
adminEventsRouter.put("/:id", validate(updateEventSchema), updateEventController);
adminEventsRouter.get("/:id/attendees", listEventAttendeesController);

publicEventsRouter.get("/", listPublicEventsController);
publicEventsRouter.post("/:id/register", validate(registerForEventSchema), registerForEventController);

module.exports = { adminEventsRouter, publicEventsRouter };