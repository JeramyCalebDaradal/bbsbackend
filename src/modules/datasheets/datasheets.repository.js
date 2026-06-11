const { pool } = require("../../db/pool");

function normalizePaging({ page }) {
  const p = Number(page);
  const pageSafe = Number.isFinite(p) && p > 0 ? Math.trunc(p) : 1;
  const pageSize = 20;
  const offset = (pageSafe - 1) * pageSize;
  return { page: pageSafe, pageSize, offset };
}

async function listDatasheets({ page, status, query, onlyActive = false }) {
  const { page: pageSafe, pageSize, offset } = normalizePaging({ page });
  const where = [];
  const params = {};

  if (onlyActive) {
    where.push("LOWER(status) = 'active'");
  } else {
    const statusValue = String(status || "").trim();
    if (statusValue && statusValue.toLowerCase() !== "all") {
      where.push("LOWER(status) = LOWER(:status)");
      params.status = statusValue;
    }
  }

  const q = String(query || "").trim();
  if (q) {
    where.push("(LOWER(title) LIKE :qLike OR LOWER(file_path) LIKE :qLike)");
    params.qLike = `%${q.toLowerCase()}%`;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query(
    `
      SELECT
        id,
        title,
        description,
        file_path,
        size,
        status,
        date_created,
        added_by
      FROM bbs_datasheets_view
      ${whereSql}
      ORDER BY id DESC
      LIMIT :limit
      OFFSET :offset
    `,
    { ...params, limit: pageSize, offset }
  );

  const [countRows] = await pool.query(
    `
      SELECT COUNT(*) AS total
      FROM bbs_datasheets_view
      ${whereSql}
    `,
    params
  );

  const total = Number(countRows?.[0]?.total || 0);
  return { rows, page: pageSafe, pageSize, total };
}

async function findById(id) {
  const [rows] = await pool.query(
    `
      SELECT
        id,
        title,
        description,
        file_path,
        size,
        status,
        date_created,
        added_by
      FROM bbs_datasheets
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  return rows[0] || null;
}

async function insertDatasheet({ title, description, filePath, size, status, addedBy }) {
  const [result] = await pool.query(
    `
      INSERT INTO bbs_datasheets
        (title, description, file_path, size, status, added_by)
      VALUES
        (?, ?, ?, ?, ?, ?)
    `,
    [title, description, filePath, size, status, addedBy]
  );
  return Number(result.insertId);
}

async function updateDatasheetById(id, { title, description, filePath, size, status }) {
  const [result] = await pool.query(
    `
      UPDATE bbs_datasheets
      SET
        title = ?,
        description = ?,
        file_path = ?,
        size = ?,
        status = ?
      WHERE id = ?
      LIMIT 1
    `,
    [title, description, filePath, size, status, id]
  );
  return Number(result.affectedRows || 0);
}

async function deleteDatasheetById(id) {
  const [result] = await pool.query(
    `
      DELETE FROM bbs_datasheets
      WHERE id = ?
      LIMIT 1
    `,
    [id]
  );
  return Number(result.affectedRows || 0);
}

module.exports = {
  listDatasheets,
  findById,
  insertDatasheet,
  updateDatasheetById,
  deleteDatasheetById,
};
