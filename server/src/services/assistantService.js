'use strict';

/**
 * General-purpose AI assistant.
 *
 * Privacy boundary:
 * - Only the signed-in user's own conversation messages are read.
 * - The Gemini prompt is built from those messages plus a fixed public system
 *   instruction. Name, email, role, organization, LGA and every programme
 *   record stay in PLACA.
 * - Chat rows are excluded from audit hooks so private text is not duplicated
 *   into the audit log.
 *
 * The feature is useful without a key, but answering returns a clear
 * AI_NOT_CONFIGURED error until GEMINI_API_KEY is set on the server.
 */

const axios = require('axios');
const {
  ChatConversation,
  ChatMessage,
  sequelize,
} = require('../models');
const env = require('../config/env');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');

const SYSTEM_PROMPT = [
  'You are the PLACA assistant inside the Plateau State Agency for the Control of AIDS staff platform.',
  'Answer general questions about HIV and AIDS, public health, coordination, reporting good practice, and how staff can use the PLACA platform.',
  'You cannot see or change any account, organization, LGA, report, workplan, funding, support request, document, notification, or other platform record. Never claim that you can. If a question depends on a specific record, tell the user to open the relevant PLACA page or contact a PLACA officer.',
  'Never ask for or repeat names, phone numbers, email addresses, home addresses, HIV status, test results, or other personal information. If the user shares such details, do not echo them; remind the user not to share personal data.',
  'Do not invent platform figures, policy, deadlines, or legal requirements. If you are unsure, say so and recommend checking with PLACA or a qualified health worker.',
  'Do not give a medical diagnosis or personal treatment instructions. Encourage the user to seek care from a qualified health worker for individual medical concerns.',
  'Answers are general guidance, not guaranteed, official, or authoritative. Keep them short, practical, and clearly worded for a non-technical audience.',
  'Use plain text only. Do not use tables or markdown formatting.',
].join(' ');

const PUBLIC_SYSTEM_PROMPT = [
  'You are the PLACA assistant on the public website of the Plateau State Agency for the Control of AIDS.',
  'You are speaking to an anonymous visitor. You cannot see any account, organization, LGA, report, workplan, funding, support request, document, notification, or other private platform record. The visitor is not signed in and this conversation is not saved.',
  'Answer only general questions about HIV and AIDS, public health, the published PLACA results, and how partners report. Do not repeat or ask for names, phone numbers, email addresses, home addresses, HIV status, test results, or other personal information.',
  'Do not invent figures, policy, deadlines, or legal requirements. If you are unsure, say so and recommend contacting the PLACA secretariat or a qualified health worker.',
  'Do not give a medical diagnosis or personal treatment instructions. Encourage the visitor to seek care from a qualified health worker for individual medical concerns.',
  'Answers are general guidance, not guaranteed, official, or authoritative. Keep them short, practical, and clearly worded for a non-technical audience.',
  'Use plain text only. Do not use tables or markdown formatting.',
].join(' ');

const LANGUAGE_NAMES = { en: 'English', ha: 'Hausa' };
const PUBLIC_MAX_HISTORY = 6;

function languageName(language) {
  return LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en;
}

function systemInstruction(language, audience = 'account') {
  const prompt = audience === 'public' ? PUBLIC_SYSTEM_PROMPT : SYSTEM_PROMPT;
  return [
    prompt,
    `Reply in ${languageName(language)}. If the user writes in another language, still reply in ${languageName(language)} unless they explicitly ask to switch.`,
  ].join(' ');
}

function plain(instance) {
  return instance && instance.toJSON ? instance.toJSON() : instance;
}

function serializeConversation(instance) {
  const conversation = plain(instance);
  if (!conversation) return null;
  return {
    id: conversation.id,
    title: conversation.title,
    language: conversation.language,
    last_message_at: conversation.last_message_at,
    created_at: conversation.createdAt,
    updated_at: conversation.updatedAt,
  };
}

function serializeMessage(instance) {
  const message = plain(instance);
  if (!message) return null;
  return {
    id: message.id,
    conversation_id: message.conversation_id,
    role: message.role,
    content: message.content,
    created_at: message.createdAt,
  };
}

