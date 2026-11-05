import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ha from './locales/ha.json';

const stored = window.localStorage.getItem('placa_language');

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ha: { translation: ha },
  },
  lng: stored === 'ha' ? 'ha' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
