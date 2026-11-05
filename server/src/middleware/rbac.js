'use strict';

/**
 * Role-based access control.
 *
 * requireRole answers "may this role use this endpoint at all?".
 * Ownership checks in services answer "may this user touch this record?".
 * Both are required; role alone is never enough for organization data.
 */

const AppError = require('../utils/AppError');

const ROLES = Object.freeze({
  PARTNER_STAFF: 'partner_staff',
  LACA_OFFICER: 'laca_officer',
  PLACA_OFFICER: 'placa_officer',
  PLACA_DIRECTOR: 'placa_director',
  ADMIN: 'admin',
});

const PLACA_ROLES = [ROLES.PLACA_OFFICER, ROLES.PLACA_DIRECTOR];
const STAFF_ROLES = [ROLES.PLACA_OFFICER, ROLES.PLACA_DIRECTOR, ROLES.ADMIN];
const ALL_ROLES = Object.values(ROLES);

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(
        AppError.forbidden('ROLE_NOT_ALLOWED', 'Your role cannot perform this action')
      );
    }
    return next();
  };
}

/**
 * HIV-status indicator counts are restricted to PLACA roles, a LACA officer
 * inside their own LGA, or a partner inside their own organization.
 * Phase 2 uses this helper when serialising report values.
 */
function canViewHivStatusCounts(user, { organizationId, lgaId }) {
  if (!user) return false;
  if (PLACA_ROLES.includes(user.role)) return true;
  if (user.role === ROLES.LACA_OFFICER) return user.lga_id === lgaId;
  if (user.role === ROLES.PARTNER_STAFF) return user.organization_id === organizationId;
  return false;
}

module.exports = {
  ROLES,
  PLACA_ROLES,
  STAFF_ROLES,
  ALL_ROLES,
  requireRole,
  canViewHivStatusCounts,
};
