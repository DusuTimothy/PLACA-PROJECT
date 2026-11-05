'use strict';

/**
 * The 17 LGAs of Plateau State.
 * Codes are stable identifiers used by exports and the public summary.
 */

const { LGA_IDS } = require('./data/ids');

const LGAS = [
  ['Barkin Ladi', 'PL-BKL'],
  ['Bassa', 'PL-BSA'],
  ['Bokkos', 'PL-BKS'],
  ['Jos East', 'PL-JSE'],
  ['Jos North', 'PL-JSN'],
  ['Jos South', 'PL-JSS'],
  ['Kanam', 'PL-KNM'],
  ['Kanke', 'PL-KNK'],
  ['Langtang North', 'PL-LTN'],
  ['Langtang South', 'PL-LTS'],
  ['Mangu', 'PL-MNG'],
  ['Mikang', 'PL-MKG'],
  ['Pankshin', 'PL-PKS'],
  ["Qua'an Pan", 'PL-QPN'],
  ['Riyom', 'PL-RYM'],
  ['Shendam', 'PL-SHD'],
  ['Wase', 'PL-WSE'],
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'lgas',
      LGAS.map(([name, code]) => ({
        id: LGA_IDS[name],
        name,
        code,
        created_at: now,
        updated_at: now,
      }))
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('lgas', { code: LGAS.map(([, code]) => code) });
  },
};
