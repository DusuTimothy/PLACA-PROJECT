import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { refreshSession, setAccessToken } from '../services/api';
import i18n from '../i18n';

/**
 * Session state.
 *
 * On a hard refresh the access token is gone, so we try the httpOnly refresh
 * cookie once. Until that finishes, routes show a loading screen instead of
 * flashing the login page.
 */

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((data) => {
    setAccessToken(data.accessToken);
    setUser(data.user);
    if (data.user?.language) {
      i18n.changeLanguage(data.user.language);
      window.localStorage.setItem('placa_language', data.user.language);
    }
    return data;
  }, []);

  const clearSession = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    let active = true;

    refreshSession()
      .then((data) => {
        if (active) applySession(data);
      })
      .catch(() => {
        if (active) clearSession();
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const onExpired = () => clearSession();
    window.addEventListener('placa:session-expired', onExpired);

    return () => {
      active = false;
      window.removeEventListener('placa:session-expired', onExpired);
    };
  }, [applySession, clearSession]);

  const login = useCallback(
    async (credentials) => {
      const { data } = await api.post('/auth/login', credentials);
      if (data.totpSetupRequired) return data;
      return applySession(data);
    },
    [applySession]
  );

  const acceptInvitation = useCallback(
    async (payload) => {
      const { data } = await api.post('/auth/accept-invitation', payload);
      return applySession(data);
    },
    [applySession]
  );

  const changePassword = useCallback(
    async (payload) => {
      const { data } = await api.post('/auth/change-password', payload);
      return applySession(data);
    },
    [applySession]
  );

  const updateProfile = useCallback(
    async (payload) => {
      const { data } = await api.patch('/auth/me', payload);
      setUser(data.user);
      return data.user;
    },
    []
  );

  const refreshUser = useCallback(async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      clearSession();
    }
  }, [clearSession]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      logout,
      acceptInvitation,
      changePassword,
      updateProfile,
      refreshUser,
      applySession,
      clearSession,
    }),
    [
      user,
      loading,
      login,
      logout,
      acceptInvitation,
      changePassword,
      updateProfile,
      refreshUser,
      applySession,
      clearSession,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
