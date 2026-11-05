'use strict';

/**
 * One number for one indicator and one disaggregation key.
 * Examples of disaggregation_key: "total", "sex=female", "sex=female|age=15-24".
 * Beneficiary identities are never stored here, by design.
 */
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ReportValue extends Model {
    static associate(models) {
      ReportValue.belongsTo(models.Report, { foreignKey: 'report_id', as: 'report' });
      ReportValue.belongsTo(models.Indicator, { foreignKey: 'indicator_id', as: 'indicator' });
    }
  }

  ReportValue.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      report_id: { type: DataTypes.UUID, allowNull: false },
      indicator_id: { type: DataTypes.UUID, allowNull: false },
      disaggregation_key: {
        type: DataTypes.STRING(120),
        allowNull: false,
        defaultValue: 'total',
      },
      value: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: { min: 0 },
      },
    },
    {
      sequelize,
      modelName: 'ReportValue',
      tableName: 'report_values',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [
        { unique: true, fields: ['report_id', 'indicator_id', 'disaggregation_key'] },
      ],
    }
  );

  return ReportValue;
};
