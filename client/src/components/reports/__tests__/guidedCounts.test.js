import { describe, expect, test } from 'vitest';
import {
  breakdownLabel,
  buildEntryMap,
  buildValues,
  collectIssues,
  entryKey,
} from '../guidedCounts';

const strings = {
  'reports.total': 'Total',
  'reports.sex.female': 'Female',
  'reports.sex.male': 'Male',
  'reports.ageBand': 'Ages {{range}}',
  'reports.issueNeedTotal': 'Enter the total first, then the breakdown.',
  'reports.issueCellTooHigh': '{{label}} ({{value}}) is higher than the total ({{total}}).',
  'reports.issueSexSum': 'Female and male add up to {{sum}}, but the total is {{total}}.',
  'reports.issueAgeSum': 'The age groups add up to {{sum}}, but the total is {{total}}.',
  'reports.issueNotGreater': '{{name}} cannot be more than {{other}}.',
  'reports.issueNegative': '{{label}} cannot be below zero.',
  'reports.issueWholeNumber': '{{label}} must be a whole number.',
};

function t(key, vars = {}) {
  const template = strings[key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name) => String(vars[name] ?? ''));
}

const tested = {
  id: 'a',
  code: 'HTS_TST',
  name: 'People tested for HIV',
  disaggregations: { sex: ['female', 'male'], age: ['10-14', '15-19'] },
  validation_rules: {},
};

const positive = {
  id: 'b',
  code: 'HTS_TST_POS',
  name: 'People who tested positive',
  disaggregations: { sex: ['female', 'male'] },
  validation_rules: {
    consistency_rules: [{ type: 'not_greater_than', indicator_code: 'HTS_TST' }],
  },
};

function entriesFor(pairs) {
  return Object.fromEntries(
    pairs.map(([indicatorId, key, value]) => [entryKey(indicatorId, key), String(value)])
  );
}

describe('guided counts helpers', () => {
  test('splits guided cells from composite values that must be preserved', () => {
    const { entries, preserved } = buildEntryMap([
      { indicator_id: 'a', disaggregation_key: 'total', value: 10 },
      { indicator_id: 'a', disaggregation_key: 'sex=female', value: 4 },
      { indicator_id: 'a', disaggregation_key: 'age=10-14', value: 2 },
      { indicator_id: 'a', disaggregation_key: 'sex=female|age=10-14', value: 2 },
    ]);

    expect(entries).toEqual({
      'a|total': '10',
      'a|sex=female': '4',
      'a|age=10-14': '2',
    });
    expect(preserved).toHaveLength(1);
    expect(preserved[0].disaggregation_key).toBe('sex=female|age=10-14');
  });

  test('builds API values and round-trips through buildEntryMap', () => {
    const values = buildValues(
      entriesFor([
        ['a', 'total', 10],
        ['a', 'sex=female', 4],
        ['a', 'sex=male', 6],
      ]),
      [{ indicator_id: 'a', disaggregation_key: 'sex=female|age=10-14', value: 1 }]
    );

    expect(values).toHaveLength(4);
    expect(values.find((item) => item.disaggregation_key === 'sex=male').value).toBe(6);

    const { entries, preserved } = buildEntryMap(values);
    expect(entries['a|total']).toBe('10');
    expect(preserved).toHaveLength(1);
  });

  test('flags a complete sex breakdown that does not add up', () => {
    const entries = entriesFor([
      ['a', 'total', 10],
      ['a', 'sex=female', 4],
      ['a', 'sex=male', 5],
    ]);

    const { byIndicator, count } = collectIssues([tested], entries, t);
    expect(count).toBe(1);
    expect(byIndicator.get('a')[0]).toBe('Female and male add up to 9, but the total is 10.');
  });

  test('does not flag an incomplete age group', () => {
    const entries = entriesFor([
      ['a', 'total', 10],
      ['a', 'sex=female', 4],
      ['a', 'sex=male', 6],
      ['a', 'age=10-14', 2],
    ]);

    expect(collectIssues([tested], entries, t).count).toBe(0);
  });

  test('flags a cell higher than its total', () => {
    const entries = entriesFor([
      ['a', 'total', 5],
      ['a', 'sex=female', 7],
    ]);

    const { byIndicator } = collectIssues([tested], entries, t);
    expect(byIndicator.get('a')).toContain('Female (7) is higher than the total (5).');
  });

  test('requires a total when breakdown cells are entered', () => {
    const entries = entriesFor([['a', 'sex=female', 3]]);
    expect(collectIssues([tested], entries, t).byIndicator.get('a')).toEqual([
      'Enter the total first, then the breakdown.',
    ]);
  });

  test('mirrors the cross-indicator not-greater-than rule', () => {
    const entries = entriesFor([
      ['a', 'total', 10],
      ['b', 'total', 20],
    ]);

    const { byIndicator } = collectIssues([tested, positive], entries, t);
    expect(byIndicator.get('b')).toEqual([
      'People who tested positive cannot be more than People tested for HIV.',
    ]);
  });

  test('rejects negative and fractional counts', () => {
    const negative = collectIssues([tested], entriesFor([['a', 'total', -2]]), t);
    expect(negative.byIndicator.get('a')).toContain('Total cannot be below zero.');

    const fractional = collectIssues([tested], entriesFor([['a', 'total', 2.5]]), t);
    expect(fractional.byIndicator.get('a')).toContain('Total must be a whole number.');
  });

  test('labels a stored breakdown for the read-only table', () => {
    expect(breakdownLabel('total', t)).toBe('Total');
    expect(breakdownLabel('sex=male', t)).toBe('Male');
    expect(breakdownLabel('age=15-19', t)).toBe('Ages 15-19');
    expect(breakdownLabel('sex=male|age=15-19', t)).toBe('Male · Ages 15-19');
  });
});
