'use strict';

/**
 * Shared pagination helper for findAndCountAll results.
 */

function getPagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

function buildPaginationMeta({ page, limit, count }) {
  return {
    page,
    limit,
    total: count,
    totalPages: Math.ceil(count / limit) || 0,
  };
}

module.exports = { getPagination, buildPaginationMeta };
