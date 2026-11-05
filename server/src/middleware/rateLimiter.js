'use strict';

/**
 * Rate limiting.
 *
 * Two layers:
 * 1. IP-based limits (this file) stop brute-force and scraping.
 * 2. Per-account failed-login locking lives in authService, because an attacker
 *    can rotate IPs but still targets one account.
 */

const rateLimit = require('express-rate-limit');
const env = require('../config/env');

function jsonLimiterHandler(req, res) {
  res.status(429).json({
    error: 'RATE_LIMITED',
    message: 'Too many requests. Please wait a few minutes and try again.',
  });
}

const globalLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimiterHandler,
});

const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonLimiterHandler,
});

const loginLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: jsonLimiterHandler,
});

// A Gemini call is much more expensive than an ordinary read. The key is the
// account id, so a shared office IP cannot exhaust the allowance for everyone.
const assistantLimiter = rateLimit({
  windowMs: env.AI_RATE_LIMIT_WINDOW_MS,
  limit: env.AI_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : `ip:${req.ip}`),
  handler: jsonLimiterHandler,
});

// Anonymous landing-page visitors have no account to key on. Keep the public
// allowance deliberately small and make it independent of the signed-in limit.
const publicAssistantLimiter = rateLimit({
  windowMs: env.PUBLIC_AI_RATE_LIMIT_WINDOW_MS,
  limit: env.PUBLIC_AI_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `public:${req.ip}`,
  handler: jsonLimiterHandler,
});

module.exports = {
  globalLimiter,
  authLimiter,
  loginLimiter,
  assistantLimiter,
  publicAssistantLimiter,
};
