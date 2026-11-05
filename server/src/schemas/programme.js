'use strict';

/**
 * Welfare / campaign programme schemas.
 */

const { z } = require('zod');
const {
  uuid,
  optionalUuid,
  text,
  optionalDateOnly,
  paginationQuery,
  emptyBody,
  emptyQuery,
  emptyParams,
} = require('./common');

const kinds = ['skills_training', 'orphan_support', 'stigma_support', 'testing_campaign'];
const statuses = ['planned', 'active', 'completed', 'cancelled'];

const programmeFields = {
  kind: z.enum(kinds),
  name: text(200).pipe(z.string().min(2, 'Enter a programme name')),
  description: z.string().trim().max(4000).nullable().optional(),
  lga_id: uuid,
  organization_id: optionalUuid,
  start_date: optionalDateOnly,
  end_date: optionalDateOnly,
  status: z.enum(statuses).default('planned'),
};

function checkDates(value, ctx) {
  if (value.start_date && value.end_date && value.end_date < value.start_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['end_date'],
      message: 'The end date cannot be before the start date.',
    });
  }
}

const createProgramme = z.object({
  body: z.object(programmeFields).superRefine(checkDates),
  query: emptyQuery,
  params: emptyParams,
});

const updateProgramme = z.object({
  body: z
    .object({
      kind: programmeFields.kind.optional(),
      name: programmeFields.name.optional(),
      description: programmeFields.description,
      lga_id: programmeFields.lga_id.optional(),
      organization_id: programmeFields.organization_id,
      start_date: programmeFields.start_date,
      end_date: programmeFields.end_date,
      status: programmeFields.status.optional(),
    })
    .refine((value) => Object.keys(value).length > 0, 'Provide at least one field to update')
    .superRefine(checkDates),
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const listProgrammes = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    kind: z.enum(kinds).optional(),
    status: z.enum(statuses).optional(),
    lga_id: uuid.optional(),
    organization_id: uuid.optional(),
    search: z.string().trim().max(120).optional(),
  }),
  params: emptyParams,
});

const programmeParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

module.exports = {
  createProgramme,
  updateProgramme,
  listProgrammes,
  programmeParams,
  kinds,
  statuses,
};
