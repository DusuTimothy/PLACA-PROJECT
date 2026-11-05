'use strict';

/**
 * AI assistant request schemas.
 *
 * The server builds conversation history from its own database rows. The client
 * never supplies prior messages, so a caller cannot inject a fake "assistant"
 * turn or send unrelated platform data for the model to read.
 */

const { z } = require('zod');
const {
  uuid,
  optionalUuid,
  language,
  paginationQuery,
  emptyBody,
  emptyQuery,
  emptyParams,
} = require('./common');

const message = z
  .string()
  .trim()
  .min(1, 'Type a question')
  .max(2000, 'Keep your message under 2000 characters');

// Public visitors have no account and no saved conversation. The browser may
// send a short recent transcript so follow-up questions work, but the server
// bounds it and never persists it.
const PUBLIC_MAX_HISTORY = 6;
const PUBLIC_MAX_MESSAGE = 1000;

const publicHistoryTurn = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(PUBLIC_MAX_MESSAGE),
});

const sendMessage = z.object({
  body: z.object({
    conversation_id: optionalUuid,
    message,
    language: language.optional(),
  }),
  query: emptyQuery,
  params: emptyParams,
});

const publicSendMessage = z.object({
  body: z.object({
    message: z
      .string()
      .trim()
      .min(1, 'Type a question')
      .max(PUBLIC_MAX_MESSAGE, 'Keep your message under 1000 characters'),
    language: language.optional(),
    history: z.array(publicHistoryTurn).max(PUBLIC_MAX_HISTORY).optional().default([]),
  }),
  query: emptyQuery,
  params: emptyParams,
});

const listConversations = z.object({
  body: emptyBody,
  query: paginationQuery,
  params: emptyParams,
});

const conversationParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

module.exports = {
  PUBLIC_MAX_HISTORY,
  PUBLIC_MAX_MESSAGE,
  sendMessage,
  publicSendMessage,
  listConversations,
  conversationParams,
};
