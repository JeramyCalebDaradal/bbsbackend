const express = require("express");
const {
  createDatasheetController,
  deleteDatasheetController,
  listDatasheetsController,
  listPublicDatasheetsController,
  updateDatasheetController,
} = require("./datasheets.controller");
const { validate } = require("../../middleware/validate");
const { requireAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");
const { createDatasheetSchema, updateDatasheetSchema } = require("../../validators/datasheetSchemas");

const adminDatasheetsRouter = express.Router();
const publicDatasheetsRouter = express.Router();

const DATASHEET_ROLES = ["Super Admin", "Content Manager"];

adminDatasheetsRouter.get("/", requireAuth, requireRole(...DATASHEET_ROLES), listDatasheetsController);
adminDatasheetsRouter.post("/", validate(createDatasheetSchema), createDatasheetController);
adminDatasheetsRouter.put("/:id", validate(updateDatasheetSchema), updateDatasheetController);
adminDatasheetsRouter.delete("/:id", deleteDatasheetController);

publicDatasheetsRouter.get("/", listPublicDatasheetsController);

module.exports = { adminDatasheetsRouter, publicDatasheetsRouter };