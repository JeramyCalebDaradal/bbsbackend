const express = require("express");
const {
  createEventController,
  listEventAttendeesController,
  listAdminEventsController,
  listPublicEventsController,
  registerForEventController,
  updateEventController,
} = require("./events.controller");

const adminEventsRouter = express.Router();
const publicEventsRouter = express.Router();

adminEventsRouter.get("/", listAdminEventsController);
adminEventsRouter.post("/", createEventController);
adminEventsRouter.put("/:id", updateEventController);
adminEventsRouter.get("/:id/attendees", listEventAttendeesController);

publicEventsRouter.get("/", listPublicEventsController);
publicEventsRouter.post("/:id/register", registerForEventController);

module.exports = { adminEventsRouter, publicEventsRouter };
