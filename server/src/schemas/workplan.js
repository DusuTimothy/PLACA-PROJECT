'use strict';

/**
 * Workplan schemas.
 */

const { z } = require('zod');
const {
  uuid,
  paginationQuery,
  emptyBody,
  emptyQuery,
  emptyParams,
} = require('./common');

const statuses = ['draft', 'submitted', 'approved', 'returned'];

const target = z.object({
  indicator_id: uuid,
  lga_id: uuid,
  target_value: z.coerce
    .number()
    .int('Use a whole number')
    .min(0, 'A target cannot be below zero')
    .max(1000000, 'That target is too large'),
});

const targets = z
  .array(target)
  .max(300, 'A workplan cannot hold more than 300 targets')
  .default([]);

const createWorkplan = z.object({
  body: z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    quarter: z.coerce.number().int().min(1).max(4),
    targets,
  }),
  query: emptyQuery,
  params: emptyParams,
});

const updateWorkplan = z.object({
  body: z
    .object({
      targets: z.array(target).max(300, 'A workplan cannot hold more than 300 targets'),
    })
    .refine((value) => value.targets !== undefined, 'Provide the targets to save'),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const listWorkplans = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    organization_id: uuid.optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    quarter: z.coerce.number().int().min(1).max(4).optional(),
    status: z.enum(statuses).optional(),
    lga_id: uuid.optional(),
  }),
  params: emptyParams,
});

const workplanParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const reviewDecision = z.enum(['approve', 'return']);

const reviewWorkplan = z.object({
  body: z
    .object({
      decision: reviewDecision,
      note: z.string().trim().max(1000).optional(),
    })
    .superRefine((value, ctx) => {
      if (value.decision === 'return' && !value.note) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['note'],
          message: 'Explain what the partner needs to change.',
        });
      }
    }),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

module.exports = {
  createWorkplan,
  updateWorkplan,
  listWorkplans,
  workplanParams,
  reviewWorkplan,
  statuses,
};
