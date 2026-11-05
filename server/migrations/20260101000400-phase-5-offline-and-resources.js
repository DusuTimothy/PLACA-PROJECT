'use strict';

/**
 * Phase 5 additions.
 *
 * Support requests can be created on a device with no signal. The client
 * generates a UUID before the first send, and this column makes a retry
 * idempotent in the same way reports.client_uuid does.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('support_requests', 'client_uuid', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await queryInterface.addIndex('support_requests', ['client_uuid'], {
      unique: true,
      name: 'support_requests_client_uuid_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(
      'support_requests',
      'support_requests_client_uuid_unique'
    );
    await queryInterface.removeColumn('support_requests', 'client_uuid');
  },
};
