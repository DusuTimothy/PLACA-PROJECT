'use strict';

/**
 * One demo account per role.
 *
 * Password for every seeded account: ChangeMe#2026
 * must_change_password is true, so the first sign-in forces a new password.
 * Director and admin also have no TOTP secret, so their first sign-in walks
 * them through authenticator setup (2FA is mandatory for those roles).
 */

const bcrypt = require('bcryptjs');
const { USER_IDS, ORG_IDS, LGA_IDS } = require('./data/ids');

const DEMO_PASSWORD = 'ChangeMe#2026';
const BCRYPT_ROUNDS = 12;

const USERS = [
  {
    id: USER_IDS.admin,
    name: 'System Administrator',
    email: 'admin@placa.gov.ng',
    phone: '08030000001',
    role: 'admin',
    lga: null,
    organization_id: null,
  },
  {
    id: USER_IDS.director,
    name: 'Dr. Ruth Bako',
    email: 'director@placa.gov.ng',
    phone: '08030000002',
    role: 'placa_director',
    lga: null,
    organization_id: null,
  },
  {
    id: USER_IDS.placaOfficer,
    name: 'Samuel Dashe',
    email: 'officer@placa.gov.ng',
    phone: '08030000003',
    role: 'placa_officer',
    lga: null,
    organization_id: null,
  },
  {
    id: USER_IDS.lacaJosNorth,
    name: 'Hauwa Sule',
    email: 'laca.josnorth@placa.gov.ng',
    phone: '08030000004',
    role: 'laca_officer',
    lga: 'Jos North',
    organization_id: null,
  },
  {
    id: USER_IDS.lacaBarkinLadi,
    name: 'Peter Gyang',
    email: 'laca.barkinladi@placa.gov.ng',
    phone: '08030000005',
    role: 'laca_officer',
    lga: 'Barkin Ladi',
    organization_id: null,
  },
  {
    id: USER_IDS.partnerHope,
    name: 'Grace Pam',
    email: 'partner@hopefoundation.org',
    phone: '08030000006',
    role: 'partner_staff',
    lga: 'Jos North',
    organization_id: ORG_IDS.hopeFoundation,
  },
  {
    id: USER_IDS.partnerRural,
    name: 'Mary Choji',
    email: 'partner@ruralhealth.ng',
    phone: '08030000007',
    role: 'partner_staff',
    lga: 'Barkin Ladi',
    organization_id: ORG_IDS.ruralHealth,
  },
];

module.exports = {
  async up(queryInterface) {
    // Never create the demo logins (and their known password) in production.
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
      throw new Error(
        'Demo user seed is disabled in production. ' +
          'Create the first administrator with `npm run admin:create`.'
      );
    }

    const now = new Date();
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

    await queryInterface.bulkInsert(
      'users',
      USERS.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        password_hash: passwordHash,
        role: user.role,
        lga_id: user.lga ? LGA_IDS[user.lga] : null,
        organization_id: user.organization_id,
        language: 'en',
        must_change_password: true,
        verified: true,
        is_active: true,
        failed_attempts: 0,
        created_at: now,
        updated_at: now,
      }))
    );

    // Attribute the seeded approvals to the director account.
    await queryInterface.bulkUpdate(
      'organizations',
      { approved_by: USER_IDS.director, approved_at: now, updated_at: now },
      { status: 'approved' }
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('users', { id: USERS.map((user) => user.id) });
  },
};
