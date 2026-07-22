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
const { requireAuth } = require("../../middleware/requireAuth");
const { requireRole } = require("../../middleware/requireRole");
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

adminRouter.get("/roles", (req, res) => {
  const isSuperAdmin = String(req.userRole || "") === "Super Admin";
  res.status(200).json({ ok: true, roles: isSuperAdmin ? ROLES : ADMIN_CREATABLE_ROLES });
});

adminRouter.get("/users", requireAuth, requireRole("Super Admin"), listUsersController);
adminRouter.post("/users", requireAuth, validate(createAdminUserSchema), createAdminUserController);
adminRouter.put("/users/:id", requireAuth, updateAdminUserController);

module.exports = { authRouter, adminRouter };