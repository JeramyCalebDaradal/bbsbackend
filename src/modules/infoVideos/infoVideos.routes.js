const express = require("express");
const {
  createInfoVideoController,
  deleteInfoVideoController,
  listInfoVideosController,
  listPublicInfoVideosController,
  updateInfoVideoController,
} = require("./infoVideos.controller");
const { validate } = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");
const { createInfoVideoSchema, updateInfoVideoSchema } = require("../../validators/infoVideoSchemas");

const adminInfoVideosRouter = express.Router();
const publicInfoVideosRouter = express.Router();

const INFOVIDEO_ROLES = ["Super Admin", "Content Manager"];

adminInfoVideosRouter.get("/", requireAuth, requireRole(...INFOVIDEO_ROLES), listInfoVideosController);
adminInfoVideosRouter.post("/", validate(createInfoVideoSchema), createInfoVideoController);
adminInfoVideosRouter.put("/:id", validate(updateInfoVideoSchema), updateInfoVideoController);
adminInfoVideosRouter.delete("/:id", deleteInfoVideoController);

publicInfoVideosRouter.get("/", listPublicInfoVideosController);

module.exports = { adminInfoVideosRouter, publicInfoVideosRouter };