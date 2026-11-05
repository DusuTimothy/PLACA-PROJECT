'use strict';

/**
 * A delivery against an approved support request. The partner confirms receipt
 * separately, which closes the accountability loop.
 */
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SupplyRecord extends Model {
    static associate(models) {
      SupplyRecord.belongsTo(models.SupportRequest, {
        foreignKey: 'support_request_id',
        as: 'request',
      });
      SupplyRecord.belongsTo(models.SupportRequestItem, {
        foreignKey: 'support_request_item_id',
        as: 'requestItem',
      });
      SupplyRecord.belongsTo(models.EquipmentItem, {
        foreignKey: 'equipment_item_id',
        as: 'equipmentItem',
      });
      SupplyRecord.belongsTo(models.User, { foreignKey: 'delivered_by', as: 'deliverer' });
      SupplyRecord.belongsTo(models.User, {
        foreignKey: 'received_confirmed_by',
        as: 'receiver',
      });
    }
  }

  SupplyRecord.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      support_request_id: { type: DataTypes.UUID, allowNull: false },
      support_request_item_id: { type: DataTypes.UUID, allowNull: false },
      equipment_item_id: { type: DataTypes.UUID, allowNull: false },
      qty_delivered: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      delivered_at: { type: DataTypes.DATE, allowNull: true },
      delivered_by: { type: DataTypes.UUID, allowNull: true },
      received_confirmed_by: { type: DataTypes.UUID, allowNull: true },
      received_at: { type: DataTypes.DATE, allowNull: true },
      note: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'SupplyRecord',
      tableName: 'supply_records',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
    }
  );

  return SupplyRecord;
};
