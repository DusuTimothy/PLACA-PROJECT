'use strict';

/**
 * Production preflight.
 *
 * Run before opening the platform to real users:
 *   NODE_ENV=production npm run preflight
 *
 * It checks configuration, database connectivity, migrations, the append-only
 * audit triggers, demo-data leftovers and the public small-cell rule. It never
 * prints a secret or a password.
 */

const env = require('../src/config/env');
const { sequelize } = require('../src/models');

const results = [];

function record(ok, label, detail = '', severity = 'fail') {
  results.push({ ok, label, detail, severity });
}

function pass(label, detail = '') {
  record(true, label, detail);
}

function fail(label, detail = '') {
  record(false, label, detail, 'fail');
}

function warn(label, detail = '') {
  record(false, label, detail, 'warn');
}

async function scalar(sql, replacements = {}) {
  const rows = await sequelize.query(sql, {
    replacements,
    type: sequelize.QueryTypes.SELECT,
  });
  return rows[0] ? Object.values(rows[0])[0] : null;
}

async function main() {
  console.log('PLACA production preflight\n');

  if (env.NODE_ENV === 'production') {
    pass('NODE_ENV is production');
  } else {
    warn(`NODE_ENV is "${env.NODE_ENV}", not "production"`);
  }

  const devSecrets = [
    ['JWT_ACCESS_SECRET', env.JWT_ACCESS_SECRET],
    ['JWT_REFRESH_SECRET', env.JWT_REFRESH_SECRET],
    ['TOTP_ENCRYPTION_KEY', env.TOTP_ENCRYPTION_KEY],
  ].filter(([, value]) => String(value).startsWith('dev-'));

  if (devSecrets.length === 0) {
    pass('Authentication secrets are not development defaults');
  } else {
    fail(
      'Authentication secrets still use development defaults',
      devSecrets.map(([name]) => name).join(', ')
    );
  }

  if (env.CLIENT_URL.startsWith('https://')) {
    pass('CLIENT_URL uses HTTPS');
  } else {
    warn('CLIENT_URL does not use HTTPS', env.CLIENT_URL);
  }

  if (env.corsOrigins.some((origin) => /localhost|127\.0\.0\.1/.test(origin))) {
    warn('CORS_ORIGINS still contains a local address', env.corsOrigins.join(', '));
  } else {
    pass('CORS_ORIGINS has no local addresses');
  }

  if (env.PUBLIC_SMALL_CELL_THRESHOLD >= 5) {
    pass(`Public small-cell threshold is ${env.PUBLIC_SMALL_CELL_THRESHOLD}`);
  } else {
    fail('Public small-cell threshold is below 5', String(env.PUBLIC_SMALL_CELL_THRESHOLD));
  }

  if (env.ENABLE_AGGREGATION_CRON === 'true') {
    pass('Aggregation scheduler is enabled');
  } else {
    warn('Aggregation scheduler is off', 'set ENABLE_AGGREGATION_CRON=true in production');
  }

  if (env.BREVO_API_KEY) {
    pass('Email delivery is configured');
  } else {
    warn('Email delivery is not configured', 'invitations and alerts will need another channel');
  }

  if (env.GEMINI_API_KEY) {
    pass('AI assistant is configured');
  } else {
    warn('AI assistant is not configured', 'set GEMINI_API_KEY to enable the assistant');
  }

  try {
    await sequelize.authenticate();
    pass('Database connection works');
  } catch (error) {
    fail('Database connection failed', error.message);
    return;
  }

  const requiredTables = [
    'users',
    'lgas',
    'organizations',
    'indicators',
    'workplans',
    'workplan_targets',
    'reports',
    'report_values',
    'public_summary',
    'audit_logs',
    'refresh_tokens',
    'guides',
    'user_guide_progress',
    'documents',
    'support_requests',
    'support_request_items',
    'supply_records',
    'equipment_items',
    'stock_levels',
    'funding_sources',
    'funding_inflows',
    'funding_allocations',
    'welfare_programmes',
    'notifications',
    'chat_conversations',
    'chat_messages',
  ];
  for (const table of requiredTables) {
    const exists = await scalar('SELECT to_regclass(:table) IS NOT NULL AS present', {
      table: `public.${table}`,
    });
    if (exists) pass(`Table ${table} exists`);
    else fail(`Table ${table} is missing`);
  }

  const migrations = await scalar('SELECT COUNT(*)::int FROM "SequelizeMeta"').catch(() => null);
  if (migrations === null) {
    fail('Migration history table "SequelizeMeta" is missing');
  } else if (migrations >= 6) {
    pass(`Migration history has ${migrations} entries`);
  } else {
    warn(`Only ${migrations} migrations recorded`, 'check that every migration ran');
  }

  const auditTriggers = await scalar(
    `SELECT COUNT(*)::int
       FROM pg_trigger
      WHERE tgname IN ('audit_logs_no_update_delete', 'audit_logs_no_truncate')`
  );
  if (auditTriggers === 2) {
    pass('Audit log update/delete/truncate triggers are installed');
  } else {
    fail('Audit log append-only triggers are missing', `found ${auditTriggers} of 2`);
  }

  const adminCount = await scalar(
    "SELECT COUNT(*)::int FROM users WHERE role = 'admin' AND is_active = true"
  );
  if (adminCount >= 1) {
    pass(`Active administrator accounts: ${adminCount}`);
  } else {
    fail('No active administrator account');
  }

  const demoEmails = [
    'admin@placa.gov.ng',
    'director@placa.gov.ng',
    'officer@placa.gov.ng',
    'laca.josnorth@placa.gov.ng',
    'laca.barkinladi@placa.gov.ng',
    'partner@hopefoundation.org',
    'partner@ruralhealth.ng',
  ];
  const demoUsers = await scalar(
    'SELECT COUNT(*)::int FROM users WHERE email IN (:emails)',
    { emails: demoEmails }
  );
  if (demoUsers === 0) {
    pass('No seeded demo accounts remain');
  } else if (env.NODE_ENV === 'production') {
    fail('Seeded demo accounts are still present', `${demoUsers} account(s)`);
  } else {
    warn('Seeded demo accounts are present', 'remove them before production');
  }

  const smallLgaCells = await scalar(
    `SELECT COUNT(*)::int
       FROM public_summary
      WHERE scope = 'lga'
        AND value > 0
        AND value < :threshold`,
    { threshold: env.PUBLIC_SMALL_CELL_THRESHOLD }
  );
  if (smallLgaCells === 0) {
    pass('No small LGA cells are published');
  } else {
    fail('Small LGA cells are visible in public_summary', `${smallLgaCells} row(s)`);
  }

  const pending = await scalar(
    `SELECT COUNT(*)::int
       FROM reports
      WHERE status = 'validated'`
  );
  if (pending === 0) {
    pass('No validated reports are waiting to be published');
  } else {
    warn(`${pending} validated report(s) are not aggregated yet`, 'run npm run aggregate');
  }

  console.log('');
  for (const item of results) {
    const mark = item.ok ? 'ok  ' : item.severity === 'warn' ? 'warn' : 'FAIL';
    console.log(`${mark}  ${item.label}${item.detail ? ` - ${item.detail}` : ''}`);
  }

  const failures = results.filter((item) => !item.ok && item.severity === 'fail');
  const warnings = results.filter((item) => !item.ok && item.severity === 'warn');
  console.log(`\n${failures.length} failure(s), ${warnings.length} warning(s).`);
  process.exitCode = failures.length > 0 ? 1 : 0;
}

main()
  .catch((error) => {
    console.error(`Preflight could not finish: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
