import api from './api';

/**
 * AI assistant endpoints.
 *
 * Conversation history is stored on the server. The browser sends only the new
 * message and the conversation id, never account or programme data.
 */

export async function listAssistantConversations(params = {}) {
  const { data } = await api.get('/assistant/conversations', { params });
  return data;
}

export async function getAssistantConversation(id) {
  const { data } = await api.get(`/assistant/conversations/${id}`);
  return data.data;
}

export async function deleteAssistantConversation(id) {
  const { data } = await api.delete(`/assistant/conversations/${id}`);
  return data;
}

export async function sendAssistantMessage(payload) {
  const { data } = await api.post('/assistant/chat', payload);
  return data.data;
}

/**
 * Anonymous landing-page chat. No session is required and the server stores
 * nothing. The caller may include a short recent transcript for follow-up
 * questions; the server bounds and sanitizes it.
 */
export async function sendPublicAssistantMessage(payload) {
  const { data } = await api.post('/public/assistant/chat', payload);
  return data.data;
}
