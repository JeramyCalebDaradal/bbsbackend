const express = require("express");
const {
  createAppointmentController,
  listAppointmentsController,
  updateAppointmentController,
} = require("./appointments.controller");

const adminAppointmentsRouter = express.Router();

adminAppointmentsRouter.get("/", listAppointmentsController);
adminAppointmentsRouter.post("/", createAppointmentController);
adminAppointmentsRouter.put("/:id", updateAppointmentController);

module.exports = { adminAppointmentsRouter };

