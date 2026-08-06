const { ingestLog, getApiLogs } = require("./apiLogs.service");

async function ingestLogController(req, res, next) {
  try {
    await ingestLog({
      method: req.get("X-Log-Method"),
      url: req.get("X-Log-Url"),
      ip: req.get("X-Log-Ip"),
      status: req.get("X-Log-Status"),
      time: req.get("X-Log-Time"),
      auth: req.get("X-Log-Auth"),
      ua: req.get("X-Log-Ua"),
      ms: req.get("X-Log-Ms"),
      referer: req.get("X-Log-Referer"),
      userId: req.userId || null,
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

async function listApiLogsController(req, res, next) {
  try {
    const result = await getApiLogs(req.query || {});
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { ingestLogController, listApiLogsController };