'use strict';

/**
 * User administration schemas.
 */

const { z } = require('zod');
const {
  uuid,
  email,
  phone,
  optionalPhone,
  name,
  language,
  paginationQuery,
  emptyBody,
  emptyQuery,
  emptyParams,
  roleEnum,
} = require('./common');

const createUser = z.object({
  body: z
    .object({
      name,
      email: email.optional(),
      phone: phone.optional(),
      role: roleEnum,
      lga_id: uuid.optional(),
      organization_id: uuid.optional(),
      language: language.default('en'),
      send_email: z.boolean().default(true),
    })
    .superRefine((value, ctx) => {
      if (!value.email && !value.phone) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['email'],
          message: 'Enter an email address or a phone number',
        });
      }
      if (value.role === 'partner_staff' && !value.organization_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['organization_id'],
          message: 'Partner staff must belong to an organization',
        });
      }
      if (value.role === 'laca_officer' && !value.lga_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['lga_id'],
          message: 'A LACA officer must belong to an LGA',
        });
      }
      if (['placa_officer', 'placa_director'].includes(value.role) && value.organization_id) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['organization_id'],
          message: 'PLACA staff are not linked to a partner organization',
        });
      }
    }),
  query: emptyQuery,
  params: emptyParams,
});

const listUsers = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    role: roleEnum.optional(),
    lga_id: uuid.optional(),
    organization_id: uuid.optional(),
    is_active: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
    search: z.string().trim().max(120).optional(),
  }),
  params: emptyParams,
});

const userParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const updateUser = z.object({
  body: z
    .object({
      name: name.optional(),
      email: email.nullable().optional(),
      phone: optionalPhone.optional(),
      language: language.optional(),
      role: roleEnum.optional(),
      lga_id: uuid.nullable().optional(),
      organization_id: uuid.nullable().optional(),
      is_active: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update'),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const resetUserPassword = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const resendInvitation = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

module.exports = {
  createUser,
  listUsers,
  userParams,
  updateUser,
  resetUserPassword,
  resendInvitation,
};
