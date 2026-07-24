const express = require("express");
const {
  createAppointmentController,
  listAppointmentsController,
  updateAppointmentController,
} = require("./appointments.controller");
const { validate } = require("../../middleware/validate");
const { requireRole } = require("../../middleware/requireRole");
const { createAppointmentSchema, updateAppointmentSchema } = require("../../validators/appointmentSchemas");

const adminAppointmentsRouter = express.Router();

const APPOINTMENT_ROLES = ["Administrator"];

adminAppointmentsRouter.use(requireRole(...APPOINTMENT_ROLES));
adminAppointmentsRouter.get("/", listAppointmentsController);
adminAppointmentsRouter.post("/", validate(createAppointmentSchema), createAppointmentController);
adminAppointmentsRouter.put("/:id", validate(updateAppointmentSchema), updateAppointmentController);

module.exports = { adminAppointmentsRouter };
