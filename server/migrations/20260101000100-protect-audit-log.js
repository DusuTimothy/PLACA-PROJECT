'use strict';

/**
 * Database-level append-only protection for audit_logs.
 *
 * The application never exposes an update/delete route for audit rows, but
 * policy must not depend on application code. A trigger rejects UPDATE, DELETE
 * and TRUNCATE with a clear error, even from a direct SQL client.
 *
 * The REVOKE statements matter when the API connects as a non-owner role (the
 * recommended production setup). A table owner can always bypass privileges,
 * but the trigger still stops the owner unless session_replication_role is
 * changed, which requires superuser access.
 */

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;

    await sequelize.query(`
      CREATE OR REPLACE FUNCTION placa_block_audit_mutation()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'audit_logs is append-only: % is not permitted', TG_OP
          USING ERRCODE = 'insufficient_privilege';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await sequelize.query(`
      CREATE TRIGGER audit_logs_no_update_delete
      BEFORE UPDATE OR DELETE ON audit_logs
      FOR EACH ROW EXECUTE FUNCTION placa_block_audit_mutation();
    `);

    await sequelize.query(`
      CREATE TRIGGER audit_logs_no_truncate
      BEFORE TRUNCATE ON audit_logs
      FOR EACH STATEMENT EXECUTE FUNCTION placa_block_audit_mutation();
    `);

    // PUBLIC is removed; in production also run these grants for the API role.
    await sequelize.query('REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM PUBLIC;');
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query('DROP TRIGGER IF EXISTS audit_logs_no_update_delete ON audit_logs;');
    await sequelize.query('DROP TRIGGER IF EXISTS audit_logs_no_truncate ON audit_logs;');
    await sequelize.query('DROP FUNCTION IF EXISTS placa_block_audit_mutation();');
  },
};
