'use strict';

/**
 * Nightly publication of validated reports (Phase 4).
 *
 * Off unless ENABLE_AGGREGATION_CRON=true. The job is idempotent: running it
 * twice replaces the same period's rows and leaves already-aggregated reports
 * counted once.
 *
 * A failed run is logged and never crashes the API. The next run retries the
 * same pending periods because reports stay `validated` until they are marked
 * `aggregated` inside the successful transaction.
 */

const cron = require('node-cron');
const env = require('../config/env');
const logger = require('../config/logger');
const { aggregatePending } = require('./aggregationService');

let task = null;

function start() {
  if (env.ENABLE_AGGREGATION_CRON !== 'true') {
    logger.info('Aggregation scheduler is off (ENABLE_AGGREGATION_CRON=false)');
    return null;
  }
  if (!cron.validate(env.AGGREGATION_CRON)) {
    logger.error(`Aggregation scheduler not started: invalid AGGREGATION_CRON="${env.AGGREGATION_CRON}"`);
    return null;
  }

  task = cron.schedule(env.AGGREGATION_CRON, async () => {
    try {
      const results = await aggregatePending();
      if (results.length === 0) {
        logger.info('Aggregation scheduler: nothing to publish');
      } else {
        logger.info(
          `Aggregation scheduler published ${results.length} period(s): ` +
            results.map((item) => item.period).join(', ')
        );
      }
    } catch (error) {
      logger.error(`Aggregation scheduler failed: ${error.message}`);
    }
  });

  logger.info(`Aggregation scheduler started (${env.AGGREGATION_CRON})`);
  return task;
}

function stop() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { start, stop };
