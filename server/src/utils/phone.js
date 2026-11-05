'use strict';

/**
 * Phone normalisation.
 *
 * Nigerian numbers are stored in local form (0XXXXXXXXXX) so that a user can
 * type either 0803..., +234803..., or 234803... and still be found at login.
 */

function normalizePhone(value) {
  if (!value) return null;
  const digits = String(value).replace(/[^\d+]/g, '');
  if (!digits) return null;

  let local = digits;
  if (local.startsWith('+234')) local = `0${local.slice(4)}`;
  else if (local.startsWith('234')) local = `0${local.slice(3)}`;
  else if (local.startsWith('+')) local = local.replace(/^\+/, '');

  return local;
}

function isValidPhone(value) {
  const normalized = normalizePhone(value);
  return Boolean(normalized && /^0\d{10}$/.test(normalized));
}

module.exports = { normalizePhone, isValidPhone };
