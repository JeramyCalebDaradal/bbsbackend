const { z } = require("zod");

const createAppointmentSchema = z.object({
  full_name: z.string().min(1).max(255).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  contact_number: z.string().min(1).max(50).trim(),
  service: z.enum([
    "Security Assessment",
    "Penetration Testing",
    "Compliance Consultation",
    "Annual Security Review",
    "Risk Assessment",
  ]),
  date_set: z.string().min(1).max(50).trim(),
  time_set: z.string().min(1).max(50).trim(),
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]).optional().default("pending"),
  location: z.string().min(1).max(500).trim(),
  duration: z.number().int().nonnegative().optional().default(0),
  notes: z.string().max(2000).optional().default(""),
  added_by: z.number().int().positive(),
});

const updateAppointmentSchema = z.object({
  full_name: z.string().min(1).max(255).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  contact_number: z.string().min(1).max(50).trim(),
  service: z.enum([
    "Security Assessment",
    "Penetration Testing",
    "Compliance Consultation",
    "Annual Security Review",
    "Risk Assessment",
  ]),
  date_set: z.string().min(1).max(50).trim(),
  time_set: z.string().min(1).max(50).trim(),
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]).optional().default("pending"),
  location: z.string().min(1).max(500).trim(),
  duration: z.number().int().nonnegative().optional().default(0),
  notes: z.string().max(2000).optional().default(""),
});

module.exports = { createAppointmentSchema, updateAppointmentSchema };