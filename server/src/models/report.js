'use strict';

/**
 * A partner's periodic report.
 *
 * client_uuid is generated on the device before the first send. A unique index
 * on it makes offline retries idempotent: sending the same report twice updates
 * the same row instead of creating a duplicate.
 */
const { Model } = require('sequelize');

const REPORT_STATUSES = ['draft', 'submitted', 'validated', 'returned', 'aggregated'];
const PERIOD_TYPES = ['monthly', 'quarterly', 'annual'];

module.exports = (sequelize, DataTypes) => {
  class Report extends Model {
    static associate(models) {
      Report.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
      Report.belongsTo(models.Lga, { foreignKey: 'lga_id', as: 'lga' });
      Report.belongsTo(models.WelfareProgramme, { foreignKey: 'programme_id', as: 'programme' });
      Report.belongsTo(models.User, { foreignKey: 'submitted_by', as: 'submitter' });
      Report.belongsTo(models.User, { foreignKey: 'validated_by', as: 'validator' });
      Report.hasMany(models.ReportValue, { foreignKey: 'report_id', as: 'values' });
    }
  }

  Report.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      // Denormalised on purpose: LACA dashboards filter by LGA without a join.
      lga_id: { type: DataTypes.UUID, allowNull: false },
      programme_id: { type: DataTypes.UUID, allowNull: true },
      period_type: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [PERIOD_TYPES] },
      },
      period_year: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 2000, max: 2100 } },
      period_number: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 12 } },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'draft',
        validate: { isIn: [REPORT_STATUSES] },
      },
      client_uuid: { type: DataTypes.UUID, allowNull: false, unique: true },
      submitted_by: { type: DataTypes.UUID, allowNull: true },
      submitted_at: { type: DataTypes.DATE, allowNull: true },
      validated_by: { type: DataTypes.UUID, allowNull: true },
      validated_at: { type: DataTypes.DATE, allowNull: true },
      return_reason: { type: DataTypes.TEXT, allowNull: true },
      flags: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    },
    {
      sequelize,
      modelName: 'Report',
      tableName: 'reports',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [
        { fields: ['organization_id', 'period_year', 'period_number'] },
        { fields: ['lga_id', 'status'] },
      ],
    }
  );

  Report.STATUSES = REPORT_STATUSES;
  Report.PERIOD_TYPES = PERIOD_TYPES;
  return Report;
};
