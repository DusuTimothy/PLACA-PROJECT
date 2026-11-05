'use strict';

/**
 * Resource-library file metadata. The file itself lives on disk or S3 and is
 * addressed by file_key. Only PLACA staff upload or replace documents.
 */
const { Model } = require('sequelize');

const DOCUMENT_CATEGORIES = ['guideline', 'training_material', 'workplan', 'policy'];

module.exports = (sequelize, DataTypes) => {
  class Document extends Model {
    static associate(models) {
      Document.belongsTo(models.User, { foreignKey: 'uploaded_by', as: 'uploader' });
    }
  }

  Document.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      title: { type: DataTypes.STRING(200), allowNull: false },
      category: {
        type: DataTypes.STRING(30),
        allowNull: false,
        validate: { isIn: [DOCUMENT_CATEGORIES] },
      },
      language: {
        type: DataTypes.STRING(2),
        allowNull: false,
        defaultValue: 'en',
        validate: { isIn: [['en', 'ha']] },
      },
      file_key: { type: DataTypes.STRING(400), allowNull: false },
      original_name: { type: DataTypes.STRING(255), allowNull: true },
      mime_type: { type: DataTypes.STRING(120), allowNull: true },
      size_bytes: { type: DataTypes.BIGINT, allowNull: true },
      uploaded_by: { type: DataTypes.UUID, allowNull: true },
      is_public: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    },
    {
      sequelize,
      modelName: 'Document',
      tableName: 'documents',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
    }
  );

  Document.CATEGORIES = DOCUMENT_CATEGORIES;
  return Document;
};
