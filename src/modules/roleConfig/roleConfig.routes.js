const express = require("express");
const { listRoleConfigsController, updateRoleConfigController } = require("./roleConfig.controller");
const { requireEntraAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");

const adminRoleConfigRouter = express.Router();

adminRoleConfigRouter.get("/", requireEntraAuth, requireRole("Administrator"), listRoleConfigsController);
adminRoleConfigRouter.put("/:roleName", requireEntraAuth, requireRole("Administrator"), updateRoleConfigController);

module.exports = { adminRoleConfigRouter };