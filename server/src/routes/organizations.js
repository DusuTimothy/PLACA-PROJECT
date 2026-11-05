'use strict';

/**
 * /api/organizations routes.
 *
 * Admin is intentionally absent: administering accounts and the audit log is
 * not the same as editing programme data.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/organization');
const controller = require('../controllers/organizationController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

const PROGRAMME_ROLES = ['partner_staff', 'laca_officer', 'placa_officer', 'placa_director'];
const PLACA_ROLES = ['placa_officer', 'placa_director'];

router.use(authenticate, requirePasswordChanged);
router.use(requireRole(...PROGRAMME_ROLES));

router.get('/', validate(schema.listOrganizations), asyncHandler(controller.list));
router.post(
  '/',
  requireRole('laca_officer', ...PLACA_ROLES),
  validate(schema.createOrganization),
  asyncHandler(controller.create)
);
router.get('/:id', validate(schema.organizationParams), asyncHandler(controller.getOne));
router.patch('/:id', validate(schema.updateOrganization), asyncHandler(controller.update));
router.post(
  '/:id/approve',
  requireRole(...PLACA_ROLES),
  validate(schema.reviewOrganization),
  asyncHandler(controller.approve)
);
router.post(
  '/:id/suspend',
  requireRole(...PLACA_ROLES),
  validate(schema.reviewOrganization),
  asyncHandler(controller.suspend)
);

module.exports = router;
