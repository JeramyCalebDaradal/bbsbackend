const {
  changePassword,
  createAdminUserAsActor,
  createSuperAdmin,
  getUsers,
  login,
  logout,
  me,
  refreshSession,
  refreshSessionForUser,
  updateAdminUser,
  updateProfile,
  setRefreshCookie,
  clearRefreshCookie,
} = require("./auth.service");
const { created, edited, loggedIn, recordLog } = require("../logs/logs.service");
const { findTokenByValue } = require("../../services/tokenService");

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

    // Set refresh token as HttpOnly cookie
    if (result._refreshToken) {
      setRefreshCookie(res, result._refreshToken);
    }

    // Log the login
    try {
      const user = result?.user;
      if (user?.id) {
        const name = `${String(user.first_name || "").trim()} ${String(user.last_name || "").trim()}`.trim();
        await recordLog({ userId: user.id, action: loggedIn(name || `user #${user.id}`) });
      }
    } catch {}

    // Return access token + user data (but NOT the raw refresh token)
    const { _refreshToken, ...safe } = result;
    res.status(200).json({ ok: true, ...safe });
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

// ──────────────────────────────────────────────
//  Refresh endpoint
// ──────────────────────────────────────────────

async function refreshController(req, res, next) {
  try {
    // Read refresh token from HttpOnly cookie
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      const err = new Error("Refresh token required");
      err.statusCode = 401;
      err.code = "REFRESH_REQUIRED";
      throw err;
    }

    // The frontend sends userId in the body (decoded from the expired access token
    // payload). This allows efficient DB lookup without scanning all tokens.
    const userId = req.body?.userId ? Number(req.body.userId) : null;
    const ipHint = String(req.ip || req.connection?.remoteAddress || "unknown");

    let result;
    if (userId) {
      result = await refreshSessionForUser(userId, refreshToken, ipHint);
    } else {
      result = await refreshSession(refreshToken, ipHint);
    }

    // Log refresh for visibility in backend terminal
    console.log(
      "[TOKEN_REFRESH] user=%d family=%s — new access token issued",
      userId || "?",
      result.accessToken ? require("jsonwebtoken").decode(result.accessToken)?.familyId || "?" : "?"
    );

    // Set new refresh token as HttpOnly cookie
    setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      ok: true,
      accessToken: result.accessToken,
    });
  } catch (err) {
    next(err);
  }
}

// ──────────────────────────────────────────────
//  Logout endpoint
// ──────────────────────────────────────────────

async function logoutController(req, res, next) {
  try {
    let userId = req.userId;

    // If no access token (requireAuth wasn't used), try to identify user
    // from the refresh token cookie
    if (!userId) {
      const refreshToken = req.cookies?.refreshToken;
      if (refreshToken) {
        try {
          const token = await findTokenByValue(refreshToken);
          if (token) {
            userId = token.user_id;
          }
        } catch {}
      }
    }

    // Log the logout
    try {
      if (userId) {
        await recordLog({ userId, action: "Logged out" });
      }
    } catch {}

    await logout(userId);

    // Clear the refresh cookie
    clearRefreshCookie(res);

    res.status(200).json({ ok: true });
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

    // Clear refresh cookie after password change (all sessions revoked)
    clearRefreshCookie(res);

    res.status(200).json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  loginController,
  meController,
  refreshController,
  logoutController,
  createSuperAdminController,
  createAdminUserController,
  listUsersController,
  updateAdminUserController,
  updateProfileController,
  changePasswordController,
};