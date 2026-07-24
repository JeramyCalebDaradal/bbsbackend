const { getRoleConfigs, getRoleConfig, saveRoleConfig } = require("./roleConfig.service");

async function listRoleConfigsController(req, res, next) {
  try {
    const tid = req.entra?.tid || "";
    const result = await getRoleConfigs({ tid });
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}

async function updateRoleConfigController(req, res, next) {
  try {
    const tid = req.entra?.tid || "";
    const roleName = String(req.params?.roleName || "").trim();
    const { allowed_pages_json, description } = req.body || {};
    const updatedBy = req.oid || null;

    const result = await saveRoleConfig({
      tid,
      roleName,
      allowedPages: allowed_pages_json,
      description,
      updatedByUserId: updatedBy,
    });
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { listRoleConfigsController, updateRoleConfigController };