'use strict';

/**
 * /api/programmes routes.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/programme');
const controller = require('../controllers/programmeController');
const asyncHandler = require('../utils/asyncHandler');
const { authenticate, requirePasswordChanged } = require('../middleware/auth');
const { requireRole } = require('../middleware/rbac');

const router = express.Router();
const PROGRAMME_ROLES = ['partner_staff', 'laca_officer', 'placa_officer', 'placa_director'];

router.use(authenticate, requirePasswordChanged);
router.use(requireRole(...PROGRAMME_ROLES));

router.get('/', validate(schema.listProgrammes), asyncHandler(controller.list));
router.post('/', validate(schema.createProgramme), asyncHandler(controller.create));
router.get('/:id', validate(schema.programmeParams), asyncHandler(controller.getOne));
router.patch('/:id', validate(schema.updateProgramme), asyncHandler(controller.update));
router.delete('/:id', validate(schema.programmeParams), asyncHandler(controller.remove));

module.exports = router;
