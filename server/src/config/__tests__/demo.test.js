'use strict';

/**
 * Demo mode is opt-in and only exempts the addresses in DEMO_ACCOUNTS.
 */

describe('demo account detection', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    jest.resetModules();
  });

  it('is off unless DEMO_MODE is true', () => {
    process.env.DEMO_MODE = 'false';
    jest.resetModules();

    const { isDemoAccount } = require('../demo');

    expect(isDemoAccount({ email: 'admin@placa.gov.ng' })).toBe(false);
  });

  it('matches only the allowlisted addresses, ignoring case', () => {
    process.env.DEMO_MODE = 'true';
    process.env.DEMO_ACCOUNTS = 'admin@placa.gov.ng,officer@placa.gov.ng';
    jest.resetModules();

    const { isDemoAccount } = require('../demo');

    expect(isDemoAccount({ email: 'ADMIN@placa.gov.ng' })).toBe(true);
    expect(isDemoAccount({ email: ' officer@placa.gov.ng ' })).toBe(true);
    expect(isDemoAccount({ email: 'real@example.com' })).toBe(false);
    expect(isDemoAccount({ email: null })).toBe(false);
  });
});
