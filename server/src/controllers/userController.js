'use strict';

/**
 * User administration endpoints.
 */

const userService = require('../services/userService');

async function create(req, res) {
  const result = await userService.createUser(req.user, req.body);
  return res.status(201).json(result);
}

async function list(req, res) {
  const result = await userService.listUsers(req.user, req.query);
  return res.json(result);
}

async function getOne(req, res) {
  const user = await userService.getUser(req.user, req.params.id);
  return res.json({ user });
}

async function update(req, res) {
  const user = await userService.updateUser(req.user, req.params.id, req.body);
  return res.json({ user });
}

async function resetPassword(req, res) {
  const result = await userService.resetUserPassword(req.user, req.params.id);
  return res.json(result);
}

async function resendInvitation(req, res) {
  const result = await userService.resendInvitation(req.user, req.params.id);
  return res.json(result);
}

module.exports = { create, list, getOne, update, resetPassword, resendInvitation };
