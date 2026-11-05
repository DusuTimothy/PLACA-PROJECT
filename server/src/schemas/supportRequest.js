'use strict';

/**
 * Support request schemas.
 */

const { z } = require('zod');
const {
  uuid,
  optionalUuid,
  text,
  dateOnly,
  paginationQuery,
  emptyBody,
  emptyQuery,
  emptyParams,
} = require('./common');

const kinds = ['equipment', 'training', 'technical'];
const statuses = ['requested', 'approved', 'rejected', 'in_transit', 'delivered', 'closed'];

const requestItem = z.object({
  equipment_item_id: uuid,
  qty_requested: z.coerce
    .number()
    .int('Use a whole number')
    .min(1, 'Ask for at least one item')
    .max(1000000, 'That quantity is too large'),
});

const createRequest = z.object({
  body: z
    .object({
      client_uuid: uuid,
      kind: z.enum(kinds),
      description: z
        .string()
        .trim()
        .min(10, 'Explain what you need in a sentence or two')
        .max(4000, 'That description is too long'),
      items: z.array(requestItem).max(50, 'A request cannot hold more than 50 items').default([]),
    })
    .superRefine((value, ctx) => {
      if (value.kind === 'equipment' && value.items.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items'],
          message: 'Add at least one equipment item.',
        });
      }
      if (value.kind !== 'equipment' && value.items.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items'],
          message: 'Only equipment requests can list items.',
        });
      }
      const seen = new Set();
      for (const item of value.items) {
        if (seen.has(item.equipment_item_id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items'],
            message: 'Each item can appear only once.',
          });
          break;
        }
        seen.add(item.equipment_item_id);
      }
    }),
  query: emptyQuery,
  params: emptyParams,
});

const listRequests = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    status: z.enum(statuses).optional(),
    kind: z.enum(kinds).optional(),
    organization_id: uuid.optional(),
    lga_id: uuid.optional(),
    search: z.string().trim().max(120).optional(),
  }),
  params: emptyParams,
});

const requestParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const decisionItem = z.object({
  id: uuid,
  qty_approved: z.coerce.number().int().min(0).max(1000000),
});

const decideRequest = z.object({
  body: z
    .object({
      decision: z.enum(['approve', 'reject']),
      note: z.string().trim().max(2000).optional(),
      items: z.array(decisionItem).max(50).optional(),
    })
    .superRefine((value, ctx) => {
      if (value.decision === 'reject' && !value.note) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['note'],
          message: 'Explain why the request was rejected.',
        });
      }
    }),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const supplyItem = z.object({
  support_request_item_id: uuid,
  qty_delivered: z.coerce.number().int().min(1).max(1000000),
});

const recordSupply = z.object({
  body: z.object({
    items: z.array(supplyItem).min(1, 'Add at least one delivered item').max(50),
    delivered_at: dateOnly.optional(),
    note: z.string().trim().max(2000).optional(),
  }),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const changeStatus = z.object({
  body: z.object({
    status: z.enum(['in_transit', 'delivered', 'closed']),
    note: z.string().trim().max(2000).optional(),
  }),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

module.exports = {
  createRequest,
  listRequests,
  requestParams,
  decideRequest,
  recordSupply,
  changeStatus,
  kinds,
  statuses,
};
