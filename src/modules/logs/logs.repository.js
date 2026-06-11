const { pool } = require("../../db/pool");

async function insertLog({ userId, action }) {
  const [result] = await pool.query(
    `
      INSERT INTO bbs_logs
        (user_id, action, date, time)
      VALUES
        (?, ?, CURDATE(), CURTIME())
    `,
    [userId, action]
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

async function listLogs({ page, pageSize, role, action, fromDate, toDate, query }) {
  const { page: pageSafe, pageSize: sizeSafe, offset } = normalizePaging({ page, pageSize });
  const where = [];
  const params = {};

  if (role) {
    where.push("role = :role");
    params.role = role;
  }

  if (action) {
    where.push("action LIKE :actionPrefix");
    params.actionPrefix = `${action}%`;
  }

  if (fromDate) {
    where.push("date >= :fromDate");
    params.fromDate = fromDate;
  }
  if (toDate) {
    where.push("date <= :toDate");
    params.toDate = toDate;
  }

  const q = String(query || "").trim();
  if (q) {
    where.push("(full_name LIKE :qLike OR CAST(user_id AS CHAR) LIKE :qLike)");
    params.qLike = `%${q}%`;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT
        id,
        user_id,
        full_name,
        role,
        action,
        date,
        time
      FROM bbs_logs_view
      ${whereSql}
      ORDER BY date DESC, time DESC, id DESC
      LIMIT :limit
      OFFSET :offset
    `,
    { ...params, limit: sizeSafe, offset }
  );

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM bbs_logs_view
      ${whereSql}
    `,
    params
  );

  const total = Number(countRows?.[0]?.total || 0);
  return { rows, page: pageSafe, pageSize: sizeSafe, total };
}

module.exports = { insertLog, listLogs };

