'use strict';

/**
 * /api/workplans routes.
 *
 * Partners author and submit; LACA officers read plans in their LGA; PLACA
 * officers approve or return them.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/workplan');
const controller = require('../controllers/workplanController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

const PROGRAMME_ROLES = ['partner_staff', 'laca_officer', 'placa_officer', 'placa_director'];
const PLACA_ROLES = ['placa_officer', 'placa_director'];

router.use(authenticate, requirePasswordChanged);
router.use(requireRole(...PROGRAMME_ROLES));

router.get('/', validate(schema.listWorkplans), asyncHandler(controller.list));
router.post(
  '/',
  requireRole('partner_staff'),
  validate(schema.createWorkplan),
  asyncHandler(controller.create)
);
router.get('/:id', validate(schema.workplanParams), asyncHandler(controller.getOne));
router.patch(
  '/:id',
  requireRole('partner_staff'),
  validate(schema.updateWorkplan),
  asyncHandler(controller.update)
);
router.delete(
  '/:id',
  requireRole('partner_staff'),
  validate(schema.workplanParams),
  asyncHandler(controller.remove)
);
router.post(
  '/:id/submit',
  requireRole('partner_staff'),
  validate(schema.workplanParams),
  asyncHandler(controller.submit)
);
router.post(
  '/:id/review',
  requireRole(...PLACA_ROLES),
  validate(schema.reviewWorkplan),
  asyncHandler(controller.review)
);

module.exports = router;
