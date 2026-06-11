const express = require("express");
const { listLogsController } = require("./logs.controller");
const { findById } = require("../auth/auth.repository");

const adminLogsRouter = express.Router();

adminLogsRouter.get("/", async (req, res, next) => {
  try {
    const actorId = req.userId;
    const actor = actorId ? await findById(actorId) : null;
    if (!actor || String(actor.role || "") !== "Super Admin") {
      const err = new Error("Forbidden");
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }
    return listLogsController(req, res, next);
  } catch (err) {
    return next(err);
  }
});

module.exports = { adminLogsRouter };
