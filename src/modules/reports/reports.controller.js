const { getReports } = require("./reports.service");

async function getReportsController(req, res, next) {
  try {
    const report = await getReports();
    res.status(200).json({ ok: true, report });
  } catch (err) {
    next(err);
  }
}

module.exports = { getReportsController };

