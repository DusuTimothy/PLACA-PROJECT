'use strict';

/**
 * Where money comes from: government, donor, private sector or other.
 */
const { Model } = require('sequelize');

const FUNDING_SOURCE_TYPES = ['government', 'donor', 'private', 'other'];

module.exports = (sequelize, DataTypes) => {
  class FundingSource extends Model {
    static associate(models) {
      FundingSource.hasMany(models.FundingInflow, { foreignKey: 'funding_source_id', as: 'inflows' });
      FundingSource.hasMany(models.FundingAllocation, {
        foreignKey: 'funding_source_id',
        as: 'allocations',
      });
    }
  }

  FundingSource.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(160), allowNull: false, unique: true },
      type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [FUNDING_SOURCE_TYPES] },
      },
      description: { type: DataTypes.TEXT, allowNull: true },
      is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'FundingSource',
      tableName: 'funding_sources',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
    }
  );

  FundingSource.TYPES = FUNDING_SOURCE_TYPES;
  return FundingSource;
};
