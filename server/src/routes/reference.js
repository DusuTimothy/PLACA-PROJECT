'use strict';

/**
 * /api/lgas and /api/indicators are read-only reference data for every signed-in
 * user. These are used by paper-style forms and offline caching.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/reference');
const controller = require('../controllers/referenceController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');

const router = express.Router();

// Auth is attached per route, not with router.use(). This router is mounted at
// /api, so a blanket guard would also answer unrelated /api/* paths with 401
// instead of letting them fall through to the 404 handler.
const guard = [authenticate, requirePasswordChanged];

router.get('/lgas', ...guard, validate(schema.listLgas), asyncHandler(controller.listLgas));
router.get(
  '/indicators',
  ...guard,
  validate(schema.listIndicators),
  asyncHandler(controller.listIndicators)
);

module.exports = router;
