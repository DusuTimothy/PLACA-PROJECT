#!/usr/bin/env node
'use strict';

/**
 * Create the first administrator on a fresh database, or promote an existing
 * account as a break-glass recovery step.
 *
 * Why a CLI instead of a public endpoint?
 * - There is no safe way to expose "create an admin" before an admin exists.
 * - A public bootstrap route is a permanent attack surface.
 * - This command is run by whoever controls the server and its secrets.
 *
 * Usage (inside the server container or server/ directory):
 *   npm run admin:create -- --email admin@placa.gov.ng --name "PLACA Admin"
 *   npm run admin:create -- --phone 08030000001 --name "PLACA Admin"
 *   npm run admin:create -- --email admin@placa.gov.ng --promote
 *
 * If no password is supplied, a one-time temporary password is generated and
 * printed once. The account must change it at first sign-in. TOTP setup is
 * still mandatory because the role is admin.
 */

const { parseArgs } = require('node:util');
const { Op } = require('sequelize');
const env = require('../src/config/env');
const { User, RefreshToken, sequelize } = require('../src/models');
const {
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  name: nameSchema,
} = require('../src/schemas/common');
const { hashPassword, generateTemporaryPassword } = require('../src/utils/password');

const USAGE = `
Create or promote a PLACA administrator.

Options:
  --email <address>      Email address for the account
  --phone <number>       Nigerian phone number (used if no email)
  --name <full name>     Display name (required when creating)
  --password <value>     Use a specific password instead of generating one.
                         Avoid this on shared shells: it enters shell history.
  --no-force-change      Do not force a password change at first sign-in.
  --promote              Elevate an existing account instead of creating one.
  -h, --help             Show this message.

Examples:
  npm run admin:create -- --email admin@placa.gov.ng --name "PLACA Admin"
  npm run admin:create -- --email director@placa.gov.ng --promote
`.trim();

function fail(message) {
  console.error(`\nError: ${message}\n`);
  process.exitCode = 1;
}

function firstIssue(result) {
  return result.error.issues[0]?.message || 'Invalid value';
}

function parseEmail(value) {
  const result = emailSchema.safeParse(value);
  if (!result.success) throw new Error(`Email: ${firstIssue(result)}`);
  return result.data;
}

function parsePhone(value) {
  const result = phoneSchema.safeParse(value);
  if (!result.success) throw new Error(`Phone: ${firstIssue(result)}`);
  return result.data;
}

function parseName(value) {
  const result = nameSchema.safeParse(value);
  if (!result.success) throw new Error(`Name: ${firstIssue(result)}`);
  return result.data;
}

function parsePassword(value) {
  const result = passwordSchema.safeParse(value);
  if (!result.success) throw new Error(`Password: ${firstIssue(result)}`);
  return result.data;
}

async function findExisting({ email, phone }) {
  const conditions = [];
  if (email) conditions.push({ email });
  if (phone) conditions.push({ phone });
  if (!conditions.length) return null;

  return User.unscoped().findOne({ where: { [Op.or]: conditions } });
}

async function createAdmin({ email, phone, name, password, forceChange }) {
  const existing = await findExisting({ email, phone });
  if (existing) {
    throw new Error(
      `An account already uses that email or phone (${existing.role}). ` +
        'Use --promote to make that account an administrator.'
    );
  }

  const temporaryPassword = password || generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  const user = await User.create({
    name,
    email,
    phone,
    password_hash: passwordHash,
    role: 'admin',
    lga_id: null,
    organization_id: null,
    language: 'en',
    must_change_password: forceChange,
    verified: true,
    is_active: true,
    totp_enabled: false,
  });

  console.log('\n✓ Administrator created');
  console.log(`  id:    ${user.id}`);
  console.log(`  name:  ${user.name}`);
  if (user.email) console.log(`  email: ${user.email}`);
  if (user.phone) console.log(`  phone: ${user.phone}`);

  if (!password) {
    console.log('\n  One-time temporary password (shown once):');
    console.log(`  ${temporaryPassword}`);
  }

  console.log(
    '\nNext steps: sign in, change the password if prompted, then scan the QR code\n' +
      'to finish mandatory authenticator (TOTP) setup. The account cannot be used\n' +
      'before that setup is complete.\n'
  );
}

async function promoteExisting({ email, phone }) {
  const user = await findExisting({ email, phone });
  if (!user) {
    throw new Error('No account matches that email or phone. Create one without --promote.');
  }

  if (user.role === 'admin') {
    console.log(`\n${user.email || user.phone} is already an administrator. Nothing to do.\n`);
    return;
  }

  if (!user.is_active) {
    throw new Error('That account is deactivated. Reactivate it before promoting it.');
  }

  const previousRole = user.role;

  await sequelize.transaction(async (transaction) => {
    // Admins are state-level accounts, so any partner/LGA placement is cleared.
    user.role = 'admin';
    user.organization_id = null;
    user.lga_id = null;
    await user.save({ transaction });

    // Force a fresh sign-in so the new role is picked up deliberately, not
    // silently inside an existing partner session.
    await RefreshToken.update(
      { revoked_at: new Date() },
      { where: { user_id: user.id, revoked_at: null }, transaction }
    );
  });

  console.log('\n✓ Account promoted to administrator');
  console.log(`  id:           ${user.id}`);
  console.log(`  email/phone:  ${user.email || user.phone}`);
  console.log(`  previous role: ${previousRole}`);
  console.log(
    '\nExisting sessions were signed out. The user must sign in again and, if they\n' +
      'have not done so already, complete authenticator (TOTP) setup.\n'
  );
}

async function main() {
  let values;
  try {
    ({ values } = parseArgs({
      options: {
        email: { type: 'string' },
        phone: { type: 'string' },
        name: { type: 'string' },
        password: { type: 'string' },
        'no-force-change': { type: 'boolean', default: false },
        promote: { type: 'boolean', default: false },
        help: { type: 'boolean', short: 'h', default: false },
      },
      allowPositionals: false,
    }));
  } catch (error) {
    console.error(`\n${error.message}`);
    console.log(`\n${USAGE}\n`);
    process.exitCode = 1;
    return;
  }

  if (values.help) {
    console.log(USAGE);
    return;
  }

  const email = values.email ? parseEmail(values.email) : null;
  const phone = values.phone ? parsePhone(values.phone) : null;

  if (!email && !phone) {
    fail('Provide --email or --phone.');
    console.log(USAGE);
    return;
  }

  if (values.promote) {
    if (values.password || values.name || values['no-force-change']) {
      fail('--password, --name and --no-force-change only apply when creating an account.');
      return;
    }
    await promoteExisting({ email, phone });
    return;
  }

  if (!values.name) {
    fail('Provide --name for the new administrator.');
    return;
  }

  const name = parseName(values.name);
  const password = values.password ? parsePassword(values.password) : null;

  await createAdmin({
    email,
    phone,
    name,
    password,
    forceChange: !values['no-force-change'],
  });
}

main()
  .catch((error) => {
    // Operational errors are expected (duplicate account, bad input). They are
    // printed without a stack trace so the operator sees the fix, not noise.
    fail(error.message);
  })
  .finally(async () => {
    await sequelize.close().catch(() => {});
  });
