const express = require("express");
const { getReportsController } = require("./reports.controller");
const { requireAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");

const adminReportsRouter = express.Router();

const REPORT_ROLES = ["Super Admin", "Analyst"];

adminReportsRouter.get("/", requireAuth, requireRole(...REPORT_ROLES), getReportsController);

module.exports = { adminReportsRouter };

