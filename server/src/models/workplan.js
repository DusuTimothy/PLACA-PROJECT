'use strict';

/**
 * One quarterly workplan per organization. Targets hang off this record.
 *
 * A partner prepares the plan, submits it, and a PLACA reviewer approves it or
 * returns it with a note. The plan is never edited after approval; a new
 * quarter is planned instead. That keeps an approved target set stable for
 * comparison with reports.
 */
const { Model } = require('sequelize');

const WORKPLAN_STATUSES = ['draft', 'submitted', 'approved', 'returned'];

module.exports = (sequelize, DataTypes) => {
  class Workplan extends Model {
    static associate(models) {
      Workplan.belongsTo(models.Organization, { foreignKey: 'organization_id', as: 'organization' });
      Workplan.belongsTo(models.User, { foreignKey: 'created_by', as: 'creator' });
      Workplan.belongsTo(models.User, { foreignKey: 'approved_by', as: 'approver' });
      Workplan.hasMany(models.WorkplanTarget, { foreignKey: 'workplan_id', as: 'targets' });
    }
  }

  Workplan.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      organization_id: { type: DataTypes.UUID, allowNull: false },
      year: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 2000, max: 2100 } },
      quarter: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, max: 4 } },
      created_by: { type: DataTypes.UUID, allowNull: true },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'draft',
        validate: { isIn: [WORKPLAN_STATUSES] },
      },
      submitted_at: { type: DataTypes.DATE, allowNull: true },
      approved_by: { type: DataTypes.UUID, allowNull: true },
      approved_at: { type: DataTypes.DATE, allowNull: true },
      review_note: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Workplan',
      tableName: 'workplans',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [
        { unique: true, fields: ['organization_id', 'year', 'quarter'] },
        { fields: ['status'] },
      ],
    }
  );

  Workplan.STATUSES = WORKPLAN_STATUSES;
  return Workplan;
};
