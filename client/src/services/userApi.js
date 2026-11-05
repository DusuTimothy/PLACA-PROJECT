import api from './api';

/**
 * User management endpoints.
 * Creating partner staff and sending invitations is restricted to PLACA officers and directors.
 */

export async function listUsers(params = {}) {
  const { data } = await api.get('/users', { params });
  return data;
}

export async function getUser(id) {
  const { data } = await api.get(`/users/${id}`);
  return data.user;
}

export async function createUser(payload) {
  const { data } = await api.post('/users', payload);
  return data;
}

export async function updateUser(id, payload) {
  const { data } = await api.patch(`/users/${id}`, payload);
  return data;
}

export async function resendInvitation(id) {
  const { data } = await api.post(`/users/${id}/resend-invitation`);
  return data;
}

export async function resetUserPassword(id) {
  const { data } = await api.post(`/users/${id}/reset-password`);
  return data;
}
