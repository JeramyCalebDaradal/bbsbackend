const { z } = require("zod");

const createLeadSchema = z.object({
  full_name: z.string().min(1).max(255).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  contact: z.string().min(1).max(50).trim(),
  source: z.enum([
    "Website contact",
    "Event Registration",
    "Newsletter signup",
    "Referral",
    "LinkedIn",
    "Appointment",
  ]),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional().default("new"),
  follow_up: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .default(null),
  notes: z.string().max(2000).optional().default(""),
  added_by: z.number().int().positive(),
});

const updateLeadSchema = z.object({
  full_name: z.string().min(1).max(255).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  contact: z.string().min(1).max(50).trim(),
  source: z.enum([
    "Website contact",
    "Event Registration",
    "Newsletter signup",
    "Referral",
    "LinkedIn",
    "Appointment",
  ]),
  status: z.enum(["new", "contacted", "qualified", "converted", "lost"]).optional().default("new"),
  follow_up: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .default(null),
  notes: z.string().max(2000).optional().default(""),
});

module.exports = { createLeadSchema, updateLeadSchema };