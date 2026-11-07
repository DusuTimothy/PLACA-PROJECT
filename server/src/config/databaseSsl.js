'use strict';

/**
 * PostgreSQL TLS configuration for hosted providers such as Aiven.
 *
 * Aiven terminates TLS with a provider-specific CA. Enable TLS with DB_SSL (or
 * DB_SSL_MODE) and point DB_SSL_CA at the downloaded ca.pem file, or paste the
 * PEM directly into the variable. The returned object is spread into
 * Sequelize's `dialectOptions`, which both the app and sequelize-cli use.
 *
 * This module deliberately reads a plain config object instead of importing
 * ../config/env, because sequelize-cli loads database.js directly and must
 * not run the full application env validation.
 */

const fs = require('fs');
const path = require('path');

const SSL_MODES = new Set(['disable', 'require', 'verify-ca', 'verify-full']);
const ENABLED_VALUES = new Set(['true', '1', 'yes', 'on']);
const DISABLED_VALUES = new Set(['false', '0', 'no', 'off', '']);

function parseBoolean(value, fallback) {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (DISABLED_VALUES.has(normalized)) return false;
  if (ENABLED_VALUES.has(normalized)) return true;
  return fallback;
}

function readMode(config) {
  const mode = String(config.DB_SSL_MODE || '').trim().toLowerCase();
  if (!mode) return null;
  if (!SSL_MODES.has(mode)) {
    throw new Error(
      `DB_SSL_MODE must be one of ${[...SSL_MODES].join(', ')} (received "${mode}")`
    );
  }
  return mode;
}

function isTlsEnabled(config) {
  const mode = readMode(config);
  if (mode) return mode !== 'disable';
  return parseBoolean(config.DB_SSL, false);
}

/**
 * Load the CA certificate from an inline PEM value or a file path.
 *
 * File paths are resolved against the working directory, then the repository
 * root and the server directory, so `npm run` from either directory works.
 */
function loadCaCertificate(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return undefined;

  // Inline PEM. Environment files often store newlines as the two characters
  // "\n", which must become real line breaks before Node parses the cert.
  if (raw.includes('-----BEGIN')) {
    return raw.replace(/\\n/g, '\n');
  }

  const candidates = path.isAbsolute(raw)
    ? [raw]
    : [
        path.resolve(process.cwd(), raw),
        path.resolve(__dirname, '../../..', raw),
        path.resolve(__dirname, '../..', raw),
      ];
  const unique = [...new Set(candidates)];
  const match = unique.find((candidate) => fs.existsSync(candidate));

  if (!match) {
    throw new Error(
      `DB_SSL_CA file not found: "${raw}". Looked in: ${unique.join(', ')}. ` +
        'On a hosted platform, commit the public CA file or set DB_SSL_CA to ' +
        'the PEM text itself (or to a mounted secret-file path).'
    );
  }

  return fs.readFileSync(match, 'utf8');
}

function buildSslOptions(config = process.env) {
  if (!isTlsEnabled(config)) return null;

  const mode = readMode(config);
  const ca = loadCaCertificate(config.DB_SSL_CA);

  // libpq's "require" encrypts but does not verify the certificate chain.
  // Every other mode verifies (and Node also checks the hostname, which is
  // stricter than libpq's "verify-ca"). An explicit value always wins.
  const rejectUnauthorized = parseBoolean(
    config.DB_SSL_REJECT_UNAUTHORIZED,
    mode === 'require' ? false : true
  );

  const ssl = { rejectUnauthorized };
  if (ca) ssl.ca = ca;
  return ssl;
}

function buildDialectOptions(config = process.env) {
  const ssl = buildSslOptions(config);
  return ssl ? { ssl } : {};
}

module.exports = {
  buildDialectOptions,
  buildSslOptions,
  loadCaCertificate,
};
