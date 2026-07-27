const https = require("https");
const { getEnvDecrypted } = require("../utils/envCrypto");

function readResponseBody(res) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    res.on("data", (d) => chunks.push(d));
    res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    res.on("error", reject);
  });
}

function postForm(url, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    }, async (res) => {
      try {
        const raw = await readResponseBody(res);
        const statusCode = Number(res.statusCode || 0);
        const parsed = raw ? JSON.parse(raw) : {};
        if (statusCode < 200 || statusCode >= 300) {
          const err = new Error(parsed?.error_description || parsed?.error || `HTTP_${statusCode}`);
          err.statusCode = statusCode;
          throw err;
        }
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function getJson(url, accessToken) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }, async (res) => {
      try {
        const raw = await readResponseBody(res);
        const statusCode = Number(res.statusCode || 0);
        const parsed = raw ? JSON.parse(raw) : {};
        if (statusCode < 200 || statusCode >= 300) {
          const err = new Error(parsed?.error?.message || `HTTP_${statusCode}`);
          err.statusCode = statusCode;
          throw err;
        }
        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
    req.end();
  });
}

async function getGraphAccessToken() {
  const tenantId = String(getEnvDecrypted("ENTRA_TENANT_ID") || "").trim();
  const clientId = String(getEnvDecrypted("ENTRA_CLIENT_ID") || "").trim();
  const clientSecret = String(getEnvDecrypted("ENTRA_CLIENT_SECRET") || "").trim();

  if (!tenantId || !clientId || !clientSecret) {
    const err = new Error("Entra Graph credentials are not configured");
    err.statusCode = 500;
    err.code = "GRAPH_NOT_CONFIGURED";
    throw err;
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  }).toString();

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const result = await postForm(tokenUrl, body);
  return String(result?.access_token || "").trim();
}

function mapGraphUser(user) {
  const roleCandidates = [];
  if (Array.isArray(user?.appRoles)) roleCandidates.push(...user.appRoles);
  if (Array.isArray(user?.roles)) roleCandidates.push(...user.roles);

  return {
    tid: null,
    oid: String(user?.id || "").trim(),
    display_name: String(user?.displayName || "").trim(),
    email: String(user?.mail || user?.userPrincipalName || "").trim(),
    user_principal_name: String(user?.userPrincipalName || "").trim(),
    department: String(user?.department || "").trim(),
    job_title: String(user?.jobTitle || "").trim(),
    account_enabled: Boolean(user?.accountEnabled),
    app_role: String(roleCandidates.find(Boolean) || "Default").trim() || "Default",
    synced_at: null,
  };
}

async function listEntraUsers({ search = "" } = {}) {
  const token = await getGraphAccessToken();
  const select = [
    "id",
    "displayName",
    "mail",
    "userPrincipalName",
    "department",
    "jobTitle",
    "accountEnabled",
  ].join(",");

  let url = `https://graph.microsoft.com/v1.0/users?$select=${encodeURIComponent(select)}&$top=999`;
  if (search) {
    const q = String(search).trim().replace(/'/g, "''");
    const filter = `startsWith(displayName,'${q}') or startsWith(mail,'${q}') or startsWith(userPrincipalName,'${q}')`;
    url += `&$filter=${encodeURIComponent(filter)}`;
  }

  const rows = [];
  while (url) {
    const payload = await getJson(url, token);
    const items = Array.isArray(payload?.value) ? payload.value : [];
    rows.push(...items.map(mapGraphUser));
    url = typeof payload?.["@odata.nextLink"] === "string" ? payload["@odata.nextLink"] : "";
  }

  return rows;
}

module.exports = { listEntraUsers };
