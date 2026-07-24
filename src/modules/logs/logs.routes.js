const express = require("express");
const { listLogsController } = require("./logs.controller");
const { requireRole } = require("../../middleware/requireRole");

const adminLogsRouter = express.Router();

adminLogsRouter.use(requireRole("Administrator"));
adminLogsRouter.get("/", listLogsController);

module.exports = { adminLogsRouter };
