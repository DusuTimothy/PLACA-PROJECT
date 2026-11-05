import { useEffect } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import LanguageSwitch from '../ui/LanguageSwitch';
import SyncStatusBadge from '../ui/SyncStatusBadge';
import NotificationBell from './NotificationBell';
import OfflineBanner from './OfflineBanner';
import { canViewProgramme, isAdmin, isPlaca } from '../../utils/roles';

/**
 * Signed-in shell. The header stays small on phones; the sign-out button is
 * always reachable because shared tablets are common.
 *
 * Navigation only shows modules a role can actually use. Admins keep the
 * dashboard and account tools, never programme data.
 */
export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  // The shell owns the browser tab title so every programme page names itself.
  useEffect(() => {
    const segment = location.pathname.split('/')[1] || 'dashboard';
    const names = {
      dashboard: 'nav.dashboard',
      organizations: 'nav.organizations',
      workplans: 'nav.workplans',
      reports: 'nav.reports',
      'audit-logs': 'nav.auditLogs',
      help: 'nav.help',
      documents: 'nav.documents',
      support: 'nav.support',
      programmes: 'nav.programmes',
      funding: 'nav.funding',
      equipment: 'nav.equipment',
      notifications: 'nav.notifications',
      'guide-editor': 'nav.guideEditor',
      users: 'nav.users',
    };
    document.title = `${t(names[segment] || 'common.appName')} | ${t('common.appName')}`;
  }, [location.pathname, t]);

  async function handleSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  const items = [
    { to: '/dashboard', key: 'nav.dashboard' },
    ...(canViewProgramme(user?.role)
      ? [
          { to: '/organizations', key: 'nav.organizations' },
          { to: '/workplans', key: 'nav.workplans' },
          { to: '/reports', key: 'nav.reports' },
          { to: '/support', key: 'nav.support' },
          { to: '/programmes', key: 'nav.programmes' },
          { to: '/funding', key: 'nav.funding' },
          { to: '/equipment', key: 'nav.equipment' },
        ]
      : []),
    { to: '/help', key: 'nav.help' },
    { to: '/documents', key: 'nav.documents' },
    ...(isPlaca(user?.role) ? [{ to: '/guide-editor', key: 'nav.guideEditor' }] : []),
    ...(isPlaca(user?.role) || isAdmin(user?.role) ? [{ to: '/users', key: 'nav.users' }] : []),
    ...(isAdmin(user?.role) ? [{ to: '/audit-logs', key: 'nav.auditLogs' }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to="/dashboard" className="flex min-h-tap items-center gap-3 rounded-xl pr-2">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-placa-600 text-lg font-black text-white"
            >
              P
            </span>
            <span className="leading-tight">
              <span className="block text-base font-bold text-ink">{t('common.appName')}</span>
              <span className="block text-xs text-slate-600">{t('common.agency')}</span>
            </span>
          </Link>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <SyncStatusBadge />
            <NotificationBell />
            <LanguageSwitch compact />
            <button
              type="button"
              onClick={handleSignOut}
              className="min-h-tap rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {t('common.signOut')}
            </button>
          </div>
        </div>

        <nav aria-label={t('nav.main')} className="border-t border-slate-100">
          <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `whitespace-nowrap border-b-2 px-2 py-3 text-xs font-semibold transition sm:px-3 sm:text-sm ${
                    isActive
                      ? 'border-placa-600 text-placa-800'
                      : 'border-transparent text-slate-600 hover:text-placa-700'
                  }`
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <OfflineBanner />

      <div className="border-b border-slate-200 bg-white/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 text-sm">
          <span className="truncate font-medium text-slate-700">{user?.name}</span>
          <span className="truncate text-slate-500">
            {user?.role ? t(`roles.${user.role}`) : ''}
            {user?.organization?.name ? ` · ${user.organization.name}` : ''}
          </span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
