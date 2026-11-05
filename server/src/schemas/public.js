'use strict';

/**
 * Public (no-login) query schemas.
 *
 * Keep these narrow: the public endpoint is the only API surface that does not
 * require a session, so it accepts only two short optional filters.
 */

const { z } = require('zod');
const { emptyBody, emptyParams } = require('./common');

const summary = z.object({
  body: emptyBody,
  query: z.object({
    period: z.string().trim().max(20).optional(),
    indicator: z.string().trim().max(40).optional(),
  }),
  params: emptyParams,
});

module.exports = { summary };
