const express = require("express");
const { getReportsController } = require("./reports.controller");
const { requireRole } = require("../../middleware/requireRole");

const adminReportsRouter = express.Router();

const REPORT_ROLES = ["Administrator", "Analyst"];

adminReportsRouter.use(requireRole(...REPORT_ROLES));
adminReportsRouter.get("/", getReportsController);

module.exports = { adminReportsRouter };
