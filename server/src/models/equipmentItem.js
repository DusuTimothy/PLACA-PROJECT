'use strict';

/**
 * Catalogue of items PLACA can supply (for example test kits, tally sheets).
 */
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class EquipmentItem extends Model {
    static associate(models) {
      EquipmentItem.hasMany(models.SupportRequestItem, { foreignKey: 'equipment_item_id', as: 'requestItems' });
      EquipmentItem.hasMany(models.SupplyRecord, { foreignKey: 'equipment_item_id', as: 'supplyRecords' });
      EquipmentItem.hasMany(models.StockLevel, { foreignKey: 'equipment_item_id', as: 'stockLevels' });
    }
  }

  EquipmentItem.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(160), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      unit: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'unit' },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'EquipmentItem',
      tableName: 'equipment_items',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
    }
  );

  return EquipmentItem;
};
