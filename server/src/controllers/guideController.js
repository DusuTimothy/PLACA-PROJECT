'use strict';

const service = require('../services/guideService');

async function list(req, res) {
  return res.json(await service.listGuides(req.user, req.query));
}

async function getOne(req, res) {
  return res.json({ data: await service.getGuide(req.user, req.params.key, req.user.language) });
}

async function create(req, res) {
  return res.status(201).json({ data: await service.createGuide(req.user, req.body) });
}

async function update(req, res) {
  return res.json({ data: await service.updateGuide(req.user, req.params.id, req.body) });
}

async function remove(req, res) {
  return res.json(await service.deleteGuide(req.user, req.params.id));
}

async function progress(req, res) {
  return res.json(await service.listProgress(req.user));
}

async function markProgress(req, res) {
  return res.json({ data: await service.markProgress(req.user, req.params.key, req.body) });
}

module.exports = { list, getOne, create, update, remove, progress, markProgress };
