'use strict';

const path = require('path');
const { buildDialectOptions, buildSslOptions, loadCaCertificate } = require('../databaseSsl');

const PEM = [
  '-----BEGIN CERTIFICATE-----',
  'MIIBexample',
  '-----END CERTIFICATE-----',
].join('\n');

describe('database SSL configuration', () => {
  test('leaves local PostgreSQL without TLS when DB_SSL is off', () => {
    expect(buildDialectOptions({ DB_SSL: 'false' })).toEqual({});
    expect(buildDialectOptions({})).toEqual({});
  });

  test('enables TLS and verifies the host and chain by default', () => {
    const options = buildDialectOptions({
      DB_SSL: 'true',
      DB_SSL_CA: PEM,
    });

    expect(options.ssl.ca).toBe(PEM);
    expect(options.ssl.rejectUnauthorized).toBe(true);
  });

  test('treats libpq "require" as encryption without verification', () => {
    expect(buildSslOptions({ DB_SSL_MODE: 'require' })).toEqual({
      rejectUnauthorized: false,
    });
  });

  test('honours an explicit rejectUnauthorized value', () => {
    expect(
      buildSslOptions({
        DB_SSL_MODE: 'require',
        DB_SSL_REJECT_UNAUTHORIZED: 'true',
      })
    ).toEqual({ rejectUnauthorized: true });
  });

  test('rejects an unknown ssl mode', () => {
    expect(() => buildSslOptions({ DB_SSL_MODE: 'sometimes' })).toThrow(
      /DB_SSL_MODE/
    );
  });

  test('converts escaped newlines in an inline PEM', () => {
    expect(loadCaCertificate(PEM.replace(/\n/g, '\\n'))).toBe(PEM);
  });

  test('reads a CA file relative to the server directory', () => {
    const relativeFile = path.relative(
      path.resolve(__dirname, '../../..'),
      __filename
    );

    expect(loadCaCertificate(relativeFile)).toContain('-----BEGIN');
  });

  test('names the missing certificate file in the error', () => {
    expect(() => loadCaCertificate('./does-not-exist-ca.pem')).toThrow(
      /does-not-exist-ca\.pem/
    );
  });
});
