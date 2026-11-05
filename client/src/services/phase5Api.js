import api from './api';
import { createReport, submitReport, updateReport } from './programmeApi';
import { isNetworkError, readThrough } from './offline';
import {
  enqueueOutbox,
  listOutbox,
  removeOutbox,
  updateOutbox,
} from './offlineDb';

/**
 * Phase 5 endpoints: help library, documents, equipment, support requests,
 * funding, programmes and notifications.
 *
 * Reads are cached. Writes that a field worker may need to do with no signal
 * (a support request or a report) can be queued in the outbox.
 */

function withCacheFlag(result) {
  if (result.fromCache && result.value && typeof result.value === 'object') {
    return { ...result.value, from_cache: true };
  }
  return result.value;
}

async function cachedGet(key, request) {
  return withCacheFlag(await readThrough(key, request));
}

// ---------- Help library ----------

export async function listGuides(params = {}) {
  const key = `guides:${JSON.stringify(params)}`;
  return cachedGet(key, async () => {
    const { data } = await api.get('/guides', { params });
    return data;
  });
}

export async function getGuide(key, params = {}) {
  return cachedGet(`guide:${key}:${JSON.stringify(params)}`, async () => {
    const { data } = await api.get(`/guides/${encodeURIComponent(key)}`, { params });
    return data.data;
  });
}

export async function createGuide(payload) {
  const { data } = await api.post('/guides', payload);
  return data.data;
}

export async function updateGuide(id, payload) {
  const { data } = await api.patch(`/guides/${id}`, payload);
  return data.data;
}

export async function deleteGuide(id) {
  const { data } = await api.delete(`/guides/${id}`);
  return data;
}

export async function listGuideProgress() {
  const { data } = await api.get('/guides/progress');
  return data.data;
}

export async function markGuideProgress(key, payload) {
  const { data } = await api.post(`/guides/progress/${encodeURIComponent(key)}`, payload);
  return data.data;
}

// ---------- Documents ----------

export async function listDocuments(params = {}) {
  const key = `documents:${JSON.stringify(params)}`;
  return cachedGet(key, async () => {
    const { data } = await api.get('/documents', { params });
    return data;
  });
}

export async function uploadDocument(formData) {
  const { data } = await api.post('/documents', formData);
  return data.data;
}

export async function updateDocument(id, payload) {
  const { data } = await api.patch(`/documents/${id}`, payload);
  return data.data;
}

export async function deleteDocument(id) {
  const { data } = await api.delete(`/documents/${id}`);
  return data;
}

export async function downloadDocument(id) {
  const response = await api.get(`/documents/${id}/download`, { responseType: 'blob' });
  return response.data;
}

// ---------- Equipment ----------

export async function listEquipment(params = {}) {
  const key = `equipment:${JSON.stringify(params)}`;
  return cachedGet(key, async () => {
    const { data } = await api.get('/equipment', { params });
    return data;
  });
}

export async function listStock(params = {}) {
  const key = `equipment-stock:${JSON.stringify(params)}`;
  return cachedGet(key, async () => {
    const { data } = await api.get('/equipment/stock', { params });
    return data;
  });
}

export async function createEquipment(payload) {
  const { data } = await api.post('/equipment', payload);
  return data.data;
}

export async function updateEquipment(id, payload) {
  const { data } = await api.patch(`/equipment/${id}`, payload);
  return data.data;
}

export async function deleteEquipment(id) {
  const { data } = await api.delete(`/equipment/${id}`);
  return data;
}

export async function setStock(id, payload) {
  const { data } = await api.put(`/equipment/${id}/stock`, payload);
  return data.data;
}

// ---------- Support requests ----------

export async function listSupportRequests(params = {}) {
  const key = `support-requests:${JSON.stringify(params)}`;
  return cachedGet(key, async () => {
    const { data } = await api.get('/support-requests', { params });
    return data;
  });
}

export async function getSupportRequest(id) {
  return cachedGet(`support-request:${id}`, async () => {
    const { data } = await api.get(`/support-requests/${id}`);
    return data.data;
  });
}

export async function createSupportRequest(payload) {
  const { data } = await api.post('/support-requests', payload);
  return data.data;
}

/**
 * Create a request now, or queue it if the phone has no signal. The server
 * treats client_uuid as an idempotency key, so a retry cannot duplicate it.
 */
export async function createSupportRequestOfflineFirst(payload, label = '') {
  try {
    return { data: await createSupportRequest(payload), queued: false };
  } catch (error) {
    if (!isNetworkError(error)) throw error;
    const id = await enqueueOutbox({
      kind: 'support_request_create',
      payload,
      label,
    });
    return { data: null, queued: Boolean(id) };
  }
}

export async function decideSupportRequest(id, payload) {
  const { data } = await api.post(`/support-requests/${id}/decision`, payload);
  return data.data;
}

export async function recordSupply(id, payload) {
  const { data } = await api.post(`/support-requests/${id}/supplies`, payload);
  return data.data;
}

export async function confirmReceipt(id) {
  const { data } = await api.post(`/support-requests/${id}/confirm-receipt`);
  return data.data;
}

export async function changeSupportStatus(id, payload) {
  const { data } = await api.post(`/support-requests/${id}/status`, payload);
  return data.data;
}

// ---------- Funding ----------

export async function listFundingSources(params = {}) {
  const key = `funding-sources:${JSON.stringify(params)}`;
  return cachedGet(key, async () => {
    const { data } = await api.get('/funding/sources', { params });
    return data;
  });
}

