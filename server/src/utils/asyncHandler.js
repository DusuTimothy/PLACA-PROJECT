'use strict';

/**
 * Express 4 does not forward rejected promises to error middleware.
 * Wrapping every async controller keeps the error handler in one place.
 */
module.exports = function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};
