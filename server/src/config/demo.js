'use strict';

/**
 * Review/demo account support.
 *
 * A pitch build needs the seeded accounts to be reusable: every tester shares
 * one password and must not be forced through a password change or TOTP setup.
 * That is only allowed when the operator explicitly sets DEMO_MODE=true, and
 * only for the addresses in DEMO_ACCOUNTS. With DEMO_MODE off this helper
 * always returns false, so normal production security applies.
 */

const env = require('./env');

function isDemoAccount(user) {
  if (!env.demoMode) return false;

  const email = String(user?.email || '')
    .trim()
    .toLowerCase();

  return Boolean(email) && env.demoAccounts.includes(email);
}

module.exports = { isDemoAccount };
