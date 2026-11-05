'use strict';

/**
 * Partner support requests and the equipment delivery loop.
 *
 * Partners ask for equipment, training or technical help. PLACA approves or
 * rejects the request, records deliveries, and the partner confirms receipt.
 * Requests that stay in `requested` for more than seven days are marked
 * overdue for the PLACA queue.
 */

const { Op } = require('sequelize');
const {
  SupportRequest,
  SupportRequestItem,
  SupplyRecord,
  EquipmentItem,
  Organization,
  Lga,
  User,
  sequelize,
} = require('../models');
const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { ROLES, PLACA_ROLES } = require('../middleware/rbac');
const { recordAudit } = require('./auditService');
const {
  notifyUser,
  notifyPlacaOfficers,
} = require('./notificationService');

const REQUEST_INCLUDE = [
  {
    model: Organization,
    as: 'organization',
    attributes: ['id', 'name', 'lga_id', 'status'],
    include: [{ model: Lga, as: 'lga', attributes: ['id', 'name', 'code'] }],
  },
  { model: User, as: 'requester', attributes: ['id', 'name'] },
  { model: User, as: 'decider', attributes: ['id', 'name'] },
  {
    model: SupportRequestItem,
    as: 'items',
    include: [
      {
        model: EquipmentItem,
        as: 'equipmentItem',
        attributes: ['id', 'name', 'unit'],
      },
    ],
  },
  {
    model: SupplyRecord,
    as: 'supplyRecords',
    include: [
      {
        model: EquipmentItem,
        as: 'equipmentItem',
        attributes: ['id', 'name', 'unit'],
      },
      { model: User, as: 'deliverer', attributes: ['id', 'name'] },
      { model: User, as: 'receiver', attributes: ['id', 'name'] },
    ],
  },
];

function plain(instance) {
  return instance && instance.toJSON ? instance.toJSON() : instance;
}

function serializeRequest(instance) {
  const request = plain(instance);
  if (!request) return null;
  const created = request.createdAt ? new Date(request.createdAt) : null;
  const ageDays = created
    ? Math.floor((Date.now() - created.getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  return {
    id: request.id,
    client_uuid: request.client_uuid,
    organization_id: request.organization_id,
    kind: request.kind,
    description: request.description,
    status: request.status,
    requested_by: request.requested_by,
    decided_by: request.decided_by,
    decided_at: request.decided_at,
    decision_note: request.decision_note,
    created_at: request.createdAt,
    updated_at: request.updatedAt,
    age_days: ageDays,
    overdue: request.status === 'requested' && ageDays > 7,
    organization: request.organization
      ? {
          id: request.organization.id,
          name: request.organization.name,
          lga_id: request.organization.lga_id,
          status: request.organization.status,
          lga: request.organization.lga
            ? {
                id: request.organization.lga.id,
                name: request.organization.lga.name,
                code: request.organization.lga.code,
              }
            : null,
        }
      : null,
    requester: request.requester
      ? { id: request.requester.id, name: request.requester.name }
      : null,
    decider: request.decider
      ? { id: request.decider.id, name: request.decider.name }
      : null,
    items: (request.items || []).map((item) => ({
      id: item.id,
      equipment_item_id: item.equipment_item_id,
      qty_requested: item.qty_requested,
      qty_approved: item.qty_approved,
      equipment_item: item.equipmentItem
        ? {
            id: item.equipmentItem.id,
            name: item.equipmentItem.name,
            unit: item.equipmentItem.unit,
          }
        : null,
    })),
    supply_records: (request.supplyRecords || []).map((record) => ({
      id: record.id,
      support_request_item_id: record.support_request_item_id,
      equipment_item_id: record.equipment_item_id,
      qty_delivered: record.qty_delivered,
      delivered_at: record.delivered_at,
      received_at: record.received_at,
      note: record.note,
      equipment_item: record.equipmentItem
        ? {
            id: record.equipmentItem.id,
            name: record.equipmentItem.name,
            unit: record.equipmentItem.unit,
          }
        : null,
      deliverer: record.deliverer
        ? { id: record.deliverer.id, name: record.deliverer.name }
        : null,
      receiver: record.receiver
        ? { id: record.receiver.id, name: record.receiver.name }
        : null,
    })),
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
    where.organization_id = actor.organization_id;
  } else if (actor.role === ROLES.LACA_OFFICER) {
    const ids = await organizationIdsForLga(actor.lga_id);
    where.organization_id = { [Op.in]: ids };
  } else if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'You cannot view support requests.');
  }

  if (query.organization_id) {
    if (
      actor.role === ROLES.PARTNER_STAFF &&
      query.organization_id !== actor.organization_id
    ) {
      throw AppError.forbidden(
        'ORGANIZATION_ACCESS_DENIED',
        'You can only view requests for your own organization.'
      );
    }
    where.organization_id = query.organization_id;
  }
  if (query.lga_id) {
    if (actor.role === ROLES.LACA_OFFICER && query.lga_id !== actor.lga_id) {
      throw AppError.forbidden('LGA_NOT_ALLOWED', 'You can only view requests in your own LGA.');
    }
    const ids = await organizationIdsForLga(query.lga_id);
    where.organization_id = { [Op.in]: ids };
  }
  if (query.status) where.status = query.status;
  if (query.kind) where.kind = query.kind;

  if (query.search) {
    const term = `%${query.search}%`;
    const organizations = await Organization.findAll({
      where: { name: { [Op.iLike]: term } },
      attributes: ['id'],
      raw: true,
    });
    where[Op.or] = [
      { description: { [Op.iLike]: term } },
      ...(organizations.length
        ? [{ organization_id: { [Op.in]: organizations.map((row) => row.id) } }]
        : []),
    ];
  }

  return where;
}

