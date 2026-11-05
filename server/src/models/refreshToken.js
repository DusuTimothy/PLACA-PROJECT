'use strict';

/**
 * Rotating refresh-token record.
 *
 * Only the SHA-256 hash is stored. family_id groups one login session's chain of
 * tokens; if an already-used token is presented again, the whole family is
 * revoked because it may have been stolen.
 */
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RefreshToken extends Model {
    static associate(models) {
      RefreshToken.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  RefreshToken.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: { type: DataTypes.UUID, allowNull: false },
      token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
      family_id: { type: DataTypes.UUID, allowNull: false },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      revoked_at: { type: DataTypes.DATE, allowNull: true },
      replaced_by_token_hash: { type: DataTypes.STRING(64), allowNull: true },
      created_by_ip: { type: DataTypes.STRING(64), allowNull: true },
      user_agent: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'RefreshToken',
      tableName: 'refresh_tokens',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [{ fields: ['user_id', 'family_id'] }],
    }
  );

  return RefreshToken;
};
