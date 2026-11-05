import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';
import { useAuth } from './AuthContext';

/**
 * Language switch. The choice is saved on the device immediately and, when a
 * user is signed in, also saved on their account so it follows them to another
 * device.
 */

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { i18n } = useTranslation();
  const { user, updateProfile } = useAuth();
  const [language, setLanguage] = useState(i18n.language === 'ha' ? 'ha' : 'en');

  useEffect(() => {
    if (user?.language && user.language !== language) {
      setLanguage(user.language);
      i18n.changeLanguage(user.language);
    }
  }, [user?.language, i18n, language]);

  const changeLanguage = useCallback(
    async (nextLanguage) => {
      if (!['en', 'ha'].includes(nextLanguage)) return;
      setLanguage(nextLanguage);
      window.localStorage.setItem('placa_language', nextLanguage);
      await i18n.changeLanguage(nextLanguage);

      if (user) {
        try {
          await updateProfile({ language: nextLanguage });
        } catch {
          // The device keeps the choice even if saving to the account fails.
        }
      }
    },
    [i18n, user, updateProfile]
  );

  const value = useMemo(
    () => ({ language, changeLanguage, isHausa: language === 'ha' }),
    [language, changeLanguage]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
