'use strict';

/**
 * AI assistant endpoints. Every service call is scoped to the signed-in user.
 */

const service = require('../services/assistantService');

async function listConversations(req, res) {
  return res.json(await service.listConversations(req.user, req.query));
}

async function getConversation(req, res) {
  return res.json({ data: await service.getConversation(req.user, req.params.id) });
}

async function deleteConversation(req, res) {
  return res.json(await service.deleteConversation(req.user, req.params.id));
}

async function sendMessage(req, res) {
  return res.json({ data: await service.sendMessage(req.user, req.body) });
}

async function sendPublicMessage(req, res) {
  return res.json({ data: await service.sendPublicMessage(req.body) });
}

module.exports = {
  listConversations,
  getConversation,
  deleteConversation,
  sendMessage,
  sendPublicMessage,
};
