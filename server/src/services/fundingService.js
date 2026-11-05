'use strict';

/**
 * Funding sources, inflows and allocations.
 *
 * Money is stored as DECIMAL and returned as a number for display only. PLACA
 * officers record and change funding. LACA officers see allocations in their
 * LGA; partners see allocations addressed to their own organization.
 */

const { Op } = require('sequelize');
const {
  FundingSource,
  FundingInflow,
  FundingAllocation,
  Organization,
  Lga,
  User,
} = require('../models');
const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { ROLES, PLACA_ROLES } = require('../middleware/rbac');
const { recordAudit } = require('./auditService');
const { notifyOrganizationPartners } = require('./notificationService');

const ALLOCATION_INCLUDE = [
  { model: FundingSource, as: 'source', attributes: ['id', 'name', 'type'] },
  { model: FundingInflow, as: 'inflow', attributes: ['id', 'amount', 'received_on', 'reference'] },
  {
    model: Organization,
    as: 'recipient',
    attributes: ['id', 'name', 'lga_id'],
    include: [{ model: Lga, as: 'lga', attributes: ['id', 'name'] }],
  },
  { model: Lga, as: 'lga', attributes: ['id', 'name'] },
  { model: User, as: 'approver', attributes: ['id', 'name'] },
];

const INFLOW_INCLUDE = [
  { model: FundingSource, as: 'source', attributes: ['id', 'name', 'type'] },
  { model: User, as: 'recorder', attributes: ['id', 'name'] },
];

function plain(instance) {
  return instance && instance.toJSON ? instance.toJSON() : instance;
}

function money(value) {
  if (value === null || value === undefined) return 0;
  return Number(value);
}

function serializeSource(instance) {
  const source = plain(instance);
  if (!source) return null;
  return {
    id: source.id,
    name: source.name,
    type: source.type,
    description: source.description,
    is_active: source.is_active,
    created_at: source.createdAt,
    updated_at: source.updatedAt,
  };
}

function serializeInflow(instance) {
  const inflow = plain(instance);
  if (!inflow) return null;
  return {
    id: inflow.id,
    funding_source_id: inflow.funding_source_id,
    amount: money(inflow.amount),
    currency: inflow.currency,
    received_on: inflow.received_on,
    purpose: inflow.purpose,
    reference: inflow.reference,
    recorded_by: inflow.recorded_by,
    created_at: inflow.createdAt,
    updated_at: inflow.updatedAt,
    source: inflow.source
      ? { id: inflow.source.id, name: inflow.source.name, type: inflow.source.type }
      : null,
    recorder: inflow.recorder
      ? { id: inflow.recorder.id, name: inflow.recorder.name }
      : null,
  };
}

function serializeAllocation(instance) {
  const allocation = plain(instance);
  if (!allocation) return null;
  return {
    id: allocation.id,
    funding_source_id: allocation.funding_source_id,
    funding_inflow_id: allocation.funding_inflow_id,
    recipient_organization_id: allocation.recipient_organization_id,
    lga_id: allocation.lga_id,
    amount: money(allocation.amount),
    currency: allocation.currency,
    period: allocation.period,
    purpose: allocation.purpose,
    status: allocation.status,
    approved_by: allocation.approved_by,
    disbursed_on: allocation.disbursed_on,
    created_at: allocation.createdAt,
    updated_at: allocation.updatedAt,
    source: allocation.source
      ? { id: allocation.source.id, name: allocation.source.name, type: allocation.source.type }
      : null,
    inflow: allocation.inflow
      ? {
          id: allocation.inflow.id,
          amount: money(allocation.inflow.amount),
          received_on: allocation.inflow.received_on,
          reference: allocation.inflow.reference,
        }
      : null,
    recipient: allocation.recipient
      ? {
          id: allocation.recipient.id,
          name: allocation.recipient.name,
          lga_id: allocation.recipient.lga_id,
          lga: allocation.recipient.lga
            ? { id: allocation.recipient.lga.id, name: allocation.recipient.lga.name }
            : null,
        }
      : null,
    lga: allocation.lga
      ? { id: allocation.lga.id, name: allocation.lga.name }
      : null,
    approver: allocation.approver
      ? { id: allocation.approver.id, name: allocation.approver.name }
      : null,
  };
}

function canManage(actor) {
  return PLACA_ROLES.includes(actor.role);
}

