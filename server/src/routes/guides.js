'use strict';

/**
 * /api/guides routes.
 *
 * Every signed-in account can read help content and record progress. Only
 * PLACA officers edit the library.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/guide');
const controller = require('../controllers/guideController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();
const PLACA_ROLES = ['placa_officer', 'placa_director'];

router.use(authenticate, requirePasswordChanged);

router.get('/progress', asyncHandler(controller.progress));
router.post(
  '/progress/:key',
  validate(schema.progressBody),
  asyncHandler(controller.markProgress)
);

router.get('/', validate(schema.listGuides), asyncHandler(controller.list));
router.post(
  '/',
  requireRole(...PLACA_ROLES),
  validate(schema.createGuide),
  asyncHandler(controller.create)
);
router.get('/:key', validate(schema.guideParams), asyncHandler(controller.getOne));
router.patch(
  '/:id',
  requireRole(...PLACA_ROLES),
  validate(schema.updateGuide),
  asyncHandler(controller.update)
);
router.delete(
  '/:id',
  requireRole(...PLACA_ROLES),
  validate(schema.guideIdParams),
  asyncHandler(controller.remove)
);

module.exports = router;
