'use strict';

/**
 * One private AI-assistant conversation.
 *
 * The owner is always the signed-in user. Assistant services must scope every
 * read and write by user_id; an id alone is never enough.
 */
const { Model } = require('sequelize');

const CHAT_LANGUAGES = ['en', 'ha'];

module.exports = (sequelize, DataTypes) => {
  class ChatConversation extends Model {
    static associate(models) {
      ChatConversation.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      ChatConversation.hasMany(models.ChatMessage, {
        foreignKey: 'conversation_id',
        as: 'messages',
      });
    }
  }

  ChatConversation.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      user_id: { type: DataTypes.UUID, allowNull: false },
      title: { type: DataTypes.STRING(200), allowNull: false },
      language: {
        type: DataTypes.STRING(2),
        allowNull: false,
        defaultValue: 'en',
        validate: { isIn: [CHAT_LANGUAGES] },
      },
      last_message_at: { type: DataTypes.DATE, allowNull: true },
    },
    {
      sequelize,
      modelName: 'ChatConversation',
      tableName: 'chat_conversations',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [{ fields: ['user_id', 'last_message_at'] }],
    }
  );

  ChatConversation.LANGUAGES = CHAT_LANGUAGES;
  return ChatConversation;
};
