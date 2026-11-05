'use strict';

/**
 * Express application wiring.
 *
 * Order matters:
 * 1. security headers and CORS
 * 2. body parsing (small limit)
 * 3. request-scoped audit context
 * 4. rate limiting and request logging
 * 5. routes
 * 6. 404 and the single error handler
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const env = require('./config/env');
const logger = require('./config/logger');
const requestContext = require('./middleware/requestContext');
const { globalLimiter } = require('./middleware/rateLimiter');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const { sequelize } = require('./models');

const app = express();

// Behind nginx, req.ip must use the forwarded address for rate limits and audit.
app.set('trust proxy', env.isProduction ? 1 : false);

app.use(
  helmet({
    // This process serves JSON only; a page CSP belongs to the client/nginx.
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(
  cors({
    origin(origin, callback) {
      // No Origin header: curl, server-to-server, or same-origin request.
      if (!origin) return callback(null, true);
      if (env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieParser());

// One audit context per request, available to Sequelize hooks.
app.use(requestContext);

// Lightweight access log. Bodies, cookies and tokens are never logged.
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.debug(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
});

app.get('/health', async (req, res) => {
  try {
    await sequelize.query('SELECT 1');
    return res.json({ status: 'ok', database: 'up', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Health check failed: database unreachable');
    return res.status(503).json({ status: 'degraded', database: 'down' });
  }
});

app.use('/api', globalLimiter);

const publicRoutes = require('./routes/public');
const publicAssistantRoutes = require('./routes/publicAssistant');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const referenceRoutes = require('./routes/reference');
const auditLogRoutes = require('./routes/auditLogs');
const organizationRoutes = require('./routes/organizations');
const workplanRoutes = require('./routes/workplans');
const reportRoutes = require('./routes/reports');
const aggregationRoutes = require('./routes/aggregation');
const dashboardRoutes = require('./routes/dashboard');
const guideRoutes = require('./routes/guides');
const documentRoutes = require('./routes/documents');
const equipmentRoutes = require('./routes/equipment');
const supportRequestRoutes = require('./routes/supportRequests');
const fundingRoutes = require('./routes/funding');
const programmeRoutes = require('./routes/programmes');
const notificationRoutes = require('./routes/notifications');
const assistantRoutes = require('./routes/assistant');

// No session: the landing page reads pre-aggregated counts only, and its chat
// is stateless with its own strict per-IP limit.
app.use('/api/public/assistant', publicAssistantRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/workplans', workplanRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/aggregation', aggregationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/guides', guideRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/support-requests', supportRequestRoutes);
app.use('/api/funding', fundingRoutes);
app.use('/api/programmes', programmeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/assistant', assistantRoutes);
// The reference router declares full paths so both can share one file.
app.use('/api', referenceRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
