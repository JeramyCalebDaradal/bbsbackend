const { getGraphAccessToken, graphPost, graphDelete } = require("./graphClient");
const { getEnvDecrypted } = require("../utils/envCrypto");

/**
 * Creates a Microsoft Graph change notification subscription for users.
 * Subscription expires in ~3 days (max for user resource).
 * 
 * @param {string} tid - Tenant ID
 * @returns {Promise<object>} Subscription object from Graph
 */
async function createSubscription(tid) {
  const notificationUrl = getEnvDecrypted("GRAPH_WEBHOOK_URL"); // e.g., https://bbsdev.qzz.io/x42/api/v1/ms/notifications
  const clientState = getEnvDecrypted("GRAPH_CLIENT_STATE"); // Optional secret for validation

  if (!notificationUrl) {
    throw new Error("GRAPH_WEBHOOK_URL not configured");
  }

  const expirationDateTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
  const body = {
    changeType: "updated,deleted",
    notificationUrl,
    resource: "/users",
    expirationDateTime: expirationDateTime.toISOString(),
    clientState,
    latestSupportedTlsVersion: "v1_2",
  };

  const token = await getGraphAccessToken(tid);
  const subscription = await graphPost(token, "/subscriptions", body);
  
  console.log(`[graphSubscription] Created subscription ${subscription.id} expiring at ${subscription.expirationDateTime}`);
  return subscription;
}

/**
 * Renews an existing subscription (extends expiration by 3 days).
 * Must be called before expiration.
 * 
 * @param {string} tid - Tenant ID
 * @param {string} subscriptionId - Subscription ID to renew
 * @returns {Promise<object>} Updated subscription object
 */
async function renewSubscription(tid, subscriptionId) {
  const expirationDateTime = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const body = { expirationDateTime: expirationDateTime.toISOString() };

  const token = await getGraphAccessToken(tid);
  const subscription = await graphPost(token, `/subscriptions/${subscriptionId}`, body, "PATCH");
  
  console.log(`[graphSubscription] Renewed subscription ${subscriptionId} to ${subscription.expirationDateTime}`);
  return subscription;
}

/**
 * Deletes a subscription.
 * 
 * @param {string} tid - Tenant ID
 * @param {string} subscriptionId - Subscription ID to delete
 */
async function deleteSubscription(tid, subscriptionId) {
  const token = await getGraphAccessToken(tid);
  await graphDelete(token, `/subscriptions/${subscriptionId}`);
  console.log(`[graphSubscription] Deleted subscription ${subscriptionId}`);
}

/**
 * Lists all subscriptions for the tenant.
 * 
 * @param {string} tid - Tenant ID
 * @returns {Promise<Array>} Array of subscriptions
 */
async function listSubscriptions(tid) {
  const token = await getGraphAccessToken(tid);
  const result = await graphPost(token, "/subscriptions", {}, "GET");
  return result.value || [];
}

/**
 * Gets the active user subscription (if any).
 * 
 * @param {string} tid - Tenant ID
 * @returns {Promise<object|null>} Active subscription or null
 */
async function getActiveUserSubscription(tid) {
  const subscriptions = await listSubscriptions(tid);
  const now = new Date();
  
  // Find active subscription for /users resource
  return subscriptions.find(s => 
    s.resource === "/users" && 
    new Date(s.expirationDateTime) > now
  ) || null;
}

/**
 * Ensures a subscription exists - creates new or renews existing.
 * Call this on startup and via cron job.
 * 
 * @param {string} tid - Tenant ID
 * @returns {Promise<object>} Active subscription
 */
async function ensureSubscription(tid) {
  const existing = await getActiveUserSubscription(tid);
  
  if (existing) {
    // Check if renewal needed (expires within 24 hours)
    const expiresAt = new Date(existing.expirationDateTime);
    const hoursUntilExpiry = (expiresAt - Date.now()) / (1000 * 60 * 60);
    
    if (hoursUntilExpiry <= 24) {
      console.log(`[graphSubscription] Subscription ${existing.id} expires in ${hoursUntilExpiry.toFixed(1)}h, renewing...`);
      return renewSubscription(tid, existing.id);
    }
    
    console.log(`[graphSubscription] Active subscription ${existing.id} valid for ${hoursUntilExpiry.toFixed(1)}h`);
    return existing;
  }

  // No active subscription - create new
  console.log("[graphSubscription] No active subscription found, creating new...");
  return createSubscription(tid);
}

module.exports = {
  createSubscription,
  renewSubscription,
  deleteSubscription,
  listSubscriptions,
  getActiveUserSubscription,
  ensureSubscription,
};