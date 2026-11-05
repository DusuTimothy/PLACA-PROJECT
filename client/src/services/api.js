import axios from 'axios';

/**
 * API client.
 *
 * The access token lives in memory only (never localStorage), which reduces the
 * damage from a script injection. The refresh token is an httpOnly cookie, so
 * JavaScript cannot read it either. On a 401 we refresh once and replay the
 * original request; concurrent 401s share one refresh call.
 */

const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20000,
});

let accessToken = null;
let refreshPromise = null;

export function setAccessToken(token) {
  accessToken = token || null;
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

export async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${baseURL}/auth/refresh`, {}, { withCredentials: true, timeout: 20000 })
      .then((response) => {
        setAccessToken(response.data.accessToken);
        return response.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthCall = original?.url?.includes('/auth/');

    if (status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      try {
        const session = await refreshSession();
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${session.accessToken}`;
        return api(original);
      } catch (refreshError) {
        setAccessToken(null);
        window.dispatchEvent(new Event('placa:session-expired'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
