const express = require("express");
const {
  getAdminSettingsController,
  getPublicSettingsController,
  updateAdminSettingsController,
} = require("./settings.controller");
const { findById } = require("../auth/auth.repository");

async function ensureSuperAdmin(req) {
  const actorId = req.userId;
  const actor = actorId ? await findById(actorId) : null;
  if (!actor || String(actor.role || "") !== "Super Admin") {
    const err = new Error("Forbidden");
    err.statusCode = 403;
    err.code = "FORBIDDEN";
    throw err;
  }
}

const publicSettingsRouter = express.Router();
publicSettingsRouter.get("/", getPublicSettingsController);

const adminSettingsRouter = express.Router();

adminSettingsRouter.get("/", async (req, res, next) => {
  try {
    await ensureSuperAdmin(req);
    return getAdminSettingsController(req, res, next);
  } catch (err) {
    return next(err);
  }
});

adminSettingsRouter.put("/", async (req, res, next) => {
  try {
    await ensureSuperAdmin(req);
    return updateAdminSettingsController(req, res, next);
  } catch (err) {
    return next(err);
  }
});

module.exports = { publicSettingsRouter, adminSettingsRouter };
