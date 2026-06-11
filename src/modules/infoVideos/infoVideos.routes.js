const express = require("express");
const {
  createInfoVideoController,
  deleteInfoVideoController,
  listInfoVideosController,
  listPublicInfoVideosController,
  updateInfoVideoController,
} = require("./infoVideos.controller");

const adminInfoVideosRouter = express.Router();
const publicInfoVideosRouter = express.Router();

adminInfoVideosRouter.get("/", listInfoVideosController);
adminInfoVideosRouter.post("/", createInfoVideoController);
adminInfoVideosRouter.put("/:id", updateInfoVideoController);
adminInfoVideosRouter.delete("/:id", deleteInfoVideoController);

publicInfoVideosRouter.get("/", listPublicInfoVideosController);

module.exports = { adminInfoVideosRouter, publicInfoVideosRouter };