async function listRequests(actor, query) {
  const { page, limit, offset } = getPagination(query);
  const where = await buildScope(actor, query);

  const { rows, count } = await SupportRequest.findAndCountAll({
    where,
    include: REQUEST_INCLUDE,
    order: [
      ['created_at', 'DESC'],
      ['id', 'DESC'],
    ],
    limit,
    offset,
    distinct: true,
  });

  return {
    data: rows.map(serializeRequest),
    pagination: buildPaginationMeta({ page, limit, count }),
  };
}

async function findRequestOrThrow(id) {
  const request = await SupportRequest.findByPk(id, { include: REQUEST_INCLUDE });
  if (!request) {
    throw AppError.notFound('SUPPORT_REQUEST_NOT_FOUND', 'That support request does not exist.');
  }
  return request;
}

function assertCanView(actor, request) {
  if (canManage(actor)) return;
  if (actor.role === ROLES.PARTNER_STAFF) {
    if (request.organization_id !== actor.organization_id) {
      throw AppError.forbidden(
        'SUPPORT_REQUEST_ACCESS_DENIED',
        'You can only view your own organization requests.'
      );
    }
    return;
  }
  if (actor.role === ROLES.LACA_OFFICER) {
    if (request.organization?.lga_id !== actor.lga_id) {
      throw AppError.forbidden(
        'SUPPORT_REQUEST_ACCESS_DENIED',
        'You can only view requests in your own LGA.'
      );
    }
    return;
  }
  throw AppError.forbidden('ROLE_NOT_ALLOWED', 'You cannot view support requests.');
}

async function getRequest(actor, id) {
  const request = await findRequestOrThrow(id);
  assertCanView(actor, request);
  return serializeRequest(request);
}

