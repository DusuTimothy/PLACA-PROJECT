'use strict';

/**
 * Equipment catalogue and stock by LGA.
 *
 * The state store is represented by a stock row with lga_id = null. Partners
 * may read the catalogue and the stock in their own LGA; PLACA officers manage
 * the catalogue and every stock row.
 */

const { Op } = require('sequelize');
const { EquipmentItem, StockLevel, Lga, Organization } = require('../models');
const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { ROLES, PLACA_ROLES } = require('../middleware/rbac');

function plain(instance) {
  return instance && instance.toJSON ? instance.toJSON() : instance;
}

function serializeItem(instance) {
  const item = plain(instance);
  if (!item) return null;
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    unit: item.unit,
    is_active: item.is_active,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function canManage(actor) {
  return PLACA_ROLES.includes(actor.role);
}

async function resolveLga(actor) {
  if (actor.lga_id) return actor.lga_id;
  if (actor.organization_id) {
    const organization = await Organization.findByPk(actor.organization_id, {
      attributes: ['lga_id'],
    });
    return organization?.lga_id || null;
  }
  return null;
}

async function listItems(actor, query) {
  const { page, limit, offset } = getPagination(query);
  const where = {};
  if (query.active_only === 'true' || !canManage(actor)) where.is_active = true;
  if (query.search) {
    const term = `%${query.search}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: term } },
      { description: { [Op.iLike]: term } },
    ];
  }

  const { rows, count } = await EquipmentItem.findAndCountAll({
    where,
    order: [['name', 'ASC']],
    limit,
    offset,
  });
  return {
    data: rows.map(serializeItem),
    pagination: buildPaginationMeta({ page, limit, count }),
  };
}

async function getItem(id) {
  const item = await EquipmentItem.findByPk(id);
  if (!item) throw AppError.notFound('EQUIPMENT_NOT_FOUND', 'That equipment item does not exist.');
  return item;
}

async function createItem(actor, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can manage equipment.');
  }
  const clash = await EquipmentItem.findOne({
    where: { name: { [Op.iLike]: input.name } },
    attributes: ['id'],
  });
  if (clash) {
    throw AppError.conflict('EQUIPMENT_NAME_TAKEN', 'An item with that name already exists.');
  }
  const item = await EquipmentItem.create({
    name: input.name,
    description: input.description || null,
    unit: input.unit || 'unit',
    is_active: input.is_active !== undefined ? input.is_active : true,
  });
  return serializeItem(item);
}

async function updateItem(actor, id, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can manage equipment.');
  }
  const item = await getItem(id);
  if (input.name) {
    const clash = await EquipmentItem.findOne({
      where: { id: { [Op.ne]: item.id }, name: { [Op.iLike]: input.name } },
      attributes: ['id'],
    });
    if (clash) {
      throw AppError.conflict('EQUIPMENT_NAME_TAKEN', 'An item with that name already exists.');
    }
  }
  Object.assign(item, input);
  await item.save();
  return serializeItem(item);
}

async function deleteItem(actor, id) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can manage equipment.');
  }
  const item = await getItem(id);
  await item.destroy();
  return { deleted: true };
}

async function listStock(actor, query) {
  const lgaScope = await resolveLga(actor);
  let requestedLga = query.lga_id || null;
  if (!canManage(actor)) requestedLga = lgaScope;

  const where = {};
  if (canManage(actor)) {
    if (requestedLga !== null && requestedLga !== undefined) where.lga_id = requestedLga;
  } else if (lgaScope) {
    where[Op.or] = [{ lga_id: lgaScope }, { lga_id: null }];
  } else {
    where.lga_id = null;
  }

  const [items, levels] = await Promise.all([
    EquipmentItem.findAll({
      where: canManage(actor) ? {} : { is_active: true },
      order: [['name', 'ASC']],
    }),
    StockLevel.findAll({
      where,
      include: [{ model: Lga, as: 'lga', attributes: ['id', 'name', 'code'] }],
    }),
  ]);

  const byItem = new Map();
  for (const level of levels) {
    if (!byItem.has(level.equipment_item_id)) byItem.set(level.equipment_item_id, []);
    byItem.get(level.equipment_item_id).push({
      id: level.id,
      lga_id: level.lga_id,
      quantity: level.quantity,
      updated_at: level.updatedAt,
      lga: level.lga ? { id: level.lga.id, name: level.lga.name, code: level.lga.code } : null,
    });
  }

  return {
    data: items.map((item) => ({
      ...serializeItem(item),
      stock_levels: byItem.get(item.id) || [],
    })),
  };
}

async function setStock(actor, itemId, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can change stock.');
  }
  await getItem(itemId);

  const lgaId = input.lga_id || null;
  if (lgaId) {
    const lga = await Lga.findByPk(lgaId, { attributes: ['id'] });
    if (!lga) throw AppError.badRequest('LGA_NOT_FOUND', 'That LGA does not exist.');
  }

  let level = await StockLevel.findOne({
    where: { equipment_item_id: itemId, lga_id: lgaId },
  });
  if (!level) {
    level = await StockLevel.create({
      equipment_item_id: itemId,
      lga_id: lgaId,
      quantity: input.quantity,
      updated_by: actor.id,
    });
  } else {
    level.quantity = input.quantity;
    level.updated_by = actor.id;
    await level.save();
  }

  return {
    id: level.id,
    equipment_item_id: level.equipment_item_id,
    lga_id: level.lga_id,
    quantity: level.quantity,
    updated_at: level.updatedAt,
  };
}

module.exports = {
  serializeItem,
  listItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  listStock,
  setStock,
  canManage,
  resolveLga,
};
