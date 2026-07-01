const express = require("express");
const {
  createLeadController,
  deleteLeadController,
  listLeadsController,
  updateLeadController,
} = require("./leads.controller");
const { validate } = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");
const { createLeadSchema, updateLeadSchema } = require("../../validators/leadSchemas");

const adminLeadsRouter = express.Router();

const LEAD_ROLES = ["Super Admin", "Sales Agent"];

adminLeadsRouter.get("/", requireAuth, requireRole(...LEAD_ROLES), listLeadsController);
adminLeadsRouter.post("/", validate(createLeadSchema), createLeadController);
adminLeadsRouter.put("/:id", validate(updateLeadSchema), updateLeadController);
adminLeadsRouter.delete("/:id", deleteLeadController);

module.exports = { adminLeadsRouter };