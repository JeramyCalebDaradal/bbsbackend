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
const { ADMIN_CREATABLE_ROLES } = require("../../constants/roles");
const { requireAuth } = require("../../middleware/requireAuth");

const authRouter = express.Router();

authRouter.post("/login", loginController);
authRouter.get("/me", requireAuth, meController);
authRouter.post("/super-admin", createSuperAdminController);
authRouter.put("/profile", requireAuth, updateProfileController);
authRouter.put("/password", requireAuth, changePasswordController);

const adminRouter = express.Router();

adminRouter.get("/roles", (req, res) => {
  res.status(200).json({ ok: true, roles: ADMIN_CREATABLE_ROLES });
});

adminRouter.get("/users", listUsersController);
adminRouter.post("/users", createAdminUserController);
adminRouter.put("/users/:id", updateAdminUserController);

module.exports = { authRouter, adminRouter };
