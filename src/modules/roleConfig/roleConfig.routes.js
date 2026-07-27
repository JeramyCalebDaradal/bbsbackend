const express = require("express");
const { listRoleConfigsController, updateRoleConfigController, deleteRoleConfigController } = require("./roleConfig.controller");
const { requireEntraAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");

const adminRoleConfigRouter = express.Router();

adminRoleConfigRouter.get("/", requireEntraAuth, requireRole("Administrator"), listRoleConfigsController);
adminRoleConfigRouter.put("/:roleName", requireEntraAuth, requireRole("Administrator"), updateRoleConfigController);
adminRoleConfigRouter.delete("/:roleName", requireEntraAuth, requireRole("Administrator"), deleteRoleConfigController);

module.exports = { adminRoleConfigRouter };