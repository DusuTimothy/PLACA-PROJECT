'use strict';

/**
 * /api/notifications routes.
 *
 * Every signed-in user sees only their own notifications. These endpoints are
 * deliberately lightweight; reading a notice is not audited.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/notification');
const controller = require('../controllers/notificationController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, requirePasswordChanged);

router.get('/', validate(schema.listNotifications), asyncHandler(controller.list));
router.get('/unread', asyncHandler(controller.unread));
router.post('/read-all', validate(schema.readAll), asyncHandler(controller.markAllRead));
router.post('/:id/read', validate(schema.notificationParams), asyncHandler(controller.markRead));

module.exports = router;
