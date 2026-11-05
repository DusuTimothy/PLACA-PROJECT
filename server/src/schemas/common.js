'use strict';

/**
 * Reusable Zod pieces. Keeping password and contact rules here means the API
 * and the client can mirror exactly the same policy.
 */

const { z } = require('zod');
const { normalizePhone, isValidPhone } = require('../utils/phone');

const uuid = z.string().uuid('Must be a valid id');

const email = z
  .string()
  .trim()
  .email('Enter a valid email address')
  .max(190, 'Email is too long')
  .transform((value) => value.toLowerCase());

const phone = z
  .string()
  .trim()
  .transform((value) => normalizePhone(value))
  .refine((value) => isValidPhone(value), 'Enter a valid Nigerian phone number');

const optionalPhone = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (value ? normalizePhone(value) : null))
  .refine((value) => value === null || isValidPhone(value), 'Enter a valid Nigerian phone number');

const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use no more than 72 characters')
  .regex(/[A-Z]/, 'Add at least one capital letter')
  .regex(/[a-z]/, 'Add at least one small letter')
  .regex(/[0-9]/, 'Add at least one number');

const name = z.string().trim().min(2, 'Enter a name').max(160, 'Name is too long');

const language = z.enum(['en', 'ha']);

const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const emptyQuery = z.object({}).default({});
const emptyParams = z.object({}).default({});
const emptyBody = z.object({}).default({});

const roleEnum = z.enum([
  'partner_staff',
  'laca_officer',
  'placa_officer',
  'placa_director',
  'admin',
]);

const optionalUuid = z.union([uuid, z.null(), z.undefined()]);

const dateOnly = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD form');

const optionalDateOnly = z.union([dateOnly, z.null(), z.undefined()]);

const money = z.coerce
  .number()
  .min(0, 'An amount cannot be below zero')
  .max(999999999999.99, 'That amount is too large');

// Multipart forms send "true"/"false" as text, while JSON sends real booleans.
const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

const text = (max = 2000) => z.string().trim().max(max, `Use no more than ${max} characters`);

const key = z
  .string()
  .trim()
  .min(2, 'Enter a key')
  .max(80, 'That key is too long')
  .regex(/^[a-z0-9_.-]+$/, 'Use lower-case letters, numbers, dots, dashes or underscores');

module.exports = {
  z,
  uuid,
  optionalUuid,
  email,
  phone,
  optionalPhone,
  password,
  name,
  language,
  dateOnly,
  optionalDateOnly,
  money,
  booleanish,
  text,
  key,
  paginationQuery,
  emptyQuery,
  emptyParams,
  emptyBody,
  roleEnum,
};
