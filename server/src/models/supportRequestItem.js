'use strict';

/**
 * Quantity requested and approved for one catalogue item on a support request.
 */
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SupportRequestItem extends Model {
    static associate(models) {
      SupportRequestItem.belongsTo(models.SupportRequest, {
        foreignKey: 'support_request_id',
        as: 'request',
      });
      SupportRequestItem.belongsTo(models.EquipmentItem, {
        foreignKey: 'equipment_item_id',
        as: 'equipmentItem',
      });
      SupportRequestItem.hasMany(models.SupplyRecord, {
        foreignKey: 'support_request_item_id',
        as: 'supplyRecords',
      });
    }
  }

  SupportRequestItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      support_request_id: { type: DataTypes.UUID, allowNull: false },
      equipment_item_id: { type: DataTypes.UUID, allowNull: false },
      qty_requested: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      qty_approved: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
    },
    {
      sequelize,
      modelName: 'SupportRequestItem',
      tableName: 'support_request_items',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [
        { unique: true, fields: ['support_request_id', 'equipment_item_id'] },
      ],
    }
  );

  return SupportRequestItem;
};
