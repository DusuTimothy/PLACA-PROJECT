'use strict';

/**
 * Internal dashboard overview (Phase 4).
 *
 * Numbers come from two places, deliberately:
 * - published figures from public_summary (already small-cell suppressed)
 * - workflow counts from reports, scoped to the signed-in role
 *
 * Scope is applied on the server:
 * - PLACA officer/director: the whole state
 * - LACA officer: their own LGA only
 * - Partner staff: their own organization and its LGA
 *
 * Admin is not a programme role and is rejected by the route.
 */

const { Op } = require('sequelize');
const { Report, PublicSummary, Lga, Indicator, Organization } = require('../models');
const { ROLES } = require('../middleware/rbac');
const { periodLabel, periodOrder } = require('./aggregationService');

const PIPELINE_STATUSES = ['draft', 'submitted', 'validated', 'returned', 'aggregated'];

function scopeFor(actor) {
  if (actor.role === ROLES.PARTNER_STAFF) {
    return { kind: 'organization', where: { organization_id: actor.organization_id } };
  }
  if (actor.role === ROLES.LACA_OFFICER) {
    return { kind: 'lga', where: { lga_id: actor.lga_id } };
  }
  return { kind: 'state', where: {} };
}

function reportPeriod(row) {
  return periodLabel(row.period_type, row.period_year, row.period_number);
}

async function pipelineCounts(scope, period) {
  const where = { ...scope.where };
  if (period) {
    const [periodType, year, number] = parsePeriod(period);
    if (periodType) Object.assign(where, { period_type: periodType, period_year: year, period_number: number });
  }

  const rows = await Report.findAll({
    attributes: ['status', 'period_type', 'period_year', 'period_number', 'flags'],
    where,
    raw: true,
  });

  const counts = Object.fromEntries(PIPELINE_STATUSES.map((status) => [status, 0]));
  for (const row of rows) {
    if (counts[row.status] !== undefined) counts[row.status] += 1;
  }
  return {
    counts,
    total: rows.length,
    has_synthetic_data: rows.some((row) => row.flags?.synthetic_demo === true),
  };
}

function parsePeriod(label) {
  if (!label) return [null, null, null];
  if (/^\d{4}$/.test(label)) return ['annual', Number(label), 1];
  const quarter = /^(\d{4})-Q([1-4])$/.exec(label);
  if (quarter) return ['quarterly', Number(quarter[1]), Number(quarter[2])];
  const month = /^(\d{4})-(\d{2})$/.exec(label);
  if (month) return ['monthly', Number(month[1]), Number(month[2])];
  return [null, null, null];
}

async function availablePeriods(scope) {
  const reports = await Report.findAll({
    attributes: ['period_type', 'period_year', 'period_number'],
    where: scope.where,
    group: ['period_type', 'period_year', 'period_number'],
    raw: true,
  });
  const published = await PublicSummary.findAll({
    attributes: ['period'],
    group: ['period'],
    raw: true,
  });

  const periods = new Set(published.map((row) => row.period));
  for (const row of reports) periods.add(reportPeriod(row));
  return [...periods].sort((left, right) => periodOrder(right) - periodOrder(left));
}

/**
 * LGAs with at least one validated report in the period.
 * This is intentionally not derived from public_summary: a suppressed small
 * cell still means the LGA reported.
 */
async function coverageFor(period) {
  const [periodType, periodYear, periodNumber] = parsePeriod(period);
  const [lgas, rows] = await Promise.all([
    Lga.findAll({ attributes: ['id', 'name', 'code'], order: [['name', 'ASC']], raw: true }),
    Report.findAll({
      attributes: ['lga_id'],
      where: {
        status: { [Op.in]: ['validated', 'aggregated'] },
        period_type: periodType,
        period_year: periodYear,
        period_number: periodNumber,
      },
      group: ['lga_id'],
      raw: true,
    }),
  ]);

  const covered = new Set(rows.map((row) => row.lga_id).filter(Boolean));
  return {
    period,
    total: lgas.length,
    covered: covered.size,
    missing: lgas.filter((lga) => !covered.has(lga.id)).map((lga) => ({ id: lga.id, name: lga.name })),
  };
}

/**
 * The authenticated middleware loads only the user's own columns, so a partner
 * account does not carry its organization's LGA. Resolve it once here.
 */
async function organizationLgaId(actor) {
  if (actor.role !== ROLES.PARTNER_STAFF || !actor.organization_id) return null;
  const organization = await Organization.findByPk(actor.organization_id, {
    attributes: ['lga_id'],
    raw: true,
  });
  return organization?.lga_id || null;
}

async function overview(actor, { period } = {}) {
  const scope = scopeFor(actor);
  const periods = await availablePeriods(scope);
  const selected = period || periods[0] || null;

  const pipeline = await pipelineCounts(scope, selected);
  const coverage = scope.kind === 'state' && selected ? await coverageFor(selected) : null;

  if (!selected) {
    return {
      scope: scope.kind,
      period: null,
      periods,
      indicators: [],
      state_rows: [],
      local_rows: [],
      trend: [],
      pipeline,
      coverage,
      generated_at: null,
    };
  }

  const summaryRows = await PublicSummary.findAll({
    attributes: ['scope', 'lga_id', 'indicator_code', 'period', 'value', 'generated_at'],
    where: { period: { [Op.in]: periods.slice(0, 8) } },
    include: [{ model: Lga, as: 'lga', attributes: ['name', 'code'], required: false }],
    order: [
      ['period', 'DESC'],
      ['indicator_code', 'ASC'],
    ],
  });

  const actorLgaId =
    actor.role === ROLES.LACA_OFFICER ? actor.lga_id : await organizationLgaId(actor);

  function inScope(row) {
    if (row.scope === 'state') return true;
    if (scope.kind === 'state') return true;
    return row.lga_id && actorLgaId === row.lga_id;
  }

  const visible = summaryRows.filter(inScope);
  const usedCodes = new Set(visible.filter((row) => row.period === selected).map((row) => row.indicator_code));

  const definitions = await Indicator.findAll({
    attributes: ['code', 'name', 'unit', 'category'],
    where: { code: { [Op.in]: [...usedCodes] } },
    order: [['name', 'ASC']],
  });

  const toRow = (row) => ({
    scope: row.scope,
    lga_id: row.lga_id,
    lga_code: row.lga?.code || null,
    lga_name: row.lga?.name || null,
    indicator_code: row.indicator_code,
    value: row.value,
  });

  return {
    scope: scope.kind,
    period: selected,
    periods,
    indicators: definitions.map((item) => ({
      code: item.code,
      name: item.name,
      unit: item.unit,
      category: item.category,
    })),
    state_rows: visible.filter((row) => row.period === selected && row.scope === 'state').map(toRow),
    local_rows: visible.filter((row) => row.period === selected && row.scope === 'lga').map(toRow),
    trend: visible
      .filter((row) => row.scope === 'state')
      .map((row) => ({
        period: row.period,
        indicator_code: row.indicator_code,
        value: row.value,
      })),
    pipeline,
    coverage,
    generated_at: visible.reduce((latest, row) => {
      if (!row.generated_at) return latest;
      const iso = new Date(row.generated_at).toISOString();
      return !latest || iso > latest ? iso : latest;
    }, null),
  };
}

module.exports = { overview, coverageFor, parsePeriod };
