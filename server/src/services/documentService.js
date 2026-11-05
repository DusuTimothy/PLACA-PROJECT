'use strict';

/**
 * Resource library.
 *
 * Metadata lives in PostgreSQL; the file lives under UPLOAD_DIR with a random
 * name. Only PLACA officers upload, replace or delete. Every signed-in user can
 * read the catalogue and download a file.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { Document, User } = require('../models');
const AppError = require('../utils/AppError');
const env = require('../config/env');
const { getPagination, buildPaginationMeta } = require('../utils/pagination');
const { PLACA_ROLES } = require('../middleware/rbac');
const { recordAudit } = require('./auditService');
const { MAX_FILE_BYTES } = require('../middleware/upload');

const EXTENSION_BY_MIME = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'image/png': '.png',
  'image/jpeg': '.jpg',
};

function plain(instance) {
  return instance && instance.toJSON ? instance.toJSON() : instance;
}

function serializeDocument(instance) {
  const document = plain(instance);
  if (!document) return null;
  return {
    id: document.id,
    title: document.title,
    category: document.category,
    language: document.language,
    file_key: document.file_key,
    original_name: document.original_name,
    mime_type: document.mime_type,
    size_bytes: document.size_bytes !== null && document.size_bytes !== undefined
      ? Number(document.size_bytes)
      : null,
    uploaded_by: document.uploaded_by,
    is_public: document.is_public,
    created_at: document.createdAt,
    updated_at: document.updatedAt,
    download_url: `/api/documents/${document.id}/download`,
    uploader: document.uploader
      ? { id: document.uploader.id, name: document.uploader.name }
      : null,
  };
}

function canManage(actor) {
  return PLACA_ROLES.includes(actor.role);
}

function safeExtension(file) {
  const fromMime = EXTENSION_BY_MIME[file.mimetype];
  if (fromMime) return fromMime;
  const fromName = path.extname(file.originalname || '').toLowerCase();
  return /^\.[a-z0-9]{1,8}$/.test(fromName) ? fromName : '';
}

async function listDocuments(actor, query) {
  const { page, limit, offset } = getPagination(query);
  const where = {};
  if (query.category) where.category = query.category;
  if (query.language) where.language = query.language;
  if (query.search) {
    const term = `%${query.search}%`;
    where[Op.or] = [
      { title: { [Op.iLike]: term } },
      { original_name: { [Op.iLike]: term } },
    ];
  }

  const { rows, count } = await Document.findAndCountAll({
    where,
    include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }],
    order: [
      ['created_at', 'DESC'],
      ['title', 'ASC'],
    ],
    limit,
    offset,
  });

  return {
    data: rows.map(serializeDocument),
    pagination: buildPaginationMeta({ page, limit, count }),
  };
}

async function getDocument(actor, id) {
  const document = await Document.findByPk(id, {
    include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }],
  });
  if (!document) throw AppError.notFound('DOCUMENT_NOT_FOUND', 'That document does not exist.');
  return document;
}

async function createDocument(actor, file, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can upload documents.');
  }
  if (!file || !file.buffer || file.buffer.length === 0) {
    throw AppError.badRequest('FILE_REQUIRED', 'Choose a file to upload.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw AppError.badRequest('FILE_TOO_LARGE', 'The file must be 10 MB or smaller.');
  }

  await fsp.mkdir(env.UPLOAD_DIR, { recursive: true });
  const fileKey = `${crypto.randomUUID()}${safeExtension(file)}`;
  const filePath = path.join(env.UPLOAD_DIR, fileKey);

  await fsp.writeFile(filePath, file.buffer, { mode: 0o640 });

  try {
    const document = await Document.create({
      title: input.title,
      category: input.category,
      language: input.language,
      file_key: fileKey,
      original_name: file.originalname || null,
      mime_type: file.mimetype || null,
      size_bytes: file.size,
      uploaded_by: actor.id,
      is_public: Boolean(input.is_public),
    });

    await recordAudit({
      action: 'document_uploaded',
      entity: 'Document',
      entityId: document.id,
      userId: actor.id,
      userRole: actor.role,
      newValue: {
        title: document.title,
        category: document.category,
        language: document.language,
        original_name: document.original_name,
      },
    });

    return serializeDocument(await getDocument(actor, document.id));
  } catch (error) {
    await fsp.unlink(filePath).catch(() => {});
    throw error;
  }
}

async function updateDocument(actor, id, input) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can edit documents.');
  }
  const document = await getDocument(actor, id);
  Object.assign(document, input);
  await document.save();
  return serializeDocument(await getDocument(actor, id));
}

async function deleteDocument(actor, id) {
  if (!canManage(actor)) {
    throw AppError.forbidden('ROLE_NOT_ALLOWED', 'Only PLACA officers can delete documents.');
  }
  const document = await getDocument(actor, id);
  const fileKey = path.basename(document.file_key);
  await document.destroy();
  await fsp.unlink(path.join(env.UPLOAD_DIR, fileKey)).catch(() => {});
  await recordAudit({
    action: 'document_deleted',
    entity: 'Document',
    entityId: id,
    userId: actor.id,
    userRole: actor.role,
    oldValue: { title: document.title, original_name: document.original_name },
  });
  return { deleted: true };
}

async function openDownload(actor, id) {
  const document = await getDocument(actor, id);
  const fileKey = path.basename(document.file_key);
  const filePath = path.join(env.UPLOAD_DIR, fileKey);

  if (!fs.existsSync(filePath)) {
    throw AppError.notFound('DOCUMENT_FILE_MISSING', 'The file for this document is missing.');
  }

  return {
    document,
    filePath,
    downloadName: document.original_name || `${document.title}${path.extname(fileKey)}`,
  };
}

module.exports = {
  serializeDocument,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  deleteDocument,
  openDownload,
  canManage,
};
