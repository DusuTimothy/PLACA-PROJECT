'use strict';

/**
 * A partner request for equipment, training or technical help, and its
 * approval pipeline. Requests waiting more than 7 days trigger an alert.
 */
const { Model } = require('sequelize');

const REQUEST_KINDS = ['equipment', 'training', 'technical'];
const REQUEST_STATUSES = ['requested', 'approved', 'rejected', 'in_transit', 'delivered', 'closed'];

module.exports = (sequelize, DataTypes) => {
  class SupportRequest extends Model {
    static associate(models) {
      SupportRequest.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
      SupportRequest.belongsTo(models.User, { foreignKey: 'requested_by', as: 'requester' });
      SupportRequest.belongsTo(models.User, { foreignKey: 'decided_by', as: 'decider' });
      SupportRequest.hasMany(models.SupportRequestItem, { foreignKey: 'support_request_id', as: 'items' });
      SupportRequest.hasMany(models.SupplyRecord, { foreignKey: 'support_request_id', as: 'supplyRecords' });
    }
  }

  SupportRequest.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      // Generated on the device before the first send, so an offline retry
      // cannot create the same request twice.
      client_uuid: { type: DataTypes.UUID, allowNull: true, unique: true },
      kind: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [REQUEST_KINDS] },
      },
      description: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'requested',
        validate: { isIn: [REQUEST_STATUSES] },
      },
      requested_by: { type: DataTypes.UUID, allowNull: true },
      decided_by: { type: DataTypes.UUID, allowNull: true },
      decided_at: { type: DataTypes.DATE, allowNull: true },
      decision_note: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'SupportRequest',
      tableName: 'support_requests',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [{ fields: ['organization_id', 'status'] }],
    }
  );

  SupportRequest.KINDS = REQUEST_KINDS;
  SupportRequest.STATUSES = REQUEST_STATUSES;
  return SupportRequest;
};
