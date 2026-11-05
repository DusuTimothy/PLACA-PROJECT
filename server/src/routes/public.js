'use strict';

/**
 * No-login public routes.
 *
 * Mounted before the authenticated routers. The global rate limiter still
 * applies, and the controller reads only pre-aggregated public tables.
 */

const express = require('express');
const validate = require('../middleware/validate');
const schema = require('../schemas/public');
const controller = require('../controllers/publicController');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.get('/summary', validate(schema.summary), asyncHandler(controller.summary));

module.exports = router;
