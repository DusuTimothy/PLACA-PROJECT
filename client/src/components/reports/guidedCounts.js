/**
 * Guided (paper-style) report entry helpers.
 *
 * The server stays authoritative: these checks only mirror the arithmetic the
 * API already enforces on submit, so a partner sees the problem at the field
 * instead of after pressing Submit. Keep them in step with
 * server/src/services/reportService.js (checkConsistency).
 */

export const TOTAL_KEY = 'total';

export function entryKey(indicatorId, key) {
  return `${indicatorId}|${key}`;
}

export function readNumber(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function sexKey(value) {
  return `sex=${value}`;
}

export function ageKey(value) {
  return `age=${value}`;
}

/** Split a stored value list into guided cells and anything we do not render. */
export function buildEntryMap(values = []) {
  const entries = {};
  const preserved = [];

  for (const value of values) {
    if (value.disaggregation_key === TOTAL_KEY) {
      entries[entryKey(value.indicator_id, TOTAL_KEY)] = String(value.value);
      continue;
    }
    if (/^sex=[^|]+$/.test(value.disaggregation_key) || /^age=[^|]+$/.test(value.disaggregation_key)) {
      entries[entryKey(value.indicator_id, value.disaggregation_key)] = String(value.value);
      continue;
    }
    // Composite (sex-by-age) or unknown keys are left untouched so editing a
    // report can never silently drop numbers entered elsewhere.
    preserved.push(value);
  }

  return { entries, preserved };
}

/** Turn guided cells back into the API's value array. */
export function buildValues(entries, preserved = []) {
  const values = [];
  for (const [compound, raw] of Object.entries(entries)) {
    if (raw === '' || raw === undefined || raw === null) continue;
    const separator = compound.indexOf('|');
    const indicatorId = compound.slice(0, separator);
    const key = compound.slice(separator + 1);
    values.push({
      indicator_id: indicatorId,
      disaggregation_key: key,
      value: Number(raw),
    });
  }
  for (const value of preserved) {
    values.push({
      indicator_id: value.indicator_id,
      disaggregation_key: value.disaggregation_key,
      value: value.value,
    });
  }
  return values;
}

export function indicatorGroups(indicator) {
  const sex = Array.isArray(indicator?.disaggregations?.sex) ? indicator.disaggregations.sex : [];
  const age = Array.isArray(indicator?.disaggregations?.age) ? indicator.disaggregations.age : [];
  return { sex, age };
}

/** How many cells of one group are filled in. */
export function groupProgress(groups, entries, indicatorId, keyFor) {
  const total = groups.length;
  let done = 0;
  for (const group of groups) {
    const raw = entries[entryKey(indicatorId, keyFor(group))];
    if (raw !== '' && raw !== undefined && raw !== null) done += 1;
  }
  return { done, total };
}

/**
 * Issues per indicator, in the same order the API checks them.
 * Returns { byIndicator: Map<id, string[]>, count }.
 */
export function collectIssues(indicators, entries, t) {
  const byIndicator = new Map();
  const totals = new Map();

  for (const indicator of indicators) {
    const total = readNumber(entries[entryKey(indicator.id, TOTAL_KEY)]);
    totals.set(indicator.code, total);
    totals.set(indicator.id, total);
  }

  for (const indicator of indicators) {
    const issues = [];
    const { sex, age } = indicatorGroups(indicator);
    const total = readNumber(entries[entryKey(indicator.id, TOTAL_KEY)]);

    const sexCells = sex.map((group) => ({
      group,
      value: readNumber(entries[entryKey(indicator.id, sexKey(group))]),
    }));
    const ageCells = age.map((group) => ({
      group,
      value: readNumber(entries[entryKey(indicator.id, ageKey(group))]),
    }));

    const anyBreakdown = [...sexCells, ...ageCells].some((cell) => cell.value !== null);

    // Negative and fractional counts are rejected by the API's Zod schema.
    const fields = [
      { label: t('reports.total'), value: total },
      ...sexCells.map((cell) => ({
        label: t(`reports.sex.${cell.group}`, { defaultValue: cell.group }),
        value: cell.value,
      })),
      ...ageCells.map((cell) => ({
        label: t('reports.ageBand', { range: cell.group }),
        value: cell.value,
      })),
    ];
    for (const field of fields) {
      if (field.value === null) continue;
      if (field.value < 0) issues.push(t('reports.issueNegative', { label: field.label }));
      else if (!Number.isInteger(field.value)) {
        issues.push(t('reports.issueWholeNumber', { label: field.label }));
      }
    }

    if (total === null) {
      if (anyBreakdown) issues.push(t('reports.issueNeedTotal'));
      if (issues.length > 0) byIndicator.set(indicator.id, issues);
      continue;
    }

    // A single cell can never be higher than its own total.
    for (const cell of sexCells) {
      if (cell.value !== null && cell.value > total) {
        const label = t(`reports.sex.${cell.group}`, { defaultValue: cell.group });
        issues.push(t('reports.issueCellTooHigh', { label, value: cell.value, total }));
      }
    }
    for (const cell of ageCells) {
      if (cell.value !== null && cell.value > total) {
        const label = t('reports.ageBand', { range: cell.group });
        issues.push(t('reports.issueCellTooHigh', { label, value: cell.value, total }));
      }
    }

    // Only complete groups are summed, matching the server.
    if (sex.length > 0 && sexCells.every((cell) => cell.value !== null)) {
      const sum = sexCells.reduce((acc, cell) => acc + cell.value, 0);
      if (sum !== total) issues.push(t('reports.issueSexSum', { sum, total }));
    }

    if (age.length > 0 && ageCells.every((cell) => cell.value !== null)) {
      const sum = ageCells.reduce((acc, cell) => acc + cell.value, 0);
      if (sum !== total) issues.push(t('reports.issueAgeSum', { sum, total }));
    }

    const rules = indicator.validation_rules?.consistency_rules;
    if (Array.isArray(rules)) {
      for (const rule of rules) {
        if (rule?.type !== 'not_greater_than' || !rule.indicator_code) continue;
        const other = totals.get(rule.indicator_code);
        if (other === null || other === undefined) continue;
        if (total > other) {
          const otherName =
            indicators.find((item) => item.code === rule.indicator_code)?.name || rule.indicator_code;
          issues.push(t('reports.issueNotGreater', { name: indicator.name, other: otherName }));
        }
      }
    }

    if (issues.length > 0) byIndicator.set(indicator.id, issues);
  }

  return { byIndicator, count: [...byIndicator.values()].reduce((sum, list) => sum + list.length, 0) };
}

/** Readable label for a stored disaggregation key, e.g. "sex=female". */
export function breakdownLabel(key, t) {
  if (key === TOTAL_KEY) return t('reports.total');
  if (key.includes('|')) {
    return key
      .split('|')
      .map((part) => breakdownLabel(part, t))
      .join(' · ');
  }
  const [dimension, value] = key.split('=');
  if (dimension === 'sex') return t(`reports.sex.${value}`, { defaultValue: value });
  if (dimension === 'age') return t('reports.ageBand', { range: value });
  return key;
}
