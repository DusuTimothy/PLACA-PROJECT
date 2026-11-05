'use strict';

/**
 * One stored turn in an AI-assistant conversation.
 *
 * Only `user` and `assistant` roles are valid. The server maps them to the
 * Gemini `user` and `model` roles when it builds a request.
 */
const { Model } = require('sequelize');

const CHAT_MESSAGE_ROLES = ['user', 'assistant'];

module.exports = (sequelize, DataTypes) => {
  class ChatMessage extends Model {
    static associate(models) {
      ChatMessage.belongsTo(models.ChatConversation, {
        foreignKey: 'conversation_id',
        as: 'conversation',
      });
    }
  }

  ChatMessage.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      conversation_id: { type: DataTypes.UUID, allowNull: false },
      role: {
        type: DataTypes.STRING(20),
        allowNull: false,
        validate: { isIn: [CHAT_MESSAGE_ROLES] },
      },
      content: { type: DataTypes.TEXT, allowNull: false },
    },
    {
      sequelize,
      modelName: 'ChatMessage',
      tableName: 'chat_messages',
      underscored: true,
      freezeTableName: true,
      timestamps: true,
      indexes: [{ fields: ['conversation_id', 'created_at'] }],
    }
  );

  ChatMessage.ROLES = CHAT_MESSAGE_ROLES;
  return ChatMessage;
};
