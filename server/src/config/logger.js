'use strict';

/**
 * Application logger.
 *
 * Security rule: never pass passwords, tokens, API keys or email bodies to
 * this logger. Error metadata is logged, but request bodies are not.
 */

const winston = require('winston');
const env = require('./env');

const logger = winston.createLogger({
  level: env.isProduction ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
      return `${timestamp} ${level.toUpperCase()} ${message}${extra}${stack ? `\n${stack}` : ''}`;
    })
  ),
  transports: [new winston.transports.Console()],
});

module.exports = logger;
