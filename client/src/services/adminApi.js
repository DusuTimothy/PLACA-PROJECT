import api from './api';

/**
 * Administrator endpoints. Admin accounts manage people and the audit trail,
 * never programme data.
 */

export async function listAuditLogs(params) {
  const { data } = await api.get('/audit-logs', { params });
  return data;
}

export {
  listUsers,
  getUser,
  createUser,
  updateUser,
  resendInvitation,
  resetUserPassword,
} from './userApi';