async function assertProgrammeRole(actor) {
  if (![ROLES.PARTNER_STAFF, ROLES.LACA_OFFICER, ...PLACA_ROLES].includes(actor.role)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'You cannot view funding records.');
  }
}

async function listSources(actor, query) {
  await assertProgrammeRole(actor);
  const { page, limit, offset } = getPagination(query);
  const where = {};
  if (query.active_only === 'true' || !canManage(actor)) where.is_active = true;
  if (query.type) where.type = query.type;
  if (query.search) {
    const term = `%${query.search}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: term } },
      { description: { [Op.iLike]: term } },
    ];
  }

  const { rows, count } = await FundingSource.findAndCountAll({
    where,
    order: [['name', 'ASC']],
    limit,
    offset,
  });
  return {
    data: rows.map(serializeSource),
    pagination: buildPaginationMeta({ page, limit, count }),
  };
}

async function getSourceOrThrow(id) {
  const source = await FundingSource.findByPk(id);
  if (!source) throw AppError.notFound('FUNDING_SOURCE_NOT_FOUND', 'That funding source does not exist.');
  return source;
}

async function createSource(actor, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can manage funding sources.');
  }
  const clash = await FundingSource.findOne({
    where: { name: { [Op.iLike]: input.name } },
    attributes: ['id'],
  });
  if (clash) {
    throw AppError.conflict('FUNDING_SOURCE_EXISTS', 'A source with that name already exists.');
  }
  const source = await FundingSource.create({
    name: input.name,
    type: input.type,
    description: input.description || null,
    is_active: input.is_active !== undefined ? input.is_active : true,
  });
  return serializeSource(source);
}

async function updateSource(actor, id, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can manage funding sources.');
  }
  const source = await getSourceOrThrow(id);
  if (input.name) {
    const clash = await FundingSource.findOne({
      where: { id: { [Op.ne]: source.id }, name: { [Op.iLike]: input.name } },
      attributes: ['id'],
    });
    if (clash) {
      throw AppError.conflict('FUNDING_SOURCE_EXISTS', 'A source with that name already exists.');
    }
  }
  Object.assign(source, input);
  await source.save();
  return serializeSource(source);
}

async function deleteSource(actor, id) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can manage funding sources.');
  }
  const source = await getSourceOrThrow(id);
  await source.destroy();
  return { deleted: true };
}

async function listInflows(actor, query) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can view funding inflows.');
  }
  const { page, limit, offset } = getPagination(query);
  const where = {};
  if (query.funding_source_id) where.funding_source_id = query.funding_source_id;
  if (query.year) {
    where.received_on = {
      [Op.gte]: `${query.year}-01-01`,
      [Op.lte]: `${query.year}-12-31`,
    };
  }

  const { rows, count } = await FundingInflow.findAndCountAll({
    where,
    include: INFLOW_INCLUDE,
    order: [
      ['received_on', 'DESC'],
      ['created_at', 'DESC'],
    ],
    limit,
    offset,
  });
  return {
    data: rows.map(serializeInflow),
    pagination: buildPaginationMeta({ page, limit, count }),
  };
}

async function createInflow(actor, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can record funding inflows.');
  }
  await getSourceOrThrow(input.funding_source_id);
  const inflow = await FundingInflow.create({
    funding_source_id: input.funding_source_id,
    amount: input.amount,
    currency: input.currency || 'NGN',
    received_on: input.received_on,
    purpose: input.purpose || null,
    reference: input.reference || null,
    recorded_by: actor.id,
  });
  return serializeInflow(
    await FundingInflow.findByPk(inflow.id, { include: INFLOW_INCLUDE })
  );
}

async function updateInflow(actor, id, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can record funding inflows.');
  }
  const inflow = await FundingInflow.findByPk(id);
  if (!inflow) throw AppError.notFound('FUNDING_INFLOW_NOT_FOUND', 'That inflow does not exist.');
  if (input.funding_source_id) await getSourceOrThrow(input.funding_source_id);
  Object.assign(inflow, input);
  await inflow.save();
  return serializeInflow(await FundingInflow.findByPk(inflow.id, { include: INFLOW_INCLUDE }));
}

async function deleteInflow(actor, id) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can delete funding inflows.');
  }
  const inflow = await FundingInflow.findByPk(id);
  if (!inflow) throw AppError.notFound('FUNDING_INFLOW_NOT_FOUND', 'That inflow does not exist.');
  await inflow.destroy();
  return { deleted: true };
}

async function organizationIdsForLga(lgaId) {
  const rows = await Organization.findAll({
    where: { lga_id: lgaId },
    attributes: ['id'],
    raw: true,
  });
  return rows.map((row) => row.id);
}

async function allocationScope(actor, query) {
  await assertProgrammeRole(actor);
  const where = {};

  if (actor.role === ROLES.PARTNER_STAFF) {
    if (!actor.organization_id) {
      throw AppError.forbidden('NO_ORGANIZATION', 'Your account is not linked to an organization.');
    }
    where.recipient_organization_id = actor.organization_id;
  } else if (actor.role === ROLES.LACA_OFFICER) {
    const ids = await organizationIdsForLga(actor.lga_id);
    where[Op.or] = [
      { lga_id: actor.lga_id },
      ...(ids.length ? [{ recipient_organization_id: { [Op.in]: ids } }] : []),
    ];
  }

  if (query.period) where.period = query.period;
  if (query.status) where.status = query.status;
  if (query.funding_source_id) where.funding_source_id = query.funding_source_id;
  if (query.organization_id) {
    if (
      actor.role === ROLES.PARTNER_STAFF &&
      query.organization_id !== actor.organization_id
    ) {
      throw AppError.forbidden(
        'ORGANIZATION_ACCESS_DENIED',
        'You can only view allocations for your own organization.'
      );
    }
    where.recipient_organization_id = query.organization_id;
  }
  if (query.lga_id) {
    if (actor.role === ROLES.LACA_OFFICER && query.lga_id !== actor.lga_id) {
      throw AppError.forbidden('LGA_NOT_ALLOWED', 'You can only view allocations in your own LGA.');
    }
    where.lga_id = query.lga_id;
  }

  return where;
}

async function listAllocations(actor, query) {
  const { page, limit, offset } = getPagination(query);
  const where = await allocationScope(actor, query);
  const { rows, count } = await FundingAllocation.findAndCountAll({
    where,
    include: ALLOCATION_INCLUDE,
    order: [
      ['period', 'DESC'],
      ['created_at', 'DESC'],
    ],
    limit,
    offset,
    distinct: true,
  });
  return {
    data: rows.map(serializeAllocation),
    pagination: buildPaginationMeta({ page, limit, count }),
  };
}

async function findRecipient(input) {
  let lgaId = input.lga_id || null;
  let organization = null;

  if (input.recipient_organization_id) {
    organization = await Organization.findByPk(input.recipient_organization_id, {
      attributes: ['id', 'name', 'lga_id'],
    });
    if (!organization) {
      throw AppError.badRequest('ORGANIZATION_NOT_FOUND', 'That organization does not exist.');
    }
    if (lgaId && organization.lga_id !== lgaId) {
      throw AppError.badRequest(
        'ALLOCATION_LGA_MISMATCH',
        'The organization is not in the selected LGA.'
      );
    }
    lgaId = lgaId || organization.lga_id;
  }

  if (!lgaId) {
    throw AppError.badRequest(
      'ALLOCATION_RECIPIENT_REQUIRED',
      'Choose a recipient organization or an LGA.'
    );
  }

  const lga = await Lga.findByPk(lgaId, { attributes: ['id', 'name'] });
  if (!lga) throw AppError.badRequest('LGA_NOT_FOUND', 'That LGA does not exist.');
  return { lgaId, organization };
}

async function createAllocation(actor, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can allocate funding.');
  }
  if (input.funding_source_id) await getSourceOrThrow(input.funding_source_id);
  if (input.funding_inflow_id) {
    const inflow = await FundingInflow.findByPk(input.funding_inflow_id, { attributes: ['id'] });
    if (!inflow) throw AppError.badRequest('FUNDING_INFLOW_NOT_FOUND', 'That inflow does not exist.');
  }

  const { lgaId, organization } = await findRecipient(input);
  const disbursed = input.status === 'disbursed';
  const allocation = await FundingAllocation.create({
    funding_source_id: input.funding_source_id || null,
    funding_inflow_id: input.funding_inflow_id || null,
    recipient_organization_id: organization?.id || null,
    lga_id: lgaId,
    amount: input.amount,
    currency: input.currency || 'NGN',
    period: input.period,
    purpose: input.purpose || null,
    status: input.status || 'planned',
    approved_by: disbursed ? actor.id : null,
    disbursed_on: disbursed
      ? input.disbursed_on || new Date().toISOString().slice(0, 10)
      : input.disbursed_on || null,
  });

  if (disbursed && organization) {
    await notifyOrganizationPartners(organization.id, {
      kind: 'funding',
      title: 'Funding allocated',
      body: `An allocation of ${input.currency || 'NGN'} ${Number(input.amount).toLocaleString()} was recorded for your organization.`,
      link: '/funding',
    });
  }

  await recordAudit({
    action: 'funding_allocation_created',
    entity: 'FundingAllocation',
    entityId: allocation.id,
    userId: actor.id,
    userRole: actor.role,
    newValue: {
      amount: allocation.amount,
      period: allocation.period,
      status: allocation.status,
      lga_id: allocation.lga_id,
    },
  });

  return serializeAllocation(
    await FundingAllocation.findByPk(allocation.id, { include: ALLOCATION_INCLUDE })
  );
}

async function updateAllocation(actor, id, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can allocate funding.');
  }
  const allocation = await FundingAllocation.findByPk(id);
  if (!allocation) throw AppError.notFound('FUNDING_ALLOCATION_NOT_FOUND', 'That allocation does not exist.');

  if (input.funding_source_id) await getSourceOrThrow(input.funding_source_id);
  if (input.recipient_organization_id || input.lga_id) {
    const recipient = await findRecipient({
      recipient_organization_id:
        input.recipient_organization_id !== undefined
          ? input.recipient_organization_id
          : allocation.recipient_organization_id,
      lga_id: input.lga_id !== undefined ? input.lga_id : allocation.lga_id,
    });
    allocation.recipient_organization_id = recipient.organization?.id || null;
    allocation.lga_id = recipient.lgaId;
  }

  Object.assign(allocation, input);
  if (allocation.status === 'disbursed') {
    allocation.approved_by = actor.id;
    allocation.disbursed_on =
      allocation.disbursed_on || new Date().toISOString().slice(0, 10);
  }
  await allocation.save();

  return serializeAllocation(
    await FundingAllocation.findByPk(allocation.id, { include: ALLOCATION_INCLUDE })
  );
}

async function deleteAllocation(actor, id) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can allocate funding.');
  }
  const allocation = await FundingAllocation.findByPk(id);
  if (!allocation) throw AppError.notFound('FUNDING_ALLOCATION_NOT_FOUND', 'That allocation does not exist.');
  await allocation.destroy();
  return { deleted: true };
}

async function summary(actor, query) {
  const where = await allocationScope(actor, query);
  const rows = await FundingAllocation.findAll({
    where,
    include: [
      { model: Lga, as: 'lga', attributes: ['id', 'name'] },
      { model: FundingSource, as: 'source', attributes: ['id', 'name', 'type'] },
      {
        model: Organization,
        as: 'recipient',
        attributes: ['id', 'name'],
        include: [{ model: Lga, as: 'lga', attributes: ['id', 'name'] }],
      },
    ],
    raw: false,
  });

  const byLga = new Map();
  const bySource = new Map();
  let total = 0;

  for (const row of rows) {
    const amount = money(row.amount);
    total += amount;
    const lga = row.lga || row.recipient?.lga;
    const lgaKey = lga?.id || 'unplaced';
    if (!byLga.has(lgaKey)) {
      byLga.set(lgaKey, { lga_id: lga?.id || null, lga_name: lga?.name || 'Unplaced', total: 0, count: 0 });
    }
    byLga.get(lgaKey).total += amount;
    byLga.get(lgaKey).count += 1;

    const sourceKey = row.source?.id || 'unspecified';
    if (!bySource.has(sourceKey)) {
      bySource.set(sourceKey, {
        funding_source_id: row.source?.id || null,
        source_name: row.source?.name || 'Unspecified',
        total: 0,
        count: 0,
      });
    }
    bySource.get(sourceKey).total += amount;
    bySource.get(sourceKey).count += 1;
  }

  return {
    period: query.period || null,
    total_allocated: total,
    allocation_count: rows.length,
    by_lga: [...byLga.values()].sort((left, right) => right.total - left.total),
    by_source: [...bySource.values()].sort((left, right) => right.total - left.total),
  };
}

module.exports = {
  serializeSource,
  serializeInflow,
  serializeAllocation,
  listSources,
  createSource,
  updateSource,
  deleteSource,
  listInflows,
  createInflow,
  updateInflow,
  deleteInflow,
  listAllocations,
  createAllocation,
  updateAllocation,
  deleteAllocation,
  summary,
};
