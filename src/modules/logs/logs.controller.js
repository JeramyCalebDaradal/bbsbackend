const { getLogs } = require("./logs.service");

async function listLogsController(req, res, next) {
  try {
    const result = await getLogs(req.query || {});
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { listLogsController };

