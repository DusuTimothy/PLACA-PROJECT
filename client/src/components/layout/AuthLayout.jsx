import { useTranslation } from 'react-i18next';
import LanguageSwitch from '../ui/LanguageSwitch';

/**
 * Simple, calm layout for sign-in and account recovery.
 * Large text, one column on phones, and the privacy promise in plain words.
 */
export default function AuthLayout({ children }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-placa-800 to-placa-900">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5 text-white">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-xl font-black text-placa-700"
          >
            P
          </span>
          <div>
            <p className="text-lg font-bold leading-tight">{t('common.appName')}</p>
            <p className="text-sm text-placa-100">{t('common.agency')}</p>
          </div>
        </div>
        <LanguageSwitch />
      </header>

      <main className="mx-auto w-full max-w-lg px-4 pb-12 pt-2 sm:pt-6">{children}</main>

      <footer className="mx-auto max-w-lg px-6 pb-8 text-center text-sm leading-relaxed text-placa-100">
        <p>{t('common.privacyFooter')}</p>
        <a href="/" className="mt-3 inline-block font-semibold text-white underline">
          {t('common.aboutSite')}
        </a>
      </footer>
    </div>
  );
}