/**
 * Make one short title from the first question. Titles are for the recent-chat
 * list only; they are not part of the Gemini request.
 */
function titleFromMessage(message) {
  const clean = String(message || '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'New conversation';
  return clean.length > 80 ? `${clean.slice(0, 79)}…` : clean;
}

/**
 * Convert stored turns into Gemini's contents array. Only role and content are
 * copied. Consecutive turns with the same role are merged so the provider gets
 * a valid alternating conversation.
 */
function toGeminiContents(history, message) {
  const contents = [];
  const turns = [...(history || []), { role: 'user', content: message }];

  for (const turn of turns) {
    if (!turn || !turn.content) continue;
    const role = turn.role === 'assistant' ? 'model' : 'user';
    const text = String(turn.content).trim();
    if (!text) continue;

    const previous = contents[contents.length - 1];
    if (previous && previous.role === role) {
      previous.parts[0].text = `${previous.parts[0].text}\n\n${text}`;
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  return contents;
}

/**
 * Build the exact JSON body sent to Gemini. Kept separate so tests can assert
 * that only conversation text leaves the server.
 */
function buildGeminiPayload({ history, message, language, audience = 'account' }) {
  return {
    systemInstruction: { parts: [{ text: systemInstruction(language, audience) }] },
    contents: toGeminiContents(history, message),
    generationConfig: {
      temperature: 0.4,
      topP: 0.9,
      maxOutputTokens: 700,
    },
  };
}

function extractReply(data) {
  const blockReason = data?.promptFeedback?.blockReason;
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (blockReason || (finishReason && !['STOP', 'MAX_TOKENS'].includes(finishReason))) {
    throw new AppError(
      400,
      'AI_BLOCKED',
      'The assistant could not answer that request. Try asking in a different way.'
    );
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts
    .map((part) => part?.text)
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!text) {
    throw new AppError(
      502,
      'AI_UNAVAILABLE',
      'The assistant is unavailable right now. Please try again in a moment.'
    );
  }
  return text;
}

async function generateReply({ history, message, language, audience = 'account' }) {
  if (!env.GEMINI_API_KEY) {
    throw new AppError(
      503,
      'AI_NOT_CONFIGURED',
      'The assistant is not set up yet. Ask a PLACA administrator to add the Gemini API key.'
    );
  }

  const recent = (history || []).slice(-(env.AI_MAX_HISTORY_MESSAGES - 1));
  const url = `${env.GEMINI_API_BASE_URL.replace(/\/+$/, '')}/models/${encodeURIComponent(
    env.GEMINI_MODEL
  )}:generateContent`;

  try {
    const { data } = await axios.post(
      url,
      buildGeminiPayload({ history: recent, message, language, audience }),
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.GEMINI_API_KEY,
        },
        timeout: env.GEMINI_TIMEOUT_MS,
      }
    );
    return extractReply(data);
  } catch (error) {
    if (error instanceof AppError) throw error;

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      logger.warn('Gemini request timed out');
      throw new AppError(
        504,
        'AI_TIMEOUT',
        'The assistant took too long to answer. Please try again.'
      );
    }

    // Log the provider status only. Never log the prompt or the API key.
    logger.warn('Gemini request failed', {
      status: error.response?.status || null,
      code: error.code || null,
    });
    throw new AppError(
      502,
      'AI_UNAVAILABLE',
      'The assistant is unavailable right now. Please try again in a moment.'
    );
  }
}

async function findOwnedConversation(actor, id, { transaction } = {}) {
  const conversation = await ChatConversation.findOne({
    where: { id, user_id: actor.id },
    transaction,
  });
  if (!conversation) {
    throw AppError.notFound(
      'AI_CONVERSATION_NOT_FOUND',
      'That conversation does not exist.'
    );
  }
  return conversation;
}

