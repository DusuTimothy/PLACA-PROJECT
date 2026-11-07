'use strict';

/**
 * Process entry point.
 *
 * We verify the database connection before listening so a bad password or a
 * missing migration shows up immediately in the container logs instead of as a
 * confusing 500 on the first request.
 */

const app = require('./app');
const env = require('./config/env');
const logger = require('./config/logger');
const { sequelize } = require('./models');
const aggregationCron = require('./services/aggregationCron');

let server;

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');
  } catch (error) {
    logger.error(`Database connection failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`PLACA API listening on port ${env.PORT} (${env.NODE_ENV})`);
    if (env.demoMode) {
      logger.warn(
        'DEMO_MODE is enabled: shared demo accounts skip password change and TOTP. ' +
          'Turn it off before real users or real data are added.'
      );
    }
  });

  aggregationCron.start();
}

async function shutdown(signal) {
  logger.info(`${signal} received; shutting down`);
  aggregationCron.stop();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await sequelize.close();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
