'use strict';

/**
 * Partner organizations and their approval workflow.
 *
 * A PLACA or LACA officer registers an organization as `pending`. Only a PLACA
 * officer or director can approve or suspend it. Partners may keep their own
 * contact details current, but never change their status or LGA.
 *
 * Admin is deliberately absent: admin manages accounts and the audit log, not
 * programme data.
 */

const { Op } = require('sequelize');
const { Organization, Lga, User } = require('../models');
const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { canAccessOrganization } = require('../middleware/ownership');
const { ROLES, PLACA_ROLES } = require('../middleware/rbac');
const { recordAudit } = require('./auditService');

const ORGANIZATION_INCLUDE = [
  {
    model: Lga,
    as: 'lga',
    attributes: ['id', 'name', 'code'],
  },
  {
    model: User,
    as: 'approver',
    attributes: ['id', 'name'],
  },
];

function plain(instance) {
  return instance && instance.toJSON ? instance.toJSON() : instance;
}

function serializeOrganization(instance) {
  const organization = plain(instance);
  if (!organization) return null;

  return {
    id: organization.id,
    name: organization.name,
    type: organization.type,
    lga_id: organization.lga_id,
    focus_areas: organization.focus_areas || [],
    contact_name: organization.contact_name,
    contact_phone: organization.contact_phone,
    contact_email: organization.contact_email,
    status: organization.status,
    approved_by: organization.approved_by,
    approved_at: organization.approved_at,
    created_at: organization.createdAt,
    updated_at: organization.updatedAt,
    lga: organization.lga
      ? { id: organization.lga.id, name: organization.lga.name, code: organization.lga.code }
      : null,
    approver: organization.approver
      ? { id: organization.approver.id, name: organization.approver.name }
      : null,
  };
}

function isPlaca(actor) {
  return PLACA_ROLES.includes(actor.role);
}

async function findOrganizationOrThrow(id) {
  const organization = await Organization.findByPk(id, { include: ORGANIZATION_INCLUDE });
  if (!organization) {
    throw AppError.notFound('ORGANIZATION_NOT_FOUND', 'That organization does not exist.');
  }
  return organization;
}

async function assertLga(lgaId) {
  const lga = await Lga.findByPk(lgaId, { attributes: ['id'] });
  if (!lga) throw AppError.badRequest('LGA_NOT_FOUND', 'That LGA does not exist.');
  return lga;
}

