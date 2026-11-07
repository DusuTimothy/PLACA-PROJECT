'use strict';

/**
 * Sequelize bootstrap.
 *
 * Models use the Model.init() pattern required by the project. We never call
 * sequelize.sync(): schema changes must go through migrations so production
 * data is never altered by a server restart.
 */

const fs = require('fs');
const path = require('path');
const { Sequelize, DataTypes } = require('sequelize');
const env = require('../config/env');
const logger = require('../config/logger');
const { buildDialectOptions } = require('../config/databaseSsl');
const applyAuditHooks = require('./auditHooks');

const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'postgres',
  timezone: '+00:00',
  // TLS for managed PostgreSQL (Aiven). Empty for local development.
  dialectOptions: buildDialectOptions(env),
  logging: env.DB_LOGGING === 'true' ? (message) => logger.debug(message) : false,
  define: {
    underscored: true,
    freezeTableName: true,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

const db = {};

// Load every model file except this index. File name and model name differ
// (user.js -> User), so we key the registry by model.name.
fs.readdirSync(__dirname)
  .filter((file) => file !== 'index.js' && file !== 'auditHooks.js' && file.endsWith('.js'))
  .sort()
  .forEach((file) => {
    const defineModel = require(path.join(__dirname, file));
    const model = defineModel(sequelize, DataTypes);
    db[model.name] = model;
  });

// Associations are a second pass because every model must exist first.
Object.values(db).forEach((model) => {
  if (typeof model.associate === 'function') {
    model.associate(db);
  }
});

applyAuditHooks(db);

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
