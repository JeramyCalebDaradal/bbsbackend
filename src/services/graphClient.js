const https = require("https");
const { getEnvDecrypted } = require("../utils/envCrypto");

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

const graphCache = {
  accessToken: null,
  expiresAt: 0,
};

/**
 * Get a client credentials access token for Microsoft Graph.
 * Cached until ~5 min before expiry.
 */
async function getGraphAccessToken() {
  const now = Date.now();
  if (graphCache.accessToken && graphCache.expiresAt > now + 5 * 60 * 1000) {
    return graphCache.accessToken;
  }

  const tenantId = String(getEnvDecrypted("ENTRA_TENANT_ID") || "").trim();
  const clientId = String(getEnvDecrypted("ENTRA_CLIENT_ID") || "").trim();
  const clientSecret = String(getEnvDecrypted("ENTRA_CLIENT_SECRET") || "").trim();

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error("Missing Graph client credentials (ENTRA_TENANT_ID, ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET)");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: GRAPH_SCOPE,
    grant_type: "client_credentials",
  }).toString();

  const token = await new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "login.microsoftonline.com",
        path: `/${tenantId}/oauth2/v2.0/token`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (!data.trim()) {
            reject(new Error(`Graph token empty response (HTTP ${res.statusCode}) — check ENTRA_CLIENT_ID and ENTRA_CLIENT_SECRET are correct`));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300 && parsed.access_token) {
              graphCache.accessToken = parsed.access_token;
              graphCache.expiresAt = now + (parsed.expires_in || 3600) * 1000;
              resolve(parsed.access_token);
            } else {
              reject(new Error(`Graph token error ${res.statusCode}: ${parsed.error_description || parsed.error || data}`));
            }
          } catch (e) {
            reject(new Error(`Graph token parse error: ${e.message} — raw: ${data.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });

  return token;
}

/**
 * Generic Graph API GET request with Authorization header.
 */
async function graphRequest(method, path, body = null, params = {}, extraHeaders = {}) {
  const token = await getGraphAccessToken();
  const query = new URLSearchParams(params).toString();
  const fullPath = `${path}${query ? `?${query}` : ""}`;
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "graph.microsoft.com",
        path: fullPath,
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...extraHeaders,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(parsed);
            } else {
              reject(new Error(`Graph ${method} ${path} failed ${res.statusCode}: ${data}`));
            }
          } catch (e) {
            reject(new Error(`Graph parse error: ${e.message}`));
          }
        });
      }
    );
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function graphGet(path, params = {}) {
  return graphRequest("GET", path, null, params, { ConsistencyLevel: "eventual" });
}

async function graphPost(path, body = {}) {
  return graphRequest("POST", path, body);
}

async function graphPatch(path, body = {}) {
  return graphRequest("PATCH", path, body);
}

async function graphDelete(path) {
  return graphRequest("DELETE", path);
}

/**
 * Fetch a single user by object ID (oid).
 * Returns the user object or null if not found.
 */
async function getUserByOid(oid) {
  const select = [
    "id",
    "userPrincipalName",
    "mail",
    "displayName",
    "givenName",
    "surname",
    "accountEnabled",
    "userType",
    "createdDateTime",
    "onPremisesSamAccountName",
    "employeeId",
    "jobTitle",
    "department",
    "officeLocation",
    "mobilePhone",
    "businessPhones",
  ].join(",");

  const data = await graphGet(`/v1.0/users/${encodeURIComponent(oid)}`, { $select: select });
  return data;
}

/**
 * List users with pagination (for full reconcile).
 * Calls callback for each page.
 */
async function listAllUsers(callback, options = {}) {
  const select = options.select || "id,userPrincipalName,mail,displayName,givenName,surname,accountEnabled,userType";
  const top = options.top || 999;
  let nextLink = `/v1.0/users?$select=${select}&$top=${top}`;

  while (nextLink) {
    const data = await graphGet(nextLink);
    const users = data.value || [];
    if (users.length === 0) break;

    await callback(users);

    nextLink = data["@odata.nextLink"] || null;
    if (nextLink) {
      // nextLink is a full URL, extract path + query
      const url = new URL(nextLink);
      nextLink = url.pathname + url.search;
    }
  }
}

module.exports = {
  getGraphAccessToken,
  graphRequest,
  graphGet,
  graphPost,
  graphPatch,
  graphDelete,
  getUserByOid,
  listAllUsers,
};