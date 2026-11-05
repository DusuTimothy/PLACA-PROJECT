'use strict';

/**
 * /api/assistant routes.
 *
 * Available to every signed-in account, including admin: the assistant answers
 * general questions and never receives programme or account data. Each chat is
 * private to its owner, and the send endpoint has its own per-account limit
 * because a model call is more expensive than a normal read.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/assistant');
const controller = require('../controllers/assistantController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { assistantLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.use(authenticate, requirePasswordChanged);

router.get(
  '/conversations',
  validate(schema.listConversations),
  asyncHandler(controller.listConversations)
);
router.get(
  '/conversations/:id',
  validate(schema.conversationParams),
  asyncHandler(controller.getConversation)
);
router.delete(
  '/conversations/:id',
  validate(schema.conversationParams),
  asyncHandler(controller.deleteConversation)
);

router.post(
  '/chat',
  assistantLimiter,
  validate(schema.sendMessage),
  asyncHandler(controller.sendMessage)
);

module.exports = router;
