'use strict';

/**
 * Reference-data and audit-log query schemas.
 */

const { z } = require('zod');
const {
  uuid,
  paginationQuery,
  emptyBody,
  emptyParams,
} = require('./common');

const listLgas = z.object({
  body: emptyBody,
  query: z.object({}).default({}),
  params: emptyParams,
});

const listIndicators = z.object({
  body: emptyBody,
  query: z.object({
    category: z.enum(['reach', 'testing', 'referral', 'welfare', 'training']).optional(),
    is_active: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
    search: z.string().trim().max(120).optional(),
  }),
  params: emptyParams,
});

const listAuditLogs = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    action: z.string().trim().max(40).optional(),
    entity: z.string().trim().max(60).optional(),
    entity_id: z.string().trim().max(64).optional(),
    user_id: uuid.optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }),
  params: emptyParams,
});

module.exports = { listLgas, listIndicators, listAuditLogs };
