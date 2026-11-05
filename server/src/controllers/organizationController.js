'use strict';

/**
 * Partner organization endpoints.
 */

const service = require('../services/organizationService');

async function list(req, res) {
  const result = await service.listOrganizations(req.user, req.query);
  return res.json(result);
}

async function getOne(req, res) {
  const organization = await service.getOrganization(req.user, req.params.id);
  return res.json({ data: organization });
}

async function create(req, res) {
  const organization = await service.createOrganization(req.user, req.body);
  return res.status(201).json({ data: organization });
}

async function update(req, res) {
  const organization = await service.updateOrganization(req.user, req.params.id, req.body);
  return res.json({ data: organization });
}

async function approve(req, res) {
  const organization = await service.approveOrganization(req.user, req.params.id);
  return res.json({ data: organization });
}

async function suspend(req, res) {
  const organization = await service.suspendOrganization(req.user, req.params.id);
  return res.json({ data: organization });
}

module.exports = { list, getOne, create, update, approve, suspend };
