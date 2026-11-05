'use strict';

const service = require('../services/supportRequestService');

async function list(req, res) {
  return res.json(await service.listRequests(req.user, req.query));
}

async function getOne(req, res) {
  return res.json({ data: await service.getRequest(req.user, req.params.id) });
}

async function create(req, res) {
  return res.status(201).json({ data: await service.createRequest(req.user, req.body) });
}

async function decide(req, res) {
  return res.json({ data: await service.decideRequest(req.user, req.params.id, req.body) });
}

async function supply(req, res) {
  return res.json({ data: await service.recordSupply(req.user, req.params.id, req.body) });
}

async function confirm(req, res) {
  return res.json({ data: await service.confirmReceipt(req.user, req.params.id) });
}

async function status(req, res) {
  return res.json({ data: await service.changeStatus(req.user, req.params.id, req.body) });
}

module.exports = { list, getOne, create, decide, supply, confirm, status };
