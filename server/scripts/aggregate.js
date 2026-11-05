#!/usr/bin/env node
'use strict';

/**
 * Publish validated reports to public_summary (Phase 4).
 *
 * Usage:
 *   npm run aggregate                         # every period with validated reports
 *   npm run aggregate -- --year 2026 --type quarterly --number 1
 *   npm run aggregate -- --period 2026-Q1      # same, parsed from the label
 *   npm run aggregate -- --threshold 10        # stricter suppression for one run
 *   npm run aggregate -- --dry-run             # show what would be written
 *
 * This is the manual path used after validating reports and by the nightly
 * cron. It never modifies report counts; it only marks reports `aggregated`.
 */

const { parseArgs } = require('node:util');
const env = require('../src/config/env');
const logger = require('../src/config/logger');
const { sequelize } = require('../src/models');
const {
  aggregatePeriod,
  aggregatePending,
  pendingPeriods,
  periodLabel,
} = require('../src/services/aggregationService');

const USAGE = `
Publish validated reports to the public results page.

Options:
  --period <label>     Annual 2026, monthly 2026-02 or quarterly 2026-Q1
  --type <type>        monthly | quarterly | annual
  --year <year>        Four-digit year
  --number <n>         Month 1-12, quarter 1-4, or 1 for annual
  --threshold <n>      Small-cell threshold for this run (default from .env)
  --dry-run            List pending periods without writing anything
  -h, --help           Show this message.

With no period options, every period that still has validated reports is
published.
`.trim();

function fail(message) {
  console.error(`\nError: ${message}\n`);
  process.exitCode = 1;
}

function parsePeriodLabel(label) {
  const annual = /^(\d{4})$/.exec(label);
  if (annual) return { periodType: 'annual', periodYear: Number(annual[1]), periodNumber: 1 };

  const quarterly = /^(\d{4})-Q([1-4])$/.exec(label);
  if (quarterly) {
    return { periodType: 'quarterly', periodYear: Number(quarterly[1]), periodNumber: Number(quarterly[2]) };
  }

  const monthly = /^(\d{4})-(\d{2})$/.exec(label);
  if (monthly) {
    return { periodType: 'monthly', periodYear: Number(monthly[1]), periodNumber: Number(monthly[2]) };
  }

  return null;
}

async function main() {
  const { values } = parseArgs({
    options: {
      period: { type: 'string' },
      type: { type: 'string' },
      year: { type: 'string' },
      number: { type: 'string' },
      threshold: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(USAGE);
    return;
  }

  const threshold = values.threshold ? Number(values.threshold) : env.PUBLIC_SMALL_CELL_THRESHOLD;
  if (!Number.isInteger(threshold) || threshold < 1) {
    fail('--threshold must be a whole number of at least 1');
    return;
  }

  if (values['dry-run']) {
    const periods = await pendingPeriods();
    if (periods.length === 0) {
      console.log('Nothing to publish: no validated reports are waiting.');
      return;
    }
    console.log('Would publish:');
    for (const item of periods) {
      console.log(`  ${periodLabel(item.periodType, item.periodYear, item.periodNumber)}`);
    }
    return;
  }

  let target = null;
  if (values.period) {
    target = parsePeriodLabel(values.period);
    if (!target) {
      fail(`--period must look like 2026, 2026-Q1 or 2026-02 (got "${values.period}")`);
      return;
    }
  } else if (values.type || values.year || values.number) {
    if (!values.type || !values.year || !values.number) {
      fail('Give --period, or all of --type, --year and --number');
      return;
    }
    target = {
      periodType: values.type,
      periodYear: Number(values.year),
      periodNumber: Number(values.number),
    };
  }

  if (target) {
    const result = await aggregatePeriod({ ...target, threshold });
    console.log(
      `Published ${result.period}: ${result.state} state rows, ${result.lga} LGA rows, ` +
        `${result.suppressed} suppressed below ${result.threshold}, ` +
        `${result.reports} report(s) marked aggregated.`
    );
    return;
  }

  const results = await aggregatePending(threshold);
  if (results.length === 0) {
    console.log('Nothing to publish: no validated reports are waiting.');
    return;
  }
  for (const result of results) {
    console.log(
      `Published ${result.period}: ${result.state} state rows, ${result.lga} LGA rows, ` +
        `${result.suppressed} suppressed below ${result.threshold}, ` +
        `${result.reports} report(s) marked aggregated.`
    );
  }
}

main()
  .catch((error) => {
    logger.error(`Aggregation failed: ${error.message}`);
    fail(error.message);
  })
  .finally(async () => {
    await sequelize.close();
  });
