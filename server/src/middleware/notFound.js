'use strict';

/**
 * Any request that reached this middleware matched no route.
 * Returning JSON (not an HTML error page) keeps API clients predictable.
 */
module.exports = function notFound(req, res) {
  res.status(404).json({
    error: 'ROUTE_NOT_FOUND',
    message: `No API route matches ${req.method} ${req.originalUrl}`,
  });
};
