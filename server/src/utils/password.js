'use strict';

/**
 * Password helpers.
 *
 * bcryptjs is used so the image does not need native build tools. It implements
 * the same bcrypt algorithm, with the cost factor required by the specification.
 */

const bcrypt = require('bcryptjs');
const { randomInt } = require('crypto');
const env = require('../config/env');

async function hashPassword(plain) {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

/**
 * Human-readable temporary password. Ambiguous characters (0/O, 1/l/I) are
 * excluded because these passwords are often read aloud over the phone.
 */
function generateTemporaryPassword(length = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = '';
  for (let index = 0; index < length; index += 1) {
    password += alphabet[randomInt(0, alphabet.length)];
  }
  // Guarantee at least one digit and one upper-case letter for basic policy.
  return `P${password}9`;
}

module.exports = { hashPassword, verifyPassword, generateTemporaryPassword };
