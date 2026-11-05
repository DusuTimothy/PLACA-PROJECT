'use strict';

/**
 * JWT and opaque-token helpers.
 *
 * Access tokens are short lived and sent in the Authorization header by the
 * client. Refresh tokens are opaque random strings; only their SHA-256 hash is
 * stored in the database. This means a database leak does not leak live tokens.
 */

const jwt = require('jsonwebtoken');
const { createHash, randomBytes } = require('crypto');
const env = require('../config/env');
const AppError = require('./AppError');

const TOKEN_ISSUER = 'placa-api';
const TOKEN_AUDIENCE = 'placa-client';

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      organizationId: user.organization_id || null,
      lgaId: user.lga_id || null,
      typ: 'access',
    },
    env.JWT_ACCESS_SECRET,
    {
      expiresIn: env.JWT_ACCESS_TTL,
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    }
  );
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });
  if (payload.typ !== 'access') {
    throw AppError.unauthorized('INVALID_TOKEN', 'This token cannot be used here');
  }
  return payload;
}

/**
 * Short-lived token used only while a director/admin finishes TOTP setup.
 * It deliberately cannot access normal API routes (typ is not "access").
 */
function signTotpSetupToken(user) {
  return jwt.sign(
    { sub: user.id, typ: 'challenge', purpose: 'totp_setup' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '10m', issuer: TOKEN_ISSUER, audience: TOKEN_AUDIENCE }
  );
}

function verifyTotpSetupToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: TOKEN_ISSUER,
      audience: TOKEN_AUDIENCE,
    });
    if (payload.typ !== 'challenge' || payload.purpose !== 'totp_setup') {
      throw new Error('wrong token type');
    }
    return payload;
  } catch (error) {
    throw AppError.unauthorized('TOTP_SETUP_TOKEN_INVALID', 'The setup session expired. Please sign in again.');
  }
}

function generateOpaqueToken() {
  const token = randomBytes(48).toString('base64url');
  return { token, hash: hashToken(token) };
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function refreshCookieOptions(expiresAt) {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    path: '/api/auth',
    expires: expiresAt,
  };
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signTotpSetupToken,
  verifyTotpSetupToken,
  generateOpaqueToken,
  hashToken,
  refreshCookieOptions,
};
