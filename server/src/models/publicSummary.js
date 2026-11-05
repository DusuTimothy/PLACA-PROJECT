'use strict';

/**
 * Pre-aggregated numbers for the no-login public page.
 * The public endpoint reads ONLY this table through a read-only DB role, so a
 * bug in the public page can never expose a report, an organization or a user.
 */
const { Model } = require('sequelize');

const SCOPES = ['state', 'lga'];

module.exports = (sequelize, DataTypes) => {
  class PublicSummary extends Model {
    static associate(models) {
      PublicSummary.belongsTo(models.Lga, { foreignKey: 'lga_id', as: 'lga' });
    }
  }

  PublicSummary.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      scope: {
        type: DataTypes.STRING(10),
        allowNull: false,
        validate: { isIn: [SCOPES] },
      },
      lga_id: { type: DataTypes.UUID, allowNull: true },
      indicator_code: { type: DataTypes.STRING(40), allowNull: false },
      period: { type: DataTypes.STRING(20), allowNull: false },
      value: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 0 },
      },
      generated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      modelName: 'PublicSummary',
      tableName: 'public_summary',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [
        { fields: ['scope', 'period'] },
        { fields: ['lga_id', 'period'] },
      ],
    }
  );

  PublicSummary.SCOPES = SCOPES;
  return PublicSummary;
};
