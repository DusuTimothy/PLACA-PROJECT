'use strict';

/**
 * Aggregation schemas (Phase 4).
 *
 * One request publishes exactly one period. Publishing everything by hand is a
 * separate, explicit action (`aggregatePending`) so an officer can never widen
 * the request by accident.
 */

const { z } = require('zod');
const { emptyBody, emptyParams, emptyQuery } = require('./common');

const periodTypes = ['monthly', 'quarterly', 'annual'];

function checkPeriod(value, ctx) {
  if (value.period_type === 'quarterly' && (value.period_number < 1 || value.period_number > 4)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['period_number'],
      message: 'A quarterly period must be quarter 1, 2, 3 or 4.',
    });
  }
  if (value.period_type === 'annual' && value.period_number !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['period_number'],
      message: 'An annual period always uses period 1.',
    });
  }
}

const runAggregation = z.object({
  body: z
    .object({
      period_type: z.enum(periodTypes),
      period_year: z.coerce.number().int().min(2000).max(2100),
      period_number: z.coerce.number().int().min(1).max(12),
    })
    .superRefine(checkPeriod),
  query: emptyQuery,
  params: emptyParams,
});

const aggregationStatus = z.object({
  body: emptyBody,
  query: z.object({
    period: z
      .string()
      .trim()
      .regex(/^\d{4}(-Q[1-4]|-\d{2})?$/, 'Use a period like 2026, 2026-Q1 or 2026-02')
      .optional(),
  }),
  params: emptyParams,
});

module.exports = { runAggregation, aggregationStatus, periodTypes };
