'use strict';

/**
 * Explicit audit events for actions that are not a single model write:
 * login, failed login, TOTP changes, report validation, aggregation.
 *
 * Ordinary create/update/delete rows are written automatically by the Sequelize
 * hooks in models/auditHooks.js. This helper is for everything else.
 */

const { AuditLog } = require('../models');
const { getContext } = require('../utils/requestContext');
const { scrubObject } = require('../utils/sanitize');

async function recordAudit({
  action,
  entity,
  entityId = null,
  oldValue = null,
  newValue = null,
  userId,
  userRole,
  options = {},
}) {
  const context = getContext();
  return AuditLog.create(
    {
      user_id: userId !== undefined ? userId : context?.userId || null,
      user_role: userRole !== undefined ? userRole : context?.userRole || null,
      action,
      entity,
      entity_id: entityId ? String(entityId) : null,
      old_value: oldValue ? scrubObject(oldValue) : null,
      new_value: newValue ? scrubObject(newValue) : null,
      ip: context?.ip || null,
      user_agent: context?.userAgent || null,
      request_id: context?.requestId || null,
    },
    { transaction: options.transaction }
  );
}

module.exports = { recordAudit };