async function createRequest(actor, input) {
  if (actor.role !== ROLES.PARTNER_STAFF) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only partner staff can request support.');
  }
  if (!actor.organization_id) {
    throw AppError.forbidden('NO_ORGANIZATION', 'Your account is not linked to an organization.');
  }

  const organization = await Organization.findByPk(actor.organization_id, {
    attributes: ['id', 'lga_id', 'status'],
  });
  if (!organization || organization.status !== 'approved') {
    throw AppError.badRequest(
      'ORGANIZATION_NOT_APPROVED',
      'Your organization must be approved before you can request support.'
    );
  }

  const existing = await SupportRequest.findOne({
    where: { client_uuid: input.client_uuid },
    include: REQUEST_INCLUDE,
  });
  if (existing) {
    if (existing.organization_id !== actor.organization_id) {
      throw AppError.conflict(
        'CLIENT_UUID_TAKEN',
        'This request identifier belongs to another organization.'
      );
    }
    return serializeRequest(existing);
  }

  if (input.items.length) {
    const itemIds = input.items.map((item) => item.equipment_item_id);
    const equipment = await EquipmentItem.findAll({
      where: { id: { [Op.in]: itemIds }, is_active: true },
      attributes: ['id'],
    });
    if (equipment.length !== itemIds.length) {
      throw AppError.badRequest(
        'EQUIPMENT_NOT_FOUND',
        'One of the chosen equipment items is not available.'
      );
    }
  }

  const request = await sequelize.transaction(async (transaction) => {
    const created = await SupportRequest.create(
      {
        organization_id: actor.organization_id,
        client_uuid: input.client_uuid,
        kind: input.kind,
        description: input.description,
        status: 'requested',
        requested_by: actor.id,
      },
      { transaction }
    );

    if (input.items.length) {
      await SupportRequestItem.bulkCreate(
        input.items.map((item) => ({
          support_request_id: created.id,
          equipment_item_id: item.equipment_item_id,
          qty_requested: item.qty_requested,
          qty_approved: 0,
        })),
        { transaction }
      );
    }

    return created;
  });

  await notifyPlacaOfficers({
    kind: 'support_request',
    title: 'New support request',
    body: `${organization.name} asked for ${input.kind} support.`,
    link: '/support-requests',
  });

  await recordAudit({
    action: 'support_request_created',
    entity: 'SupportRequest',
    entityId: request.id,
    userId: actor.id,
    userRole: actor.role,
    newValue: { kind: request.kind, organization_id: request.organization_id },
  });

  return getRequest(actor, request.id);
}

async function decideRequest(actor, id, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can decide a request.');
  }
  const request = await findRequestOrThrow(id);
  if (request.status !== 'requested') {
    throw AppError.conflict(
      'SUPPORT_REQUEST_DECIDED',
      'This request has already been decided.'
    );
  }

  const approved = input.decision === 'approve';
  if (!approved && !input.note) {
    throw AppError.badRequest(
      'DECISION_NOTE_REQUIRED',
      'Explain why the request was rejected.'
    );
  }

  const quantities = new Map(
    (input.items || []).map((item) => [item.id, item.qty_approved])
  );

  await sequelize.transaction(async (transaction) => {
    request.status = approved ? 'approved' : 'rejected';
    request.decided_by = actor.id;
    request.decided_at = new Date();
    request.decision_note = input.note || null;
    await request.save({ transaction });

    for (const item of request.items || []) {
      if (approved) {
        const qty = quantities.has(item.id)
          ? quantities.get(item.id)
          : item.qty_requested;
        item.qty_approved = Math.min(qty, item.qty_requested);
      } else {
        item.qty_approved = 0;
      }
      await item.save({ transaction });
    }
  });

  await notifyUser({
    userId: request.requested_by,
    kind: 'support_request',
    title: approved ? 'Support request approved' : 'Support request rejected',
    body: approved
      ? `Your ${request.kind} request was approved.`
      : `Your ${request.kind} request was rejected. ${input.note || ''}`.trim(),
    link: '/support-requests',
  });

  await recordAudit({
    action: approved ? 'support_request_approved' : 'support_request_rejected',
    entity: 'SupportRequest',
    entityId: request.id,
    userId: actor.id,
    userRole: actor.role,
    oldValue: { status: 'requested' },
    newValue: { status: request.status, note: input.note || null },
  });

  return getRequest(actor, id);
}

