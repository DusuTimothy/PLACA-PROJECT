import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { unreadNotifications } from '../../services/phase5Api';

/**
 * Small bell with an unread count. It refreshes when the route changes and
 * whenever the browser comes back online, which is enough for a field app
 * without a live socket.
 */
export default function NotificationBell() {
  const { t } = useTranslation();
  const location = useLocation();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const load = () => {
      unreadNotifications().then((value) => {
        if (active) setUnread(value);
      });
    };
    load();
    window.addEventListener('online', load);
    window.addEventListener('focus', load);
    return () => {
      active = false;
      window.removeEventListener('online', load);
      window.removeEventListener('focus', load);
    };
  }, [location.pathname]);

  return (
    <Link
      to="/notifications"
      aria-label={
        unread > 0
          ? t('phase5.notifications.bellUnread', { count: unread })
          : t('phase5.notifications.bell')
      }
      className="relative inline-flex min-h-tap items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-slate-700 hover:bg-slate-50"
    >
      <span aria-hidden="true" className="text-lg">
        🔔
      </span>
      {unread > 0 && (
        <span className="ml-1 rounded-full bg-red-700 px-1.5 py-0.5 text-xs font-bold text-white">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
