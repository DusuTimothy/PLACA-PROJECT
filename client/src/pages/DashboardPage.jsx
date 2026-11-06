import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Select from '../components/ui/Select';
import { IndicatorBarChart, TrendChart } from '../components/charts/ResultsCharts';
import { useAuth } from '../context/AuthContext';
import { getDashboardOverview } from '../services/programmeApi';
import { errorMessage } from '../utils/errors';
import {
  canViewProgramme,
  formatDate,
  publishedPeriodLabel,
} from '../utils/roles';

function Detail({ label, value }) {
  if (!value) return null;
  return (
    <div className="border-t border-slate-100 py-3 first:border-t-0 first:pt-0">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold text-ink">{value}</dd>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}

function Overview({ overview, loading, error, period, setPeriod }) {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'ha' ? 'ha' : 'en';

  const indicatorName = useMemo(() => {
    const map = new Map((overview?.indicators || []).map((item) => [item.code, item.name]));
    return (code) => map.get(code) || code;
  }, [overview]);

  const stateRows = useMemo(
    () =>
      (overview?.state_rows || []).map((row) => ({
        ...row,
        indicator_name: indicatorName(row.indicator_code),
      })),
    [overview, indicatorName]
  );

  const localRows = useMemo(
    () =>
      (overview?.local_rows || []).map((row) => ({
        ...row,
        indicator_name: indicatorName(row.indicator_code),
      })),
    [overview, indicatorName]
  );

  const trendPeriods = useMemo(() => {
    const withData = new Set((overview?.trend || []).map((row) => row.period));
    return (overview?.periods || [])
      .filter((item) => withData.has(item))
      .slice(0, 8)
      .reverse();
  }, [overview]);

  const counts = overview?.pipeline?.counts || {};
  const published = counts.validated + counts.aggregated;

  return (
    <section className="space-y-5" aria-labelledby="results-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="results-heading" className="text-xl font-bold text-ink">
            {t('dashboard.resultsTitle')}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            {t('dashboard.resultsIntro')}
          </p>
        </div>

        {overview?.periods?.length > 0 && (
          <Select
            label={t('dashboard.period')}
            value={period || overview.period || ''}
            onChange={(event) => setPeriod(event.target.value)}
            className="w-full max-w-xs"
          >
            {overview.periods.map((item) => (
              <option key={item} value={item}>
                {publishedPeriodLabel(item, language)}
              </option>
            ))}
          </Select>
        )}
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading && !overview && <p className="text-sm text-slate-600">{t('common.loading')}</p>}

      {overview?.pipeline?.has_synthetic_data && (
        <Alert variant="warning" title={t('dashboard.demoDataTitle')}>
          {t('dashboard.demoDataNote')}
        </Alert>
      )}

      {!loading && overview && !overview.period && (
        <Alert variant="info" title={t('dashboard.noResults')}>
          {t('dashboard.noResultsHint')}
        </Alert>
      )}

      {overview?.period && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t('dashboard.statReports')} value={overview.pipeline.total} />
            <Stat
              label={t('dashboard.statWaiting')}
              value={counts.submitted || 0}
              hint={t('dashboard.statWaitingHint')}
            />
            <Stat label={t('dashboard.statPublished')} value={published} />
            {overview.coverage ? (
              <Stat
                label={t('dashboard.statCovered')}
                value={`${overview.coverage.covered}/${overview.coverage.total}`}
                hint={t('dashboard.statCoveredHint')}
              />
            ) : (
              <Stat
                label={t('dashboard.statLocal')}
                value={localRows.length}
                hint={t('dashboard.statLocalHint')}
              />
            )}
          </div>

          {stateRows.length > 0 ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <figure className="placa-card">
                <figcaption className="text-base font-bold text-ink">
                  {t('dashboard.barTitle')}
                </figcaption>
                <p className="mt-1 text-sm text-slate-600">{t('dashboard.barIntro')}</p>
                <IndicatorBarChart rows={stateRows} t={t} />
                <ul className="mt-2 space-y-1 text-sm text-slate-700">
                  {stateRows.map((row) => (
                    <li key={row.indicator_code} className="flex justify-between gap-3">
                      <span className="truncate">{row.indicator_name}</span>
                      <span className="font-semibold tabular-nums">{row.value}</span>
                    </li>
                  ))}
                </ul>
              </figure>

              <figure className="placa-card">
                <figcaption className="text-base font-bold text-ink">
                  {t('dashboard.trendTitle')}
                </figcaption>
                <p className="mt-1 text-sm text-slate-600">{t('dashboard.trendIntro')}</p>
                <TrendChart
                  periods={trendPeriods}
                  indicators={overview.indicators}
                  trend={overview.trend}
                  t={t}
                />
              </figure>
            </div>
          ) : (
            <Alert variant="info">{t('dashboard.noPublished')}</Alert>
          )}

          {stateRows.length > 0 && (
            <p className="text-sm leading-relaxed text-slate-600">{t('dashboard.reportedNote')}</p>
          )}

          {overview.coverage && (
            <div className="placa-card">
              <h3 className="text-base font-bold text-ink">{t('dashboard.coverageTitle')}</h3>
              <p className="mt-1 text-sm text-slate-600">{t('dashboard.coverageIntro')}</p>
              {overview.coverage.missing.length > 0 ? (
                <>
                  <p className="mt-3 text-sm font-semibold text-amber-900">
                    {t('dashboard.coverageMissing', {
                      count: overview.coverage.missing.length,
                    })}
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {overview.coverage.missing.map((lga) => (
                      <li
                        key={lga.id}
                        className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900"
                      >
                        {lga.name}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-3 text-sm font-semibold text-green-800">
                  {t('dashboard.coverageComplete')}
                </p>
              )}
            </div>
          )}

          {localRows.length > 0 && (
            <div className="placa-card overflow-x-auto">
              <h3 className="text-base font-bold text-ink">
                {overview.scope === 'state' ? t('dashboard.lgaTitle') : t('dashboard.localTitle')}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {overview.scope === 'state' ? t('dashboard.lgaIntro') : t('dashboard.localIntro')}
              </p>
              <table className="mt-4 w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    {overview.scope === 'state' && <th className="py-2 pr-3">{t('dashboard.lgaColumn')}</th>}
                    <th className="py-2 pr-3">{t('dashboard.indicatorColumn')}</th>
                    <th className="py-2 text-right">{t('dashboard.valueColumn')}</th>
                  </tr>
                </thead>
                <tbody>
                  {localRows.map((row) => (
                    <tr
                      key={`${row.lga_id}-${row.indicator_code}`}
                      className="border-b border-slate-100 last:border-0"
                    >
                      {overview.scope === 'state' && (
                        <td className="py-2 pr-3 font-medium text-slate-700">{row.lga_name}</td>
                      )}
                      <td className="py-2 pr-3 text-slate-700">{row.indicator_name}</td>
                      <td className="py-2 text-right font-semibold tabular-nums text-ink">
                        {row.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-xs text-slate-500">
            {overview.generated_at
              ? t('dashboard.generatedAt', { date: formatDate(overview.generated_at, language) })
              : t('dashboard.notPublishedYet')}
          </p>
        </>
      )}
    </section>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const programme = canViewProgramme(user?.role);

  const [overview, setOverview] = useState(null);
  const [period, setPeriod] = useState('');
  const [loading, setLoading] = useState(programme);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!programme) return undefined;
    let cancelled = false;
    setLoading(true);

    getDashboardOverview(period ? { period } : {})
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setError('');
        if (!period && data.period) setPeriod(data.period);
      })
      .catch((requestError) => {
        if (!cancelled) setError(errorMessage(requestError, t));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [programme, period, t]);

  const readyItems = [
    t('dashboard.readyAccount'),
    t('dashboard.readyRoles'),
    t('dashboard.readyLanguage'),
    t('dashboard.readyAudit'),
    ...(programme ? [t('dashboard.readyProgramme')] : []),
  ];

  const modules = programme
    ? [
        {
          to: '/organizations',
          title: t('nav.organizations'),
          description: t(
            user?.role === 'partner_staff' ? 'dashboard.orgsCardPartner' : 'dashboard.orgsCard'
          ),
        },
        {
          to: '/workplans',
          title: t('nav.workplans'),
          description: t('dashboard.workplansCard'),
        },
        {
          to: '/reports',
          title: t('nav.reports'),
          description: t('dashboard.reportsCard'),
        },
      ]
    : [];

  return (
    <AppShell>
      <div className="space-y-7">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            {t('dashboard.welcome', { name: user?.name || '' })}
          </h1>
          <p className="mt-1 text-base text-slate-600">{t('common.agency')}</p>
        </div>

        {programme && (
          <Overview
            overview={overview}
            loading={loading}
            error={error}
            period={period}
            setPeriod={setPeriod}
          />
        )}

        {modules.length > 0 && (
          <section aria-labelledby="modules-heading">
            <h2 id="modules-heading" className="text-lg font-bold text-ink">
              {t('dashboard.modulesTitle')}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {t('dashboard.modulesIntro')}
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              {modules.map((module) => (
                <Link
                  key={module.to}
                  to={module.to}
                  className="placa-card block transition hover:border-placa-300 hover:shadow"
                >
                  <h3 className="text-base font-bold text-placa-800">{module.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">
                    {module.description}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <section className="placa-card" aria-labelledby="account-heading">
            <h2 id="account-heading" className="text-lg font-bold text-ink">
              {t('dashboard.accountTitle')}
            </h2>
            <dl className="mt-4">
              <Detail
                label={t('dashboard.role')}
                value={user?.role ? t(`roles.${user.role}`) : null}
              />
              <Detail label={t('dashboard.organization')} value={user?.organization?.name} />
              <Detail label={t('dashboard.lga')} value={user?.lga?.name} />
              <Detail label={t('dashboard.email')} value={user?.email} />
              <Detail label={t('dashboard.phone')} value={user?.phone} />
            </dl>
          </section>

          <section className="placa-card" aria-labelledby="status-heading">
            <h2 id="status-heading" className="text-lg font-bold text-ink">
              {t('dashboard.statusTitle')}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {t('dashboard.statusIntro')}
            </p>
            <ul className="mt-4 space-y-3">
              {readyItems.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-placa-100 text-xs font-black text-placa-700"
                  >
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section className="rounded-2xl border border-placa-200 bg-placa-50 p-5 sm:p-6">
          <h2 className="text-base font-bold text-placa-900">{t('common.countsOnlyTitle')}</h2>
          <p className="mt-1 text-sm leading-relaxed text-placa-900">
            {t('common.countsOnlyBody')}
          </p>
        </section>

        <p className="text-sm text-slate-600">{t('dashboard.helpNote')}</p>
      </div>
    </AppShell>
  );
}
