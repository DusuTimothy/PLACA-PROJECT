'use strict';

/**
 * Public results service.
 *
 * Security boundary: this is the only service reachable without a session.
 * It reads just three non-sensitive tables:
 *
 * - public_summary: pre-aggregated counts, written by the reporting workflow
 * - lgas: the 17 public Local Government Areas
 * - indicators: the public name and unit of each indicator
 *
 * It never touches users, organizations, reports, report values, documents or
 * the audit log. The route must stay like this even when more filters are
 * added later.
 *
 * Small-cell suppression belongs in the aggregation job that writes
 * public_summary, before a value can reach this service. Never derive public
 * numbers directly from report_values here.
 */

const { PublicSummary, Lga, Indicator } = require('../models');
const { periodOrder } = require('./aggregationService');

function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

async function getSummary({ period, indicator } = {}) {
  const [summaryRows, lgas, indicators] = await Promise.all([
    PublicSummary.findAll({
      attributes: ['scope', 'lga_id', 'indicator_code', 'period', 'value', 'generated_at'],
      include: [{ model: Lga, as: 'lga', attributes: ['name', 'code'], required: false }],
      order: [
        ['period', 'DESC'],
        ['indicator_code', 'ASC'],
        ['scope', 'ASC'],
      ],
    }),
    Lga.findAll({
      attributes: ['name', 'code'],
      order: [['name', 'ASC']],
    }),
    Indicator.findAll({
      attributes: ['code', 'name', 'unit', 'category'],
      order: [['name', 'ASC']],
    }),
  ]);

  const indicatorByCode = new Map(indicators.map((item) => [item.code, item]));
  const periods = [...new Set(summaryRows.map((row) => row.period))].sort(
    (left, right) => periodOrder(right) - periodOrder(left)
  );
  const usedIndicatorCodes = new Set(summaryRows.map((row) => row.indicator_code));

  const rows = summaryRows
    .filter((row) => (period ? row.period === period : true))
    .filter((row) => (indicator ? row.indicator_code === indicator : true))
    .map((row) => {
      const definition = indicatorByCode.get(row.indicator_code);
      return {
        scope: row.scope,
        lga_code: row.lga?.code || null,
        lga_name: row.lga?.name || null,
        indicator_code: row.indicator_code,
        indicator_name: definition?.name || row.indicator_code,
        unit: definition?.unit || 'people',
        period: row.period,
        value: row.value,
        generated_at: toIso(row.generated_at),
      };
    });

  return {
    generated_at: rows.reduce((latest, row) => {
      if (!row.generated_at) return latest;
      return !latest || row.generated_at > latest ? row.generated_at : latest;
    }, null),
    periods,
    // Only indicators that have at least one published figure. An empty
    // dashboard should not offer 14 filters that all return nothing.
    indicators: indicators
      .filter((item) => usedIndicatorCodes.has(item.code))
      .map((item) => ({
        code: item.code,
        name: item.name,
        unit: item.unit,
        category: item.category,
      })),
    lgas,
    rows,
  };
}

module.exports = { getSummary };
