'use strict';

/**
 * Public HTTP layer. No cookies, no session, cacheable for a short time.
 */

const publicService = require('../services/publicService');

async function summary(req, res) {
  const data = await publicService.getSummary(req.query);

  // Public aggregates change at reporting cadence, not per request. A short
  // browser/proxy cache keeps the landing page fast and protects the database.
  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  return res.json(data);
}

module.exports = { summary };
