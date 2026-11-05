'use strict';

/**
 * Guide and help-content schemas.
 */

const { z } = require('zod');
const {
  uuid,
  key,
  language,
  text,
  booleanish,
  paginationQuery,
  emptyBody,
  emptyQuery,
  emptyParams,
  roleEnum,
} = require('./common');

const audienceRoles = z.array(roleEnum).max(5).default([]);

const guideFields = {
  key,
  language,
  title: text(200).pipe(z.string().min(2, 'Enter a title')),
  body_md: z.string().trim().min(10, 'Write the guide body').max(20000, 'That guide is too long'),
  audience_roles: audienceRoles,
  page_key: z.string().trim().max(80).nullable().optional(),
  field_key: z.string().trim().max(80).nullable().optional(),
  sort_order: z.coerce.number().int().min(0).max(100000).default(0),
  is_published: booleanish.default(true),
};

const createGuide = z.object({
  body: z.object(guideFields),
  query: emptyQuery,
  params: emptyParams,
});

const updateGuide = z.object({
  body: z
    .object({
      key: guideFields.key.optional(),
      language: guideFields.language.optional(),
      title: guideFields.title.optional(),
      body_md: guideFields.body_md.optional(),
      audience_roles: guideFields.audience_roles.optional(),
      page_key: guideFields.page_key,
      field_key: guideFields.field_key,
      sort_order: guideFields.sort_order.optional(),
      is_published: guideFields.is_published.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update'),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const listGuides = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    language: language.optional(),
    page_key: z.string().trim().max(80).optional(),
    field_key: z.string().trim().max(80).optional(),
    search: z.string().trim().max(120).optional(),
    manage: z.enum(['true', 'false']).optional(),
  }),
  params: emptyParams,
});

const guideParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ key: z.string().trim().min(2).max(80) }),
});

const guideIdParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const progressBody = z.object({
  body: z
    .object({
      completed: z.boolean().optional(),
      dismissed: z.boolean().optional(),
    })
    .refine(
      (value) => value.completed !== undefined || value.dismissed !== undefined,
      'Provide completed or dismissed'
    ),
  query: emptyQuery,
  params: z.object({ key: z.string().trim().min(2).max(80) }),
});

module.exports = {
  createGuide,
  updateGuide,
  listGuides,
  guideParams,
  guideIdParams,
  progressBody,
};
