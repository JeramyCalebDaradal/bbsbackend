const express = require("express");
const {
  createAppointmentController,
  listAppointmentsController,
  updateAppointmentController,
} = require("./appointments.controller");
const { validate } = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");
const { createAppointmentSchema, updateAppointmentSchema } = require("../../validators/appointmentSchemas");

const adminAppointmentsRouter = express.Router();

const APPOINTMENT_ROLES = ["Super Admin", "Sales Agent", "Event Coordinator"];

adminAppointmentsRouter.get("/", requireAuth, requireRole(...APPOINTMENT_ROLES), listAppointmentsController);
adminAppointmentsRouter.post("/", validate(createAppointmentSchema), createAppointmentController);
adminAppointmentsRouter.put("/:id", validate(updateAppointmentSchema), updateAppointmentController);

module.exports = { adminAppointmentsRouter };