async function listOrganizations(actor, query) {
  const { page, limit, offset } = getPagination(query);
  const where = {};

  if (actor.role === ROLES.PARTNER_STAFF) {
    if (!actor.organization_id) {
      throw AppError.forbidden(
        'NO_ORGANIZATION',
        'Your account is not linked to an organization. Contact your LACA officer.'
      );
    }
    where.id = actor.organization_id;
  } else if (actor.role === ROLES.LACA_OFFICER) {
    where.lga_id = actor.lga_id;
  } else if (!isPlaca(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'You cannot view organizations.');
  }

  if (query.status) where.status = query.status;
  if (query.type) where.type = query.type;
  if (query.lga_id) {
    if (actor.role === ROLES.LACA_OFFICER && query.lga_id !== actor.lga_id) {
      throw AppError.forbidden(
        'LGA_NOT_ALLOWED',
        'You can only view organizations in your own LGA.'
      );
    }
    // A partner's own organization filter is already fixed above.
    if (actor.role !== ROLES.PARTNER_STAFF) where.lga_id = query.lga_id;
  }
  if (query.search) {
    const term = `%${query.search}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: term } },
      { contact_name: { [Op.iLike]: term } },
      { contact_email: { [Op.iLike]: term } },
    ];
  }

  const { rows, count } = await Organization.findAndCountAll({
    where,
    include: ORGANIZATION_INCLUDE,
    order: [['name', 'ASC']],
    limit,
    offset,
  });

  return {
    data: rows.map(serializeOrganization),
    pagination: buildPaginationMeta({ page, limit, count }),
  };
}

async function getOrganization(actor, id) {
  const organization = await findOrganizationOrThrow(id);
  if (!canAccessOrganization(actor, organization)) {
    throw AppError.forbidden(
      'ORGANIZATION_ACCESS_DENIED',
      'You can only view your own organization or organizations in your LGA.'
    );
  }
  return serializeOrganization(organization);
}

async function createOrganization(actor, input) {
  if (!isPlaca(actor) && actor.role !== ROLES.LACA_OFFICER) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'You cannot register an organization.');
  }

  if (actor.role === ROLES.LACA_OFFICER && input.lga_id !== actor.lga_id) {
    throw AppError.forbidden(
      'LGA_NOT_ALLOWED',
      'You can only register organizations inside your own LGA.'
    );
  }

  await assertLga(input.lga_id);

  const existing = await Organization.findOne({
    where: { name: { [Op.iLike]: input.name } },
    attributes: ['id'],
  });
  if (existing) {
    throw AppError.conflict(
      'ORGANIZATION_NAME_TAKEN',
      'An organization with that name is already registered.'
    );
  }

  const organization = await Organization.create({
    name: input.name,
    type: input.type,
    lga_id: input.lga_id,
    focus_areas: input.focus_areas || [],
    contact_name: input.contact_name || null,
    contact_phone: input.contact_phone || null,
    contact_email: input.contact_email || null,
    status: 'pending',
  });

  return getOrganization(actor, organization.id);
}

async function updateOrganization(actor, id, input) {
  const organization = await findOrganizationOrThrow(id);
  if (!canAccessOrganization(actor, organization)) {
    throw AppError.forbidden(
      'ORGANIZATION_ACCESS_DENIED',
      'You can only edit your own organization or one in your LGA.'
    );
  }

  // Partners maintain contact details only. Identity and placement are
  // controlled by PLACA/LACA to keep reporting attribution correct.
  const isPartner = actor.role === ROLES.PARTNER_STAFF;
  const allowed = isPartner
    ? ['contact_name', 'contact_phone', 'contact_email', 'focus_areas']
    : ['name', 'type', 'lga_id', 'focus_areas', 'contact_name', 'contact_phone', 'contact_email'];

  const changes = {};
  for (const key of allowed) {
    if (input[key] !== undefined) changes[key] = input[key];
  }

  if (Object.keys(changes).length === 0) {
    throw AppError.badRequest('NO_CHANGES', 'No allowed fields were provided.');
  }

  if (changes.lga_id) {
    if (actor.role === ROLES.LACA_OFFICER && changes.lga_id !== actor.lga_id) {
      throw AppError.forbidden('LGA_NOT_ALLOWED', 'You can only move an organization inside your LGA.');
    }
    await assertLga(changes.lga_id);
  }

  if (changes.name) {
    const clash = await Organization.findOne({
      where: { id: { [Op.ne]: organization.id }, name: { [Op.iLike]: changes.name } },
      attributes: ['id'],
    });
    if (clash) {
      throw AppError.conflict(
        'ORGANIZATION_NAME_TAKEN',
        'An organization with that name is already registered.'
      );
    }
  }

  Object.assign(organization, changes);
  await organization.save();

  return getOrganization(actor, organization.id);
}

async function approveOrganization(actor, id) {
  if (!isPlaca(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can approve an organization.');
  }

  const organization = await findOrganizationOrThrow(id);

  if (organization.status === 'approved') {
    return serializeOrganization(organization);
  }

  const previousStatus = organization.status;
  organization.status = 'approved';
  organization.approved_by = actor.id;
  organization.approved_at = new Date();
  await organization.save();

  await recordAudit({
    action: previousStatus === 'suspended' ? 'organization_reinstated' : 'organization_approved',
    entity: 'Organization',
    entityId: organization.id,
    userId: actor.id,
    userRole: actor.role,
    oldValue: { status: previousStatus },
    newValue: { status: 'approved' },
  });

  return getOrganization(actor, organization.id);
}

async function suspendOrganization(actor, id) {
  if (!isPlaca(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can suspend an organization.');
  }

  const organization = await findOrganizationOrThrow(id);
  if (organization.status === 'pending') {
    throw AppError.badRequest(
      'ORGANIZATION_NOT_APPROVED',
      'This organization has not been approved yet, so it cannot be suspended.'
    );
  }
  if (organization.status === 'suspended') {
    return serializeOrganization(organization);
  }

  organization.status = 'suspended';
  await organization.save();

  await recordAudit({
    action: 'organization_suspended',
    entity: 'Organization',
    entityId: organization.id,
    userId: actor.id,
    userRole: actor.role,
    oldValue: { status: 'approved' },
    newValue: { status: 'suspended' },
  });

  return getOrganization(actor, organization.id);
}

module.exports = {
  APPROVED_ONLY_MESSAGE: 'The organization must be approved before staff can report.',
  serializeOrganization,
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  approveOrganization,
  suspendOrganization,
  findOrganizationOrThrow,
  isPlaca,
};
