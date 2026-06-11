const {
  changePassword,
  createAdminUserAsActor,
  createSuperAdmin,
  getUsers,
  login,
  me,
  updateAdminUser,
  updateProfile,
} = require("./auth.service");
const { created, edited, recordLog } = require("../logs/logs.service");

function normalizeOrigin(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  try {
    const u = new URL(v);
    return u.origin;
  } catch {
    return v.replace(/\/+$/, "");
  }
}

function requestOrigin(req) {
  const origin = normalizeOrigin(req.get("origin"));
  if (origin) return origin;
  const ref = String(req.get("referer") || "").trim();
  if (!ref) return "";
  try {
    return new URL(ref).origin;
  } catch {
    return "";
  }
}

async function loginController(req, res, next) {
  try {
    const sender = requestOrigin(req);
    const result = await login(req.body || {}, { sender });
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function meController(req, res, next) {
  try {
    const user = await me(req.userId);
    res.status(200).json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

async function createSuperAdminController(req, res, next) {
  try {
    const result = await createSuperAdmin(req.body || {}, { actorId: req.userId });
    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function createAdminUserController(req, res, next) {
  try {
    const result = await createAdminUserAsActor(req.userId, req.body || {});
    try {
      if (req.userId) {
        const u = result?.user;
        const name = `${String(u?.first_name || "").trim()} ${String(u?.last_name || "").trim()}`.trim();
        const role = String(u?.role || "").trim();
        await recordLog({ userId: req.userId, action: created(`a new user: ${name}${role ? ` (${role})` : ""}`) });
      }
    } catch {}
    res.status(201).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function listUsersController(req, res, next) {
  try {
    const users = await getUsers(req.userId);
    res.status(200).json({ ok: true, users });
  } catch (err) {
    next(err);
  }
}

async function updateAdminUserController(req, res, next) {
  try {
    const before = req.body || {};
    const user = await updateAdminUser(req.userId, req.params.id, before);
    try {
      if (req.userId) {
        const name = `${String(user?.first_name || "").trim()} ${String(user?.last_name || "").trim()}`.trim();
        await recordLog({ userId: req.userId, action: edited(`a user: ${name}`) });
      }
    } catch {}
    res.status(200).json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

async function updateProfileController(req, res, next) {
  try {
    const user = await updateProfile(req.body || {});
    try {
      const actorId = req.userId || req.body?.id;
      if (actorId) {
        await recordLog({ userId: actorId, action: edited("own profile") });
      }
    } catch {}
    res.status(200).json({ ok: true, user });
  } catch (err) {
    next(err);
  }
}

async function changePasswordController(req, res, next) {
  try {
    await changePassword(req.body || {});
    try {
      const actorId = req.userId || req.body?.id;
      if (actorId) {
        await recordLog({ userId: actorId, action: edited("own password") });
      }
    } catch {}
    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  loginController,
  meController,
  createSuperAdminController,
  createAdminUserController,
  listUsersController,
  updateAdminUserController,
  updateProfileController,
  changePasswordController,
};
