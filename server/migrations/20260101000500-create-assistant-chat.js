'use strict';

/**
 * AI assistant conversations.
 *
 * A conversation belongs to exactly one user. The assistant endpoint reads
 * only the messages in the requested conversation; account, organization, LGA
 * and programme records are never included in the Gemini prompt.
 *
 * Chat rows are deliberately kept out of the audit trail (see auditHooks.js):
 * the audit log is for programme/business changes and must not become a second
 * copy of private conversations.
 */

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chat_conversations', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      title: { type: Sequelize.STRING(200), allowNull: false },
      language: { type: Sequelize.STRING(2), allowNull: false, defaultValue: 'en' },
      last_message_at: { type: Sequelize.DATE, allowNull: true },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('chat_conversations', ['user_id', 'last_message_at'], {
      name: 'chat_conversations_user_recent_idx',
    });
    await queryInterface.sequelize.query(`
      ALTER TABLE chat_conversations
      ADD CONSTRAINT chat_conversations_language_check CHECK (language IN ('en','ha'));
    `);

    await queryInterface.createTable('chat_messages', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
        defaultValue: Sequelize.literal('gen_random_uuid()'),
      },
      conversation_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'chat_conversations', key: 'id' },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      },
      role: { type: Sequelize.STRING(20), allowNull: false },
      content: { type: Sequelize.TEXT, allowNull: false },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('chat_messages', ['conversation_id', 'created_at'], {
      name: 'chat_messages_conversation_created_idx',
    });
    await queryInterface.sequelize.query(`
      ALTER TABLE chat_messages
      ADD CONSTRAINT chat_messages_role_check CHECK (role IN ('user','assistant')),
      ADD CONSTRAINT chat_messages_content_length_check CHECK
        (char_length(content) BETWEEN 1 AND 20000);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('chat_messages');
    await queryInterface.dropTable('chat_conversations');
  },
};
