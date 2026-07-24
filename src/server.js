const http = require("http");
const dotenv = require("dotenv");
const cron = require("node-cron");

dotenv.config();

const { createApp } = require("./app");
const { getEnvDecrypted } = require("./utils/envCrypto");
const { ensureSubscription } = require("./services/graphSubscription");

const port = Number(process.env.PORT || 4000);
const host = process.env.HOST || "0.0.0.0";

const app = createApp();
const server = http.createServer(app);

/**
 * Initialize Graph subscription on startup.
 * Runs async - doesn't block server start.
 */
async function initGraphSubscription() {
  try {
    const tid = getEnvDecrypted("ENTRA_TENANT_ID");
    if (!tid) {
      console.warn("[graphSubscription] ENTRA_TENANT_ID not configured, skipping subscription init");
      return;
    }
    console.log("[graphSubscription] Initializing subscription on startup...");
    await ensureSubscription(tid);
    console.log("[graphSubscription] Startup subscription check complete");
  } catch (err) {
    console.error("[graphSubscription] Startup subscription init failed:", err.message);
  }
}

/**
 * Daily cron job to ensure subscription stays active.
 * Runs at 03:00 UTC daily.
 */
function startSubscriptionCron() {
  cron.schedule("0 3 * * *", async () => {
    try {
      const tid = getEnvDecrypted("ENTRA_TENANT_ID");
      if (!tid) return;
      
      console.log("[graphSubscription] Running daily subscription renewal check...");
      await ensureSubscription(tid);
      console.log("[graphSubscription] Daily subscription check complete");
    } catch (err) {
      console.error("[graphSubscription] Cron job error:", err.message);
    }
  }, {
    timezone: "UTC"
  });
  
  console.log("[graphSubscription] Daily cron job scheduled (03:00 UTC)");
}

// Initialize subscription on startup (non-blocking)
initGraphSubscription();

// Start daily cron job
startSubscriptionCron();

server.listen(port, host, () => {
  process.stdout.write(`BBSBackend listening on http://${host}:${port}\n`);
});

