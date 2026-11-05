import api from './api';

/**
 * Programme endpoints for organizations, workplans and reports.
 * The server decides scope; the client only supplies filters.
 */

export async function listOrganizations(params) {
  const { data } = await api.get('/organizations', { params });
  return data;
}

export async function getOrganization(id) {
  const { data } = await api.get(`/organizations/${id}`);
  return data.data;
}

export async function createOrganization(payload) {
  const { data } = await api.post('/organizations', payload);
  return data.data;
}

export async function updateOrganization(id, payload) {
  const { data } = await api.patch(`/organizations/${id}`, payload);
  return data.data;
}

export async function approveOrganization(id) {
  const { data } = await api.post(`/organizations/${id}/approve`);
  return data.data;
}

export async function suspendOrganization(id) {
  const { data } = await api.post(`/organizations/${id}/suspend`);
  return data.data;
}

export async function listWorkplans(params) {
  const { data } = await api.get('/workplans', { params });
  return data;
}

export async function getWorkplan(id) {
  const { data } = await api.get(`/workplans/${id}`);
  return data.data;
}

export async function createWorkplan(payload) {
  const { data } = await api.post('/workplans', payload);
  return data.data;
}

export async function updateWorkplan(id, payload) {
  const { data } = await api.patch(`/workplans/${id}`, payload);
  return data.data;
}

export async function submitWorkplan(id) {
  const { data } = await api.post(`/workplans/${id}/submit`);
  return data.data;
}

export async function reviewWorkplan(id, payload) {
  const { data } = await api.post(`/workplans/${id}/review`, payload);
  return data.data;
}

export async function deleteWorkplan(id) {
  const { data } = await api.delete(`/workplans/${id}`);
  return data;
}

export async function listReports(params) {
  const { data } = await api.get('/reports', { params });
  return data;
}

export async function getReport(id) {
  const { data } = await api.get(`/reports/${id}`);
  return data.data;
}

export async function createReport(payload) {
  const { data } = await api.post('/reports', payload);
  return data.data;
}

export async function updateReport(id, payload) {
  const { data } = await api.patch(`/reports/${id}`, payload);
  return data.data;
}

export async function submitReport(id) {
  const { data } = await api.post(`/reports/${id}/submit`);
  return data.data;
}

export async function reviewReport(id, payload) {
  const { data } = await api.post(`/reports/${id}/review`, payload);
  return data.data;
}

export async function deleteReport(id) {
  const { data } = await api.delete(`/reports/${id}`);
  return data;
}

export async function listLgas() {
  const { data } = await api.get('/lgas');
  return data.data;
}

export async function getDashboardOverview(params = {}) {
  const { data } = await api.get('/dashboard/overview', { params });
  return data.data;
}

export async function downloadReportsCsv(params = {}) {
  const response = await api.get('/reports/export', { params, responseType: 'blob' });
  return response.data;
}

export async function downloadReportsPdf(params = {}) {
  const response = await api.get('/reports/export/pdf', { params, responseType: 'blob' });
  return response.data;
}

export async function listIndicators(params = {}) {
  const { data } = await api.get('/indicators', { params });
  return data.data;
}
