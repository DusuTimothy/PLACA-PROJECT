'use strict';

/**
 * Opens one AsyncLocalStorage context per HTTP request.
 * Audit hooks read this context to record who made a change and from where.
 */

const { runWithContext } = require('../utils/requestContext');

function requestContext(req, res, next) {
  runWithContext(
    {
      requestId: req.headers['x-request-id'],
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    },
    () => next()
  );
}

module.exports = requestContext;
