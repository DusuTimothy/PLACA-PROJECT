'use strict';

/**
 * Authentication middleware.
 *
 * The access token is verified cryptographically, then the user is re-read from
 * the database. Re-reading is intentional: a deactivated user or a role change
 * takes effect immediately instead of waiting for the 15-minute token to expire.
 */

const { User } = require('../models');
const { verifyAccessToken } = require('../utils/tokens');
const { setContextUser } = require('../utils/requestContext');
const { isDemoAccount } = require('../config/demo');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw AppError.unauthorized('AUTH_REQUIRED', 'Please sign in to continue');
  }

  const payload = verifyAccessToken(token);

  const user = await User.findByPk(payload.sub, {
    attributes: [
      'id', 'name', 'email', 'phone', 'role', 'lga_id', 'organization_id',
      'language', 'is_active', 'must_change_password', 'verified',
    ],
  });

  if (!user || !user.is_active) {
    throw AppError.unauthorized('ACCOUNT_UNAVAILABLE', 'This account is not active');
  }

  req.user = user;
  setContextUser(user.id, user.role);
  return next();
});

/**
 * Blocks all data routes until a temporary password has been replaced.
 * Mounted on data routers, not on /auth/change-password or /auth/logout.
 */
function requirePasswordChanged(req, res, next) {
  if (req.user.must_change_password && !isDemoAccount(req.user)) {
    return next(
      AppError.forbidden(
        'PASSWORD_CHANGE_REQUIRED',
        'You must set a new password before using the platform'
      )
    );
  }
  return next();
}

/**
 * Optional authentication for the public page: if a token is present it is
 * validated, but anonymous requests are allowed to continue.
 */
const optionalAuthenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next();

  const payload = verifyAccessToken(token);
  const user = await User.findByPk(payload.sub, {
    attributes: ['id', 'role', 'lga_id', 'organization_id', 'is_active'],
  });
  if (user && user.is_active) {
    req.user = user;
    setContextUser(user.id, user.role);
  }
  return next();
});

module.exports = { authenticate, requirePasswordChanged, optionalAuthenticate };
