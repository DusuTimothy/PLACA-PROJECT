'use strict';

/**
 * /api/auth routes.
 *
 * Login and refresh are rate limited per IP. Per-account lockout is handled in
 * authService after five wrong passwords.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/auth');
const controller = require('../controllers/authController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, optionalAuthenticate } = require('../middleware/auth');
const { authLimiter, loginLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post('/login', loginLimiter, validate(schema.login), asyncHandler(controller.login));
router.post('/refresh', authLimiter, validate(schema.refresh), asyncHandler(controller.refresh));
router.post('/logout', authLimiter, validate(schema.logout), asyncHandler(controller.logout));

router.post(
  '/accept-invitation',
  authLimiter,
  validate(schema.acceptInvitation),
  asyncHandler(controller.acceptInvitation)
);
router.post(
  '/verify-email',
  authLimiter,
  validate(schema.verifyEmail),
  asyncHandler(controller.verifyEmail)
);
router.post(
  '/forgot-password',
  authLimiter,
  validate(schema.forgotPassword),
  asyncHandler(controller.forgotPassword)
);
router.post(
  '/reset-password',
  authLimiter,
  validate(schema.resetPassword),
  asyncHandler(controller.resetPassword)
);

// These two work with either a short-lived TOTP setup token (from login) or a
// normal access token (a signed-in director enabling 2FA after the fact).
router.post(
  '/totp/setup',
  authLimiter,
  optionalAuthenticate,
  validate(schema.totpSetup),
  asyncHandler(controller.totpSetup)
);
router.post(
  '/totp/enable',
  authLimiter,
  optionalAuthenticate,
  validate(schema.totpEnable),
  asyncHandler(controller.totpEnable)
);

// Accessible while must_change_password is true, so the user can recover.
router.post(
  '/change-password',
  authenticate,
  validate(schema.changePassword),
  asyncHandler(controller.changePassword)
);
router.get('/me', authenticate, asyncHandler(controller.me));
router.patch(
  '/me',
  authenticate,
  validate(schema.updateProfile),
  asyncHandler(controller.updateProfile)
);

module.exports = router;