async function recordSupply(actor, id, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can record a delivery.');
  }
  const request = await findRequestOrThrow(id);
  if (!['approved', 'in_transit'].includes(request.status)) {
    throw AppError.conflict(
      'SUPPORT_REQUEST_NOT_APPROVED',
      'Approve the request before recording a delivery.'
    );
  }

  const itemById = new Map((request.items || []).map((item) => [item.id, item]));
  const deliveredByItem = new Map();
  for (const row of request.supplyRecords || []) {
    deliveredByItem.set(
      row.support_request_item_id,
      (deliveredByItem.get(row.support_request_item_id) || 0) + row.qty_delivered
    );
  }

  for (const line of input.items) {
    const item = itemById.get(line.support_request_item_id);
    if (!item) {
      throw AppError.badRequest(
        'SUPPORT_ITEM_NOT_FOUND',
        'One of the delivered items is not part of this request.'
      );
    }
    const already = deliveredByItem.get(item.id) || 0;
    if (already + line.qty_delivered > item.qty_approved) {
      throw AppError.badRequest(
        'DELIVERY_EXCEEDS_APPROVAL',
        `The delivery for ${item.equipmentItem?.name || 'an item'} is more than the approved quantity.`
      );
    }
  }

  const deliveredAt = input.delivered_at ? new Date(`${input.delivered_at}T12:00:00Z`) : new Date();

  await sequelize.transaction(async (transaction) => {
    for (const line of input.items) {
      const item = itemById.get(line.support_request_item_id);
      await SupplyRecord.create(
        {
          support_request_id: request.id,
          support_request_item_id: item.id,
          equipment_item_id: item.equipment_item_id,
          qty_delivered: line.qty_delivered,
          delivered_at: deliveredAt,
          delivered_by: actor.id,
          note: input.note || null,
        },
        { transaction }
      );
    }

    if (request.status === 'approved') {
      request.status = 'in_transit';
      await request.save({ transaction });
    }
  });

  await notifyUser({
    userId: request.requested_by,
    kind: 'support_request',
    title: 'Support is on the way',
    body: 'PLACA recorded a delivery for your support request. Confirm receipt when it arrives.',
    link: '/support-requests',
  });

  await recordAudit({
    action: 'support_request_supplied',
    entity: 'SupportRequest',
    entityId: request.id,
    userId: actor.id,
    userRole: actor.role,
    newValue: { items: input.items, note: input.note || null },
  });

  return getRequest(actor, id);
}

async function confirmReceipt(actor, id) {
  if (actor.role !== ROLES.PARTNER_STAFF) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only partner staff can confirm receipt.');
  }
  const request = await findRequestOrThrow(id);
  assertCanView(actor, request);

  if (request.status === 'delivered') return serializeRequest(request);
  if (request.status !== 'in_transit') {
    throw AppError.conflict(
      'SUPPORT_REQUEST_NOT_IN_TRANSIT',
      'There is no delivery waiting for confirmation.'
    );
  }

  await sequelize.transaction(async (transaction) => {
    for (const record of request.supplyRecords || []) {
      if (!record.received_confirmed_by) {
        record.received_confirmed_by = actor.id;
        record.received_at = new Date();
        await record.save({ transaction });
      }
    }
    request.status = 'delivered';
    await request.save({ transaction });
  });

  await notifyUser({
    userId: request.decided_by,
    kind: 'support_request',
    title: 'Delivery confirmed',
    body: `${request.organization?.name || 'A partner'} confirmed receipt of a support delivery.`,
    link: '/support-requests',
  });

  await recordAudit({
    action: 'support_request_received',
    entity: 'SupportRequest',
    entityId: request.id,
    userId: actor.id,
    userRole: actor.role,
    oldValue: { status: 'in_transit' },
    newValue: { status: 'delivered' },
  });

  return getRequest(actor, id);
}

async function changeStatus(actor, id, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can change a request status.');
  }
  const request = await findRequestOrThrow(id);
  const allowed = {
    approved: ['in_transit', 'delivered'],
    in_transit: ['delivered'],
    delivered: ['closed'],
  };
  if (!(allowed[request.status] || []).includes(input.status)) {
    throw AppError.conflict(
      'SUPPORT_STATUS_INVALID',
      `A request that is ${request.status} cannot move to ${input.status}.`
    );
  }

  const previous = request.status;
  request.status = input.status;
  if (input.note) request.decision_note = input.note;
  await request.save();

  await notifyUser({
    userId: request.requested_by,
    kind: 'support_request',
    title: 'Support request updated',
    body: `Your ${request.kind} request is now ${input.status.replace('_', ' ')}.`,
    link: '/support-requests',
  });

  await recordAudit({
    action: 'support_request_status_changed',
    entity: 'SupportRequest',
    entityId: request.id,
    userId: actor.id,
    userRole: actor.role,
    oldValue: { status: previous },
    newValue: { status: input.status, note: input.note || null },
  });

  return getRequest(actor, id);
}

module.exports = {
  serializeRequest,
  listRequests,
  getRequest,
  createRequest,
  decideRequest,
  recordSupply,
  confirmReceipt,
  changeStatus,
};
