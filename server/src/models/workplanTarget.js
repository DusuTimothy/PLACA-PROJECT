'use strict';

/**
 * A target number for one indicator in one LGA within a workplan.
 */
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class WorkplanTarget extends Model {
    static associate(models) {
      WorkplanTarget.belongsTo(models.Workplan, { foreignKey: 'workplan_id', as: 'workplan' });
      WorkplanTarget.belongsTo(models.Indicator, { foreignKey: 'indicator_id', as: 'indicator' });
      WorkplanTarget.belongsTo(models.Lga, { foreignKey: 'lga_id', as: 'lga' });
    }
  }

  WorkplanTarget.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      workplan_id: { type: DataTypes.UUID, allowNull: false },
      indicator_id: { type: DataTypes.UUID, allowNull: false },
      lga_id: { type: DataTypes.UUID, allowNull: false },
      target_value: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
    },
    {
      sequelize,
      modelName: 'WorkplanTarget',
      tableName: 'workplan_targets',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [{ unique: true, fields: ['workplan_id', 'indicator_id', 'lga_id'] }],
    }
  );

  return WorkplanTarget;
};
