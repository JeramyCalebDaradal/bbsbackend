const { z } = require("zod");

const createEventSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  preview_image: z.string().max(500).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1).max(50).trim(),
  location_type: z.enum(["online", "in person"]),
  location_address: z.string().min(1).max(500).trim(),
  description: z.string().min(1).trim(),
  category: z.string().min(1).max(100).trim(),
  capacity: z.number().int().nonnegative(),
  paid_event: z.boolean().optional().default(false),
  tags: z
    .union([z.array(z.string().min(1)), z.string()])
    .optional()
    .default([]),
  created_by: z.number().int().positive(),
});

const updateEventSchema = z.object({
  title: z.string().min(1).max(255).trim(),
  preview_image: z.string().max(500).optional().default(""),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().min(1).max(50).trim(),
  location_type: z.enum(["online", "in person"]),
  location_address: z.string().min(1).max(500).trim(),
  description: z.string().min(1).trim(),
  category: z.string().min(1).max(100).trim(),
  capacity: z.number().int().nonnegative(),
  paid_event: z.boolean().optional().default(false),
  tags: z
    .union([z.array(z.string().min(1)), z.string()])
    .optional()
    .default([]),
});

const registerForEventSchema = z.object({
  first_name: z.string().min(1).max(100).trim(),
  last_name: z.string().min(1).max(100).trim(),
  email: z.string().email().max(255).trim().toLowerCase(),
  contact_number: z.string().min(1).max(50).trim(),
});

module.exports = { createEventSchema, updateEventSchema, registerForEventSchema };