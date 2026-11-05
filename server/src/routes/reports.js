'use strict';

/**
 * /api/reports routes.
 *
 * Partners enter and submit counts; PLACA officers validate or return them.
 * Aggregation into public_summary happens in Phase 4, never on this route.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/report');
const controller = require('../controllers/reportController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

const PROGRAMME_ROLES = ['partner_staff', 'laca_officer', 'placa_officer', 'placa_director'];
const PLACA_ROLES = ['placa_officer', 'placa_director'];

router.use(authenticate, requirePasswordChanged);
router.use(requireRole(...PROGRAMME_ROLES));

router.get('/', validate(schema.listReports), asyncHandler(controller.list));
router.get('/export/pdf', validate(schema.exportReports), asyncHandler(controller.exportPdf));
router.get('/export', validate(schema.exportReports), asyncHandler(controller.exportCsv));
router.post(
  '/',
  requireRole('partner_staff'),
  validate(schema.createReport),
  asyncHandler(controller.create)
);
router.get('/:id', validate(schema.reportParams), asyncHandler(controller.getOne));
router.patch(
  '/:id',
  requireRole('partner_staff'),
  validate(schema.updateReport),
  asyncHandler(controller.update)
);
router.delete(
  '/:id',
  requireRole('partner_staff'),
  validate(schema.reportParams),
  asyncHandler(controller.remove)
);
router.post(
  '/:id/submit',
  requireRole('partner_staff'),
  validate(schema.reportParams),
  asyncHandler(controller.submit)
);
router.post(
  '/:id/review',
  requireRole(...PLACA_ROLES),
  validate(schema.reviewReport),
  asyncHandler(controller.review)
);

module.exports = router;
