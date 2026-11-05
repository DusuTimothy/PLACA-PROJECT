'use strict';

/**
 * Operational error with an HTTP status and a stable machine-readable code.
 * Controllers throw these instead of hand-writing res.status(...) everywhere.
 */

class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(code, message, details) {
    return new AppError(400, code, message, details);
  }

  static unauthorized(code = 'UNAUTHORIZED', message = 'Authentication required') {
    return new AppError(401, code, message);
  }

  static forbidden(code = 'FORBIDDEN', message = 'You do not have permission for this action') {
    return new AppError(403, code, message);
  }

  static notFound(code = 'NOT_FOUND', message = 'Record not found') {
    return new AppError(404, code, message);
  }

  static conflict(code, message, details) {
    return new AppError(409, code, message, details);
  }
}

module.exports = AppError;
