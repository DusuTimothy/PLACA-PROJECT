'use strict';

/**
 * /api/aggregation routes.
 *
 * Publishing is a deliberate PLACA action, not a side effect of validating a
 * report. The scheduler calls the same service at night.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/aggregation');
const controller = require('../controllers/aggregationController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate, requirePasswordChanged);
router.use(requireRole('placa_officer', 'placa_director'));

router.get('/status', validate(schema.aggregationStatus), asyncHandler(controller.status));
router.post('/run', validate(schema.runAggregation), asyncHandler(controller.run));

module.exports = router;
