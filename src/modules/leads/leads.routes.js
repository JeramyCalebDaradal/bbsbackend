const express = require("express");
const {
  createLeadController,
  deleteLeadController,
  listLeadsController,
  updateLeadController,
} = require("./leads.controller");

const adminLeadsRouter = express.Router();

adminLeadsRouter.get("/", listLeadsController);
adminLeadsRouter.post("/", createLeadController);
adminLeadsRouter.put("/:id", updateLeadController);
adminLeadsRouter.delete("/:id", deleteLeadController);

module.exports = { adminLeadsRouter };

