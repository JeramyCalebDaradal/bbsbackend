const { createAppointment, getAppointments, updateAppointment } = require("./appointments.service");
const { created, edited, recordLog } = require("../logs/logs.service");

async function listAppointmentsController(req, res, next) {
  try {
    const result = await getAppointments(req.query || {});
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function createAppointmentController(req, res, next) {
  try {
    const appointment = await createAppointment(req.body || {});
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: created(`a new appointment: ${appointment.full_name}`) });
      }
    } catch {}
    res.status(201).json({ ok: true, appointment });
  } catch (err) {
    next(err);
  }
}

async function updateAppointmentController(req, res, next) {
  try {
    const appointment = await updateAppointment(req.params.id, req.body || {});
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: edited(`an appointment: ${appointment.full_name}`) });
      }
    } catch {}
    res.status(200).json({ ok: true, appointment });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAppointmentsController, createAppointmentController, updateAppointmentController };
