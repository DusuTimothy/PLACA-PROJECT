'use strict';

/**
 * Single error boundary for the API.
 *
 * Rules:
 * - clients receive a stable `error` code and a human message;
 * - stack traces are logged, never returned;
 * - passwords/tokens never appear because request bodies are not logged.
 */

const { ZodError } = require('zod');
const { UniqueConstraintError, ValidationError, ForeignKeyConstraintError } = require('sequelize');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const AppError = require('../utils/AppError');
const env = require('../config/env');

// eslint-disable-next-line no-unused-vars
function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }

  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code,
      })),
    });
  }

  if (error instanceof UniqueConstraintError) {
    return res.status(409).json({
      error: 'DUPLICATE_VALUE',
      message: 'A record with that value already exists.',
      details: Object.keys(error.fields || {}).map((field) => ({
        path: field,
        message: 'This value is already in use',
        code: 'duplicate',
      })),
    });
  }

  if (error instanceof ValidationError) {
    return res.status(400).json({
      error: 'MODEL_VALIDATION_FAILED',
      message: 'Some values are not valid.',
      details: error.errors.map((item) => ({
        path: item.path,
        message: item.message,
        code: 'invalid',
      })),
    });
  }

  if (error instanceof ForeignKeyConstraintError) {
    return res.status(400).json({
      error: 'INVALID_REFERENCE',
      message: 'A linked record does not exist or is still in use.',
    });
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'FILE_TOO_LARGE',
        message: 'The file must be 10 MB or smaller.',
      });
    }
    return res.status(400).json({
      error: 'UPLOAD_FAILED',
      message: error.message || 'The file could not be uploaded.',
    });
  }

  if (error instanceof jwt.TokenExpiredError) {
    return res.status(401).json({
      error: 'TOKEN_EXPIRED',
      message: 'Your session has expired. Please sign in again.',
    });
  }

  if (error instanceof jwt.JsonWebTokenError) {
    return res.status(401).json({
      error: 'INVALID_TOKEN',
      message: 'Your session is not valid. Please sign in again.',
    });
  }

  // Malformed JSON from express.json()
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'INVALID_JSON',
      message: 'The request body is not valid JSON.',
    });
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'PAYLOAD_TOO_LARGE',
      message: 'The request is too large.',
    });
  }

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, {
    message: error.message,
    stack: error.stack,
    requestId: req.requestId,
  });

  return res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: env.isProduction
      ? 'Something went wrong on the server. Please try again.'
      : error.message,
  });
}

module.exports = errorHandler;
