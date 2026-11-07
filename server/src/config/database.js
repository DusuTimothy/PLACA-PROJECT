'use strict';

/**
 * Sequelize CLI database configuration.
 *
 * sequelize-cli loads this file directly, so it must stay CommonJS and must
 * not import the application env helper (which validates more settings than
 * migrations need).
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { buildDialectOptions } = require('./databaseSsl');

const base = {
  username: process.env.DB_USER || 'placa',
  password: process.env.DB_PASSWORD || 'placa_password',
  database: process.env.DB_NAME || 'placa',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  dialect: 'postgres',
  timezone: '+00:00',
  // TLS settings for hosted databases (Aiven and similar). Empty for local
  // PostgreSQL, where DB_SSL is unset/false.
  dialectOptions: buildDialectOptions(process.env),
  define: {
    underscored: true,
    freezeTableName: true,
  },
  // Track executed seeders so `db:seed:all` is safe to run twice.
  seederStorage: 'sequelize',
  seederStorageTableName: 'SequelizeData',
  // Migrations must be deterministic; logging is opt-in via DB_LOGGING.
  logging: process.env.DB_LOGGING === 'true' ? console.log : false,
};

module.exports = {
  development: { ...base },
  test: { ...base, database: `${base.database}_test` },
  production: { ...base, logging: false },
};
