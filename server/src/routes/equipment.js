'use strict';

/**
 * /api/equipment routes.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/equipment');
const controller = require('../controllers/equipmentController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();
const PROGRAMME_ROLES = ['partner_staff', 'laca_officer', 'placa_officer', 'placa_director'];
const PLACA_ROLES = ['placa_officer', 'placa_director'];

router.use(authenticate, requirePasswordChanged);
router.use(requireRole(...PROGRAMME_ROLES));

router.get('/', validate(schema.listItems), asyncHandler(controller.list));
router.get('/stock', validate(schema.listStock), asyncHandler(controller.stock));
router.post(
  '/',
  requireRole(...PLACA_ROLES),
  validate(schema.createItem),
  asyncHandler(controller.create)
);
router.put(
  '/:id/stock',
  requireRole(...PLACA_ROLES),
  validate(schema.setStock),
  asyncHandler(controller.setStock)
);
router.patch(
  '/:id',
  requireRole(...PLACA_ROLES),
  validate(schema.updateItem),
  asyncHandler(controller.update)
);
router.delete(
  '/:id',
  requireRole(...PLACA_ROLES),
  validate(schema.itemParams),
  asyncHandler(controller.remove)
);

module.exports = router;
