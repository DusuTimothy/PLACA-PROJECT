'use strict';

/**
 * An allocation of money to a partner organization or an LGA.
 * The LGA dashboard uses this to make equity between LGAs visible.
 */
const { Model } = require('sequelize');

const ALLOCATION_STATUSES = ['planned', 'disbursed', 'closed'];

module.exports = (sequelize, DataTypes) => {
  class FundingAllocation extends Model {
    static associate(models) {
      FundingAllocation.belongsTo(models.FundingSource, {
        foreignKey: 'funding_source_id',
        as: 'source',
      });
      FundingAllocation.belongsTo(models.FundingInflow, {
        foreignKey: 'funding_inflow_id',
        as: 'inflow',
      });
      FundingAllocation.belongsTo(models.Organization, {
        foreignKey: 'recipient_organization_id',
        as: 'recipient',
      });
      FundingAllocation.belongsTo(models.Lga, { foreignKey: 'lga_id', as: 'lga' });
      FundingAllocation.belongsTo(models.User, { foreignKey: 'approved_by', as: 'approver' });
    }
  }

  FundingAllocation.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      funding_source_id: { type: DataTypes.UUID, allowNull: true },
      funding_inflow_id: { type: DataTypes.UUID, allowNull: true },
      recipient_organization_id: { type: DataTypes.UUID, allowNull: true },
      lga_id: { type: DataTypes.UUID, allowNull: true },
      amount: {
        type: DataTypes.DECIMAL(14, 2),
        allowNull: false,
        validate: { min: 0 },
      },
      currency: { type: DataTypes.STRING(3), allowNull: false, defaultValue: 'NGN' },
      period: { type: DataTypes.STRING(20), allowNull: false },
      purpose: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'planned',
        validate: { isIn: [ALLOCATION_STATUSES] },
      },
      approved_by: { type: DataTypes.UUID, allowNull: true },
      disbursed_on: { type: DataTypes.DATEONLY, allowNull: true },
    },
    {
      sequelize,
      modelName: 'FundingAllocation',
      tableName: 'funding_allocations',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [{ fields: ['lga_id', 'period'] }],
    }
  );

  FundingAllocation.STATUSES = ALLOCATION_STATUSES;
  return FundingAllocation;
};
