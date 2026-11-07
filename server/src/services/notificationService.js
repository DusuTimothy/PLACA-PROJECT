'use strict';

/**
 * In-app notifications.
 *
 * Notifications are deliberately short and link to the record they describe.
 * They are excluded from the audit hooks: reading a notice is not a business
 * change, and a read receipt should not fill the audit trail.
 */

const { Op } = require('sequelize');
const { Notification, User } = require('../models');
const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { ROLES, PLACA_ROLES } = require('../middleware/rbac');

function plain(instance) {
  return instance && instance.toJSON ? instance.toJSON() : instance;
}

function serializeNotification(instance) {
  const item = plain(instance);
  if (!item) return null;
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    body: item.body,
    link: item.link,
    read_at: item.read_at,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

async function notifyUser({ userId, kind, title, body, link = null, options = {} }) {
  if (!userId) return null;
  return Notification.create(
    {
      user_id: userId,
      kind,
      title,
      body,
      link,
    },
    { transaction: options.transaction }
  );
}

async function notifyUsers(userIds, payload) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  if (unique.length === 0) return [];
  return Promise.all(unique.map((userId) => notifyUser({ userId, ...payload })));
}

async function notifyPlacaOfficers(payload) {
  const officers = await User.findAll({
    where: { role: { [Op.in]: PLACA_ROLES }, is_active: true },
    attributes: ['id'],
    raw: true,
    transaction: payload.options?.transaction,
  });
  return notifyUsers(officers.map((row) => row.id), payload);
}

async function notifyOrganizationPartners(organizationId, payload) {
  if (!organizationId) return [];
  const partners = await User.findAll({
    where: {
      role: ROLES.PARTNER_STAFF,
      organization_id: organizationId,
      is_active: true,
    },
    attributes: ['id'],
    raw: true,
    transaction: payload.options?.transaction,
  });
  return notifyUsers(partners.map((row) => row.id), payload);
}

async function listNotifications(actor, query) {
  const { page, limit, offset } = getPagination(query);
  const where = { user_id: actor.id };
  if (query.unread === 'true') where.read_at = null;

  const { rows, count } = await Notification.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
    offset,
  });

  const unread = await Notification.count({
    where: { user_id: actor.id, read_at: null },
  });

  return {
    data: rows.map(serializeNotification),
    unread,
    pagination: buildPaginationMeta({ page, limit, count }),
  };
}

async function unreadCount(actor) {
  const count = await Notification.count({
    where: { user_id: actor.id, read_at: null },
  });
  return { unread: count };
}

async function markRead(actor, id) {
  const notification = await Notification.findOne({
    where: { id, user_id: actor.id },
  });
  if (!notification) {
    throw AppError.notFound('NOTIFICATION_NOT_FOUND', 'That notification does not exist.');
  }
  if (!notification.read_at) {
    notification.read_at = new Date();
    await notification.save();
  }
  return serializeNotification(notification);
}

async function markAllRead(actor) {
  const [updated] = await Notification.update(
    { read_at: new Date() },
    { where: { user_id: actor.id, read_at: null } }
  );
  return { updated };
}

module.exports = {
  serializeNotification,
  notifyUser,
  notifyUsers,
  notifyPlacaOfficers,
  notifyOrganizationPartners,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
};
