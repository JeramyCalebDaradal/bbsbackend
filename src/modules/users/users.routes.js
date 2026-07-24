const express = require("express");
const { listUsers, getUser } = require("./users.controller");
const { requireDashboardAuth } = require("../../middleware/requireAuth");
const { requirePageAccess } = require("../../middleware/requirePageAccess");

const router = express.Router();

/**
 * Admin user management endpoints
 * All require Entra authentication + Administrator role + users page access
 */
router.use(requireDashboardAuth, requirePageAccess("users"));

router.get("/", listUsers);
router.get("/:oid", getUser);

module.exports = { adminUsersRouter: router };