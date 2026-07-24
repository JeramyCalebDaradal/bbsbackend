const { processNotification } = require("../../services/graphSync");
const { getEnvDecrypted } = require("../../utils/envCrypto");

/**
 * Handles the Graph change notification webhook.
 * GET  /ms/notifications?validationToken=xxx  -> returns 200 with validationToken as plain text (handshake)
 * POST /ms/notifications                      -> processes notification payload
 */
async function handleNotification(req, res) {
  const tid = getEnvDecrypted("ENTRA_TENANT_ID");

  // Microsoft Graph validation handshake (GET with validationToken)
  if (req.method === "GET" && req.query.validationToken) {
    const validationToken = req.query.validationToken;
    console.log("[msGraph] Validation handshake received");
    return res.status(200).type("text/plain").send(validationToken);
  }

  // Notification delivery (POST)
  if (req.method === "POST") {
    const notifications = req.body?.value;
    if (!Array.isArray(notifications) || notifications.length === 0) {
      console.warn("[msGraph] Received empty or invalid notification payload");
      return res.status(202).json({ received: true, processed: 0 });
    }

    console.log(`[msGraph] Received ${notifications.length} notification(s)`);

    const results = [];
    for (const notification of notifications) {
      try {
        const result = await processNotification(notification, tid);
        results.push({ resource: notification.resource, ...result });
      } catch (err) {
        console.error("[msGraph] Error processing notification:", err);
        results.push({ resource: notification.resource, success: false, error: err.message });
      }
    }

    // Always return 202 to acknowledge receipt (Graph will retry on 4xx/5xx)
    return res.status(202).json({ received: true, processed: results.length, results });
  }

  return res.status(405).json({ error: "Method not allowed" });
}

module.exports = { handleNotification };