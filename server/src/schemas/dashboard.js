'use strict';

/**
 * Dashboard schemas (Phase 4).
 */

const { z } = require('zod');
const { emptyBody, emptyParams } = require('./common');

const overview = z.object({
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

module.exports = { overview };
