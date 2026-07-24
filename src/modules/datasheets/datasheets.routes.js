const express = require("express");
const {
  createDatasheetController,
  deleteDatasheetController,
  listDatasheetsController,
  listPublicDatasheetsController,
  updateDatasheetController,
} = require("./datasheets.controller");
const { validate } = require("../../middleware/validate");
const { requireRole } = require("../../middleware/requireRole");
const { createDatasheetSchema, updateDatasheetSchema } = require("../../validators/datasheetSchemas");

const adminDatasheetsRouter = express.Router();
const publicDatasheetsRouter = express.Router();

const DATASHEET_ROLES = ["Administrator", "ContentManager"];

adminDatasheetsRouter.use(requireRole(...DATASHEET_ROLES));
adminDatasheetsRouter.get("/", listDatasheetsController);
adminDatasheetsRouter.post("/", validate(createDatasheetSchema), createDatasheetController);
adminDatasheetsRouter.put("/:id", validate(updateDatasheetSchema), updateDatasheetController);
adminDatasheetsRouter.delete("/:id", deleteDatasheetController);

publicDatasheetsRouter.get("/", listPublicDatasheetsController);

module.exports = { adminDatasheetsRouter, publicDatasheetsRouter };
