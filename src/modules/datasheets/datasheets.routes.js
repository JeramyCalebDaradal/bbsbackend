const express = require("express");
const {
  createDatasheetController,
  deleteDatasheetController,
  listDatasheetsController,
  listPublicDatasheetsController,
  updateDatasheetController,
} = require("./datasheets.controller");

const adminDatasheetsRouter = express.Router();
const publicDatasheetsRouter = express.Router();

adminDatasheetsRouter.get("/", listDatasheetsController);
adminDatasheetsRouter.post("/", createDatasheetController);
adminDatasheetsRouter.put("/:id", updateDatasheetController);
adminDatasheetsRouter.delete("/:id", deleteDatasheetController);

publicDatasheetsRouter.get("/", listPublicDatasheetsController);

module.exports = { adminDatasheetsRouter, publicDatasheetsRouter };
