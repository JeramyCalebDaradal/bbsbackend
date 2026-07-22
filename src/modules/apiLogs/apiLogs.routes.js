const express = require("express");
const { ingestLogController, listApiLogsController } = require("./apiLogs.controller");
const { requireAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");

const apiLogsIngestRouter = express.Router();
const adminApiLogsRouter = express.Router();

// Internal nginx post_action endpoint — no auth (protected by nginx internal directive)
apiLogsIngestRouter.post("/ingest", ingestLogController);

// Dashboard endpoint — Super Admin only
adminApiLogsRouter.get("/", requireAuth, requireRole("Super Admin"), listApiLogsController);

module.exports = { apiLogsIngestRouter, adminApiLogsRouter };