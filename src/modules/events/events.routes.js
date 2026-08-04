const express = require("express");
const {
  createEventController,
  deleteEventController,
  listEventAttendeesController,
  listAdminEventsController,
  listPublicEventsController,
  registerForEventController,
  updateEventController,
} = require("./events.controller");
const { validate } = require("../../middleware/validate");
const { requireRole } = require("../../middleware/requireRole");
const { createEventSchema, updateEventSchema, registerForEventSchema } = require("../../validators/eventSchemas");

const adminEventsRouter = express.Router();
const publicEventsRouter = express.Router();

const EVENT_ROLES = ["Administrator", "ContentManager"];

adminEventsRouter.use(requireRole(...EVENT_ROLES));
adminEventsRouter.get("/", listAdminEventsController);
adminEventsRouter.post("/", validate(createEventSchema), createEventController);
adminEventsRouter.put("/:id", validate(updateEventSchema), updateEventController);
adminEventsRouter.delete("/:id", deleteEventController);
adminEventsRouter.get("/:id/attendees", listEventAttendeesController);

publicEventsRouter.get("/", listPublicEventsController);
publicEventsRouter.post("/:id/register", validate(registerForEventSchema), registerForEventController);

module.exports = { adminEventsRouter, publicEventsRouter };
