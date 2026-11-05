'use strict';

/**
 * Public summary integrity.
 *
 * public_summary is written by the aggregation job, not by users. Each
 * indicator/period must have exactly one state row or one row per LGA.
 * Without these indexes a retried aggregation could silently double-count.
 */

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE public_summary
      ADD CONSTRAINT public_summary_scope_lga_check
      CHECK (
        (scope = 'state' AND lga_id IS NULL)
        OR (scope = 'lga' AND lga_id IS NOT NULL)
      );
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX public_summary_state_unique_idx
      ON public_summary (indicator_code, period)
      WHERE scope = 'state' AND lga_id IS NULL;
    `);

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX public_summary_lga_unique_idx
      ON public_summary (lga_id, indicator_code, period)
      WHERE scope = 'lga' AND lga_id IS NOT NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS public_summary_lga_unique_idx;'
    );
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS public_summary_state_unique_idx;'
    );
    await queryInterface.sequelize.query(
      'ALTER TABLE public_summary DROP CONSTRAINT IF EXISTS public_summary_scope_lga_check;'
    );
  },
};
