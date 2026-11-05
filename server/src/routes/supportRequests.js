'use strict';

/**
 * /api/support-requests routes.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/supportRequest');
const controller = require('../controllers/supportRequestController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();
const PROGRAMME_ROLES = ['partner_staff', 'laca_officer', 'placa_officer', 'placa_director'];
const PLACA_ROLES = ['placa_officer', 'placa_director'];

router.use(authenticate, requirePasswordChanged);
router.use(requireRole(...PROGRAMME_ROLES));

router.get('/', validate(schema.listRequests), asyncHandler(controller.list));
router.post(
  '/',
  requireRole('partner_staff'),
  validate(schema.createRequest),
  asyncHandler(controller.create)
);
router.get('/:id', validate(schema.requestParams), asyncHandler(controller.getOne));
router.post(
  '/:id/decision',
  requireRole(...PLACA_ROLES),
  validate(schema.decideRequest),
  asyncHandler(controller.decide)
);
router.post(
  '/:id/supplies',
  requireRole(...PLACA_ROLES),
  validate(schema.recordSupply),
  asyncHandler(controller.supply)
);
router.post(
  '/:id/confirm-receipt',
  requireRole('partner_staff'),
  validate(schema.requestParams),
  asyncHandler(controller.confirm)
);
router.post(
  '/:id/status',
  requireRole(...PLACA_ROLES),
  validate(schema.changeStatus),
  asyncHandler(controller.status)
);

module.exports = router;
