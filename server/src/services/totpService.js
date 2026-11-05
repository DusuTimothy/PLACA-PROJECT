'use strict';

/**
 * TOTP (authenticator app) support for director and admin accounts.
 *
 * The shared secret is a narrow sensitive column. It is encrypted inside
 * PostgreSQL with pgcrypto, so a database dump without the application key does
 * not reveal usable second factors. All SQL here is parameterised.
 */

const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const { sequelize } = require('../models');
const env = require('../config/env');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');

function generateSecret(email) {
  return speakeasy.generateSecret({
    length: 20,
    name: `PLACA:${email || 'account'}`,
    issuer: env.TOTP_ISSUER,
  });
}

async function saveEncryptedSecret(userId, base32Secret) {
  await sequelize.query(
    `UPDATE users
        SET totp_secret = pgp_sym_encrypt(:secret, :key, 'cipher-algo=aes256'),
            updated_at = NOW()
      WHERE id = :userId`,
    {
      replacements: { secret: base32Secret, key: env.TOTP_ENCRYPTION_KEY, userId },
      type: sequelize.QueryTypes.UPDATE,
    }
  );
}

async function readSecret(userId) {
  const rows = await sequelize.query(
    `SELECT pgp_sym_decrypt(totp_secret, :key) AS secret
       FROM users
      WHERE id = :userId AND totp_secret IS NOT NULL`,
    {
      replacements: { key: env.TOTP_ENCRYPTION_KEY, userId },
      type: sequelize.QueryTypes.SELECT,
    }
  );
  return rows[0]?.secret || null;
}

async function markEnabled(userId) {
  await sequelize.query(
    `UPDATE users SET totp_enabled = TRUE, updated_at = NOW() WHERE id = :userId`,
    {
      replacements: { userId },
      type: sequelize.QueryTypes.UPDATE,
    }
  );
}

function verifyCode(base32Secret, code) {
  try {
    return speakeasy.totp.verify({
      secret: base32Secret,
      encoding: 'base32',
      token: code,
      window: 1, // allow one 30-second step of clock drift
    });
  } catch (error) {
    logger.warn(`TOTP verification error: ${error.message}`);
    return false;
  }
}

async function buildSetupResponse(user) {
  const secret = generateSecret(user.email);
  await saveEncryptedSecret(user.id, secret.base32);

  const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
    qrDataUrl,
    instructions:
      'Scan the code with an authenticator app, then type the 6-digit code to finish. Keep the secret somewhere safe.',
  };
}

async function confirmSetup(userId, code) {
  const secret = await readSecret(userId);
  if (!secret) {
    throw AppError.badRequest(
      'TOTP_SETUP_MISSING',
      'Start the authenticator setup again, then enter the code.'
    );
  }
  if (!verifyCode(secret, code)) {
    throw AppError.badRequest(
      'INVALID_TOTP_CODE',
      'That code did not work. Check the time on your phone and try the newest code.'
    );
  }
  await markEnabled(userId);
}

module.exports = {
  generateSecret,
  buildSetupResponse,
  confirmSetup,
  verifyCode,
  readSecret,
};
