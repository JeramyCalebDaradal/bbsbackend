const express = require("express");
const { listLogsController } = require("./logs.controller");
const { requireAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");

const adminLogsRouter = express.Router();

adminLogsRouter.get("/", requireAuth, requireRole("Super Admin"), listLogsController);

module.exports = { adminLogsRouter };
