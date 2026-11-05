import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Plain-words connection badge.
 *
 * Phase 5 extends this with "Saved on this phone" and "Waiting for signal".
 * The wording is deliberately non-technical.
 */

export default function SyncStatusBadge() {
  const { t } = useTranslation();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${
        online
          ? 'border-green-300 bg-green-50 text-green-900'
          : 'border-amber-300 bg-amber-50 text-amber-900'
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-2.5 w-2.5 rounded-full ${online ? 'bg-green-600' : 'bg-amber-600'}`}
      />
      {online ? t('common.online') : t('common.offline')}
    </span>
  );
}
