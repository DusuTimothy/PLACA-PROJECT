'use strict';

/**
 * Sample organizations for demos and testing.
 * Most are approved so a reviewer can log in and use the platform immediately.
 * One is left pending to exercise the approval workflow.
 */

const { ORG_IDS, LGA_IDS } = require('./data/ids');
const { textArray } = require('./data/sql');

const ORGANIZATIONS = [
  {
    id: ORG_IDS.hopeFoundation,
    name: 'Hope Foundation Jos',
    type: 'ngo',
    lga: 'Jos North',
    focus_areas: ['testing', 'referral', 'orphan_support'],
    contact_name: 'Grace Pam',
    contact_phone: '08031234501',
    contact_email: 'info@hopefoundation.org',
    status: 'approved',
  },
  {
    id: ORG_IDS.faithCoalition,
    name: 'Plateau Faith Coalition',
    type: 'faith_based',
    lga: 'Jos South',
    focus_areas: ['reach', 'stigma_support'],
    contact_name: 'Pastor Daniel Gyang',
    contact_phone: '08031234502',
    contact_email: 'office@plateaufaith.org',
    status: 'approved',
  },
  {
    id: ORG_IDS.ruralHealth,
    name: 'Rural Health Initiative',
    type: 'cbo',
    lga: 'Barkin Ladi',
    focus_areas: ['testing', 'training', 'welfare'],
    contact_name: 'Mary Choji',
    contact_phone: '08031234503',
    contact_email: 'info@ruralhealth.ng',
    status: 'approved',
  },
  {
    id: ORG_IDS.waseYouth,
    name: 'Wase Youth Network',
    type: 'cbo',
    lga: 'Wase',
    focus_areas: ['reach', 'skills_training'],
    contact_name: 'Ibrahim Musa',
    contact_phone: '08031234504',
    contact_email: 'hello@waseyouth.org',
    status: 'approved',
  },
  {
    id: ORG_IDS.privateSector,
    name: 'Plateau Private Sector HIV Alliance',
    type: 'private_sector',
    lga: 'Jos North',
    focus_areas: ['workplace_programmes', 'testing'],
    contact_name: 'Ngozi Okeke',
    contact_phone: '08031234505',
    contact_email: 'contact@ppsalliance.ng',
    status: 'approved',
  },
  {
    id: ORG_IDS.lacaJosEast,
    name: 'LACA Jos East',
    type: 'laca',
    lga: 'Jos East',
    focus_areas: ['coordination', 'monitoring'],
    contact_name: 'LGA AIDS Control Officer',
    contact_phone: '08031234506',
    contact_email: 'laca.joseast@plateau.gov.ng',
    status: 'approved',
  },
  {
    id: ORG_IDS.pendingCbo,
    name: 'Gindiri Community Care',
    type: 'cbo',
    lga: 'Mangu',
    focus_areas: ['orphan_support'],
    contact_name: 'Esther Dung',
    contact_phone: '08031234507',
    contact_email: 'gindiricare@example.org',
    status: 'pending',
  },
];

module.exports = {
  async up(queryInterface) {
    // Production safety: demo partners and demo logins must never be inserted
    // into a live database. Reference data (LGAs, indicators, guides) is seeded
    // by `npm run seed`; the first administrator comes from `admin:create`.
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_DEMO_SEED !== 'true') {
      throw new Error(
        'Demo organization seed is disabled in production. ' +
          'Run `npm run seed` for reference data and `npm run admin:create` for the first admin.'
      );
    }

    const now = new Date();
    await queryInterface.bulkInsert(
      'organizations',
      ORGANIZATIONS.map((organization) => ({
        id: organization.id,
        name: organization.name,
        type: organization.type,
        lga_id: LGA_IDS[organization.lga],
        focus_areas: textArray(organization.focus_areas),
        contact_name: organization.contact_name,
        contact_phone: organization.contact_phone,
        contact_email: organization.contact_email,
        status: organization.status,
        approved_by: null,
        approved_at: organization.status === 'approved' ? now : null,
        created_at: now,
        updated_at: now,
      }))
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('organizations', {
      id: ORGANIZATIONS.map((organization) => organization.id),
    });
  },
};
