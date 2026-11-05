'use strict';

/**
 * Reference data: LGAs, indicators and the audit log.
 */

const { Op } = require('sequelize');
const { Lga, Indicator, AuditLog } = require('../models');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

async function listLgas(req, res) {
  const lgas = await Lga.findAll({
    attributes: ['id', 'name', 'code'],
    order: [['name', 'ASC']],
  });
  return res.json({ data: lgas });
}

async function listIndicators(req, res) {
  const where = {};
  if (req.query.category) where.category = req.query.category;
  if (req.query.is_active !== undefined) where.is_active = req.query.is_active;
  if (req.query.search) {
    where[Op.or] = [
      { code: { [Op.iLike]: `%${req.query.search}%` } },
      { name: { [Op.iLike]: `%${req.query.search}%` } },
    ];
  }

  const indicators = await Indicator.findAll({
    where,
    attributes: [
      'id', 'code', 'name', 'plain_language_definition', 'category',
      'unit', 'disaggregations', 'validation_rules', 'is_active', 'version',
    ],
    order: [['category', 'ASC'], ['name', 'ASC']],
  });

  return res.json({ data: indicators });
}

async function listAuditLogs(req, res) {
  const { page, limit, offset } = getPagination(req.query);
  const where = {};

  if (req.query.action) where.action = req.query.action;
  if (req.query.entity) where.entity = req.query.entity;
  if (req.query.entity_id) where.entity_id = req.query.entity_id;
  if (req.query.user_id) where.user_id = req.query.user_id;

  if (req.query.from || req.query.to) {
    where.created_at = {};
    if (req.query.from) where.created_at[Op.gte] = req.query.from;
    if (req.query.to) where.created_at[Op.lte] = req.query.to;
  }

  const { rows, count } = await AuditLog.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  // Audit rows are returned in snake_case like the rest of the API. Sequelize
  // exposes createdAt/updatedAt to JSON even though the columns are created_at
  // and updated_at, so normalise them explicitly.
  const data = rows.map((row) => {
    const plain = row.toJSON();
    return {
      id: plain.id,
      user_id: plain.user_id,
      user_role: plain.user_role,
      action: plain.action,
      entity: plain.entity,
      entity_id: plain.entity_id,
      old_value: plain.old_value,
      new_value: plain.new_value,
      ip: plain.ip,
      user_agent: plain.user_agent,
      request_id: plain.request_id,
      created_at: plain.createdAt,
      updated_at: plain.updatedAt,
    };
  });

  return res.json({
    data,
    pagination: buildPaginationMeta({ page, limit, count }),
  });
}

module.exports = { listLgas, listIndicators, listAuditLogs };
