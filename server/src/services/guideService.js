'use strict';

/**
 * Help centre content and per-user learning progress.
 *
 * Guides are data, not code. PLACA officers edit them in the app. Readers see
 * only published guides addressed to their role; an empty audience_roles array
 * means everyone.
 */

const { Op } = require('sequelize');
const { Guide, UserGuideProgress, User } = require('../models');
const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { ROLES, PLACA_ROLES } = require('../middleware/rbac');
const { recordAudit } = require('./auditService');

const EDITOR_ROLES = PLACA_ROLES;

function plain(instance) {
  return instance && instance.toJSON ? instance.toJSON() : instance;
}

function serializeGuide(instance) {
  const guide = plain(instance);
  if (!guide) return null;
  return {
    id: guide.id,
    key: guide.key,
    language: guide.language,
    title: guide.title,
    body_md: guide.body_md,
    audience_roles: guide.audience_roles || [],
    page_key: guide.page_key,
    field_key: guide.field_key,
    sort_order: guide.sort_order,
    is_published: guide.is_published,
    updated_by: guide.updated_by,
    updated_at: guide.updatedAt,
    created_at: guide.createdAt,
    editor: guide.editor
      ? { id: guide.editor.id, name: guide.editor.name }
      : null,
  };
}

function canEdit(actor) {
  return EDITOR_ROLES.includes(actor.role);
}

function visibleTo(guide, actor) {
  // Editors can open any guide, including a draft or one addressed to another
  // audience, so they can review and edit it.
  if (canEdit(actor)) return true;
  if (!guide.is_published) return false;
  const audience = guide.audience_roles || [];
  return audience.length === 0 || audience.includes(actor.role);
}

async function listGuides(actor, query) {
  const language = query.language || actor.language || 'en';
  const manage = query.manage === 'true' && canEdit(actor);
  const { page, limit, offset } = getPagination(query);
  const where = { language };

  if (!manage) where.is_published = true;
  if (query.page_key) where.page_key = query.page_key;
  if (query.field_key) where.field_key = query.field_key;
  if (query.search) {
    const term = `%${query.search}%`;
    where[Op.or] = [
      { title: { [Op.iLike]: term } },
      { body_md: { [Op.iLike]: term } },
      { key: { [Op.iLike]: term } },
    ];
  }

  const rows = await Guide.findAll({
    where,
    include: [{ model: User, as: 'editor', attributes: ['id', 'name'] }],
    order: [
      ['sort_order', 'ASC'],
      ['title', 'ASC'],
    ],
  });

  const visible = rows.filter((guide) => manage || visibleTo(guide, actor));
  const total = visible.length;
  return {
    data: visible.slice(offset, offset + limit).map(serializeGuide),
    pagination: buildPaginationMeta({ page, limit, count: total }),
  };
}

async function getGuide(actor, key, language) {
  const guide = await Guide.findOne({
    where: { key, language: language || actor.language || 'en' },
    include: [{ model: User, as: 'editor', attributes: ['id', 'name'] }],
  });
  if (!guide || !visibleTo(guide, actor)) {
    throw AppError.notFound('GUIDE_NOT_FOUND', 'That guide does not exist.');
  }
  return serializeGuide(guide);
}

async function assertUnique(key, language, ignoreId = null) {
  const where = { key, language };
  if (ignoreId) where.id = { [Op.ne]: ignoreId };
  const existing = await Guide.findOne({ where, attributes: ['id'] });
  if (existing) {
    throw AppError.conflict(
      'GUIDE_EXISTS',
      'A guide with that key and language already exists.'
    );
  }
}

async function createGuide(actor, input) {
  if (!canEdit(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can edit guides.');
  }
  await assertUnique(input.key, input.language);

  const guide = await Guide.create({
    key: input.key,
    language: input.language,
    title: input.title,
    body_md: input.body_md,
    audience_roles: input.audience_roles || [],
    page_key: input.page_key || null,
    field_key: input.field_key || null,
    sort_order: input.sort_order || 0,
    is_published: input.is_published !== undefined ? input.is_published : true,
    updated_by: actor.id,
  });

  await recordAudit({
    action: 'guide_created',
    entity: 'Guide',
    entityId: guide.id,
    userId: actor.id,
    userRole: actor.role,
    newValue: { key: guide.key, language: guide.language, title: guide.title },
  });

  return getGuide(actor, guide.key, guide.language);
}

async function updateGuide(actor, id, input) {
  if (!canEdit(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can edit guides.');
  }
  const guide = await Guide.findByPk(id);
  if (!guide) throw AppError.notFound('GUIDE_NOT_FOUND', 'That guide does not exist.');

  if (input.key !== undefined || input.language !== undefined) {
    await assertUnique(
      input.key !== undefined ? input.key : guide.key,
      input.language !== undefined ? input.language : guide.language,
      guide.id
    );
  }

  const before = { key: guide.key, language: guide.language, title: guide.title };
  Object.assign(guide, input, { updated_by: actor.id });
  await guide.save();

  await recordAudit({
    action: 'guide_updated',
    entity: 'Guide',
    entityId: guide.id,
    userId: actor.id,
    userRole: actor.role,
    oldValue: before,
    newValue: { key: guide.key, language: guide.language, title: guide.title },
  });

  return getGuide(actor, guide.key, guide.language);
}

async function deleteGuide(actor, id) {
  if (!canEdit(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can edit guides.');
  }
  const guide = await Guide.findByPk(id);
  if (!guide) throw AppError.notFound('GUIDE_NOT_FOUND', 'That guide does not exist.');

  await guide.destroy();
  await recordAudit({
    action: 'guide_deleted',
    entity: 'Guide',
    entityId: id,
    userId: actor.id,
    userRole: actor.role,
    oldValue: { key: guide.key, language: guide.language, title: guide.title },
  });
  return { deleted: true };
}

async function listProgress(actor) {
  const rows = await UserGuideProgress.findAll({
    where: { user_id: actor.id },
    order: [['updated_at', 'DESC']],
  });
  return {
    data: rows.map((row) => ({
      guide_key: row.guide_key,
      completed_at: row.completed_at,
      dismissed_at: row.dismissed_at,
    })),
  };
}

async function markProgress(actor, key, input) {
  const guide = await Guide.findOne({
    where: { key, language: actor.language || 'en', is_published: true },
  });
  if (!guide || !visibleTo(guide, actor)) {
    throw AppError.notFound('GUIDE_NOT_FOUND', 'That guide does not exist.');
  }

  let progress = await UserGuideProgress.findOne({
    where: { user_id: actor.id, guide_key: key },
  });
  if (!progress) {
    progress = await UserGuideProgress.create({
      user_id: actor.id,
      guide_key: key,
    });
  }

  if (input.completed !== undefined) {
    progress.completed_at = input.completed ? new Date() : null;
  }
  if (input.dismissed !== undefined) {
    progress.dismissed_at = input.dismissed ? new Date() : null;
  }
  await progress.save();

  return {
    guide_key: progress.guide_key,
    completed_at: progress.completed_at,
    dismissed_at: progress.dismissed_at,
  };
}

module.exports = {
  serializeGuide,
  listGuides,
  getGuide,
  createGuide,
  updateGuide,
  deleteGuide,
  listProgress,
  markProgress,
  canEdit,
};
