const { z } = require("zod");

const loginSchema = z.object({
  email: z.string().email().max(255).trim().toLowerCase(),
  password: z.string().min(1).max(255),
});

const createSuperAdminSchema = z.object({
  first_name: z.string().min(1).max(100).trim(),
  last_name: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  password: z.string().max(255).optional().default(""),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

const createAdminUserSchema = z.object({
  first_name: z.string().min(1).max(100).trim(),
  last_name: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  password: z.string().max(255).optional().default(""),
  role: z.string().min(1).max(50).trim(),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

const updateProfileSchema = z.object({
  first_name: z.string().min(1).max(100).trim(),
  last_name: z.string().min(1).max(100).trim(),
});

const changePasswordSchema = z.object({
  current_password: z.string().min(1).max(255),
  new_password: z.string().min(1).max(255),
});

module.exports = {
  loginSchema,
  createSuperAdminSchema,
  createAdminUserSchema,
  updateProfileSchema,
  changePasswordSchema,
};