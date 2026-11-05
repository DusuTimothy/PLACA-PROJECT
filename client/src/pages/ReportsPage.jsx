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
import { listReports, downloadReportsCsv, downloadReportsPdf } from '../services/programmeApi';
import { deleteDraft, listDrafts, removeOutbox } from '../services/offlineDb';
import { useOutbox } from '../services/offline';
import { flushOutbox } from '../services/phase5Api';
import { errorMessage } from '../utils/errors';
import { canAuthor, formatDate, periodLabel } from '../utils/roles';

export default function ReportsPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const author = canAuthor(user?.role);

  const [filters, setFilters] = useState({ status: '', period_type: '', period_year: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], pagination: null });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const outbox = useOutbox();

  const refreshDrafts = useCallback(() => {
    listDrafts('report:').then((rows) => setDrafts(rows));
  }, []);

  useEffect(() => {
    refreshDrafts();
  }, [refreshDrafts, outbox.length]);

  async function handleSync() {
    setSyncing(true);
    setSyncMessage('');
    try {
      const results = await flushOutbox();
      const offline = results.some((item) => item.offline);
      const failed = results.filter((item) => !item.ok && !item.offline).length;
      if (offline) {
        setSyncMessage(t('phase5.offline.stillOffline'));
      } else if (failed > 0) {
        setSyncMessage(t('phase5.offline.someFailed', { count: failed }));
      } else {
        setSyncMessage(t('phase5.offline.allSent'));
        // A newly created report now has a server row, so its local draft is
        // no longer needed.
        for (const row of await listDrafts('report:new:')) {
          await deleteDraft(row.key);
        }
      }
      refreshDrafts();
    } finally {
      setSyncing(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listReports({
        page,
        limit: 20,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.period_type ? { period_type: filters.period_type } : {}),
        ...(filters.period_year ? { period_year: filters.period_year } : {}),
      });
      setResult(data);
    } catch (loadError) {
      setError(errorMessage(loadError, t));
    } finally {
      setLoading(false);
    }
  }, [page, filters.status, filters.period_type, filters.period_year, t]);

  useEffect(() => {
    load();
  }, [load]);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function exportFilters() {
    return {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.period_type ? { period_type: filters.period_type } : {}),
      ...(filters.period_year ? { period_year: filters.period_year } : {}),
    };
  }

  function saveBlob(blob, extension) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `placa-reports-${new Date().toISOString().slice(0, 10)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function handleExport() {
    setExporting(true);
    setError('');
    try {
      saveBlob(await downloadReportsCsv(exportFilters()), 'csv');
    } catch (exportError) {
      setError(errorMessage(exportError, t));
    } finally {
      setExporting(false);
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    setError('');
    try {
      saveBlob(await downloadReportsPdf(exportFilters()), 'pdf');
    } catch (exportError) {
      setError(errorMessage(exportError, t));
    } finally {
      setExportingPdf(false);
    }
  }

  async function discardLocalDraft(key) {
    await deleteDraft(key);
    refreshDrafts();
  }

  async function discardOutboxItem(item) {
    await removeOutbox(item.id);
  }

  const pagination = result.pagination;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t('reports.title')}</h1>
            <p className="mt-1 max-w-2xl text-base leading-relaxed text-slate-600">
              {t('reports.intro')}
            </p>
          </div>
          {author && (
            <Link
              to="/reports/new"
              className="inline-flex min-h-tap items-center justify-center rounded-xl bg-placa-600 px-5 py-3 text-base font-semibold text-white hover:bg-placa-700"
            >
              {t('reports.add')}
            </Link>
          )}
        </div>

        {error && <Alert variant="error">{error}</Alert>}

        {(drafts.length > 0 || outbox.length > 0) && (
          <section className="placa-card space-y-3" aria-labelledby="device-work">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 id="device-work" className="text-lg font-bold text-ink">
                  {t('phase5.reports.deviceTitle')}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {t('phase5.reports.deviceIntro')}
                </p>
              </div>
              {outbox.length > 0 && (
                <Button variant="secondary" loading={syncing} onClick={handleSync}>
                  {t('phase5.offline.sendNow')}
                </Button>
              )}
            </div>

            {syncMessage && <Alert variant="info">{syncMessage}</Alert>}

            {drafts.length > 0 && (
              <ul className="space-y-2">
                {drafts.map((draft) => {
                  const isNewDraft = draft.key.startsWith('report:new:');
                  const reportId = draft.key.slice('report:'.length);
                  const label =
                    draft.data?.period_type
                      ? periodLabel(
                          draft.data.period_type,
                          Number(draft.data.period_number),
                          Number(draft.data.period_year),
                          i18n.language
                        )
                      : t('phase5.reports.draftNew');
                  return (
                    <li
                      key={draft.key}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-amber-950">{label}</p>
                        <p className="text-xs text-amber-900">
                          {t('phase5.reports.draftSavedAt', {
                            date: formatDate(draft.updated_at, i18n.language),
                          })}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={isNewDraft ? '/reports/new' : `/reports/${reportId}`}
                          className="inline-flex min-h-tap items-center rounded-xl border border-amber-400 bg-white px-3 py-2 font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          {t('phase5.reports.resumeDraft')}
                        </Link>
                        <Button variant="ghost" onClick={() => discardLocalDraft(draft.key)}>
                          {t('phase5.reports.discardDraft')}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}

            {outbox.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-ink">
                  {t('phase5.reports.pendingTitle', { count: outbox.length })}
                </h3>
                <ul className="mt-2 space-y-2">
                  {outbox.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{item.label}</p>
                        <p className="text-xs text-slate-600">
                          {formatDate(item.created_at, i18n.language)}
                          {item.attempts ? ` · ${t('phase5.reports.attempts', { count: item.attempts })}` : ''}
                          {item.last_error ? ` · ${item.last_error}` : ''}
                        </p>
                      </div>
                      <Button variant="ghost" onClick={() => discardOutboxItem(item)}>
                        {t('phase5.reports.discardDraft')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <Select
            label={t('reports.statusFilter')}
            value={filters.status}
            onChange={(event) => updateFilter('status', event.target.value)}
            className="w-full sm:w-44"
          >
            <option value="">{t('reports.allStatuses')}</option>
            {['draft', 'submitted', 'validated', 'returned', 'aggregated'].map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </Select>
          <Select
            label={t('reports.periodType')}
            value={filters.period_type}
            onChange={(event) => updateFilter('period_type', event.target.value)}
            className="w-full sm:w-56"
          >
            <option value="">{t('reports.allPeriods')}</option>
            {['monthly', 'quarterly', 'annual'].map((type) => (
              <option key={type} value={type}>
                {t(`periods.${type}`)}
              </option>
            ))}
          </Select>
          <Input
            label={t('reports.year')}
            type="number"
            min="2000"
            max="2100"
            value={filters.period_year}
            onChange={(event) => updateFilter('period_year', event.target.value)}
            className="w-full sm:w-32"
          />
          <div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={handleExport} loading={exporting}>
                {t('reports.exportCsv')}
              </Button>
              <Button variant="secondary" onClick={handleExportPdf} loading={exportingPdf}>
                {t('reports.exportPdf')}
              </Button>
            </div>
            <p className="placa-hint max-w-sm">{t('reports.exportHint')}</p>
          </div>
        </div>

        {loading ? (
          <p className="text-base text-slate-600">{t('common.loading')}</p>
        ) : result.data.length === 0 ? (
          <div className="placa-card">
            <p className="text-base text-slate-700">{t('reports.empty')}</p>
            {author && <p className="mt-2 text-sm text-slate-600">{t('reports.emptyPartnerHint')}</p>}
          </div>
        ) : (
          <ul className="space-y-3">
            {result.data.map((report) => (
              <li key={report.id}>
                <Link
                  to={`/reports/${report.id}`}
                  className="placa-card block transition hover:border-placa-300 hover:shadow"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-ink">
                        {periodLabel(
                          report.period_type,
                          report.period_number,
                          report.period_year,
                          i18n.language
                        )}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {t(`periods.${report.period_type}`)}
                        {report.organization?.name ? ` · ${report.organization.name}` : ''}
                        {report.lga?.name ? ` · ${report.lga.name}` : ''}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {report.submitted_at
                          ? t('reports.submittedOn', {
                              date: formatDate(report.submitted_at, i18n.language),
                            })
                          : t('reports.updatedOn', {
                              date: formatDate(report.updated_at, i18n.language),
                            })}
                      </p>
                    </div>
                    <StatusBadge status={report.status} />
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
