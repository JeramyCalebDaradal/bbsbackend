const express = require("express");
const {
  changePasswordController,
  createAdminUserController,
  createSuperAdminController,
  loginController,
  logoutController,
  meController,
  refreshController,
  listUsersController,
  updateAdminUserController,
  updateProfileController,
} = require("./auth.controller");
const { ADMIN_CREATABLE_ROLES, ROLES } = require("../../constants/roles");
const { requireAuth, requireEntraAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");
const { requirePageAccess } = require("../../middleware/requirePageAccess");
const { validate } = require("../../middleware/validate");
const {
  loginSchema,
  createSuperAdminSchema,
  createAdminUserSchema,
  updateProfileSchema,
  changePasswordSchema,
} = require("../../validators/authSchemas");

const authRouter = express.Router();

// DISABLED: Old credential login — use Microsoft Entra SSO instead
authRouter.post("/login", (req, res) => {
  res.status(410).json({
    ok: false,
    code: "GONE",
    message: "Credential login is disabled. Please sign in via Microsoft Entra SSO."
  });
});

// DISABLED: Old refresh — Entra tokens are refreshed client-side via MSAL
authRouter.post("/refresh", (req, res) => {
  res.status(410).json({
    ok: false,
    code: "GONE",
    message: "Token refresh is handled by Microsoft Entra SSO (MSAL)."
  });
});

// DISABLED: Old logout — Entra sign-out is client-side
authRouter.post("/logout", (req, res) => {
  res.status(410).json({
    ok: false,
    code: "GONE",
    message: "Sign out via Microsoft Entra SSO."
  });
});

authRouter.get("/entra/me", requireEntraAuth, async (req, res, next) => {
  try {
    const authUser = req.localUser;
    res.status(200).json({
      ok: true,
      id: authUser?.id || null,
      tid: req.entra?.tid || null,
      oid: req.entra?.oid || null,
      roles: req.entra?.roles || [],
      upn: req.entra?.upn || null,
      auth_user: authUser
        ? {
            id: authUser.id,
            first_name: authUser.first_name,
            last_name: authUser.last_name,
            email: authUser.email,
            role: authUser.role,
            status: authUser.status,
          }
        : null,
    });
  } catch (err) {
    next(err);
  }
});

// DISABLED: Old /me — custom JWTs no longer issued
authRouter.get("/me", (req, res) => {
  res.status(410).json({
    ok: false,
    code: "GONE",
    message: "Use /auth/entra/me with an Entra access token."
  });
});

function optionalAuth(req, res, next) {
  const header = String(req.headers?.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return next();
  return requireAuth(req, res, next);
}

// DISABLED: These endpoints relied on custom JWTs
authRouter.post("/super-admin", (req, res) => {
  res.status(410).json({ ok: false, code: "GONE", message: "Super-admin creation is now managed via Entra App Roles." });
});
authRouter.put("/profile", (req, res) => {
  res.status(410).json({ ok: false, code: "GONE", message: "Profile updates are managed via Entra user profile." });
});
authRouter.put("/password", (req, res) => {
  res.status(410).json({ ok: false, code: "GONE", message: "Password changes are managed in Entra (Azure AD)." });
});

const adminRouter = express.Router();

adminRouter.get("/roles", requirePageAccess("roles"), (req, res) => {
  res.status(200).json({ ok: true, roles: ["Administrator", "ContentManager", "Analyst", "Default"] });
});

adminRouter.get("/users", requirePageAccess("users"), requireRole("Administrator"), listUsersController);

module.exports = { authRouter, adminRouter };
