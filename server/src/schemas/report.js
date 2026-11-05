'use strict';

/**
 * Report schemas.
 */

const { z } = require('zod');
const {
  uuid,
  paginationQuery,
  emptyBody,
  emptyQuery,
  emptyParams,
} = require('./common');

const statuses = ['draft', 'submitted', 'validated', 'returned', 'aggregated'];
const periodTypes = ['monthly', 'quarterly', 'annual'];

const value = z.object({
  indicator_id: uuid,
  disaggregation_key: z
    .string()
    .trim()
    .min(1, 'Choose a breakdown')
    .max(120, 'That breakdown is too long')
    .default('total'),
  value: z.coerce
    .number()
    .int('Use a whole number')
    .min(0, 'A count cannot be below zero')
    .max(1000000, 'That count is too large'),
});

function checkPeriod(value, ctx) {
  if (value.period_type === 'quarterly' && (value.period_number < 1 || value.period_number > 4)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['period_number'],
      message: 'A quarterly report must be for quarter 1, 2, 3 or 4.',
    });
  }
  if (value.period_type === 'annual' && value.period_number !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['period_number'],
      message: 'An annual report always uses period 1.',
    });
  }
}

const createReport = z.object({
  body: z
    .object({
      client_uuid: uuid,
      programme_id: uuid.nullable().optional(),
      period_type: z.enum(periodTypes),
      period_year: z.coerce.number().int().min(2000).max(2100),
      period_number: z.coerce.number().int().min(1).max(12),
      values: z.array(value).max(500, 'A report cannot hold more than 500 numbers').default([]),
    })
    .superRefine(checkPeriod),
  query: emptyQuery,
  params: emptyParams,
});

const updateReport = z.object({
  body: z
    .object({
      programme_id: uuid.nullable().optional(),
      values: z.array(value).max(500, 'A report cannot hold more than 500 numbers').optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update'),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const listReports = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    organization_id: uuid.optional(),
    lga_id: uuid.optional(),
    status: z.enum(statuses).optional(),
    period_type: z.enum(periodTypes).optional(),
    period_year: z.coerce.number().int().min(2000).max(2100).optional(),
    period_number: z.coerce.number().int().min(1).max(12).optional(),
  }),
  params: emptyParams,
});

const exportReports = z.object({
  body: emptyBody,
  query: z.object({
    organization_id: uuid.optional(),
    lga_id: uuid.optional(),
    status: z.enum(statuses).optional(),
    period_type: z.enum(periodTypes).optional(),
    period_year: z.coerce.number().int().min(2000).max(2100).optional(),
    period_number: z.coerce.number().int().min(1).max(12).optional(),
  }),
  params: emptyParams,
});

const reportParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const reviewReport = z.object({
  body: z
    .object({
      decision: z.enum(['validate', 'return']),
      reason: z.string().trim().max(1000).optional(),
    })
    .superRefine((value, ctx) => {
      if (value.decision === 'return' && !value.reason) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['reason'],
          message: 'Tell the partner what to correct.',
        });
      }
    }),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

module.exports = {
  createReport,
  updateReport,
  listReports,
  exportReports,
  reportParams,
  reviewReport,
  statuses,
  periodTypes,
};
