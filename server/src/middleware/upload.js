'use strict';

/**
 * In-memory upload for the resource library.
 *
 * Files are held in memory only until the service has validated the metadata
 * and written them to UPLOAD_DIR. Nothing is written for a rejected request.
 */

const multer = require('multer');

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
  fileFilter(req, file, callback) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      const error = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
      error.message = 'Use a PDF, Word, PowerPoint, Excel, text, CSV, PNG or JPEG file.';
      return callback(error);
    }
    return callback(null, true);
  },
});

module.exports = { upload, MAX_FILE_BYTES, ALLOWED_MIME_TYPES };
