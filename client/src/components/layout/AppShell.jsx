import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import LanguageSwitch from '../ui/LanguageSwitch';
import SyncStatusBadge from '../ui/SyncStatusBadge';
import NotificationBell from './NotificationBell';
import OfflineBanner from './OfflineBanner';
import { canViewProgramme, isAdmin, isPlaca } from '../../utils/roles';

function Brand({ compact = false, mobile = false }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/dashboard"
      className={`flex min-h-tap items-center gap-3 rounded-xl ${compact ? 'justify-center' : ''}`}
      aria-label={t('common.appName')}
    >
      <span
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-xl bg-placa-600 font-black text-white ${
          compact ? 'h-8 w-8 text-base' : 'h-10 w-10 text-lg'
        }`}
      >
        P
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="block text-base font-bold text-ink">{t('common.appName')}</span>
          <span className={`block text-xs text-slate-600 ${mobile ? 'hidden xl:block' : ''}`}>
            {t('common.agency')}
          </span>
        </span>
      )}
    </Link>
  );
}

function NavIcon({ name }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    assistant: <><path d="M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l-2 2v-6a7.5 7.5 0 1 1 17-3.5Z" /><path d="M8 11h8M8 14h5" /></>,
    organizations: <><path d="M3 21h18M5 21V7l7-4 7 4v14M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 21v-4h4v4" /></>,
    workplans: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
    reports: <><path d="M4 20V4M4 20h17" /><path d="m7 15 4-4 3 2 5-6" /></>,
    support: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.7 1.2c-.8 1.2-2.2 1.3-2.2 3M12 17h.01" /></>,
    programmes: <><path d="M4 19V5M4 19h16" /><path d="M8 15V9M12 15V6M16 15v-4" /></>,
    funding: <><circle cx="12" cy="12" r="9" /><path d="M15 8.5c-.6-.7-1.6-1-3-1-1.7 0-2.8.8-2.8 2s1 1.8 2.8 2 2.8.8 2.8 2-1.1 2-2.8 2c-1.3 0-2.4-.4-3-1.2M12 6v12" /></>,
    equipment: <><path d="M14.5 6.5 17.5 9.5M4 20l5.5-1.2L20 8.3 15.7 4 5.2 14.5 4 20Z" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 4.7 1.2c-.8 1.2-2.2 1.3-2.2 3M12 17h.01" /></>,
    documents: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></>,
    guideEditor: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5v-13A2.5 2.5 0 0 1 6.5 3Z" /><path d="M8 7h8M8 11h6" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 8v6M23 11h-6" /></>,
    auditLogs: <><path d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5" /></>,
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      {paths[name] || paths.dashboard}
    </svg>
  );
}

function Navigation({ items, collapsed, onNavigate }) {
  const { t } = useTranslation();
  return (
    <nav aria-label={t('nav.main')} className="flex-1 overflow-y-auto px-3 py-5">
      {!collapsed && (
        <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-slate-400">
          {t('nav.main')}
        </p>
      )}
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              onClick={onNavigate}
              title={collapsed ? t(item.key) : undefined}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive
                    ? 'bg-placa-50 text-placa-800 ring-1 ring-inset ring-placa-100'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
                }`
              }
              end={item.to === '/dashboard'}
            >
              <NavIcon name={item.icon} />
              <span className={collapsed ? 'sr-only' : 'truncate'}>{t(item.key)}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Sidebar({ items, collapsed, mobile = false, onNavigate, onToggle, onSignOut, user }) {
  const { t } = useTranslation();
  return (
    <aside
      className={`flex h-full flex-col border-r border-slate-200 bg-white ${
        mobile ? 'w-[min(19rem,88vw)] shadow-2xl' : collapsed ? 'w-[5.25rem]' : 'w-64'
      } transition-[width] duration-200`}
    >
      <div className={`flex min-h-[5rem] items-center border-b border-slate-100 ${
        collapsed && !mobile ? 'justify-center gap-1 px-1' : 'justify-between px-4'
      }`}>
        <Brand compact={collapsed && !mobile} />
        {mobile ? (
          <button
            type="button"
            onClick={onNavigate}
            aria-label={t('sidebar.closeMenu')}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-xl text-slate-600 hover:bg-slate-100"
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            title={collapsed ? t('sidebar.expand') : t('sidebar.collapse')}
            className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:flex"
          >
            <span aria-hidden="true">{collapsed ? '›' : '‹'}</span>
          </button>
        )}
      </div>
      <Navigation items={items} collapsed={collapsed && !mobile} onNavigate={onNavigate} />
      <div className={`border-t border-slate-100 p-3 ${collapsed && !mobile ? 'text-center' : ''}`}>
        {(!collapsed || mobile) && (
          <div className="mb-3 px-2">
            <p className="truncate text-sm font-semibold text-slate-800">{user?.name}</p>
            <p className="truncate text-xs text-slate-500">
              {user?.role ? t(`roles.${user.role}`) : ''}
              {user?.organization?.name ? ` · ${user.organization.name}` : ''}
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={onSignOut}
          title={collapsed && !mobile ? t('common.signOut') : undefined}
          className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700 ${
            collapsed && !mobile ? 'justify-center' : ''
          }`}
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
            <path d="M10 17l5-5-5-5M15 12H3M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
          </svg>
          <span className={collapsed && !mobile ? 'sr-only' : ''}>{t('common.signOut')}</span>
        </button>
      </div>
    </aside>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);

  useEffect(() => {
    const segment = location.pathname.split('/')[1] || 'dashboard';
    const names = {
      dashboard: 'nav.dashboard',
      assistant: 'nav.assistant',
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

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        menuButtonRef.current?.focus();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileMenuOpen]);

  async function handleSignOut() {
    await logout();
    navigate('/login', { replace: true });
  }

  const items = [
    { to: '/dashboard', key: 'nav.dashboard', icon: 'dashboard' },
    { to: '/assistant', key: 'nav.assistant', icon: 'assistant' },
    ...(canViewProgramme(user?.role)
      ? [
          { to: '/organizations', key: 'nav.organizations', icon: 'organizations' },
          { to: '/workplans', key: 'nav.workplans', icon: 'workplans' },
          { to: '/reports', key: 'nav.reports', icon: 'reports' },
          { to: '/support', key: 'nav.support', icon: 'support' },
          { to: '/programmes', key: 'nav.programmes', icon: 'programmes' },
          { to: '/funding', key: 'nav.funding', icon: 'funding' },
          { to: '/equipment', key: 'nav.equipment', icon: 'equipment' },
        ]
      : []),
    { to: '/help', key: 'nav.help', icon: 'help' },
    { to: '/documents', key: 'nav.documents', icon: 'documents' },
    ...(isPlaca(user?.role) ? [{ to: '/guide-editor', key: 'nav.guideEditor', icon: 'guideEditor' }] : []),
    ...(isPlaca(user?.role) || isAdmin(user?.role) ? [{ to: '/users', key: 'nav.users', icon: 'users' }] : []),
    ...(isAdmin(user?.role) ? [{ to: '/audit-logs', key: 'nav.auditLogs', icon: 'auditLogs' }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <div className="hidden shrink-0 lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar
            items={items}
            collapsed={collapsed}
            onToggle={() => setCollapsed((value) => !value)}
            onSignOut={handleSignOut}
            user={user}
          />
        </div>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-[70] flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label={t('nav.main')}
        >
          <button
            type="button"
            aria-label={t('sidebar.closeMenu')}
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-slate-950/40"
          />
          <div className="relative h-full">
            <Sidebar
              items={items}
              collapsed={false}
              mobile
              onNavigate={() => setMobileMenuOpen(false)}
              onSignOut={handleSignOut}
              user={user}
            />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="flex min-h-[4.5rem] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label={t('sidebar.openMenu')}
              aria-expanded={mobileMenuOpen}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 lg:hidden"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="min-w-0 flex-1 lg:hidden"><Brand mobile /></div>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden sm:inline-flex"><SyncStatusBadge /></span>
              <NotificationBell />
              <LanguageSwitch compact />
            </div>
          </div>
        </header>

        <OfflineBanner />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
