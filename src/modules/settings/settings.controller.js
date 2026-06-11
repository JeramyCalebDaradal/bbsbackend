const { getAdminSettings, getPublicWebsiteSettings, updateAdminSettings } = require("./settings.service");
const { edited, recordLog } = require("../logs/logs.service");

async function getPublicSettingsController(req, res, next) {
  try {
    const settings = await getPublicWebsiteSettings();
    res.status(200).json({ ok: true, settings });
  } catch (err) {
    next(err);
  }
}

async function getAdminSettingsController(req, res, next) {
  try {
    const settings = await getAdminSettings();
    res.status(200).json({ ok: true, settings });
  } catch (err) {
    next(err);
  }
}

async function updateAdminSettingsController(req, res, next) {
  try {
    const before = req.body || {};
    const settings = await updateAdminSettings(before);
    try {
      if (req.userId) {
        const fields = Object.keys(before || {}).join(", ") || "settings";
        await recordLog({ userId: req.userId, action: edited(`settings: ${fields}`) });
      }
    } catch {}
    res.status(200).json({ ok: true, settings });
  } catch (err) {
    next(err);
  }
}

module.exports = { getPublicSettingsController, getAdminSettingsController, updateAdminSettingsController };
