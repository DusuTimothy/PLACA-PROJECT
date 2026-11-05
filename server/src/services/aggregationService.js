'use strict';

/**
 * Aggregation into public_summary (Phase 4).
 *
 * The public page never reads reports. This job is the only writer of
 * public_summary, and it reads validated totals only:
 * - one state row per indicator (lga_id NULL)
 * - one row per LGA, omitted when the count is below the small-cell threshold
 *
 * Re-running a period is safe: existing rows for that period are replaced and
 * reports already marked `aggregated` stay part of the sum.
 */

const { Op } = require('sequelize');
const { sequelize, Report, PublicSummary, Lga } = require('../models');
const env = require('../config/env');
const logger = require('../config/logger');
const { recordAudit } = require('./auditService');

const PERIOD_TYPES = ['monthly', 'quarterly', 'annual'];

function periodLabel(periodType, year, periodNumber) {
  if (periodType === 'quarterly') return `${year}-Q${periodNumber}`;
  if (periodType === 'monthly') return `${year}-${String(periodNumber).padStart(2, '0')}`;
  return `${year}`;
}

/**
 * Sort key for a public period label. Higher means newer, and an annual summary
 * sits above the months and quarters of the same year.
 */
function periodOrder(period) {
  if (!period) return 0;
  const year = Number(String(period).slice(0, 4));
  const quarter = /^\d{4}-Q([1-4])$/.exec(period);
  if (quarter) return year * 100 + Number(quarter[1]) * 3;
  const month = /^\d{4}-(\d{2})$/.exec(period);
  if (month) return year * 100 + Number(month[1]);
  return year * 100 + 13;
}

function assertPeriod({ periodType, periodYear, periodNumber }) {
  if (!PERIOD_TYPES.includes(periodType)) {
    throw new Error(`Unknown period type: ${periodType}`);
  }
  if (!Number.isInteger(periodYear) || periodYear < 2000 || periodYear > 2100) {
    throw new Error('periodYear must be between 2000 and 2100');
  }
  if (!Number.isInteger(periodNumber) || periodNumber < 1 || periodNumber > 12) {
    throw new Error('periodNumber must be between 1 and 12');
  }
  if (periodType === 'quarterly' && periodNumber > 4) {
    throw new Error('A quarterly period uses 1 to 4');
  }
  if (periodType === 'annual' && periodNumber !== 1) {
    throw new Error('An annual period always uses 1');
  }
}

async function collect(periodType, periodYear, periodNumber) {
  const rows = await sequelize.query(
    `SELECT r.lga_id,
            i.code AS indicator_code,
            SUM(rv.value)::bigint AS value
       FROM reports r
       JOIN report_values rv ON rv.report_id = r.id
       JOIN indicators i ON i.id = rv.indicator_id
      WHERE r.status IN ('validated', 'aggregated')
        AND r.period_type = :periodType
        AND r.period_year = :periodYear
        AND r.period_number = :periodNumber
        AND rv.disaggregation_key = 'total'
      GROUP BY r.lga_id, i.code`,
    {
      replacements: { periodType, periodYear, periodNumber },
      type: sequelize.QueryTypes.SELECT,
    }
  );

  return rows.map((row) => ({
    lga_id: row.lga_id,
    indicator_code: row.indicator_code,
    value: Number(row.value),
  }));
}

/**
 * Rebuild public_summary for one period.
 * Returns { period, state, lga, suppressed, threshold, reports }.
 */
