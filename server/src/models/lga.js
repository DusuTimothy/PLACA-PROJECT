'use strict';

/**
 * Local Government Area. Plateau State has 17, seeded once by migration seeder.
 */
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Lga extends Model {
    static associate(models) {
      Lga.hasMany(models.User, { foreignKey: 'lga_id', as: 'users' });
      Lga.hasMany(models.Organization, { foreignKey: 'lga_id', as: 'organizations' });
      Lga.hasMany(models.WelfareProgramme, { foreignKey: 'lga_id', as: 'programmes' });
      Lga.hasMany(models.FundingAllocation, { foreignKey: 'lga_id', as: 'fundingAllocations' });
      Lga.hasMany(models.WorkplanTarget, { foreignKey: 'lga_id', as: 'workplanTargets' });
      Lga.hasMany(models.PublicSummary, { foreignKey: 'lga_id', as: 'publicSummaries' });
      Lga.hasMany(models.StockLevel, { foreignKey: 'lga_id', as: 'stockLevels' });
    }
  }

  Lga.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
        unique: true,
      },
      code: {
        type: DataTypes.STRING(20),
        allowNull: false,
        unique: true,
      },
    },
    {
      sequelize,
      modelName: 'Lga',
      tableName: 'lgas',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
    }
  );

  return Lga;
};
