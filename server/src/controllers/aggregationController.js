'use strict';

/**
 * Aggregation endpoints (Phase 4).
 *
 * Only PLACA officers and the director can publish results. Admin is excluded:
 * administrators manage accounts, never programme data.
 */

const service = require('../services/aggregationService');

async function run(req, res) {
  const result = await service.aggregatePeriod({
    periodType: req.body.period_type,
    periodYear: req.body.period_year,
    periodNumber: req.body.period_number,
  });
  return res.json({ data: result });
}

async function status(req, res) {
  const result = await service.status(req.query.period);
  return res.json({ data: result });
}

module.exports = { run, status };
