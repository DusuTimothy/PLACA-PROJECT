'use strict';

/**
 * Welfare or campaign programme. Participants are counted through report
 * values; no participant names are stored.
 */
const { Model } = require('sequelize');

const PROGRAMME_KINDS = ['skills_training', 'orphan_support', 'stigma_support', 'testing_campaign'];
const PROGRAMME_STATUSES = ['planned', 'active', 'completed', 'cancelled'];

module.exports = (sequelize, DataTypes) => {
  class WelfareProgramme extends Model {
    static associate(models) {
      WelfareProgramme.belongsTo(models.Lga, { foreignKey: 'lga_id', as: 'lga' });
      WelfareProgramme.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
      WelfareProgramme.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
      WelfareProgramme.hasMany(models.Report, { foreignKey: 'programme_id', as: 'reports' });
    }
  }

  WelfareProgramme.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      kind: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: { isIn: [PROGRAMME_KINDS] },
      },
      name: { type: DataTypes.STRING(200), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      lga_id: { type: DataTypes.UUID, allowNull: false },
      organization_id: { type: DataTypes.UUID, allowNull: true },
      start_date: { type: DataTypes.DATEONLY, allowNull: true },
      end_date: { type: DataTypes.DATEONLY, allowNull: true },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'planned',
        validate: { isIn: [PROGRAMME_STATUSES] },
      },
      created_by: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: 'WelfareProgramme',
      tableName: 'welfare_programmes',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
    }
  );

  WelfareProgramme.KINDS = PROGRAMME_KINDS;
  WelfareProgramme.STATUSES = PROGRAMME_STATUSES;
  return WelfareProgramme;
};
