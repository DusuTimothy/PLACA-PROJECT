'use strict';

/**
 * Notification schemas.
 */

const { z } = require('zod');
const {
  uuid,
  paginationQuery,
  emptyBody,
  emptyQuery,
  emptyParams,
} = require('./common');

const listNotifications = z.object({
  body: emptyBody,
  query: paginationQuery.extend({
    unread: z.enum(['true', 'false']).optional(),
  }),
  params: emptyParams,
});

const notificationParams = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: z.object({ id: uuid }),
});

const readAll = z.object({
  body: emptyBody,
  query: emptyQuery,
  params: emptyParams,
});

module.exports = { listNotifications, notificationParams, readAll };
