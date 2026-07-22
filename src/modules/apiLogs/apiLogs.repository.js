const { pool } = require("../../db/pool");

async function insertApiLog({ url, method, ipAddress, statusCode, userId, authMasked, userAgent, responseTimeMs, referer }) {
  const [result] = await pool.query(
    `INSERT INTO bbs_api_logs
      (url, method, ip_address, status_code, user_id, authorization_masked, user_agent, response_time_ms, referer, time_sent, date_sent)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, CURTIME(), CURDATE())`,
    [url, method, ipAddress, statusCode, userId, authMasked, userAgent, responseTimeMs, referer]
  );
  return Number(result.insertId);
}

function normalizePaging({ page, pageSize }) {
  const p = Number(page);
  const s = Number(pageSize);
  const pageSafe = Number.isFinite(p) && p > 0 ? Math.trunc(p) : 1;
  const sizeSafe = Number.isFinite(s) && s > 0 ? Math.min(Math.trunc(s), 50) : 50;
  const offset = (pageSafe - 1) * sizeSafe;
  return { page: pageSafe, pageSize: sizeSafe, offset };
}

async function listApiLogs({ page, pageSize, fromDate, toDate, statusCode, urlSearch, ipSearch, query }) {
  const { page: pageSafe, pageSize: sizeSafe, offset } = normalizePaging({ page, pageSize });
  const where = [];
  const params = [];

  if (fromDate) {
    where.push("date_sent >= ?");
    params.push(fromDate);
  }
  if (toDate) {
    where.push("date_sent <= ?");
    params.push(toDate);
  }
  if (statusCode) {
    where.push("status_code = ?");
    params.push(Number(statusCode));
  }
  if (urlSearch) {
    where.push("url LIKE ?");
    params.push(`%${urlSearch}%`);
  }
  if (ipSearch) {
    where.push("ip_address LIKE ?");
    params.push(`%${ipSearch}%`);
  }
  if (query) {
    const q = String(query).trim().slice(0, 200).replace(/[%_]/g, "\\$&");
    where.push("(url LIKE ? OR ip_address LIKE ? OR CAST(user_id AS CHAR) LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `SELECT
      l.id, l.url, l.method, l.ip_address, l.status_code, l.user_id,
      l.authorization_masked, l.user_agent, l.response_time_ms, l.referer,
      l.time_sent, l.date_sent,
      a.email AS user_email
    FROM bbs_api_logs l
    LEFT JOIN auth a ON a.id = l.user_id
    ${whereSql}
    ORDER BY l.date_sent DESC, l.time_sent DESC, l.id DESC
    LIMIT ?
    OFFSET ?`,
    [...params, sizeSafe, offset]
  );

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM bbs_api_logs ${whereSql}`,
    params
  );

  const total = Number(countRows?.[0]?.total || 0);
  return { rows, page: pageSafe, pageSize: sizeSafe, total };
}

module.exports = { insertApiLog, listApiLogs };