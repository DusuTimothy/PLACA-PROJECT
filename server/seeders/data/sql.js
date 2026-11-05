'use strict';

/**
 * Helpers for raw seed inserts.
 *
 * queryInterface.bulkInsert does not serialise JSONB objects or text[] arrays,
 * so those columns are passed as explicit SQL literals. Values here are static
 * seed data, and quotes are escaped anyway.
 */

const { Sequelize } = require('sequelize');

function jsonb(value) {
  const text = JSON.stringify(value).replace(/'/g, "''");
  return Sequelize.literal(`'${text}'::jsonb`);
}

function textArray(values) {
  const items = (values || [])
    .map((value) => `'${String(value).replace(/'/g, "''")}'`)
    .join(', ');
  return Sequelize.literal(`ARRAY[${items}]::text[]`);
}

module.exports = { jsonb, textArray };
