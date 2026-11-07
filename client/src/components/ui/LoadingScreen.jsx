import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Full-page loading state used while the session is being restored.
 *
 * A bare spinner on an empty background looks like a broken blank page on a
 * slow connection. This keeps the brand visible, explains what is happening and
 * adds a calm note (and a manual reload) when the wait gets long.
 */
export default function LoadingScreen({ label }) {
  const { t } = useTranslation();
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div
        role="status"
        aria-live="polite"
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm"
      >
        <span
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-placa-600 text-2xl font-black text-white"
        >
          P
        </span>

        <span
          aria-hidden="true"
          className="mx-auto mt-5 block h-9 w-9 animate-spin rounded-full border-4 border-placa-200 border-t-placa-600"
        />

        <p className="mt-4 text-base font-semibold text-ink">
          {label || t('common.loading')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {slow ? t('common.loadingSlow') : t('common.loadingHint')}
        </p>

        {slow && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex min-h-tap items-center justify-center rounded-xl border-2 border-placa-600 bg-white px-4 py-2 text-sm font-semibold text-placa-700 transition hover:bg-placa-50 focus-visible:ring-4 focus-visible:ring-placa-300"
          >
            {t('common.reloadPage')}
          </button>
        )}
      </div>
    </div>
  );
}
