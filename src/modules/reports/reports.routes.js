const express = require("express");
const { getReportsController } = require("./reports.controller");

const adminReportsRouter = express.Router();

adminReportsRouter.get("/", getReportsController);

module.exports = { adminReportsRouter };

