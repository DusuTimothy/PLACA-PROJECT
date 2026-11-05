'use strict';

/**
 * Current stock for one item in one LGA. A null lga_id means the state store.
 */
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StockLevel extends Model {
    static associate(models) {
      StockLevel.belongsTo(models.EquipmentItem, {
        foreignKey: 'equipment_item_id',
        as: 'equipmentItem',
      });
      StockLevel.belongsTo(models.Lga, { foreignKey: 'lga_id', as: 'lga' });
    }
  }

  StockLevel.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      equipment_item_id: { type: DataTypes.UUID, allowNull: false },
      lga_id: { type: DataTypes.UUID, allowNull: true },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
      updated_by: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: 'StockLevel',
      tableName: 'stock_levels',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['equipment_item_id', 'lga_id'] }],
    }
  );

  return StockLevel;
};
