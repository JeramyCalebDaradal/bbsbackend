const { pool } = require("../db/pool");

/**
 * Page-to-pageKey mapping for admin dashboard routes.
 * Every admin route group should be mapped here.
 */
const PAGE_KEY_BY_ROUTE = {
  "/admin/events": "events",
  "/admin/articles": "articles",
  "/admin/datasheets": "datasheets",
  "/admin/info-videos": "videos",
  "/admin/appointments": "appointments",
  "/admin/leads": "leads",
  "/admin/reports": "reports",
  "/admin/settings": "settings",
  "/admin/api-logs": "api-logs",
  "/admin/logs": "logs",
  "/admin/users": "users",
  "/admin/role-config": "roles",
  "/admin/roles": "roles",
};

/**
 * requirePageAccess middleware.
 * Must be used AFTER requireEntraAuth (req.entra.tid, req.userRole populated).
 * Looks up the role's allowed_pages_json from bbs_role_config and
 * blocks the request if the page key is not in the allowed list.
 */
function requirePageAccess(pageKey) {
  return async (req, res, next) => {
    try {
      const tid = req.entra?.tid;
      const role = req.userRole;

      if (!tid || !role) {
        const err = new Error("Forbidden");
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        return next(err);
      }

      // Default role has no access — already blocked by requireDashboardAuth, but double-check
      if (role === "Default") {
        const err = new Error("Forbidden");
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        return next(err);
      }

      // Resolve page key: use explicit param, or infer from req.baseUrl
      const key = pageKey || resolvePageKey(req.baseUrl);
      if (!key) {
        // Unknown route — allow through (let individual route auth handle it)
        return next();
      }

      const [rows] = await pool.query(
        "SELECT allowed_pages_json FROM bbs_role_config WHERE tid = ? AND role_name = ? LIMIT 1",
        [tid, role]
      );

      if (!rows || rows.length === 0) {
        const err = new Error("Forbidden");
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        return next(err);
      }

      let allowedPages = [];
      try {
        allowedPages = typeof rows[0].allowed_pages_json === "string"
          ? JSON.parse(rows[0].allowed_pages_json)
          : rows[0].allowed_pages_json || [];
      } catch {
        allowedPages = [];
      }

      if (!allowedPages.includes(key)) {
        const err = new Error("Forbidden");
        err.statusCode = 403;
        err.code = "FORBIDDEN";
        return next(err);
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

function resolvePageKey(baseUrl) {
  // Normalize: remove trailing slash, match against known keys
  const normalized = String(baseUrl || "").replace(/\/+$/, "");
  return PAGE_KEY_BY_ROUTE[normalized] || null;
}

module.exports = { requirePageAccess, PAGE_KEY_BY_ROUTE };