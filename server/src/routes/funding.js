'use strict';

/**
 * /api/funding routes.
 *
 * Sources and allocations are readable by programme roles with scope applied
 * in the service. Inflows and every write are PLACA-only.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/funding');
const controller = require('../controllers/fundingController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();
const PROGRAMME_ROLES = ['partner_staff', 'laca_officer', 'placa_officer', 'placa_director'];
const PLACA_ROLES = ['placa_officer', 'placa_director'];

router.use(authenticate, requirePasswordChanged);
router.use(requireRole(...PROGRAMME_ROLES));

router.get('/sources', validate(schema.listSources), asyncHandler(controller.listSources));
router.post(
  '/sources',
  requireRole(...PLACA_ROLES),
  validate(schema.createSource),
  asyncHandler(controller.createSource)
);
router.patch(
  '/sources/:id',
  requireRole(...PLACA_ROLES),
  validate(schema.updateSource),
  asyncHandler(controller.updateSource)
);
router.delete(
  '/sources/:id',
  requireRole(...PLACA_ROLES),
  validate(schema.sourceParams),
  asyncHandler(controller.removeSource)
);

router.get(
  '/inflows',
  requireRole(...PLACA_ROLES),
  validate(schema.listInflows),
  asyncHandler(controller.listInflows)
);
router.post(
  '/inflows',
  requireRole(...PLACA_ROLES),
  validate(schema.createInflow),
  asyncHandler(controller.createInflow)
);
router.patch(
  '/inflows/:id',
  requireRole(...PLACA_ROLES),
  validate(schema.updateInflow),
  asyncHandler(controller.updateInflow)
);
router.delete(
  '/inflows/:id',
  requireRole(...PLACA_ROLES),
  validate(schema.inflowParams),
  asyncHandler(controller.removeInflow)
);

router.get(
  '/allocations',
  validate(schema.listAllocations),
  asyncHandler(controller.listAllocations)
);
router.post(
  '/allocations',
  requireRole(...PLACA_ROLES),
  validate(schema.createAllocation),
  asyncHandler(controller.createAllocation)
);
router.patch(
  '/allocations/:id',
  requireRole(...PLACA_ROLES),
  validate(schema.updateAllocation),
  asyncHandler(controller.updateAllocation)
);
router.delete(
  '/allocations/:id',
  requireRole(...PLACA_ROLES),
  validate(schema.allocationParams),
  asyncHandler(controller.removeAllocation)
);

router.get('/summary', validate(schema.summaryQuery), asyncHandler(controller.summary));

module.exports = router;
