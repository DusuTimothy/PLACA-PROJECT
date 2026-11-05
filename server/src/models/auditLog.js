'use strict';

/**
 * Append-only audit trail.
 *
 * Application hooks insert rows; a database trigger rejects UPDATE and DELETE,
 * so even a buggy service or a direct SQL client cannot rewrite history.
 * There is intentionally no association that would allow a cascade delete.
 */
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AuditLog extends Model {
    static associate(models) {
      AuditLog.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  AuditLog.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: { type: DataTypes.UUID, allowNull: true },
      user_role: { type: DataTypes.STRING(30), allowNull: true },
      action: { type: DataTypes.STRING(40), allowNull: false },
      entity: { type: DataTypes.STRING(60), allowNull: false },
      entity_id: { type: DataTypes.STRING(64), allowNull: true },
      old_value: { type: DataTypes.JSONB, allowNull: true },
      new_value: { type: DataTypes.JSONB, allowNull: true },
      ip: { type: DataTypes.STRING(64), allowNull: true },
      user_agent: { type: DataTypes.TEXT, allowNull: true },
      request_id: { type: DataTypes.STRING(64), allowNull: true },
    },
    {
      sequelize,
      modelName: 'AuditLog',
      tableName: 'audit_logs',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [
        { fields: ['entity', 'entity_id'] },
        { fields: ['user_id'] },
        { fields: ['created_at'] },
      ],
    }
  );

  return AuditLog;
};
