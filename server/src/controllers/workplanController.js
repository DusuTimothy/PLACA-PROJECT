'use strict';

/**
 * Workplan endpoints.
 */

const service = require('../services/workplanService');

async function list(req, res) {
  const result = await service.listWorkplans(req.user, req.query);
  return res.json(result);
}

async function getOne(req, res) {
  const workplan = await service.getWorkplan(req.user, req.params.id);
  return res.json({ data: workplan });
}

async function create(req, res) {
  const workplan = await service.createWorkplan(req.user, req.body);
  return res.status(201).json({ data: workplan });
}

async function update(req, res) {
  const workplan = await service.updateWorkplan(req.user, req.params.id, req.body);
  return res.json({ data: workplan });
}

async function submit(req, res) {
  const workplan = await service.submitWorkplan(req.user, req.params.id);
  return res.json({ data: workplan });
}

async function review(req, res) {
  const workplan = await service.reviewWorkplan(req.user, req.params.id, req.body);
  return res.json({ data: workplan });
}

async function remove(req, res) {
  const result = await service.deleteWorkplan(req.user, req.params.id);
  return res.json(result);
}

module.exports = { list, getOne, create, update, submit, review, remove };
