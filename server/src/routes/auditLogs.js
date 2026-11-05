'use strict';

/**
 * /api/audit-logs is read-only and visible to the system admin only.
 * There is deliberately no POST, PATCH or DELETE route.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/reference');
const controller = require('../controllers/referenceController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();

router.get(
  '/',
  authenticate,
  requirePasswordChanged,
  requireRole('admin'),
  validate(schema.listAuditLogs),
  asyncHandler(controller.listAuditLogs)
);

module.exports = router;
