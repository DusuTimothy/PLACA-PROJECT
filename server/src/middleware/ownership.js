'use strict';

/**
 * Resource ownership rules.
 *
 * Used from Phase 2 onwards for reports, workplans and support requests.
 * Kept here in Phase 1 so role and ownership policy live together.
 */

const AppError = require('../utils/AppError');
const { ROLES, PLACA_ROLES } = require('./rbac');

function canAccessOrganization(user, organization) {
  if (!user || !organization) return false;
  if (PLACA_ROLES.includes(user.role)) return true;
  if (user.role === ROLES.LACA_OFFICER) return user.lga_id === organization.lga_id;
  if (user.role === ROLES.PARTNER_STAFF) return user.organization_id === organization.id;
  // Admin administers accounts and the audit log, never programme data.
  return false;
}

function assertOrganizationAccess(user, organization) {
  if (!canAccessOrganization(user, organization)) {
    throw AppError.forbidden(
      'ORGANIZATION_ACCESS_DENIED',
      'You can only work with your own organization or LGA'
    );
  }
}

module.exports = { canAccessOrganization, assertOrganizationAccess };
