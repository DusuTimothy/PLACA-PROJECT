import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/phase5Api';
import { errorMessage } from '../utils/errors';
import { formatDate } from '../utils/roles';

export default function NotificationsPage() {
  const { t, i18n } = useTranslation();
  const [result, setResult] = useState({ data: [], unread: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fromCache, setFromCache] = useState(false);
  const [busy, setBusy] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await listNotifications({ limit: 50 });
      setResult(data || { data: [], unread: 0 });
      setFromCache(Boolean(data?.from_cache));
    } catch (loadError) {
      setError(errorMessage(loadError, t));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function readOne(notification) {
    setBusy(notification.id);
    setError('');
    try {
      await markNotificationRead(notification.id);
      setResult((current) => ({
        ...current,
        unread: Math.max(0, current.unread - (notification.read_at ? 0 : 1)),
        data: current.data.map((row) =>
          row.id === notification.id ? { ...row, read_at: new Date().toISOString() } : row
        ),
      }));
    } catch (readError) {
      setError(errorMessage(readError, t));
    } finally {
      setBusy('');
    }
  }

  async function readAll() {
    setBusy('all');
    setError('');
    try {
      await markAllNotificationsRead();
      setResult((current) => ({
        ...current,
        unread: 0,
        data: current.data.map((row) => ({
          ...row,
          read_at: row.read_at || new Date().toISOString(),
        })),
      }));
      setNotice(t('phase5.notifications.allRead'));
    } catch (readError) {
      setError(errorMessage(readError, t));
    } finally {
      setBusy('');
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('phase5.notifications.title')}
          intro={t('phase5.notifications.intro')}
          actions={
            result.unread > 0 ? (
              <Button variant="secondary" loading={busy === 'all'} onClick={readAll}>
                {t('phase5.notifications.markAll')}
              </Button>
            ) : null
          }
        />

        {fromCache && <Alert variant="warning">{t('phase5.offline.showingSaved')}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        {loading ? (
          <p className="text-base text-slate-600">{t('common.loading')}</p>
        ) : result.data.length === 0 ? (
          <div className="placa-card">
            <p className="text-base text-slate-700">{t('phase5.notifications.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {result.data.map((notification) => (
              <li
                key={notification.id}
                className={`placa-card ${
                  notification.read_at ? 'opacity-80' : 'border-l-4 border-l-placa-600'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-ink">{notification.title}</h2>
                    <p className="mt-1 text-sm leading-relaxed text-slate-700">{notification.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(notification.created_at, i18n.language)}
                      {notification.read_at ? ` · ${t('phase5.notifications.read')}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {notification.link && (
                      <Link
                        to={notification.link}
                        className="inline-flex min-h-tap items-center rounded-xl border-2 border-placa-600 bg-white px-3 py-2 text-sm font-semibold text-placa-700 hover:bg-placa-50"
                      >
                        {t('phase5.notifications.open')}
                      </Link>
                    )}
                    {!notification.read_at && (
                      <Button
                        variant="ghost"
                        loading={busy === notification.id}
                        onClick={() => readOne(notification)}
                      >
                        {t('phase5.notifications.markRead')}
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
