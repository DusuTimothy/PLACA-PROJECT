'use strict';

/**
 * Dashboard endpoints (Phase 4). Scope is resolved from the signed-in role.
 */

const service = require('../services/dashboardService');

async function overview(req, res) {
  const data = await service.overview(req.user, req.query);
  return res.json({ data });
}

module.exports = { overview };
