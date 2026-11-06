'use strict';

const { sequelize } = require('../src/models');
const env = require('../src/config/env');
const { aggregatePeriod } = require('../src/services/aggregationService');
const { INDICATOR_IDS, LGA_IDS } = require('./data/ids');

const ORGANIZATIONS = [
  {
    id: '55555555-5555-4555-8555-000000000001',
    name: 'DEMO - Synthetic Analytics Sample (Jos North)',
    lga_id: LGA_IDS['Jos North'],
    offset: 0,
  },
  {
    id: '55555555-5555-4555-8555-000000000002',
    name: 'DEMO - Synthetic Analytics Sample (Barkin Ladi)',
    lga_id: LGA_IDS['Barkin Ladi'],
    offset: 17,
  },
  {
    id: '55555555-5555-4555-8555-000000000003',
    name: 'DEMO - Synthetic Analytics Sample (Wase)',
    lga_id: LGA_IDS.Wase,
    offset: 31,
  },
];

const PERIODS = [
  [2025, 1],
  [2025, 2],
  [2025, 3],
  [2025, 4],
  [2026, 1],
  [2026, 2],
  [2026, 3],
  [2026, 4],
];

const INDICATORS = ['HTS_TST', 'HTS_TST_POS', 'HTS_REF', 'HTS_LINK', 'REACH'];

function assertLocalDevelopment() {
  if (
    !env.isDevelopment ||
    !['localhost', '127.0.0.1', '::1'].includes(env.DB_HOST)
  ) {
    throw new Error(
      'Synthetic analytics data can only be loaded into a local development database.'
    );
  }
}

function uuid(prefix, sequence) {
  return `${prefix}-${String(sequence).padStart(12, '0')}`;
}

function valuesFor(quarterIndex, organizationOffset) {
  const tested = 150 + quarterIndex * 12 + organizationOffset;
  const positive = Math.floor(tested * 0.08);
  const referred = Math.floor(positive * 0.9);
  const linked = Math.floor(referred * 0.85);

  return {
    HTS_TST: tested,
    HTS_TST_POS: positive,
    HTS_REF: referred,
    HTS_LINK: linked,
    REACH: 700 + quarterIndex * 45 + organizationOffset * 5,
  };
}

async function refreshPeriods() {
  for (const [periodYear, periodNumber] of PERIODS) {
    await aggregatePeriod({
      periodType: 'quarterly',
      periodYear,
      periodNumber,
    });
  }
}

module.exports = {
  async up(queryInterface) {
    assertLocalDevelopment();

    try {
      const [existingOrganizations] = await queryInterface.sequelize.query(
        'SELECT id FROM organizations WHERE id IN (:ids)',
        { replacements: { ids: ORGANIZATIONS.map(({ id }) => id) } }
      );
      if (existingOrganizations.length > 0) {
        throw new Error(
          'Synthetic analytics organizations already exist. Do not rerun this seeder; undo it first if you need to reload the demo dataset.'
        );
      }

      const [missingIndicators] = await queryInterface.sequelize.query(
        'SELECT id FROM indicators WHERE id IN (:ids)',
        { replacements: { ids: INDICATORS.map((code) => INDICATOR_IDS[code]) } }
      );
      if (missingIndicators.length !== INDICATORS.length) {
        throw new Error('Seed the reference indicators before loading synthetic analytics data.');
      }

      const now = new Date();
      const organizations = ORGANIZATIONS.map(({ offset: _offset, ...organization }) => ({
        ...organization,
        type: 'ngo',
        focus_areas: ['testing', 'referral', 'reach'],
        contact_name: 'Synthetic demo data - not a real organization',
        contact_phone: null,
        contact_email: null,
        status: 'approved',
        approved_by: null,
        approved_at: now,
        created_at: now,
        updated_at: now,
      }));

      const reports = [];
      const reportValues = [];
      let reportSequence = 0;

      PERIODS.forEach(([periodYear, periodNumber], quarterIndex) => {
        ORGANIZATIONS.forEach((organization) => {
          reportSequence += 1;
          const reportId = uuid('66666666-6666-4666-8666', reportSequence);
          const submittedAt = new Date(Date.UTC(periodYear, (periodNumber - 1) * 3, 15));

          reports.push({
            id: reportId,
            organization_id: organization.id,
            lga_id: organization.lga_id,
            programme_id: null,
            period_type: 'quarterly',
            period_year: periodYear,
            period_number: periodNumber,
            status: 'validated',
            client_uuid: uuid('77777777-7777-4777-8777', reportSequence),
            submitted_by: null,
            submitted_at: submittedAt,
            validated_by: null,
            validated_at: submittedAt,
            return_reason: null,
            flags: JSON.stringify({ synthetic_demo: true }),
            created_at: submittedAt,
            updated_at: submittedAt,
          });

          const values = valuesFor(quarterIndex, organization.offset);
          INDICATORS.forEach((code) => {
            reportValues.push({
              report_id: reportId,
              indicator_id: INDICATOR_IDS[code],
              disaggregation_key: 'total',
              value: values[code],
              created_at: submittedAt,
              updated_at: submittedAt,
            });
          });
        });
      });

      await queryInterface.sequelize.transaction(async (transaction) => {
        await queryInterface.bulkInsert('organizations', organizations, { transaction });
        await queryInterface.bulkInsert('reports', reports, { transaction });
        await queryInterface.bulkInsert('report_values', reportValues, { transaction });
      });

      await refreshPeriods();
    } finally {
      await sequelize.close();
    }
  },

  async down(queryInterface) {
    assertLocalDevelopment();

    try {
      const reportIds = Array.from({ length: PERIODS.length * ORGANIZATIONS.length }, (_, index) =>
        uuid('66666666-6666-4666-8666', index + 1)
      );
      await queryInterface.bulkDelete('reports', { id: reportIds });
      await queryInterface.bulkDelete('organizations', {
        id: ORGANIZATIONS.map(({ id }) => id),
      });

      await refreshPeriods();
    } finally {
      await sequelize.close();
    }
  },
};
