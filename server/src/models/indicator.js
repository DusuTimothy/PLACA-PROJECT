'use strict';

/**
 * Indicator definition. PLACA staff edit these through the app; no developer
 * is needed to add an indicator or change its plain-language explanation.
 */
const { Model } = require('sequelize');

const CATEGORIES = ['reach', 'testing', 'referral', 'welfare', 'training'];

module.exports = (sequelize, DataTypes) => {
  class Indicator extends Model {
    static associate(models) {
      Indicator.hasMany(models.WorkplanTarget, { foreignKey: 'indicator_id', as: 'workplanTargets' });
      Indicator.hasMany(models.ReportValue, { foreignKey: 'indicator_id', as: 'reportValues' });
    }
  }

  Indicator.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(200), allowNull: false },
      plain_language_definition: { type: DataTypes.TEXT, allowNull: false },
      category: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [CATEGORIES] },
      },
      unit: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'people' },
      disaggregations: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      validation_rules: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    },
    {
      sequelize,
      modelName: 'Indicator',
      tableName: 'indicators',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
    }
  );

  Indicator.CATEGORIES = CATEGORIES;
  return Indicator;
};
