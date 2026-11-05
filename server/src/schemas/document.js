'use strict';

/**
 * Resource-library document schemas.
 *
 * The file itself is validated by the upload middleware. These schemas only
 * cover the metadata that is stored in PostgreSQL.
 */

const { z } = require('zod');
const {
  uuid,
  language,
  text,
  booleanish,
  paginationQuery,
  emptyBody,
  emptyQuery,
  emptyParams,
} = require('./common');

const categories = ['guideline', 'training_material', 'workplan', 'policy'];

const documentFields = {
  title: text(200).pipe(z.string().min(2, 'Enter a title')),
  category: z.enum(categories),
  language,
  is_public: booleanish.default(false),
};

const createDocument = z.object({
  body: z.object(documentFields),
  query: emptyQuery,
  params: emptyParams,
});

const updateDocument = z.object({
  body: z
    .object({
      title: documentFields.title.optional(),
      category: documentFields.category.optional(),
      language: documentFields.language.optional(),
      is_public: documentFields.is_public.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update'),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const listDocuments = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    category: z.enum(categories).optional(),
    language: language.optional(),
    search: z.string().trim().max(120).optional(),
  }),
  params: emptyParams,
});

const documentParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

module.exports = {
  createDocument,
  updateDocument,
  listDocuments,
  documentParams,
  categories,
};
