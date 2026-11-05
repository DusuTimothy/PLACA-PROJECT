import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline, useOutbox } from '../../services/offline';
import { flushOutbox } from '../../services/phase5Api';

/**
 * A plain-language strip for work that is waiting on this phone.
 *
 * It is hidden when there is signal and nothing is queued, so it never becomes
 * background noise for an office user.
 */
export default function OfflineBanner() {
  const { t } = useTranslation();
  const online = useOnline();
  const items = useOutbox();
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSync() {
    setSyncing(true);
    setMessage('');
    try {
      const results = await flushOutbox();
      const failed = results.filter((item) => !item.ok && !item.offline);
      if (results.some((item) => item.offline)) {
        setMessage(t('phase5.offline.stillOffline'));
      } else if (failed.length > 0) {
        setMessage(t('phase5.offline.someFailed', { count: failed.length }));
      } else {
        setMessage(t('phase5.offline.allSent'));
      }
    } finally {
      setSyncing(false);
    }
  }

  if (online && items.length === 0 && !message) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2 text-sm text-amber-950">
        <span className="font-semibold">
          {online ? t('phase5.offline.waitingTitle') : t('phase5.offline.offlineTitle')}
        </span>
        <span>
          {items.length > 0
            ? t('phase5.offline.queued', { count: items.length })
            : t('phase5.offline.savedHere')}
        </span>
        {online && items.length > 0 && (
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="ml-auto rounded-lg border border-amber-400 bg-white px-3 py-1 font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
          >
            {syncing ? t('phase5.offline.sending') : t('phase5.offline.sendNow')}
          </button>
        )}
        {message && <span className="basis-full text-xs font-medium">{message}</span>}
      </div>
    </div>
  );
}
