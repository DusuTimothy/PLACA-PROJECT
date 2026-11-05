'use strict';

/**
 * /api/dashboard routes.
 *
 * All programme roles may read an overview; the service narrows it to their
 * own organization or LGA. Admin is not a programme role.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/dashboard');
const controller = require('../controllers/dashboardController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate, requirePasswordChanged);
router.use(requireRole('partner_staff', 'laca_officer', 'placa_officer', 'placa_director'));

router.get('/overview', validate(schema.overview), asyncHandler(controller.overview));

module.exports = router;
