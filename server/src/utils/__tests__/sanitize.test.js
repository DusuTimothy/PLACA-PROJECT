'use strict';

/**
 * Audit rows must never leak secrets and must survive included associations,
 * which contain circular references back to their model instances.
 */

const { scrubObject } = require('../sanitize');

describe('scrubObject', () => {
  test('redacts sensitive fields and keeps business data', () => {
    const output = scrubObject({
      password_hash: '$2a$12$secret',
      email: 'partner@example.org',
      amount: 12.5,
      totp_secret: Buffer.from('secret'),
    });

    expect(output.password_hash).toBe('[redacted]');
    expect(output.totp_secret).toBe('[redacted]');
    expect(output.email).toBe('partner@example.org');
    expect(output.amount).toBe(12.5);
  });

  test('keeps arrays and primitives', () => {
    expect(scrubObject([1, 'two', null])).toEqual([1, 'two', null]);
    expect(scrubObject('plain')).toBe('plain');
    expect(scrubObject(null)).toBeNull();
  });

  test('replaces a real cycle instead of overflowing the stack', () => {
    const node = { name: 'report' };
    node.self = node;

    expect(scrubObject(node)).toEqual({ name: 'report', self: '[circular]' });
  });

  test('keeps shared objects that are not ancestors', () => {
    const shared = { name: 'indicator' };
    const output = scrubObject({ first: shared, second: shared });

    expect(output).toEqual({
      first: { name: 'indicator' },
      second: { name: 'indicator' },
    });
  });
});
