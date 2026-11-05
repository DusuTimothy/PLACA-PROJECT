'use strict';

/**
 * /api/users routes.
 * Account creation is allowed for PLACA and LACA officers, not partner staff.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/user');
const controller = require('../controllers/userController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.use(authenticate, requirePasswordChanged);
router.use(requireRole('admin', 'placa_director', 'placa_officer', 'laca_officer'));

router.get('/', validate(schema.listUsers), asyncHandler(controller.list));
router.post('/', validate(schema.createUser), asyncHandler(controller.create));
router.get('/:id', validate(schema.userParams), asyncHandler(controller.getOne));
router.patch('/:id', validate(schema.updateUser), asyncHandler(controller.update));
router.post(
  '/:id/reset-password',
  validate(schema.resetUserPassword),
  asyncHandler(controller.resetPassword)
);
router.post(
  '/:id/resend-invitation',
  validate(schema.resendInvitation),
  asyncHandler(controller.resendInvitation)
);

module.exports = router;
