const express = require("express");
const {
  changePasswordController,
  createAdminUserController,
  createSuperAdminController,
  loginController,
  meController,
  listUsersController,
  updateAdminUserController,
  updateProfileController,
} = require("./auth.controller");
const { ADMIN_CREATABLE_ROLES, ROLES } = require("../../constants/roles");
const { requireAuth } = require("../../middleware/requireAuth");

const authRouter = express.Router();

authRouter.post("/login", loginController);
authRouter.get("/me", requireAuth, meController);
function optionalAuth(req, res, next) {
  const header = String(req.headers?.authorization || "");
  if (!header.toLowerCase().startsWith("bearer ")) return next();
  return requireAuth(req, res, next);
}

authRouter.post("/super-admin", optionalAuth, createSuperAdminController);
authRouter.put("/profile", requireAuth, updateProfileController);
authRouter.put("/password", requireAuth, changePasswordController);

const adminRouter = express.Router();

adminRouter.get("/roles", (req, res) => {
  const isSuperAdmin = String(req.userRole || "") === "Super Admin";
  res.status(200).json({ ok: true, roles: isSuperAdmin ? ROLES : ADMIN_CREATABLE_ROLES });
});

adminRouter.get("/users", listUsersController);
adminRouter.post("/users", createAdminUserController);
adminRouter.put("/users/:id", updateAdminUserController);

module.exports = { authRouter, adminRouter };
