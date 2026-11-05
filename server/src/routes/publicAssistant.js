'use strict';

/**
 * Public AI assistant route.
 *
 * The landing page is not signed in, so this route has no session and no access
 * to any user or programme record. It is stateless: the service sends the
 * visitor's message plus a short client-supplied transcript to Gemini and
 * returns the answer without writing anything to the database.
 *
 * Abuse is bounded by a strict per-IP limiter, small message/history limits and
 * a fixed server-side system instruction. The Gemini key never leaves the
 * server.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/assistant');
const controller = require('../controllers/assistantController');
const asyncHandler = require('../utils/asyncHandler');
const { publicAssistantLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

router.post(
  '/chat',
  publicAssistantLimiter,
  validate(schema.publicSendMessage),
  asyncHandler(controller.sendPublicMessage)
);

module.exports = router;
