'use strict';

/**
 * Central environment configuration.
 *
 * Debugging tip: every place that reads process.env directly should live here.
 * If a setting is wrong, this file throws once at boot instead of failing later
 * in a request with a confusing error.
 */

const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Load the repository-level .env first, then allow server/.env to fill gaps.
// We never override a value that was already supplied by Docker or the shell.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

// Copies of .env.example leave optional settings as empty strings; treat those
// as unset so enum validation does not reject them.
const optionalEnum = (values) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    z.enum(values).optional()
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),

  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().int().positive().default(5432),
  DB_NAME: z.string().default('placa'),
  DB_USER: z.string().default('placa'),
  DB_PASSWORD: z.string().default('placa_password'),
  DB_LOGGING: z.enum(['true', 'false']).default('false'),
  // Hosted PostgreSQL (for example Aiven) requires TLS. DB_SSL is the simple
  // switch; DB_SSL_MODE mirrors libpq's sslmode for providers that document it.
  // DB_SSL_CA accepts a path to ca.pem or the PEM text itself.
  DB_SSL: z.enum(['true', 'false']).default('false'),
  DB_SSL_MODE: optionalEnum(['disable', 'require', 'verify-ca', 'verify-full']),
  DB_SSL_CA: z.string().trim().optional(),
  DB_SSL_REJECT_UNAUTHORIZED: optionalEnum(['true', 'false']),

  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  // The signed-in React app lives under this path; "/" is the public site.
  APP_BASE_PATH: z.string().default('/app'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  // Cross-site cookies are needed when the client (for example Vercel) and the
  // API (for example Render) are on different domains. Production defaults to
  // SameSite=None; a same-origin nginx deployment can set "lax" explicitly.
  COOKIE_SAME_SITE: optionalEnum(['lax', 'strict', 'none']),

  // Review/demo deployments only. When true, the accounts listed in
  // DEMO_ACCOUNTS skip the forced-password-change and TOTP steps so a public
  // pitch build can be explored quickly. Never enable this for real users.
  DEMO_MODE: z.enum(['true', 'false']).default('false'),
  DEMO_ACCOUNTS: z
    .string()
    .default(
      [
        'admin@placa.gov.ng',
        'director@placa.gov.ng',
        'officer@placa.gov.ng',
        'laca.josnorth@placa.gov.ng',
        'laca.barkinladi@placa.gov.ng',
        'partner@hopefoundation.org',
        'partner@ruralhealth.ng',
      ].join(',')
    ),

  JWT_ACCESS_SECRET: z.string().default('dev-access-secret-change-me-please-32'),
  JWT_REFRESH_SECRET: z.string().default('dev-refresh-secret-change-me-please-32'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),

  // pgcrypto symmetric key used only for the narrow users.totp_secret column.
  TOTP_ENCRYPTION_KEY: z.string().default('dev-totp-key-change-me'),
  TOTP_ISSUER: z.string().default('PLACA Platform'),

  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('noreply@placa.org.ng'),
  EMAIL_FROM_NAME: z.string().default('PLACA Platform'),

  // Gemini powers the general-purpose assistant. The key is server-only and is
  // never sent to the browser. The feature reports a clear setup error when it
  // is absent; the rest of the platform keeps working.
  GEMINI_API_KEY: z.string().trim().optional(),
  GEMINI_MODEL: z.string().trim().default('gemini-2.5-flash'),
  GEMINI_API_BASE_URL: z
    .string()
    .url()
    .default('https://generativelanguage.googleapis.com/v1beta'),
  GEMINI_TIMEOUT_MS: z.coerce.number().int().positive().max(120000).default(30000),
  // Prior turns sent as context. The full conversation stays in PostgreSQL.
  AI_MAX_HISTORY_MESSAGES: z.coerce.number().int().min(2).max(50).default(12),
  // Per-account assistant limit, separate from the global IP limit.
  AI_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  // Anonymous landing-page chat is more exposed than an authenticated account,
  // so it has a smaller allowance per IP address.
  PUBLIC_AI_RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 60 * 1000),
  PUBLIC_AI_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(8),

  STORAGE_TYPE: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default(path.resolve(__dirname, '../../uploads')),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  // Refresh and account-recovery endpoints. One full page load uses one
  // refresh, and shared office IPs can hold several devices, so this is higher
  // than the failed-login limit (which stays strict and skips success).
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  LOGIN_LOCK_MINUTES: z.coerce.number().int().positive().default(15),

  // Public results. An LGA cell below this many people is never published.
  PUBLIC_SMALL_CELL_THRESHOLD: z.coerce.number().int().min(1).default(5),
  // The scheduler is off by default; production sets it to true.
  ENABLE_AGGREGATION_CRON: z.enum(['true', 'false']).default('false'),
  // 02:30 daily, server time. Five-field cron expression.
  AGGREGATION_CRON: z.string().default('30 2 * * *'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${details}`);
}

const env = parsed.data;

// Production must not silently run with the development secrets above.
if (isProduction) {
  if (env.JWT_ACCESS_SECRET.startsWith('dev-')) {
    throw new Error('JWT_ACCESS_SECRET must be set to a real secret in production');
  }
  if (env.JWT_REFRESH_SECRET.startsWith('dev-')) {
    throw new Error('JWT_REFRESH_SECRET must be set to a real secret in production');
  }
  if (env.TOTP_ENCRYPTION_KEY.startsWith('dev-')) {
    throw new Error('TOTP_ENCRYPTION_KEY must be set to a real secret in production');
  }
}

function normalizeBasePath(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed || trimmed === '/') return '';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

const appBasePath = normalizeBasePath(env.APP_BASE_PATH);

module.exports = {
  ...env,
  appBasePath,
  // Absolute links in invitation, verification and reset emails.
  clientAppUrl: (path) => {
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${env.CLIENT_URL.replace(/\/$/, '')}${appBasePath}${suffix}`;
  },
  isProduction,
  isTest,
  isDevelopment: !isProduction && !isTest,
  corsOrigins: env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean),
  demoMode: env.DEMO_MODE === 'true',
  demoAccounts: env.DEMO_ACCOUNTS.split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
};
