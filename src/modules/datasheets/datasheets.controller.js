const {
  createDatasheet,
  deleteDatasheet,
  getDatasheets,
  getPublicDatasheets,
  updateDatasheet,
} = require("./datasheets.service");
const { created, edited, removed, recordLog } = require("../logs/logs.service");

async function listDatasheetsController(req, res, next) {
  try {
    const result = await getDatasheets(req.query || {});
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function listPublicDatasheetsController(req, res, next) {
  try {
    const result = await getPublicDatasheets(req.query || {});
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function createDatasheetController(req, res, next) {
  try {
    const datasheet = await createDatasheet(req.body || {});
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: created(`a new datasheet: ${datasheet.title}`) });
      }
    } catch {}
    res.status(201).json({ ok: true, datasheet });
  } catch (err) {
    next(err);
  }
}

async function updateDatasheetController(req, res, next) {
  try {
    const datasheet = await updateDatasheet(req.params.id, req.body || {});
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: edited(`a datasheet: ${datasheet.title}`) });
      }
    } catch {}
    res.status(200).json({ ok: true, datasheet });
  } catch (err) {
    next(err);
  }
}

async function deleteDatasheetController(req, res, next) {
  try {
    const datasheet = await deleteDatasheet(req.params.id);
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: removed(`a datasheet: ${datasheet.title}`) });
      }
    } catch {}
    res.status(200).json({ ok: true, datasheet });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listDatasheetsController,
  listPublicDatasheetsController,
  createDatasheetController,
  updateDatasheetController,
  deleteDatasheetController,
};
