'use strict';

const service = require('../services/fundingService');

async function listSources(req, res) {
  return res.json(await service.listSources(req.user, req.query));
}

async function createSource(req, res) {
  return res.status(201).json({ data: await service.createSource(req.user, req.body) });
}

async function updateSource(req, res) {
  return res.json({ data: await service.updateSource(req.user, req.params.id, req.body) });
}

async function removeSource(req, res) {
  return res.json(await service.deleteSource(req.user, req.params.id));
}

async function listInflows(req, res) {
  return res.json(await service.listInflows(req.user, req.query));
}

async function createInflow(req, res) {
  return res.status(201).json({ data: await service.createInflow(req.user, req.body) });
}

async function updateInflow(req, res) {
  return res.json({ data: await service.updateInflow(req.user, req.params.id, req.body) });
}

async function removeInflow(req, res) {
  return res.json(await service.deleteInflow(req.user, req.params.id));
}

async function listAllocations(req, res) {
  return res.json(await service.listAllocations(req.user, req.query));
}

async function createAllocation(req, res) {
  return res.status(201).json({ data: await service.createAllocation(req.user, req.body) });
}

async function updateAllocation(req, res) {
  return res.json({
    data: await service.updateAllocation(req.user, req.params.id, req.body),
  });
}

async function removeAllocation(req, res) {
  return res.json(await service.deleteAllocation(req.user, req.params.id));
}

async function summary(req, res) {
  return res.json({ data: await service.summary(req.user, req.query) });
}

module.exports = {
  listSources,
  createSource,
  updateSource,
  removeSource,
  listInflows,
  createInflow,
  updateInflow,
  removeInflow,
  listAllocations,
  createAllocation,
  updateAllocation,
  removeAllocation,
  summary,
};
