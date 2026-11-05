import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { listWorkplans } from '../services/programmeApi';
import { errorMessage } from '../utils/errors';
import { canAuthor, formatDate } from '../utils/roles';

export default function WorkplansPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const author = canAuthor(user?.role);

  const [filters, setFilters] = useState({ year: '', quarter: '', status: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listWorkplans({
        page,
        limit: 20,
        ...(filters.year ? { year: filters.year } : {}),
        ...(filters.quarter ? { quarter: filters.quarter } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      });
      setResult(data);
    } catch (loadError) {
      setError(errorMessage(loadError, t));
    } finally {
      setLoading(false);
    }
  }, [page, filters.year, filters.quarter, filters.status, t]);

  useEffect(() => {
    load();
  }, [load]);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const pagination = result.pagination;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t('workplans.title')}</h1>
            <p className="mt-1 max-w-2xl text-base leading-relaxed text-slate-600">
              {t('workplans.intro')}
            </p>
          </div>
          {author && (
            <Link
              to="/workplans/new"
              className="inline-flex min-h-tap items-center justify-center rounded-xl bg-placa-600 px-5 py-3 text-base font-semibold text-white hover:bg-placa-700"
            >
              {t('workplans.add')}
            </Link>
          )}
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex flex-wrap items-end gap-3">
          <Input
            label={t('workplans.year')}
            type="number"
            min="2000"
            max="2100"
            value={filters.year}
            onChange={(event) => updateFilter('year', event.target.value)}
            className="w-full sm:w-28"
          />
          <Select
            label={t('workplans.quarter')}
            value={filters.quarter}
            onChange={(event) => updateFilter('quarter', event.target.value)}
            className="w-full sm:w-40"
          >
            <option value="">{t('workplans.allQuarters')}</option>
            {[1, 2, 3, 4].map((quarter) => (
              <option key={quarter} value={String(quarter)}>
                {t('periods.quarter', { number: quarter })}
              </option>
            ))}
          </Select>
          <Select
            label={t('workplans.statusFilter')}
            value={filters.status}
            onChange={(event) => updateFilter('status', event.target.value)}
            className="w-full sm:w-44"
          >
            <option value="">{t('workplans.allStatuses')}</option>
            {['draft', 'submitted', 'approved', 'returned'].map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <p className="text-base text-slate-600">{t('common.loading')}</p>
        ) : result.data.length === 0 ? (
          <div className="placa-card">
            <p className="text-base text-slate-700">{t('workplans.empty')}</p>
            {author && (
              <p className="mt-2 text-sm text-slate-600">{t('workplans.emptyPartnerHint')}</p>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {result.data.map((workplan) => (
              <li key={workplan.id}>
                <Link
                  to={`/workplans/${workplan.id}`}
                  className="placa-card block transition hover:border-placa-300 hover:shadow"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-ink">
                        {workplan.organization?.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {t('periods.quarter', { number: workplan.quarter })} {workplan.year}
                        {workplan.organization?.lga?.name
                          ? ` · ${workplan.organization.lga.name}`
                          : ''}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {t('workplans.targetsCount', { count: workplan.targets.length })}
                        {workplan.updated_at
                          ? ` · ${t('workplans.updated', {
                              date: formatDate(workplan.updated_at, i18n.language),
                            })}`
                          : ''}
                      </p>
                    </div>
                    <StatusBadge status={workplan.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600">
              {t('common.pageOf', { page: pagination.page, total: pagination.totalPages })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                disabled={pagination.page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                {t('common.previous')}
              </Button>
              <Button
                variant="secondary"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                {t('common.next')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
