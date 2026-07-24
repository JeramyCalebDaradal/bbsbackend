const express = require("express");
const {
  createLeadController,
  deleteLeadController,
  listLeadsController,
  updateLeadController,
} = require("./leads.controller");
const { validate } = require("../../middleware/validate");
const { requireRole } = require("../../middleware/requireRole");
const { createLeadSchema, updateLeadSchema } = require("../../validators/leadSchemas");

const adminLeadsRouter = express.Router();

const LEAD_ROLES = ["Administrator", "Analyst"];

adminLeadsRouter.use(requireRole(...LEAD_ROLES));
adminLeadsRouter.get("/", listLeadsController);
adminLeadsRouter.post("/", validate(createLeadSchema), createLeadController);
adminLeadsRouter.put("/:id", validate(updateLeadSchema), updateLeadController);
adminLeadsRouter.delete("/:id", deleteLeadController);

module.exports = { adminLeadsRouter };
