'use strict';

/**
 * Phase 2: workplan review and report period integrity.
 *
 * Workplans become a small review workflow (draft -> submitted -> approved or
 * returned), so reviewers need a status and a place to explain a return.
 *
 * Reports gain one row per organization, period type and period. Without the
 * unique index a partner could submit the same quarter twice and the later
 * aggregation job would count both. Returned reports are edited in place, so
 * the index does not exclude any status.
 */

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE workplans
      ADD COLUMN status varchar(20) NOT NULL DEFAULT 'draft',
      ADD COLUMN submitted_at timestamptz,
      ADD COLUMN approved_by uuid REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN approved_at timestamptz,
      ADD COLUMN review_note text;

      ALTER TABLE workplans
      ADD CONSTRAINT workplans_status_check CHECK (status IN
        ('draft','submitted','approved','returned'));

      CREATE INDEX workplans_status_idx ON workplans (status);
    `);

    // Quarterly reports only have four periods; the annual report has one.
    await queryInterface.sequelize.query(`
      ALTER TABLE reports
      ADD CONSTRAINT reports_period_number_type_check CHECK (
        (period_type = 'monthly' AND period_number BETWEEN 1 AND 12)
        OR (period_type = 'quarterly' AND period_number BETWEEN 1 AND 4)
        OR (period_type = 'annual' AND period_number = 1)
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX reports_org_period_unique
      ON reports (organization_id, period_type, period_year, period_number);
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS reports_org_period_unique;
      ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_period_number_type_check;
    `);

    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS workplans_status_idx;
      ALTER TABLE workplans DROP CONSTRAINT IF EXISTS workplans_status_check;
      ALTER TABLE workplans
      DROP COLUMN IF EXISTS review_note,
      DROP COLUMN IF EXISTS approved_at,
      DROP COLUMN IF EXISTS approved_by,
      DROP COLUMN IF EXISTS submitted_at,
      DROP COLUMN IF EXISTS status;
    `);
  },
};
