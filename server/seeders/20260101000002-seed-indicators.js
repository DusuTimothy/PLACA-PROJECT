'use strict';

/**
 * Starter indicator set.
 *
 * PLACA officers can edit these in the app later. The plain-language
 * definition is shown in the glossary and in every FieldHint, so it is written
 * for a partner staff member using a paper tally sheet, not for a data analyst.
 */

const { INDICATOR_IDS } = require('./data/ids');
const { jsonb } = require('./data/sql');

const SEX_AND_AGE = {
  sex: ['female', 'male'],
  age: ['10-14', '15-19', '20-24', '25-49', '50+'],
};

const SEX_ONLY = {
  sex: ['female', 'male'],
};

function rules(extra = {}) {
  return {
    min: 0,
    max: 1000000,
    disaggregations_must_sum_to_total: true,
    soft_max_multiplier: 3,
    ...extra,
  };
}

const INDICATORS = [
  {
    code: 'HTS_TST',
    name: 'People tested for HIV',
    category: 'testing',
    unit: 'people',
    disaggregations: SEX_AND_AGE,
    definition:
      'Count each person your organization tested for HIV during this period. Count a person only once, even if they tested more than once.',
    validation: rules(),
  },
  {
    code: 'HTS_TST_POS',
    name: 'People who tested positive for HIV',
    category: 'testing',
    unit: 'people',
    disaggregations: SEX_AND_AGE,
    definition:
      'Count each person whose HIV test result was positive during this period. This number can never be bigger than the number tested.',
    validation: rules({
      consistency_rules: [
        {
          type: 'not_greater_than',
          indicator_code: 'HTS_TST',
          message: 'People who tested positive cannot be more than people tested.',
        },
      ],
    }),
  },
  {
    code: 'HTS_REF',
    name: 'People referred for HIV treatment',
    category: 'referral',
    unit: 'people',
    disaggregations: SEX_AND_AGE,
    definition:
      'Count people you referred to a health facility for HIV treatment or care during this period. A referral means you gave them a paper or verbal link to a facility.',
    validation: rules({
      consistency_rules: [
        {
          type: 'not_greater_than',
          indicator_code: 'HTS_TST_POS',
          message: 'People referred cannot be more than people who tested positive.',
        },
      ],
    }),
  },
  {
    code: 'HTS_LINK',
    name: 'People linked to HIV treatment',
    category: 'referral',
    unit: 'people',
    disaggregations: SEX_AND_AGE,
    definition:
      'Count people you referred who reached a health facility and were confirmed to have started care during this period.',
    validation: rules({
      consistency_rules: [
        {
          type: 'not_greater_than',
          indicator_code: 'HTS_REF',
          message: 'People linked cannot be more than people referred.',
        },
      ],
    }),
  },
  {
    code: 'HTS_TX_NEW',
    name: 'People newly started on HIV treatment',
    category: 'referral',
    unit: 'people',
    disaggregations: SEX_AND_AGE,
    definition:
      'Count people who started HIV treatment for the first time during this period, as confirmed by the health facility.',
    validation: rules({
      consistency_rules: [
        {
          type: 'not_greater_than',
          indicator_code: 'HTS_LINK',
          message: 'Newly started on treatment cannot be more than people linked to treatment.',
        },
      ],
    }),
  },
  {
    code: 'HTS_PREP_NEW',
    name: 'People newly started on PrEP',
    category: 'testing',
    unit: 'people',
    disaggregations: SEX_AND_AGE,
    definition:
      'Count people who started PrEP (HIV prevention medicine) for the first time during this period.',
    validation: rules(),
  },
  {
    code: 'REACH',
    name: 'People reached with HIV prevention messages',
    category: 'reach',
    unit: 'people',
    disaggregations: SEX_AND_AGE,
    definition:
      'Count people who received at least one HIV prevention or awareness message from your organization during this period. Count each person once, even if you spoke to them more than once.',
    validation: rules(),
  },
  {
    code: 'CONDOM_DIST',
    name: 'Male condoms distributed',
    category: 'reach',
    unit: 'condoms',
    disaggregations: {},
    definition:
      'Count the number of male condoms you gave out during this period. This is a count of condoms, not a count of people.',
    validation: rules(),
  },
  {
    code: 'IEC_DIST',
    name: 'IEC materials distributed',
    category: 'reach',
    unit: 'materials',
    disaggregations: {},
    definition:
      'Count the number of information, education and communication (IEC) materials you gave out during this period, such as leaflets and posters.',
    validation: rules(),
  },
  {
    code: 'WELFARE_SKILLS',
    name: 'People who completed skills training',
    category: 'welfare',
    unit: 'people',
    disaggregations: SEX_ONLY,
    definition:
      'Count people who finished a PLACA-supported skills training programme during this period. Do not count people who only attended one session.',
    validation: rules(),
  },
  {
    code: 'WELFARE_ORPHAN',
    name: 'Orphans and vulnerable children supported',
    category: 'welfare',
    unit: 'children',
    disaggregations: SEX_AND_AGE,
    definition:
      'Count orphans and vulnerable children who received support from your organization during this period, such as school materials, food or health support.',
    validation: rules(),
  },
  {
    code: 'WELFARE_STIGMA',
    name: 'People reached with stigma reduction support',
    category: 'welfare',
    unit: 'people',
    disaggregations: SEX_ONLY,
    definition:
      'Count people who took part in an activity that reduces HIV stigma and discrimination during this period.',
    validation: rules(),
  },
  {
    code: 'TRAINING_PARTICIPANTS',
    name: 'People trained',
    category: 'training',
    unit: 'people',
    disaggregations: SEX_ONLY,
    definition:
      'Count people who completed a training session organized or supported by your organization during this period. Include community volunteers and health workers.',
    validation: rules(),
  },
  {
    code: 'SBCC_SESSIONS',
    name: 'Community sensitisation sessions held',
    category: 'reach',
    unit: 'sessions',
    disaggregations: {},
    definition:
      'Count the number of community sensitisation or social and behaviour change sessions your organization held during this period.',
    validation: rules(),
  },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'indicators',
      INDICATORS.map((indicator) => ({
        id: INDICATOR_IDS[indicator.code],
        code: indicator.code,
        name: indicator.name,
        plain_language_definition: indicator.definition,
        category: indicator.category,
        unit: indicator.unit,
        disaggregations: jsonb(indicator.disaggregations),
        validation_rules: jsonb(indicator.validation),
        is_active: true,
        version: 1,
        created_at: now,
        updated_at: now,
      }))
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('indicators', {
      code: INDICATORS.map((indicator) => indicator.code),
    });
  },
};
