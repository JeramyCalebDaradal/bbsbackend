const express = require("express");
const { handleNotification } = require("./msGraph.controller");

const router = express.Router();

/**
 * Microsoft Graph Change Notification Webhook
 * 
 * GET  /ms/notifications?validationToken=xxx  -> Handshake validation (returns 200 with token as plain text)
 * POST /ms/notifications                     -> Notification delivery (processes user changes)
 * 
 * IMPORTANT: This endpoint must be publicly accessible (no auth middleware)
 * and must respond to GET with validationToken within 10 seconds for handshake.
 * 
 * Nginx path: /x42/api/v1/ms/notifications -> /api/v1/ms/notifications
 */
router.get("/notifications", handleNotification);
router.post("/notifications", handleNotification);

module.exports = { msGraphRouter: router };