import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { listAuditLogs } from '../services/adminApi';
import { errorMessage } from '../utils/errors';
import { formatDate } from '../utils/roles';

const EMPTY_FILTERS = { action: '', entity: '', from: '', to: '' };

/**
 * Read-only audit history for the system administrator.
 *
 * The API is the only reader, and the database trigger rejects UPDATE and
 * DELETE. This page therefore has no edit, delete or approve controls at all.
 */

function formatDateTime(value, language) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${formatDate(value, language)} ${hours}:${minutes}`;
}

function ValueBlock({ label, value, emptyLabel }) {
  const hasValue = value !== null && value !== undefined;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      {hasValue ? (
        <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-800">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <p className="mt-1 text-sm text-slate-500">{emptyLabel}</p>
      )}
    </div>
  );
}

function AuditEntry({ entry, language, t }) {
  const actor = entry.user_role ? t(`roles.${entry.user_role}`, { defaultValue: entry.user_role }) : t('auditLogs.system');
  const entityId = entry.entity_id ? ` · ${entry.entity_id}` : '';

  return (
    <li className="placa-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-xs font-bold text-slate-800">
              {entry.action}
            </span>
            <span className="text-base font-bold text-ink">
              {entry.entity}
              {entityId}
            </span>
          </p>
          <p className="mt-2 text-sm text-slate-600">
            {t('auditLogs.time')}: {formatDateTime(entry.created_at, language)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {t('auditLogs.actor')}: {actor}
            {entry.user_id ? ` · ${entry.user_id}` : ''}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {t('auditLogs.ip')}: {entry.ip || t('auditLogs.notRecorded')}
          </p>
        </div>
      </div>

      <details className="mt-3 border-t border-slate-200 pt-3">
        <summary className="cursor-pointer text-sm font-semibold text-placa-700">
          {t('auditLogs.details')}
        </summary>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <ValueBlock label={t('auditLogs.oldValue')} value={entry.old_value} emptyLabel={t('auditLogs.noValue')} />
          <ValueBlock label={t('auditLogs.newValue')} value={entry.new_value} emptyLabel={t('auditLogs.noValue')} />
        </div>
        {entry.request_id && (
          <p className="mt-3 text-xs text-slate-500">
            {t('auditLogs.requestId')}: <span className="font-mono">{entry.request_id}</span>
          </p>
        )}
      </details>
    </li>
  );
}

export default function AuditLogPage() {
  const { t, i18n } = useTranslation();

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [applied, setApplied] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listAuditLogs({
        page,
        limit: 20,
        ...(applied.action ? { action: applied.action } : {}),
        ...(applied.entity ? { entity: applied.entity } : {}),
        ...(applied.from ? { from: applied.from } : {}),
        ...(applied.to ? { to: applied.to } : {}),
      });
      setResult(data);
    } catch (loadError) {
      setError(errorMessage(loadError, t));
    } finally {
      setLoading(false);
    }
  }, [page, applied, t]);

  useEffect(() => {
    load();
  }, [load]);

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleApply(event) {
    event.preventDefault();
    setPage(1);
    setApplied(filters);
  }

  function handleClear() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  }

  const pagination = result.pagination;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t('auditLogs.title')}</h1>
          <p className="mt-1 max-w-3xl text-base leading-relaxed text-slate-600">{t('auditLogs.intro')}</p>
        </div>

        <Alert variant="info" title={t('auditLogs.readOnlyTitle')}>
          {t('auditLogs.readOnlyBody')}
        </Alert>

        {error && <Alert variant="error">{error}</Alert>}

        <form onSubmit={handleApply} className="placa-card space-y-4">
          <h2 className="text-lg font-bold text-ink">{t('auditLogs.filtersTitle')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label={t('auditLogs.action')}
              value={filters.action}
              onChange={(event) => updateFilter('action', event.target.value)}
              placeholder={t('auditLogs.actionPlaceholder')}
              hint={t('auditLogs.actionHint')}
            />
            <Input
              label={t('auditLogs.entity')}
              value={filters.entity}
              onChange={(event) => updateFilter('entity', event.target.value)}
              placeholder={t('auditLogs.entityPlaceholder')}
              hint={t('auditLogs.entityHint')}
            />
            <Input
              label={t('auditLogs.from')}
              type="date"
              value={filters.from}
              onChange={(event) => updateFilter('from', event.target.value)}
            />
            <Input
              label={t('auditLogs.to')}
              type="date"
              value={filters.to}
              onChange={(event) => updateFilter('to', event.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">{t('auditLogs.apply')}</Button>
            <Button type="button" variant="secondary" onClick={handleClear}>
              {t('auditLogs.clear')}
            </Button>
          </div>
        </form>

        {loading ? (
          <p className="text-base text-slate-600">{t('common.loading')}</p>
        ) : result.data.length === 0 ? (
          <div className="placa-card">
            <p className="text-base text-slate-700">{t('auditLogs.empty')}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              {t('auditLogs.count', { count: pagination?.total ?? result.data.length })}
            </p>
            <ul className="space-y-3">
              {result.data.map((entry) => (
                <AuditEntry key={entry.id} entry={entry} language={i18n.language} t={t} />
              ))}
            </ul>
          </>
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
