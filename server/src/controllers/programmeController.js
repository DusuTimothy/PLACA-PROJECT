'use strict';

const service = require('../services/programmeService');

async function list(req, res) {
  return res.json(await service.listProgrammes(req.user, req.query));
}

async function getOne(req, res) {
  return res.json({ data: await service.getProgramme(req.user, req.params.id) });
}

async function create(req, res) {
  return res.status(201).json({ data: await service.createProgramme(req.user, req.body) });
}

async function update(req, res) {
  return res.json({ data: await service.updateProgramme(req.user, req.params.id, req.body) });
}

async function remove(req, res) {
  return res.json(await service.deleteProgramme(req.user, req.params.id));
}

module.exports = { list, getOne, create, update, remove };
