'use strict';

/**
 * Organization schemas.
 */

const { z } = require('zod');
const {
  uuid,
  email,
  optionalPhone,
  name,
  paginationQuery,
  emptyBody,
  emptyQuery,
  emptyParams,
} = require('./common');

const organizationTypes = [
  'ngo',
  'cbo',
  'faith_based',
  'private_sector',
  'government_mda',
  'laca',
];

const organizationStatuses = ['pending', 'approved', 'suspended'];

const focusAreas = z
  .array(z.string().trim().min(1).max(60))
  .max(12, 'Choose no more than 12 focus areas')
  .default([]);

const fields = {
  name,
  type: z.enum(organizationTypes),
  lga_id: uuid,
  focus_areas: focusAreas,
  contact_name: z.string().trim().max(160).nullable().optional(),
  contact_phone: optionalPhone.optional(),
  contact_email: email.nullable().optional(),
};

const createOrganization = z.object({
  body: z.object({
    name: fields.name,
    type: fields.type,
    lga_id: fields.lga_id,
    focus_areas: fields.focus_areas,
    contact_name: fields.contact_name,
    contact_phone: fields.contact_phone,
    contact_email: fields.contact_email,
  }),
  query: emptyQuery,
  params: emptyParams,
});

const updateOrganization = z.object({
  body: z
    .object({
      name: fields.name.optional(),
      type: fields.type.optional(),
      lga_id: fields.lga_id.optional(),
      focus_areas: focusAreas.optional(),
      contact_name: fields.contact_name,
      contact_phone: fields.contact_phone,
      contact_email: fields.contact_email,
    })
    .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update'),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const listOrganizations = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    status: z.enum(organizationStatuses).optional(),
    type: z.enum(organizationTypes).optional(),
    lga_id: uuid.optional(),
    search: z.string().trim().max(120).optional(),
  }),
  params: emptyParams,
});

const organizationParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const reviewOrganization = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

module.exports = {
  createOrganization,
  updateOrganization,
  listOrganizations,
  organizationParams,
  reviewOrganization,
  organizationTypes,
  organizationStatuses,
};
