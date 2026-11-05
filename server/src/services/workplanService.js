'use strict';

/**
 * Quarterly workplans and their targets.
 *
 * Partners author and submit a plan; PLACA officers approve it or return it
 * with a note. LACA officers and PLACA staff read plans in their area. A
 * returned plan is edited and resubmitted in place, so targets stay comparable
 * with the reports for the same quarter.
 */

const { Op } = require('sequelize');
const {
  Workplan,
  WorkplanTarget,
  Organization,
  Indicator,
  Lga,
  User,
  sequelize,
} = require('../models');
const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { canAccessOrganization } = require('../middleware/ownership');
const { ROLES, PLACA_ROLES } = require('../middleware/rbac');
const { recordAudit } = require('./auditService');
const { findOrganizationOrThrow } = require('./organizationService');

const ORGANIZATION_INCLUDE = {
  model: Organization,
  as: 'organization',
  attributes: ['id', 'name', 'lga_id', 'status'],
  include: [{ model: Lga, as: 'lga', attributes: ['id', 'name'] }],
};

const TARGET_INCLUDE = [
  {
    model: Indicator,
    as: 'indicator',
    attributes: ['id', 'code', 'name', 'unit', 'category'],
  },
  { model: Lga, as: 'lga', attributes: ['id', 'name'] },
];

const WORKPLAN_INCLUDE = [
  ORGANIZATION_INCLUDE,
  { model: User, as: 'creator', attributes: ['id', 'name'] },
  {
    model: WorkplanTarget,
    as: 'targets',
    include: TARGET_INCLUDE,
  },
];

function plain(instance) {
  return instance && instance.toJSON ? instance.toJSON() : instance;
}

function serializeTarget(target) {
  const value = plain(target);
  return {
    id: value.id,
    indicator_id: value.indicator_id,
    lga_id: value.lga_id,
    target_value: value.target_value,
    indicator: value.indicator
      ? {
          id: value.indicator.id,
          code: value.indicator.code,
          name: value.indicator.name,
          unit: value.indicator.unit,
          category: value.indicator.category,
        }
      : null,
    lga: value.lga ? { id: value.lga.id, name: value.lga.name } : null,
  };
}

function serializeWorkplan(instance) {
  const workplan = plain(instance);
  if (!workplan) return null;

  return {
    id: workplan.id,
    organization_id: workplan.organization_id,
    year: workplan.year,
    quarter: workplan.quarter,
    status: workplan.status,
    submitted_at: workplan.submitted_at,
    approved_by: workplan.approved_by,
    approved_at: workplan.approved_at,
    review_note: workplan.review_note,
    created_by: workplan.created_by,
    created_at: workplan.createdAt,
    updated_at: workplan.updatedAt,
    organization: workplan.organization
      ? {
          id: workplan.organization.id,
          name: workplan.organization.name,
          lga_id: workplan.organization.lga_id,
          status: workplan.organization.status,
          lga: workplan.organization.lga
            ? { id: workplan.organization.lga.id, name: workplan.organization.lga.name }
            : null,
        }
      : null,
    creator: workplan.creator
      ? { id: workplan.creator.id, name: workplan.creator.name }
      : null,
    targets: (workplan.targets || [])
      .map(serializeTarget)
      .sort((left, right) => {
        const byCode = (left.indicator?.code || '').localeCompare(right.indicator?.code || '');
        return byCode || (left.lga?.name || '').localeCompare(right.lga?.name || '');
      }),
  };
}

function isPlaca(actor) {
  return PLACA_ROLES.includes(actor.role);
}

async function findWorkplanOrThrow(id, options = {}) {
  const workplan = await Workplan.findByPk(id, {
    include: WORKPLAN_INCLUDE,
    ...options,
  });
  if (!workplan) {
    throw AppError.notFound('WORKPLAN_NOT_FOUND', 'That workplan does not exist.');
  }
  return workplan;
}

function assertCanView(user, workplan) {
  if (!canAccessOrganization(user, workplan.organization)) {
    throw AppError.forbidden(
      'WORKPLAN_ACCESS_DENIED',
      'You can only view workplans for your own organization or LGA.'
    );
  }
}

function assertCanAuthor(user, workplan) {
  if (
    user.role !== ROLES.PARTNER_STAFF ||
    !user.organization_id ||
    workplan.organization_id !== user.organization_id
  ) {
    throw AppError.forbidden(
      'WORKPLAN_EDIT_DENIED',
      'Only staff of the organization that owns this workplan can edit it.'
    );
  }
}

