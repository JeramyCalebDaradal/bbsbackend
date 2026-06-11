const { createLead, deleteLead, getLeads, updateLead } = require("./leads.service");
const { created, edited, recordLog, removed } = require("../logs/logs.service");

async function listLeadsController(req, res, next) {
  try {
    const result = await getLeads(req.query || {});
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function createLeadController(req, res, next) {
  try {
    const lead = await createLead(req.body || {});
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: created(`a new lead: ${lead.full_name}`) });
      }
    } catch {}
    res.status(201).json({ ok: true, lead });
  } catch (err) {
    next(err);
  }
}

async function updateLeadController(req, res, next) {
  try {
    const lead = await updateLead(req.params.id, req.body || {});
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: edited(`a lead: ${lead.full_name}`) });
      }
    } catch {}
    res.status(200).json({ ok: true, lead });
  } catch (err) {
    next(err);
  }
}

async function deleteLeadController(req, res, next) {
  try {
    const lead = await deleteLead(req.params.id);
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: removed(`a lead: ${lead.full_name}`) });
      }
    } catch {}
    res.status(200).json({ ok: true, lead });
  } catch (err) {
    next(err);
  }
}

module.exports = { listLeadsController, createLeadController, updateLeadController, deleteLeadController };
