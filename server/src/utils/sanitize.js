'use strict';

/**
 * Helpers that keep secrets out of audit rows and API responses.
 * Business data ($ and . in emails/decimals) is never stripped.
 */

const SENSITIVE_FIELDS = new Set([
  'password_hash',
  'password',
  'current_password',
  'new_password',
  'temporary_password',
  'token',
  'token_hash',
  'invitation_token_hash',
  'email_verification_token_hash',
  'password_reset_token_hash',
  'totp_secret',
  'refresh_token',
  'authorization',
]);

function scrubObject(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    const list = value.map((item) => scrubObject(item, seen));
    seen.delete(value);
    return list;
  }

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_FIELDS.has(key)) {
      output[key] = '[redacted]';
    } else if (item && typeof item === 'object') {
      output[key] = scrubObject(item, seen);
    } else {
      output[key] = item;
    }
  }
  seen.delete(value);
  return output;
}

module.exports = { scrubObject, SENSITIVE_FIELDS };
