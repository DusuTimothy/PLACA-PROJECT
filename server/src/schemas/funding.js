'use strict';

/**
 * Funding source, inflow and allocation schemas.
 */

const { z } = require('zod');
const {
  uuid,
  optionalUuid,
  text,
  booleanish,
  money,
  dateOnly,
  optionalDateOnly,
  paginationQuery,
  emptyBody,
  emptyQuery,
  emptyParams,
} = require('./common');

const sourceTypes = ['government', 'donor', 'private', 'other'];
const allocationStatuses = ['planned', 'disbursed', 'closed'];

const sourceFields = {
  name: text(160).pipe(z.string().min(2, 'Enter a source name')),
  type: z.enum(sourceTypes),
  description: z.string().trim().max(2000).nullable().optional(),
  is_active: booleanish.default(true),
};

const createSource = z.object({
  body: z.object(sourceFields),
  query: emptyQuery,
  params: emptyParams,
});

const updateSource = z.object({
  body: z
    .object({
      name: sourceFields.name.optional(),
      type: sourceFields.type.optional(),
      description: sourceFields.description,
      is_active: sourceFields.is_active.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update'),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const listSources = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    type: z.enum(sourceTypes).optional(),
    active_only: z.enum(['true', 'false']).optional(),
    search: z.string().trim().max(120).optional(),
  }),
  params: emptyParams,
});

const sourceParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const inflowFields = {
  funding_source_id: uuid,
  amount: money,
  currency: z.string().trim().length(3).default('NGN'),
  received_on: dateOnly,
  purpose: z.string().trim().max(2000).nullable().optional(),
  reference: z.string().trim().max(120).nullable().optional(),
};

const createInflow = z.object({
  body: z.object(inflowFields),
  query: emptyQuery,
  params: emptyParams,
});

const updateInflow = z.object({
  body: z
    .object({
      funding_source_id: inflowFields.funding_source_id.optional(),
      amount: inflowFields.amount.optional(),
      currency: inflowFields.currency.optional(),
      received_on: inflowFields.received_on.optional(),
      purpose: inflowFields.purpose,
      reference: inflowFields.reference,
    })
    .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update'),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const listInflows = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    funding_source_id: uuid.optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }),
  params: emptyParams,
});

const inflowParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const allocationFields = {
  funding_source_id: optionalUuid,
  funding_inflow_id: optionalUuid,
  recipient_organization_id: optionalUuid,
  lga_id: optionalUuid,
  amount: money,
  currency: z.string().trim().length(3).default('NGN'),
  period: z
    .string()
    .trim()
    .min(4, 'Enter a period')
    .max(20, 'That period is too long')
    .regex(/^\d{4}(-Q[1-4]|-(0[1-9]|1[0-2]))?$/, 'Use 2026, 2026-Q4 or 2026-08'),
  purpose: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(allocationStatuses).default('planned'),
  disbursed_on: optionalDateOnly,
};

const createAllocation = z.object({
  body: z
    .object(allocationFields)
    .refine(
      (value) => value.recipient_organization_id || value.lga_id,
      'Choose a recipient organization or an LGA'
    ),
  query: emptyQuery,
  params: emptyParams,
});

const updateAllocation = z.object({
  body: z
    .object({
      funding_source_id: allocationFields.funding_source_id,
      funding_inflow_id: allocationFields.funding_inflow_id,
      recipient_organization_id: allocationFields.recipient_organization_id,
      lga_id: allocationFields.lga_id,
      amount: allocationFields.amount.optional(),
      currency: allocationFields.currency.optional(),
      period: allocationFields.period.optional(),
      purpose: allocationFields.purpose,
      status: allocationFields.status.optional(),
      disbursed_on: allocationFields.disbursed_on,
    })
    .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update'),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const listAllocations = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    period: z.string().trim().max(20).optional(),
    lga_id: uuid.optional(),
    organization_id: uuid.optional(),
    status: z.enum(allocationStatuses).optional(),
    funding_source_id: uuid.optional(),
  }),
  params: emptyParams,
});

const allocationParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const summaryQuery = z.object({
  body: emptyBody,
  query: z.object({
    period: z.string().trim().max(20).optional(),
  }),
  params: emptyParams,
});

module.exports = {
  createSource,
  updateSource,
  listSources,
  sourceParams,
  createInflow,
  updateInflow,
  listInflows,
  inflowParams,
  createAllocation,
  updateAllocation,
  listAllocations,
  allocationParams,
  summaryQuery,
  sourceTypes,
  allocationStatuses,
};