async function validateTargets(actor, organization, targets) {
  if (!targets.length) return [];

  const indicatorIds = [...new Set(targets.map((target) => target.indicator_id))];
  const lgaIds = [...new Set(targets.map((target) => target.lga_id))];

  const [indicators, lgas] = await Promise.all([
    Indicator.findAll({
      where: { id: { [Op.in]: indicatorIds } },
      attributes: ['id', 'is_active'],
    }),
    Lga.findAll({ where: { id: { [Op.in]: lgaIds } }, attributes: ['id'] }),
  ]);

  const indicatorMap = new Map(indicators.map((indicator) => [indicator.id, indicator]));
  const lgaSet = new Set(lgas.map((lga) => lga.id));
  const seen = new Set();
  const clean = [];

  for (const target of targets) {
    const indicator = indicatorMap.get(target.indicator_id);
    if (!indicator) {
      throw AppError.badRequest(
        'INDICATOR_NOT_FOUND',
        'One of the indicators in this workplan does not exist.'
      );
    }
    if (!indicator.is_active) {
      throw AppError.badRequest(
        'INDICATOR_INACTIVE',
        'One of the indicators in this workplan has been retired. Remove it and choose another.'
      );
    }
    if (!lgaSet.has(target.lga_id)) {
      throw AppError.badRequest('LGA_NOT_FOUND', 'One of the LGAs in this workplan does not exist.');
    }
    if (actor.role === ROLES.LACA_OFFICER && target.lga_id !== actor.lga_id) {
      throw AppError.forbidden('LGA_NOT_ALLOWED', 'Targets must stay inside your own LGA.');
    }

    const key = `${target.indicator_id}:${target.lga_id}`;
    if (seen.has(key)) {
      throw AppError.badRequest(
        'DUPLICATE_TARGET',
        'Each indicator can appear only once per LGA in a workplan.'
      );
    }
    seen.add(key);

    clean.push({
      indicator_id: target.indicator_id,
      lga_id: target.lga_id,
      target_value: target.target_value,
    });
  }

  return clean;
}

async function replaceTargets(workplan, targets, transaction) {
  const existing = await WorkplanTarget.findAll({
    where: { workplan_id: workplan.id },
    transaction,
  });
  for (const target of existing) {
    await target.destroy({ transaction });
  }

  if (!targets.length) return;
  await WorkplanTarget.bulkCreate(
    targets.map((target) => ({ ...target, workplan_id: workplan.id })),
    { transaction }
  );
}

async function listWorkplans(actor, query) {
  const { page, limit, offset } = getPagination(query);
  const where = {};
  const organizationWhere = {};

  if (actor.role === ROLES.PARTNER_STAFF) {
    if (!actor.organization_id) {
      throw AppError.forbidden('NO_ORGANIZATION', 'Your account is not linked to an organization.');
    }
    where.organization_id = actor.organization_id;
  } else if (actor.role === ROLES.LACA_OFFICER) {
    organizationWhere.lga_id = actor.lga_id;
  } else if (!isPlaca(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'You cannot view workplans.');
  }

  if (query.organization_id) {
    if (
      actor.role === ROLES.PARTNER_STAFF &&
      query.organization_id !== actor.organization_id
    ) {
      throw AppError.forbidden(
        'ORGANIZATION_ACCESS_DENIED',
        'You can only view workplans for your own organization.'
      );
    }
    where.organization_id = query.organization_id;
  }
  if (query.year) where.year = query.year;
  if (query.quarter) where.quarter = query.quarter;
  if (query.status) where.status = query.status;
  if (query.lga_id) {
    if (actor.role === ROLES.LACA_OFFICER && query.lga_id !== actor.lga_id) {
      throw AppError.forbidden('LGA_NOT_ALLOWED', 'You can only view workplans in your own LGA.');
    }
    organizationWhere.lga_id = query.lga_id;
  }

  const { rows, count } = await Workplan.findAndCountAll({
    where,
    include: [
      {
        ...ORGANIZATION_INCLUDE,
        where: Object.keys(organizationWhere).length ? organizationWhere : undefined,
        required: Object.keys(organizationWhere).length > 0,
      },
      { model: User, as: 'creator', attributes: ['id', 'name'] },
      { model: WorkplanTarget, as: 'targets', include: TARGET_INCLUDE },
    ],
    order: [
      ['year', 'DESC'],
      ['quarter', 'DESC'],
      ['created_at', 'DESC'],
    ],
    limit,
    offset,
    distinct: true,
  });

  return {
    data: rows.map(serializeWorkplan),
    pagination: buildPaginationMeta({ page, limit, count }),
  };
}

async function getWorkplan(actor, id) {
  const workplan = await findWorkplanOrThrow(id);
  assertCanView(actor, workplan);
  return serializeWorkplan(workplan);
}

