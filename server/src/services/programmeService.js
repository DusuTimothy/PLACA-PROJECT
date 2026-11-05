'use strict';

/**
 * Welfare and campaign programmes.
 *
 * A programme can belong to one partner organization or be LGA-wide. Reports
 * can link to a programme through reports.programme_id. Participants are still
 * counted through report values; no participant names are stored.
 */

const { Op } = require('sequelize');
const { WelfareProgramme, Organization, Lga, User, Report } = require('../models');
const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { ROLES, PLACA_ROLES } = require('../middleware/rbac');

const PROGRAMME_INCLUDE = [
  { model: Lga, as: 'lga', attributes: ['id', 'name', 'code'] },
  { model: Organization, as: 'organization', attributes: ['id', 'name', 'lga_id'] },
  { model: User, as: 'creator', attributes: ['id', 'name'] },
];

function plain(instance) {
  return instance && instance.toJSON ? instance.toJSON() : instance;
}

function serializeProgramme(instance) {
  const programme = plain(instance);
  if (!programme) return null;
  return {
    id: programme.id,
    kind: programme.kind,
    name: programme.name,
    description: programme.description,
    lga_id: programme.lga_id,
    organization_id: programme.organization_id,
    start_date: programme.start_date,
    end_date: programme.end_date,
    status: programme.status,
    created_by: programme.created_by,
    created_at: programme.createdAt,
    updated_at: programme.updatedAt,
    lga: programme.lga
      ? { id: programme.lga.id, name: programme.lga.name, code: programme.lga.code }
      : null,
    organization: programme.organization
      ? {
          id: programme.organization.id,
          name: programme.organization.name,
          lga_id: programme.organization.lga_id,
        }
      : null,
    creator: programme.creator
      ? { id: programme.creator.id, name: programme.creator.name }
      : null,
  };
}

function canManage(actor) {
  return PLACA_ROLES.includes(actor.role);
}

async function organizationIdsForLga(lgaId) {
  const rows = await Organization.findAll({
    where: { lga_id: lgaId },
    attributes: ['id'],
    raw: true,
  });
  return rows.map((row) => row.id);
}

async function buildScope(actor, query) {
  const where = {};

  if (actor.role === ROLES.PARTNER_STAFF) {
    if (!actor.organization_id) {
      throw AppError.forbidden('NO_ORGANIZATION', 'Your account is not linked to an organization.');
    }
    const organization = await Organization.findByPk(actor.organization_id, {
      attributes: ['lga_id'],
    });
    where[Op.or] = [
      { organization_id: actor.organization_id },
      { organization_id: null, lga_id: organization?.lga_id || null },
    ];
  } else if (actor.role === ROLES.LACA_OFFICER) {
    where.lga_id = actor.lga_id;
  } else if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'You cannot view programmes.');
  }

  if (query.lga_id) {
    if (actor.role === ROLES.LACA_OFFICER && query.lga_id !== actor.lga_id) {
      throw AppError.forbidden('LGA_NOT_ALLOWED', 'You can only view programmes in your own LGA.');
    }
    where.lga_id = query.lga_id;
  }
  if (query.organization_id) {
    if (
      actor.role === ROLES.PARTNER_STAFF &&
      query.organization_id !== actor.organization_id
    ) {
      throw AppError.forbidden(
        'ORGANIZATION_ACCESS_DENIED',
        'You can only view your own programmes.'
      );
    }
    where.organization_id = query.organization_id;
  }
  if (query.kind) where.kind = query.kind;
  if (query.status) where.status = query.status;
  if (query.search) {
    const term = `%${query.search}%`;
    where[Op.or] = [
      ...(where[Op.or] || []),
      { name: { [Op.iLike]: term } },
      { description: { [Op.iLike]: term } },
    ];
  }

  return where;
}

async function listProgrammes(actor, query) {
  const { page, limit, offset } = getPagination(query);
  const where = await buildScope(actor, query);
  const { rows, count } = await WelfareProgramme.findAndCountAll({
    where,
    include: PROGRAMME_INCLUDE,
    order: [
      ['start_date', 'DESC'],
      ['created_at', 'DESC'],
    ],
    limit,
    offset,
    distinct: true,
  });
  return {
    data: rows.map(serializeProgramme),
    pagination: buildPaginationMeta({ page, limit, count }),
  };
}

async function findProgrammeOrThrow(id) {
  const programme = await WelfareProgramme.findByPk(id, { include: PROGRAMME_INCLUDE });
  if (!programme) {
    throw AppError.notFound('PROGRAMME_NOT_FOUND', 'That programme does not exist.');
  }
  return programme;
}

function assertCanView(actor, programme) {
  if (canManage(actor)) return;
  if (actor.role === ROLES.LACA_OFFICER) {
    if (programme.lga_id !== actor.lga_id) {
      throw AppError.forbidden(
        'PROGRAMME_ACCESS_DENIED',
        'You can only view programmes in your own LGA.'
      );
    }
    return;
  }
  if (actor.role === ROLES.PARTNER_STAFF) {
    const own = programme.organization_id === actor.organization_id;
    const lgaWide = programme.organization_id === null && programme.lga_id === actor.lga_id;
    if (!own && !lgaWide) {
      throw AppError.forbidden(
        'PROGRAMME_ACCESS_DENIED',
        'You can only view your own programmes.'
      );
    }
    return;
  }
  throw AppError.forbidden('ROLE_NOT_ALLOWED', 'You cannot view programmes.');
}

