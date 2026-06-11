const { pool } = require("../../db/pool");

async function listReportRows() {
  const [rows] = await pool.query(
    "SELECT report_type, key1, key2, value1, value2, color FROM bbs_reports_view"
  );
  return rows;
}

module.exports = { listReportRows };