async function createWorkplan(actor, input) {
  if (actor.role !== ROLES.PARTNER_STAFF) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only partner staff can create a workplan.');
  }
  if (!actor.organization_id) {
    throw AppError.forbidden('NO_ORGANIZATION', 'Your account is not linked to an organization.');
  }

  const organization = await findOrganizationOrThrow(actor.organization_id);
  if (organization.status !== 'approved') {
    throw AppError.badRequest(
      'ORGANIZATION_NOT_APPROVED',
      'Your organization must be approved before you can plan work.'
    );
  }

  const duplicate = await Workplan.findOne({
    where: {
      organization_id: organization.id,
      year: input.year,
      quarter: input.quarter,
    },
    attributes: ['id'],
  });
  if (duplicate) {
    throw AppError.conflict(
      'WORKPLAN_EXISTS',
      'A workplan already exists for this organization and quarter.'
    );
  }

  const targets = await validateTargets(actor, organization, input.targets || []);

  const workplan = await sequelize.transaction(async (transaction) => {
    const created = await Workplan.create(
      {
        organization_id: organization.id,
        year: input.year,
        quarter: input.quarter,
        created_by: actor.id,
        status: 'draft',
      },
      { transaction }
    );

    if (targets.length) {
      await WorkplanTarget.bulkCreate(
        targets.map((target) => ({ ...target, workplan_id: created.id })),
        { transaction }
      );
    }

    return created;
  });

  return getWorkplan(actor, workplan.id);
}

async function updateWorkplan(actor, id, input) {
  const workplan = await findWorkplanOrThrow(id);
  assertCanAuthor(actor, workplan);

  if (!['draft', 'returned'].includes(workplan.status)) {
    throw AppError.conflict(
      'WORKPLAN_LOCKED',
      'This workplan has been submitted and can no longer be edited.'
    );
  }

  const targets =
    input.targets !== undefined
      ? await validateTargets(actor, workplan.organization, input.targets)
      : null;

  await sequelize.transaction(async (transaction) => {
    if (targets) {
      await replaceTargets(workplan, targets, transaction);
    }
    await workplan.save({ transaction });
  });

  return getWorkplan(actor, id);
}

async function submitWorkplan(actor, id) {
  const workplan = await findWorkplanOrThrow(id);
  assertCanAuthor(actor, workplan);

  if (!['draft', 'returned'].includes(workplan.status)) {
    throw AppError.conflict('WORKPLAN_LOCKED', 'This workplan has already been submitted.');
  }

  if (!workplan.targets || workplan.targets.length === 0) {
    throw AppError.badRequest(
      'WORKPLAN_EMPTY',
      'Add at least one target before submitting the workplan.'
    );
  }

  if (workplan.organization.status !== 'approved') {
    throw AppError.badRequest(
      'ORGANIZATION_NOT_APPROVED',
      'Your organization must be approved before you can submit a workplan.'
    );
  }

  await sequelize.transaction(async (transaction) => {
    workplan.status = 'submitted';
    workplan.submitted_at = new Date();
    workplan.approved_by = null;
    workplan.approved_at = null;
    workplan.review_note = null;
    await workplan.save({ transaction });
  });

  await recordAudit({
    action: 'workplan_submitted',
    entity: 'Workplan',
    entityId: workplan.id,
    userId: actor.id,
    userRole: actor.role,
    newValue: { status: 'submitted' },
  });

  return getWorkplan(actor, id);
}

async function reviewWorkplan(actor, id, { decision, note }) {
  if (!isPlaca(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can review a workplan.');
  }

  const workplan = await findWorkplanOrThrow(id);
  if (workplan.status !== 'submitted') {
    throw AppError.conflict(
      'WORKPLAN_NOT_SUBMITTED',
      'Only a submitted workplan can be reviewed.'
    );
  }

  const approved = decision === 'approve';
  if (!approved && !note) {
    throw AppError.badRequest(
      'RETURN_NOTE_REQUIRED',
      'Explain what the partner needs to change before returning the workplan.'
    );
  }

  await sequelize.transaction(async (transaction) => {
    workplan.status = approved ? 'approved' : 'returned';
    workplan.review_note = approved ? null : note;
    workplan.approved_by = approved ? actor.id : null;
    workplan.approved_at = approved ? new Date() : null;
    await workplan.save({ transaction });
  });

  await recordAudit({
    action: approved ? 'workplan_approved' : 'workplan_returned',
    entity: 'Workplan',
    entityId: workplan.id,
    userId: actor.id,
    userRole: actor.role,
    oldValue: { status: 'submitted' },
    newValue: { status: workplan.status, note: note || null },
  });

  return getWorkplan(actor, id);
}

async function deleteWorkplan(actor, id) {
  const workplan = await findWorkplanOrThrow(id);
  assertCanAuthor(actor, workplan);

  if (workplan.status !== 'draft') {
    throw AppError.conflict('WORKPLAN_LOCKED', 'Only a draft workplan can be deleted.');
  }

  await sequelize.transaction(async (transaction) => {
    for (const target of workplan.targets || []) {
      await target.destroy({ transaction });
    }
    await workplan.destroy({ transaction });
  });

  await recordAudit({
    action: 'workplan_deleted',
    entity: 'Workplan',
    entityId: workplan.id,
    userId: actor.id,
    userRole: actor.role,
    oldValue: { year: workplan.year, quarter: workplan.quarter },
  });

  return { deleted: true };
}

module.exports = {
  listWorkplans,
  getWorkplan,
  createWorkplan,
  updateWorkplan,
  submitWorkplan,
  reviewWorkplan,
  deleteWorkplan,
  serializeWorkplan,
};