async function aggregatePeriod({
  periodType,
  periodYear,
  periodNumber,
  threshold = env.PUBLIC_SMALL_CELL_THRESHOLD,
}) {
  assertPeriod({ periodType, periodYear, periodNumber });
  const period = periodLabel(periodType, periodYear, periodNumber);
  const cells = await collect(periodType, periodYear, periodNumber);

  const stateTotals = new Map();
  for (const cell of cells) {
    stateTotals.set(cell.indicator_code, (stateTotals.get(cell.indicator_code) || 0) + cell.value);
  }

  const published = [];
  let suppressed = 0;

  for (const [indicatorCode, value] of stateTotals) {
    published.push({ scope: 'state', lga_id: null, indicator_code: indicatorCode, period, value });
  }

  for (const cell of cells) {
    // A report always carries the organization's LGA. If one is missing we
    // still count it in the state total, but never write a row with a null
    // LGA into the per-LGA index.
    if (!cell.lga_id) continue;
    if (cell.value < threshold) {
      suppressed += 1;
      continue;
    }
    published.push({
      scope: 'lga',
      lga_id: cell.lga_id,
      indicator_code: cell.indicator_code,
      period,
      value: cell.value,
    });
  }

  const reports = await sequelize.transaction(async (transaction) => {
    await PublicSummary.destroy({ where: { period }, transaction });

    if (published.length > 0) {
      await PublicSummary.bulkCreate(
        published.map((row) => ({ ...row, generated_at: new Date() })),
        { transaction, validate: true }
      );
    }

    const [updated] = await Report.update(
      { status: 'aggregated' },
      {
        where: {
          period_type: periodType,
          period_year: periodYear,
          period_number: periodNumber,
          status: 'validated',
        },
        transaction,
      }
    );

    await recordAudit({
      action: 'aggregate',
      entity: 'PublicSummary',
      entityId: null,
      newValue: {
        period,
        indicators: stateTotals.size,
        lga_rows: published.length - stateTotals.size,
        suppressed,
        threshold,
        reports_marked: updated,
      },
      options: { transaction },
    });

    return updated;
  });

  logger.info(
    `Aggregated ${period}: ${stateTotals.size} state rows, ${published.length - stateTotals.size} LGA rows, ` +
      `${suppressed} suppressed below ${threshold}, ${reports} reports marked aggregated`
  );

  return {
    period,
    state: stateTotals.size,
    lga: published.length - stateTotals.size,
    suppressed,
    threshold,
    reports,
  };
}

/** Periods that still have validated reports waiting to be published. */
async function pendingPeriods() {
  const rows = await Report.findAll({
    attributes: ['period_type', 'period_year', 'period_number'],
    where: { status: 'validated' },
    group: ['period_type', 'period_year', 'period_number'],
    order: [
      ['period_year', 'ASC'],
      ['period_number', 'ASC'],
    ],
    raw: true,
  });

  return rows.map((row) => ({
    periodType: row.period_type,
    periodYear: row.period_year,
    periodNumber: row.period_number,
  }));
}

/** Aggregate every period with validated reports. Used by the cron entry point. */
async function aggregatePending(threshold = env.PUBLIC_SMALL_CELL_THRESHOLD) {
  const periods = await pendingPeriods();
  const results = [];
  for (const period of periods) {
    results.push(await aggregatePeriod({ ...period, threshold }));
  }
  return results;
}

/** Coverage snapshot for the dashboards: which LGAs have published rows in a period. */
async function coverage(period) {
  const [lgas, rows] = await Promise.all([
    Lga.findAll({ attributes: ['id', 'name', 'code'], order: [['name', 'ASC']], raw: true }),
    PublicSummary.findAll({
      attributes: ['lga_id'],
      where: { period, scope: 'lga', lga_id: { [Op.ne]: null } },
      group: ['lga_id'],
      raw: true,
    }),
  ]);

  const covered = new Set(rows.map((row) => row.lga_id));
  return {
    period,
    total: lgas.length,
    covered: covered.size,
    missing: lgas.filter((lga) => !covered.has(lga.id)).map((lga) => ({ id: lga.id, name: lga.name })),
  };
}

/**
 * What the public page currently shows and what is still waiting.
 * Used by the officer dashboard so nobody has to guess whether publishing ran.
 */
async function status(period) {
  const [publishedRows, pending] = await Promise.all([
    sequelize.query(
      `SELECT period,
              COUNT(*)::int AS rows,
              COUNT(*) FILTER (WHERE scope = 'lga')::int AS lga_rows,
              MAX(generated_at) AS generated_at
         FROM public_summary
        GROUP BY period
        ORDER BY period DESC`,
      { type: sequelize.QueryTypes.SELECT }
    ),
    pendingPeriods(),
  ]);

  const result = {
    threshold: env.PUBLIC_SMALL_CELL_THRESHOLD,
    published: publishedRows.map((row) => ({
      period: row.period,
      rows: row.rows,
      lga_rows: row.lga_rows,
      generated_at: row.generated_at ? new Date(row.generated_at).toISOString() : null,
    })),
    pending: pending.map((item) => ({
      ...item,
      period: periodLabel(item.periodType, item.periodYear, item.periodNumber),
    })),
  };

  if (period) result.coverage = await coverage(period);

  return result;
}

module.exports = {
  aggregatePeriod,
  aggregatePending,
  pendingPeriods,
  coverage,
  status,
  periodLabel,
  periodOrder,
};
