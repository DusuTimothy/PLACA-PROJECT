'use strict';

/**
 * In-app notification. Email is optional and sent separately by the job or
 * workflow that creates the notification.
 */
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Notification extends Model {
    static associate(models) {
      Notification.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  Notification.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: { type: DataTypes.UUID, allowNull: false },
      kind: { type: DataTypes.STRING(40), allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      link: { type: DataTypes.STRING(400), allowNull: true },
      read_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Notification',
      tableName: 'notifications',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [{ fields: ['user_id', 'read_at'] }],
    }
  );

  return Notification;
};
