/**
 * Demo accounts shown on the sign-in page for review and pitch builds.
 *
 * Enabled only when VITE_DEMO_MODE is "true" at build time. The password is
 * shared by the seeded accounts and can be overridden with VITE_DEMO_PASSWORD.
 *
 * These are throwaway review accounts. Turn demo mode off before real use.
 */

const password = import.meta.env.VITE_DEMO_PASSWORD || 'ChangeMe#2026';

export const demoModeEnabled = import.meta.env.VITE_DEMO_MODE === 'true';

export const demoAccounts = [
  {
    role: 'placa_officer',
    name: 'Samuel Dashe',
    email: 'officer@placa.gov.ng',
    password,
  },
  {
    role: 'laca_officer',
    name: 'Hauwa Sule',
    email: 'laca.josnorth@placa.gov.ng',
    password,
  },
  {
    role: 'partner_staff',
    name: 'Grace Pam',
    email: 'partner@hopefoundation.org',
    password,
  },
  {
    role: 'placa_director',
    name: 'Dr. Ruth Bako',
    email: 'director@placa.gov.ng',
    password,
  },
  {
    role: 'admin',
    name: 'System Administrator',
    email: 'admin@placa.gov.ng',
    password,
  },
];
