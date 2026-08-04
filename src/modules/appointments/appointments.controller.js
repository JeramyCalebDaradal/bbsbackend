const { createAppointment, deleteAppointment, getAppointments, updateAppointment } = require("./appointments.service");
const { created, edited, recordLog, removed } = require("../logs/logs.service");

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
    const result = await createAppointment(req.body || {});
    const appointment = result?.appointment;
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: created(`a new appointment: ${appointment.full_name}`) });
        if (result?.leadId) {
          await recordLog({ userId: req.userId, action: created(`a new lead (auto): ${appointment.full_name}`) });
        }
      }
    } catch {}
    res.status(201).json({ ok: true, appointment, leadId: result?.leadId || null });
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

async function deleteAppointmentController(req, res, next) {
  try {
    const appointment = await deleteAppointment(req.params.id);
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: removed(`an appointment: ${appointment.full_name}`) });
      }
    } catch {}
    res.status(200).json({ ok: true, appointment });
  } catch (err) {
    next(err);
  }
}

module.exports = { listAppointmentsController, createAppointmentController, updateAppointmentController, deleteAppointmentController };
