'use strict';

/**
 * Request-scoped context using AsyncLocalStorage.
 *
 * Model audit hooks run deep inside Sequelize and have no access to `req`.
 * This store lets them read the current user id, IP, and request id without
 * threading those values through every service call.
 */

const { AsyncLocalStorage } = require('async_hooks');
const { randomUUID } = require('crypto');

const storage = new AsyncLocalStorage();

function runWithContext(initial, callback) {
  const context = {
    requestId: initial.requestId || randomUUID(),
    ip: initial.ip || null,
    userAgent: initial.userAgent || null,
    userId: initial.userId || null,
    userRole: initial.userRole || null,
  };
  return storage.run(context, callback);
}

function getContext() {
  return storage.getStore() || null;
}

/**
 * Called by the auth middleware after the JWT has been verified.
 * The context object is mutable on purpose so the same request keeps one id.
 */
function setContextUser(userId, userRole) {
  const context = storage.getStore();
  if (context) {
    context.userId = userId;
    context.userRole = userRole;
  }
}

module.exports = { runWithContext, getContext, setContextUser };
