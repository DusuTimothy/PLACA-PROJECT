'use strict';

/**
 * Global Sequelize audit hooks.
 *
 * Every business create/update/delete writes one audit row. The row records
 * the acting user and IP from AsyncLocalStorage, the changed field names, and
 * scrubbed old/new values.
 *
 * Excluded models:
 * - AuditLog: writing an audit row for an audit row would recurse.
 * - RefreshToken: contains security tokens; token rotation is operational noise.
 * - UserGuideProgress: learning progress, not programme/business data.
 * - Notification: read receipts and in-app notices are operational noise.
 * - ChatConversation/ChatMessage: private assistant conversations must not be
 *   copied into the audit log.
 */

const { getContext } = require('../utils/requestContext');
const { scrubObject } = require('../utils/sanitize');

const EXCLUDED_MODELS = new Set([
  'AuditLog',
  'RefreshToken',
  'UserGuideProgress',
  'Notification',
  'ChatConversation',
  'ChatMessage',
]);

function cloneValue(value) {
  if (value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return '[binary]';
  return value;
}

function pickValues(data, fields) {
  const output = {};
  for (const field of fields) {
    output[field] = cloneValue(data[field]);
  }
  return scrubObject(output);
}

async function writeAudit(db, { action, entity, entityId, oldValue, newValue, options }) {
  const context = getContext();
  await db.AuditLog.create(
    {
      user_id: context?.userId || null,
      user_role: context?.userRole || null,
      action,
      entity,
      entity_id: entityId ? String(entityId) : null,
      old_value: oldValue,
      new_value: newValue,
      ip: context?.ip || null,
      user_agent: context?.userAgent || null,
      request_id: context?.requestId || null,
    },
    { transaction: options?.transaction }
  );
}

function applyAuditHooks(db) {
  for (const [modelName, model] of Object.entries(db)) {
    if (typeof model !== 'function' || !model.addHook) continue;
    if (EXCLUDED_MODELS.has(modelName)) continue;

    // Audit the model's own columns only. Included associations are model
    // instances with circular references, so they are never picked up.
    const columns = Object.keys(model.rawAttributes || {});

    model.addHook('afterCreate', (instance, options) =>
      writeAudit(db, {
        action: 'create',
        entity: modelName,
        entityId: instance.id,
        oldValue: null,
        newValue: pickValues(instance.dataValues, columns),
        options,
      })
    );

    model.addHook('afterUpdate', (instance, options) => {
      const changed = instance.changed() || [];
      if (!changed.length) return undefined;

      const previous = instance._previousDataValues || {};
      const oldValue = pickValues(previous, changed);
      const newValue = pickValues(instance.dataValues, changed);

      return writeAudit(db, {
        action: 'update',
        entity: modelName,
        entityId: instance.id,
        oldValue,
        newValue,
        options,
      });
    });

    model.addHook('afterDestroy', (instance, options) =>
      writeAudit(db, {
        action: 'delete',
        entity: modelName,
        entityId: instance.id,
        oldValue: pickValues(instance.dataValues, columns),
        newValue: null,
        options,
      })
    );

    // Bulk operations bypass instance hooks in Sequelize. The services in this
    // project use instance saves inside transactions so the trail stays complete.
  }
}

module.exports = applyAuditHooks;