export async function createFundingSource(payload) {
  const { data } = await api.post('/funding/sources', payload);
  return data.data;
}

export async function updateFundingSource(id, payload) {
  const { data } = await api.patch(`/funding/sources/${id}`, payload);
  return data.data;
}

export async function deleteFundingSource(id) {
  const { data } = await api.delete(`/funding/sources/${id}`);
  return data;
}

export async function listFundingInflows(params = {}) {
  const key = `funding-inflows:${JSON.stringify(params)}`;
  return cachedGet(key, async () => {
    const { data } = await api.get('/funding/inflows', { params });
    return data;
  });
}

export async function createFundingInflow(payload) {
  const { data } = await api.post('/funding/inflows', payload);
  return data.data;
}

export async function updateFundingInflow(id, payload) {
  const { data } = await api.patch(`/funding/inflows/${id}`, payload);
  return data.data;
}

export async function deleteFundingInflow(id) {
  const { data } = await api.delete(`/funding/inflows/${id}`);
  return data;
}

export async function listFundingAllocations(params = {}) {
  const key = `funding-allocations:${JSON.stringify(params)}`;
  return cachedGet(key, async () => {
    const { data } = await api.get('/funding/allocations', { params });
    return data;
  });
}

export async function createFundingAllocation(payload) {
  const { data } = await api.post('/funding/allocations', payload);
  return data.data;
}

export async function updateFundingAllocation(id, payload) {
  const { data } = await api.patch(`/funding/allocations/${id}`, payload);
  return data.data;
}

export async function deleteFundingAllocation(id) {
  const { data } = await api.delete(`/funding/allocations/${id}`);
  return data;
}

export async function getFundingSummary(params = {}) {
  return cachedGet(`funding-summary:${JSON.stringify(params)}`, async () => {
    const { data } = await api.get('/funding/summary', { params });
    return data.data;
  });
}

// ---------- Welfare programmes ----------

export async function listProgrammes(params = {}) {
  const key = `programmes:${JSON.stringify(params)}`;
  return cachedGet(key, async () => {
    const { data } = await api.get('/programmes', { params });
    return data;
  });
}

export async function getProgramme(id) {
  return cachedGet(`programme:${id}`, async () => {
    const { data } = await api.get(`/programmes/${id}`);
    return data.data;
  });
}

export async function createProgramme(payload) {
  const { data } = await api.post('/programmes', payload);
  return data.data;
}

export async function updateProgramme(id, payload) {
  const { data } = await api.patch(`/programmes/${id}`, payload);
  return data.data;
}

export async function deleteProgramme(id) {
  const { data } = await api.delete(`/programmes/${id}`);
  return data;
}

// ---------- Notifications ----------

export async function listNotifications(params = {}) {
  const key = `notifications:${JSON.stringify(params)}`;
  return cachedGet(key, async () => {
    const { data } = await api.get('/notifications', { params });
    return data;
  });
}

export async function unreadNotifications() {
  try {
    const response = await api.get('/notifications/unread');
    const data = response?.data;
    return data?.unread || 0;
  } catch {
    return 0;
  }
}

export async function markNotificationRead(id) {
  const { data } = await api.post(`/notifications/${id}/read`);
  return data.data;
}

export async function markAllNotificationsRead() {
  const { data } = await api.post('/notifications/read-all');
  return data;
}

// ---------- Outbox ----------

const OUTBOX_LABELS = {
  support_request_create: 'Support request',
  report_create: 'Report',
  report_update: 'Report changes',
  report_submit: 'Report submission',
};

export async function queueReport(payload, { submit = false } = {}) {
  const id = await enqueueOutbox({
    kind: 'report_create',
    payload,
    submit,
    label: OUTBOX_LABELS.report_create,
  });
  return Boolean(id);
}

export async function queueReportUpdate(id, values) {
  const queued = await enqueueOutbox({
    kind: 'report_update',
    payload: { id, values },
    label: OUTBOX_LABELS.report_update,
  });
  return Boolean(queued);
}

export async function queueReportSubmit(id) {
  const queued = await enqueueOutbox({
    kind: 'report_submit',
    payload: { id },
    label: OUTBOX_LABELS.report_submit,
  });
  return Boolean(queued);
}

/**
 * Send everything waiting in the outbox, oldest first. A network failure stops
 * the run so the remaining items keep their place in line. A server rejection
 * records the message and moves on, so one bad item cannot block the queue.
 */
export async function flushOutbox() {
  const items = await listOutbox();
  const results = [];

  for (const item of items) {
    try {
      if (item.kind === 'support_request_create') {
        await createSupportRequest(item.payload);
      } else if (item.kind === 'report_create') {
        const report = await createReport(item.payload);
        if (item.submit && report?.id) await submitReport(report.id);
      } else if (item.kind === 'report_update') {
        await updateReport(item.payload.id, { values: item.payload.values });
      } else if (item.kind === 'report_submit') {
        await submitReport(item.payload.id);
      } else {
        throw new Error(`Unknown outbox item: ${item.kind}`);
      }

      await removeOutbox(item.id);
      results.push({ id: item.id, ok: true, label: item.label });
    } catch (error) {
      if (isNetworkError(error)) {
        results.push({ id: item.id, ok: false, label: item.label, offline: true });
        break;
      }
      await updateOutbox(item.id, {
        attempts: (item.attempts || 0) + 1,
        last_error: error?.response?.data?.message || error.message || 'Could not send',
      });
      results.push({ id: item.id, ok: false, label: item.label, error });
    }
  }

  return results;
}