async function listConversations(actor, query) {
  const { page, limit, offset } = getPagination(query);
  const { rows, count } = await ChatConversation.findAndCountAll({
    where: { user_id: actor.id },
    order: [
      ['last_message_at', 'DESC'],
      ['created_at', 'DESC'],
    ],
    limit,
    offset,
  });

  return {
    data: rows.map(serializeConversation),
    pagination: buildPaginationMeta({ page, limit, count }),
  };
}

async function getConversation(actor, id) {
  const conversation = await ChatConversation.findOne({
    where: { id, user_id: actor.id },
    include: [
      {
        model: ChatMessage,
        as: 'messages',
        required: false,
      },
    ],
    order: [[{ model: ChatMessage, as: 'messages' }, 'created_at', 'ASC']],
  });
  if (!conversation) {
    throw AppError.notFound(
      'AI_CONVERSATION_NOT_FOUND',
      'That conversation does not exist.'
    );
  }

  const data = serializeConversation(conversation);
  return {
    ...data,
    messages: (conversation.messages || []).map(serializeMessage),
  };
}

async function deleteConversation(actor, id) {
  const conversation = await findOwnedConversation(actor, id);
  await conversation.destroy();
  return { deleted: true };
}

/**
 * Public-site chat is stateless: nothing is written to the database, so there
 * is no conversation that could be exposed to another visitor. The browser may
 * send a short transcript to support follow-up questions; only role and content
 * survive, and both length and turn count are capped here as well as in the
 * request schema.
 */
function sanitizePublicHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (turn) =>
        turn &&
        (turn.role === 'user' || turn.role === 'assistant') &&
        typeof turn.content === 'string'
    )
    .map((turn) => ({
      role: turn.role,
      content: turn.content.trim().slice(0, 1000),
    }))
    .filter((turn) => turn.content.length > 0)
    .slice(-PUBLIC_MAX_HISTORY);
}

async function sendPublicMessage(input) {
  const language = input.language || 'en';
  const history = sanitizePublicHistory(input.history);
  const reply = await generateReply({
    history,
    message: input.message,
    language,
    audience: 'public',
  });

  return {
    messages: [
      {
        role: 'assistant',
        content: reply,
        created_at: new Date().toISOString(),
      },
    ],
  };
}

async function sendMessage(actor, input) {
  const language = input.language || actor.language || 'en';
  let conversation = null;
  let history = [];

  if (input.conversation_id) {
    conversation = await findOwnedConversation(actor, input.conversation_id);
    const rows = await ChatMessage.findAll({
      where: { conversation_id: conversation.id },
      order: [['created_at', 'ASC']],
    });
    history = rows.map((row) => ({ role: row.role, content: row.content }));
  }

  // Call Gemini before writing, so a provider failure leaves no half-turn in
  // the conversation. The user can safely retry the same question.
  const reply = await generateReply({
    history,
    message: input.message,
    language,
  });

  const now = new Date();
  const saved = await sequelize.transaction(async (transaction) => {
    let active = conversation;

    if (active) {
      active.language = language;
      active.last_message_at = now;
      await active.save({ transaction });
    } else {
      active = await ChatConversation.create(
        {
          user_id: actor.id,
          title: titleFromMessage(input.message),
          language,
          last_message_at: now,
        },
        { transaction }
      );
    }

    const userMessage = await ChatMessage.create(
      {
        conversation_id: active.id,
        role: 'user',
        content: input.message,
      },
      { transaction }
    );
    const assistantMessage = await ChatMessage.create(
      {
        conversation_id: active.id,
        role: 'assistant',
        content: reply,
      },
      { transaction }
    );

    return { active, userMessage, assistantMessage };
  });

  return {
    conversation: serializeConversation(saved.active),
    messages: [serializeMessage(saved.userMessage), serializeMessage(saved.assistantMessage)],
  };
}

module.exports = {
  SYSTEM_PROMPT,
  PUBLIC_SYSTEM_PROMPT,
  systemInstruction,
  titleFromMessage,
  toGeminiContents,
  buildGeminiPayload,
  extractReply,
  sanitizePublicHistory,
  listConversations,
  getConversation,
  deleteConversation,
  sendPublicMessage,
  sendMessage,
};
