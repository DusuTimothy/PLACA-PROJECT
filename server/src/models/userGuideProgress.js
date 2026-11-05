'use strict';

/**
 * Per-user learning progress. Drives the Getting Started checklist and the
 * "Mark as done" button on step guides. One row per user and guide key.
 */
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserGuideProgress extends Model {
    static associate(models) {
      UserGuideProgress.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  UserGuideProgress.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: { type: DataTypes.UUID, allowNull: false },
      guide_key: { type: DataTypes.STRING(80), allowNull: false },
      completed_at: { type: DataTypes.DATE, allowNull: true },
      dismissed_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'UserGuideProgress',
      tableName: 'user_guide_progress',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['user_id', 'guide_key'] }],
    }
  );

  return UserGuideProgress;
};
