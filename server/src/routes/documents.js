'use strict';

/**
 * /api/documents routes.
 *
 * The catalogue is readable by every signed-in account. Upload, metadata edit
 * and delete are restricted to PLACA officers.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/document');
const controller = require('../controllers/documentController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');
const { upload } = require('../middleware/upload');

const router = express.Router();
const PLACA_ROLES = ['placa_officer', 'placa_director'];

router.use(authenticate, requirePasswordChanged);

router.get('/', validate(schema.listDocuments), asyncHandler(controller.list));
router.post(
  '/',
  requireRole(...PLACA_ROLES),
  upload.single('file'),
  validate(schema.createDocument),
  asyncHandler(controller.create)
);
router.get('/:id/download', validate(schema.documentParams), asyncHandler(controller.download));
router.patch(
  '/:id',
  requireRole(...PLACA_ROLES),
  validate(schema.updateDocument),
  asyncHandler(controller.update)
);
router.delete(
  '/:id',
  requireRole(...PLACA_ROLES),
  validate(schema.documentParams),
  asyncHandler(controller.remove)
);

module.exports = router;