async function getProgramme(actor, id) {
  const programme = await findProgrammeOrThrow(id);
  assertCanView(actor, programme);
  return serializeProgramme(programme);
}

async function resolvePlacement(actor, input) {
  let lgaId = input.lga_id;
  let organizationId = input.organization_id || null;

  if (actor.role === ROLES.PARTNER_STAFF) {
    if (!actor.organization_id) {
      throw AppError.forbidden('NO_ORGANIZATION', 'Your account is not linked to an organization.');
    }
    const organization = await Organization.findByPk(actor.organization_id, {
      attributes: ['id', 'lga_id', 'status'],
    });
    if (!organization || organization.status !== 'approved') {
      throw AppError.badRequest(
        'ORGANIZATION_NOT_APPROVED',
        'Your organization must be approved before it can create a programme.'
      );
    }
    lgaId = organization.lga_id;
    organizationId = organization.id;
  }

  if (actor.role === ROLES.LACA_OFFICER && lgaId !== actor.lga_id) {
    throw AppError.forbidden('LGA_NOT_ALLOWED', 'You can only create programmes in your own LGA.');
  }

  if (organizationId) {
    const organization = await Organization.findByPk(organizationId, {
      attributes: ['id', 'lga_id'],
    });
    if (!organization) {
      throw AppError.badRequest('ORGANIZATION_NOT_FOUND', 'That organization does not exist.');
    }
    if (organization.lga_id !== lgaId) {
      throw AppError.badRequest(
        'PROGRAMME_LGA_MISMATCH',
        'The organization is not in the selected LGA.'
      );
    }
  }

  const lga = await Lga.findByPk(lgaId, { attributes: ['id'] });
  if (!lga) throw AppError.badRequest('LGA_NOT_FOUND', 'That LGA does not exist.');

  return { lgaId, organizationId };
}

async function createProgramme(actor, input) {
  if (![ROLES.PARTNER_STAFF, ROLES.LACA_OFFICER, ...PLACA_ROLES].includes(actor.role)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'You cannot create a programme.');
  }
  const { lgaId, organizationId } = await resolvePlacement(actor, input);

  const programme = await WelfareProgramme.create({
    kind: input.kind,
    name: input.name,
    description: input.description || null,
    lga_id: lgaId,
    organization_id: organizationId,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    status: input.status || 'planned',
    created_by: actor.id,
  });

  return serializeProgramme(
    await WelfareProgramme.findByPk(programme.id, { include: PROGRAMME_INCLUDE })
  );
}

async function updateProgramme(actor, id, input) {
  const programme = await findProgrammeOrThrow(id);
  assertCanView(actor, programme);
  if (
    actor.role === ROLES.PARTNER_STAFF &&
    programme.organization_id !== actor.organization_id
  ) {
    throw AppError.forbidden('PROGRAMME_EDIT_DENIED', 'You can only edit your own programmes.');
  }
  if (actor.role === ROLES.LACA_OFFICER && programme.lga_id !== actor.lga_id) {
    throw AppError.forbidden('PROGRAMME_EDIT_DENIED', 'You can only edit programmes in your own LGA.');
  }
  if (![ROLES.PARTNER_STAFF, ROLES.LACA_OFFICER, ...PLACA_ROLES].includes(actor.role)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'You cannot edit programmes.');
  }

  if (input.lga_id || input.organization_id !== undefined) {
    const placement = await resolvePlacement(actor, {
      lga_id: input.lga_id || programme.lga_id,
      organization_id:
        input.organization_id !== undefined
          ? input.organization_id
          : programme.organization_id,
    });
    programme.lga_id = placement.lgaId;
    programme.organization_id = placement.organizationId;
  }

  const { lga_id: ignoredLga, organization_id: ignoredOrganization, ...changes } = input;
  Object.assign(programme, changes);
  await programme.save();

  return serializeProgramme(
    await WelfareProgramme.findByPk(programme.id, { include: PROGRAMME_INCLUDE })
  );
}

async function deleteProgramme(actor, id) {
  const programme = await findProgrammeOrThrow(id);
  assertCanView(actor, programme);

  const reports = await Report.count({ where: { programme_id: id } });
  if (reports > 0) {
    throw AppError.conflict(
      'PROGRAMME_IN_USE',
      'This programme has reports linked to it, so it cannot be deleted.'
    );
  }

  const isOwner =
    actor.role === ROLES.PARTNER_STAFF &&
    programme.organization_id === actor.organization_id &&
    programme.status === 'planned';
  if (!canManage(actor) && !isOwner) {
    throw AppError.forbidden(
      'PROGRAMME_DELETE_DENIED',
      'Only PLACA officers, or a partner with a planned programme, can delete it.'
    );
  }

  await programme.destroy();
  return { deleted: true };
}

module.exports = {
  serializeProgramme,
  listProgrammes,
  getProgramme,
  createProgramme,
  updateProgramme,
  deleteProgramme,
};
