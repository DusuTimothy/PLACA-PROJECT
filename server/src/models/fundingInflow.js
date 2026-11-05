'use strict';

/**
 * Money actually received into the PLACA account. DECIMAL is used for amounts;
 * floating point is never used for money.
 */
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class FundingInflow extends Model {
    static associate(models) {
      FundingInflow.belongsTo(models.FundingSource, {
        foreignKey: 'funding_source_id',
        as: 'source',
      });
      FundingInflow.belongsTo(models.User, { foreignKey: 'recorded_by', as: 'recorder' });
      FundingInflow.hasMany(models.FundingAllocation, {
        foreignKey: 'funding_inflow_id',
        as: 'allocations',
      });
    }
  }

  FundingInflow.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      funding_source_id: { type: DataTypes.UUID, allowNull: false },
      amount: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NGN' },
      received_on: { type: DataTypes.DATEONLY, allowNull: false },
      purpose: { type: DataTypes.TEXT, allowNull: true },
      reference: { type: DataTypes.STRING(120), allowNull: true },
      recorded_by: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: 'FundingInflow',
      tableName: 'funding_inflows',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
    }
  );

  return FundingInflow;
};
