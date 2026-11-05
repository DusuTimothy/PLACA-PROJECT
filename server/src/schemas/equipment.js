'use strict';

/**
 * Equipment catalogue and stock schemas.
 */

const { z } = require('zod');
const {
  uuid,
  optionalUuid,
  text,
  booleanish,
  paginationQuery,
  emptyBody,
  emptyQuery,
  emptyParams,
} = require('./common');

const itemFields = {
  name: text(160).pipe(z.string().min(2, 'Enter an item name')),
  description: z.string().trim().max(2000).nullable().optional(),
  unit: text(40).default('unit'),
  is_active: booleanish.default(true),
};

const createItem = z.object({
  body: z.object(itemFields),
  query: emptyQuery,
  params: emptyParams,
});

const updateItem = z.object({
  body: z
    .object({
      name: itemFields.name.optional(),
      description: itemFields.description,
      unit: itemFields.unit.optional(),
      is_active: itemFields.is_active.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update'),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const listItems = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    active_only: z.enum(['true', 'false']).optional(),
    search: z.string().trim().max(120).optional(),
  }),
  params: emptyParams,
});

const itemParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const listStock = z.object({
  body: emptyBody,
  query: z.object({
    lga_id: optionalUuid,
  }),
  params: emptyParams,
});

const setStock = z.object({
  body: z.object({
    lga_id: optionalUuid,
    quantity: z.coerce
      .number()
      .int('Use a whole number')
      .min(0, 'Stock cannot be below zero')
      .max(100000000, 'That stock figure is too large'),
  }),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

module.exports = {
  createItem,
  updateItem,
  listItems,
  itemParams,
  listStock,
  setStock,
};
