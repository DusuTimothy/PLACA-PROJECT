'use strict';

/**
 * English and Hausa starter guides and field hints.
 * Each logical guide produces one row per language.
 */

const { GUIDES } = require('./data/guides');
const { textArray } = require('./data/sql');

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = [];

    for (const guide of GUIDES) {
      for (const language of ['en', 'ha']) {
        const translation = guide[language];
        rows.push({
          key: guide.key,
          language,
          title: translation.title,
          body_md: translation.body,
          audience_roles: textArray(guide.roles),
          page_key: guide.page_key || null,
          field_key: guide.field_key || null,
          sort_order: guide.sort_order || 0,
          is_published: true,
          // Starter content is system-owned, so production can seed it without
          // depending on a demo user account existing.
          updated_by: null,
          created_at: now,
          updated_at: now,
        });
      }
    }

    await queryInterface.bulkInsert('guides', rows);
  },

  async down(queryInterface) {
    const { Op } = require('sequelize');
    await queryInterface.bulkDelete('guides', {
      key: { [Op.in]: GUIDES.map((guide) => guide.key) },
    });
  },
};
