'use strict';

/**
 * Help content and field hints.
 *
 * Guides are data, not code: PLACA officers edit them in the app, and the
 * client caches published rows for offline use. page_key + field_key let a
 * FieldHint component look up help for one form input.
 */
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Guide extends Model {
    static associate(models) {
      Guide.belongsTo(models.User, { foreignKey: 'updated_by', as: 'editor' });
    }
  }

  Guide.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      key: { type: DataTypes.STRING(80), allowNull: false },
      language: {
        type: DataTypes.STRING(2),
        allowNull: false,
        defaultValue: 'en',
        validate: { isIn: [['en', 'ha']] },
      },
      title: { type: DataTypes.STRING(200), allowNull: false },
      body_md: { type: DataTypes.TEXT, allowNull: false },
      audience_roles: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: false,
        defaultValue: [],
      },
      page_key: { type: DataTypes.STRING(80), allowNull: true },
      field_key: { type: DataTypes.STRING(80), allowNull: true },
      sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      is_published: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      updated_by: { type: DataTypes.UUID, allowNull: true },
    },
    {
      sequelize,
      modelName: 'Guide',
      tableName: 'guides',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [
        { unique: true, fields: ['key', 'language'] },
        { fields: ['page_key', 'language'] },
      ],
    }
  );

  return Guide;
};
