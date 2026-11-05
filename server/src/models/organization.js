'use strict';

/**
 * Implementing partner. Partners must be approved before they can report.
 */
const { Model } = require('sequelize');

const ORGANIZATION_TYPES = ['ngo', 'cbo', 'faith_based', 'private_sector', 'government_mda', 'laca'];
const ORGANIZATION_STATUSES = ['pending', 'approved', 'suspended'];

module.exports = (sequelize, DataTypes) => {
  class Organization extends Model {
    static associate(models) {
      Organization.belongsTo(models.Lga, { foreignKey: 'lga_id', as: 'lga' });
      Organization.belongsTo(models.User, { foreignKey: 'approved_by', as: 'approver' });
      Organization.hasMany(models.User, { foreignKey: 'organization_id', as: 'users' });
      Organization.hasMany(models.Workplan, { foreignKey: 'organization_id', as: 'workplans' });
      Organization.hasMany(models.Report, { foreignKey: 'organization_id', as: 'reports' });
      Organization.hasMany(models.SupportRequest, { foreignKey: 'organization_id', as: 'supportRequests' });
      Organization.hasMany(models.WelfareProgramme, { foreignKey: 'organization_id', as: 'programmes' });
      Organization.hasMany(models.FundingAllocation, { foreignKey: 'recipient_organization_id', as: 'fundingAllocations' });
    }
  }

  Organization.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(200), allowNull: false, unique: true },
      type: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: { isIn: [ORGANIZATION_TYPES] },
      },
      lga_id: { type: DataTypes.UUID, allowNull: false },
      focus_areas: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      contact_name: { type: DataTypes.STRING(160), allowNull: true },
      contact_phone: { type: DataTypes.STRING(30), allowNull: true },
      contact_email: {
        type: DataTypes.STRING(190),
        allowNull: true,
        set(value) {
          this.setDataValue('contact_email', value ? String(value).trim().toLowerCase() : null);
        },
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'pending',
        validate: { isIn: [ORGANIZATION_STATUSES] },
      },
      approved_by: { type: DataTypes.UUID, allowNull: true },
      approved_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Organization',
      tableName: 'organizations',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
    }
  );

  Organization.TYPES = ORGANIZATION_TYPES;
  Organization.STATUSES = ORGANIZATION_STATUSES;
  return Organization;
};
