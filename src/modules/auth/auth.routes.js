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

authRouter.post("/login", validate(loginSchema), loginController);
authRouter.post("/refresh", refreshController);
authRouter.post("/logout", logoutController);  // No requireAuth — identifies user via refresh token cookie
authRouter.get("/entra/me", requireEntraAuth, (req, res) => {
  res.status(200).json({
    ok: true,
    tid: req.entra?.tid || null,
    oid: req.entra?.oid || null,
    roles: req.entra?.roles || [],
    upn: req.entra?.upn || null,
  });
});
authRouter.get("/me", requireAuth, meController);

function optionalAuth(req, res, next) {
  const header = String(req.headers?.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return next();
  return requireAuth(req, res, next);
}

authRouter.post("/super-admin", optionalAuth, validate(createSuperAdminSchema), createSuperAdminController);
authRouter.put("/profile", requireAuth, validate(updateProfileSchema), updateProfileController);
authRouter.put("/password", requireAuth, validate(changePasswordSchema), changePasswordController);

const adminRouter = express.Router();

adminRouter.get("/roles", requirePageAccess("roles"), (req, res) => {
  res.status(200).json({ ok: true, roles: ["Administrator", "ContentManager", "Analyst", "Default"] });
});

adminRouter.get("/users", requirePageAccess("users"), requireRole("Administrator"), listUsersController);
adminRouter.post("/users", requirePageAccess("users"), requireRole("Administrator"), validate(createAdminUserSchema), createAdminUserController);
adminRouter.put("/users/:id", requirePageAccess("users"), requireRole("Administrator"), updateAdminUserController);

module.exports = { authRouter, adminRouter };
