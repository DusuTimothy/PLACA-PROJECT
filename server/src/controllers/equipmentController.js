'use strict';

const service = require('../services/equipmentService');

async function list(req, res) {
  return res.json(await service.listItems(req.user, req.query));
}

async function create(req, res) {
  return res.status(201).json({ data: await service.createItem(req.user, req.body) });
}

async function update(req, res) {
  return res.json({ data: await service.updateItem(req.user, req.params.id, req.body) });
}

async function remove(req, res) {
  return res.json(await service.deleteItem(req.user, req.params.id));
}

async function stock(req, res) {
  return res.json(await service.listStock(req.user, req.query));
}

async function setStock(req, res) {
  return res.json({ data: await service.setStock(req.user, req.params.id, req.body) });
}

module.exports = { list, create, update, remove, stock, setStock };
