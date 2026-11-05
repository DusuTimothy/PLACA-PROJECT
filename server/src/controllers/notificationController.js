'use strict';

const service = require('../services/notificationService');

async function list(req, res) {
  return res.json(await service.listNotifications(req.user, req.query));
}

async function unread(req, res) {
  return res.json(await service.unreadCount(req.user));
}

async function markRead(req, res) {
  return res.json({ data: await service.markRead(req.user, req.params.id) });
}

async function markAllRead(req, res) {
  return res.json(await service.markAllRead(req.user));
}

module.exports = { list, unread, markRead, markAllRead };
