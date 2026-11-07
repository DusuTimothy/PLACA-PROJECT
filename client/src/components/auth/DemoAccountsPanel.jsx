import { useTranslation } from 'react-i18next';
import { demoAccounts } from '../../config/demoAccounts';

/**
 * Credentials panel for review/pitch builds.
 *
 * Rendered only when VITE_DEMO_MODE is enabled. Every row shows the shared
 * demo login and can sign in with one click, so testers never have to ask for
 * details during a presentation.
 */
export default function DemoAccountsPanel({ onSignIn, busy = false }) {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="demo-accounts-heading"
      className="mt-6 rounded-2xl border border-placa-200 bg-white p-5 shadow-sm"
    >
      <h2 id="demo-accounts-heading" className="text-lg font-bold text-ink">
        {t('auth.demoHeading')}
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{t('auth.demoIntro')}</p>

      <ul className="mt-4 space-y-3">
        {demoAccounts.map((account) => (
          <li
            key={account.email}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">
                {t(`roles.${account.role}`)}
                <span className="font-normal text-slate-600"> · {account.name}</span>
              </p>
              <p className="mt-0.5 break-all font-mono text-xs text-slate-700">{account.email}</p>
              <p className="font-mono text-xs text-slate-500">{account.password}</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSignIn(account)}
              className="shrink-0 rounded-xl border-2 border-placa-600 bg-white px-4 py-2 text-sm font-semibold text-placa-700 transition hover:bg-placa-50 focus-visible:ring-4 focus-visible:ring-placa-300 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
            >
              {t('auth.demoSignIn')}
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
        {t('auth.demoWarning')}
      </p>
    </section>
  );
}
