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

function mapGraphUser(user, roleByPrincipalName) {
  const upn = String(user?.userPrincipalName || "").trim().toLowerCase();
  return {
    tid: null,
    oid: String(user?.id || "").trim(),
    display_name: String(user?.displayName || "").trim(),
    email: String(user?.mail || user?.userPrincipalName || "").trim(),
    user_principal_name: String(user?.userPrincipalName || "").trim(),
    department: String(user?.department || "").trim(),
    job_title: String(user?.jobTitle || "").trim(),
    account_enabled: Boolean(user?.accountEnabled),
    app_role: roleByPrincipalName.get(upn) || "Default",
    synced_at: null,
  };
}

async function getAppRoleDefinitions(token, servicePrincipalId) {
  const payload = await getJson(`https://graph.microsoft.com/v1.0/servicePrincipals/${encodeURIComponent(servicePrincipalId)}?$select=appRoles`, token);
  const appRoles = Array.isArray(payload?.appRoles) ? payload.appRoles : [];
  const roleMap = new Map();
  for (const role of appRoles) {
    const id = String(role?.id || "").trim();
    const displayName = String(role?.displayName || role?.value || "").trim();
    if (id && displayName) roleMap.set(id, displayName);
  }
  return roleMap;
}

async function listDirectoryRoleAssignments(token, servicePrincipalId) {
  const appRoleNames = await getAppRoleDefinitions(token, servicePrincipalId);
  const usersByPrincipalName = new Map();
  let url = `https://graph.microsoft.com/v1.0/servicePrincipals/${encodeURIComponent(servicePrincipalId)}/appRoleAssignedTo?$top=999`;

  while (url) {
    const payload = await getJson(url, token);
    const items = Array.isArray(payload?.value) ? payload.value : [];
    for (const item of items) {
      const principalType = String(item?.principalType || "").trim();
      const principalDisplayName = String(item?.principalDisplayName || "").trim();
      if (principalType !== "User" || !principalDisplayName) continue;
      const key = principalDisplayName.toLowerCase();
      const appRoleId = String(item?.appRoleId || "").trim();
      const roleName = appRoleNames.get(appRoleId) || "Assigned";
      usersByPrincipalName.set(key, roleName);
    }
    url = typeof payload?.["@odata.nextLink"] === "string" ? payload["@odata.nextLink"] : "";
  }

  return usersByPrincipalName;
}

async function getRoleMap(token) {
  const servicePrincipalId = String(getEnvDecrypted("ENTRA_SERVICE_PRINCIPAL_ID") || "").trim();
  if (!servicePrincipalId) return new Map();

  try {
    return await listDirectoryRoleAssignments(token, servicePrincipalId);
  } catch {
    return new Map();
  }
}

function paginate(items, page, limit) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  const start = (safePage - 1) * safeLimit;
  const end = start + safeLimit;
  return {
    page: safePage,
    limit: safeLimit,
    total: items.length,
    data: items.slice(start, end),
  };
}

async function listEntraUsers({ search = "", page = 1, limit = 20 } = {}) {
  const token = await getGraphAccessToken();
  const roleByPrincipalName = await getRoleMap(token);
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
    rows.push(...items.map((item) => mapGraphUser(item, roleByPrincipalName)));
    url = typeof payload?.["@odata.nextLink"] === "string" ? payload["@odata.nextLink"] : "";
  }

  rows.sort((a, b) => String(a.display_name || a.email || "").localeCompare(String(b.display_name || b.email || "")));
  return paginate(rows, page, limit);
}

module.exports = { listEntraUsers };
