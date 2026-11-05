import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PageHeader from '../components/ui/PageHeader';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { listLgas, listOrganizations } from '../services/programmeApi';
import {
  createFundingAllocation,
  createFundingInflow,
  createFundingSource,
  deleteFundingAllocation,
  deleteFundingInflow,
  deleteFundingSource,
  getFundingSummary,
  listFundingAllocations,
  listFundingInflows,
  listFundingSources,
  updateFundingAllocation,
  updateFundingSource,
} from '../services/phase5Api';
import { errorMessage, getFieldErrors } from '../utils/errors';
import { formatDate, isPlaca } from '../utils/roles';

const SOURCE_TYPES = ['government', 'donor', 'private', 'other'];
const ALLOCATION_STATUSES = ['planned', 'disbursed', 'closed'];

function formatMoney(amount, currency = 'NGN') {
  const value = Number(amount || 0);
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency || 'NGN',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || 'NGN'} ${value.toLocaleString()}`;
  }
}

function currentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-Q${Math.floor(now.getMonth() / 3) + 1}`;
}

export default function FundingPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const manager = isPlaca(user?.role);

  const [tab, setTab] = useState('summary');
  const [summary, setSummary] = useState(null);
  const [sources, setSources] = useState([]);
  const [inflows, setInflows] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [lgas, setLgas] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [periodFilter, setPeriodFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [sourceForm, setSourceForm] = useState({
    name: '',
    type: 'government',
    description: '',
    is_active: true,
  });
  const [editingSource, setEditingSource] = useState(null);
  const [savingSource, setSavingSource] = useState(false);

  const [inflowForm, setInflowForm] = useState({
    funding_source_id: '',
    amount: '',
    currency: 'NGN',
    received_on: '',
    reference: '',
    purpose: '',
  });
  const [savingInflow, setSavingInflow] = useState(false);

  const [allocationForm, setAllocationForm] = useState({
    funding_source_id: '',
    funding_inflow_id: '',
    recipient_organization_id: '',
    lga_id: '',
    amount: '',
    currency: 'NGN',
    period: currentPeriod(),
    purpose: '',
    status: 'planned',
    disbursed_on: '',
  });
  const [editingAllocation, setEditingAllocation] = useState(null);
  const [savingAllocation, setSavingAllocation] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const params = periodFilter ? { period: periodFilter } : {};
      const [summaryData, sourcesData, allocationData] = await Promise.all([
        getFundingSummary(params),
        listFundingSources({ limit: 100, active_only: 'false' }),
        listFundingAllocations({ limit: 50, ...params }),
      ]);
      setSummary(summaryData || null);
      setSources(sourcesData?.data || []);
      setAllocations(allocationData?.data || []);
      setFromCache(
        Boolean(sourcesData?.from_cache || allocationData?.from_cache)
      );

      if (manager) {
        const inflowData = await listFundingInflows({ limit: 50 });
        setInflows(inflowData?.data || []);
      }
    } catch (loadError) {
      setError(errorMessage(loadError, t));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodFilter]);

  useEffect(() => {
    if (!manager) return;
    listLgas()
      .then((rows) => setLgas(rows || []))
      .catch(() => setLgas([]));
    listOrganizations({ limit: 100, status: 'approved' })
      .then((data) => setOrganizations(data?.data || []))
      .catch(() => setOrganizations([]));
  }, [manager]);

  const organizationOptions = useMemo(() => {
    if (!allocationForm.lga_id) return organizations;
    return organizations.filter(
      (organization) => organization.lga_id === allocationForm.lga_id
    );
  }, [organizations, allocationForm.lga_id]);

  const periodOptions = useMemo(() => {
    const values = new Set([currentPeriod()]);
    for (const allocation of allocations) {
      if (allocation.period) values.add(allocation.period);
    }
    return [...values].sort().reverse();
  }, [allocations]);

  function flash(message) {
    setNotice(message);
    setError('');
  }

  async function saveSource(event) {
    event.preventDefault();
    setSavingSource(true);
    setError('');
    setFieldErrors({});
    try {
      const payload = {
        name: sourceForm.name.trim(),
        type: sourceForm.type,
        description: sourceForm.description.trim() || null,
        is_active: sourceForm.is_active,
      };
      if (editingSource) {
        await updateFundingSource(editingSource.id, payload);
        flash(t('phase5.funding.sourceUpdated'));
        setEditingSource(null);
      } else {
        await createFundingSource(payload);
        flash(t('phase5.funding.sourceCreated'));
      }
      setSourceForm({ name: '', type: 'government', description: '', is_active: true });
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError, t));
      setFieldErrors(getFieldErrors(saveError));
    } finally {
      setSavingSource(false);
    }
  }

  function startEditSource(source) {
    setEditingSource(source);
    setSourceForm({
      name: source.name,
      type: source.type,
      description: source.description || '',
      is_active: Boolean(source.is_active),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeSource(source) {
    if (!window.confirm(t('phase5.funding.confirmDeleteSource', { name: source.name }))) return;
    setBusyId(source.id);
    setError('');
    try {
      await deleteFundingSource(source.id);
      flash(t('phase5.funding.sourceDeleted'));
      await load();
    } catch (deleteError) {
      setError(errorMessage(deleteError, t));
    } finally {
      setBusyId('');
    }
  }

  async function saveInflow(event) {
    event.preventDefault();
    setSavingInflow(true);
    setError('');
    setFieldErrors({});
    try {
      await createFundingInflow({
        funding_source_id: inflowForm.funding_source_id,
        amount: Number(inflowForm.amount),
        currency: inflowForm.currency || 'NGN',
        received_on: inflowForm.received_on,
        reference: inflowForm.reference.trim() || null,
        purpose: inflowForm.purpose.trim() || null,
      });
      setInflowForm({
        funding_source_id: '',
        amount: '',
        currency: 'NGN',
        received_on: '',
        reference: '',
        purpose: '',
      });
      flash(t('phase5.funding.inflowCreated'));
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError, t));
      setFieldErrors(getFieldErrors(saveError));
    } finally {
      setSavingInflow(false);
    }
  }

  async function removeInflow(inflow) {
    if (!window.confirm(t('phase5.funding.confirmDeleteInflow'))) return;
    setBusyId(inflow.id);
    setError('');
    try {
      await deleteFundingInflow(inflow.id);
      flash(t('phase5.funding.inflowDeleted'));
      await load();
    } catch (deleteError) {
      setError(errorMessage(deleteError, t));
    } finally {
      setBusyId('');
    }
  }

  function updateAllocationForm(key, value) {
    setAllocationForm((current) => {
      if (key === 'lga_id') {
        return { ...current, lga_id: value, recipient_organization_id: '' };
      }
      return { ...current, [key]: value };
    });
  }

  async function saveAllocation(event) {
    event.preventDefault();
    setSavingAllocation(true);
    setError('');
    setFieldErrors({});
    try {
      const payload = {
        funding_source_id: allocationForm.funding_source_id || null,
        funding_inflow_id: allocationForm.funding_inflow_id || null,
        recipient_organization_id: allocationForm.recipient_organization_id || null,
        lga_id: allocationForm.lga_id || null,
        amount: Number(allocationForm.amount),
        currency: allocationForm.currency || 'NGN',
        period: allocationForm.period.trim(),
        purpose: allocationForm.purpose.trim() || null,
        status: allocationForm.status,
        disbursed_on: allocationForm.disbursed_on || null,
      };
      if (editingAllocation) {
        await updateFundingAllocation(editingAllocation.id, payload);
        flash(t('phase5.funding.allocationUpdated'));
        setEditingAllocation(null);
      } else {
        await createFundingAllocation(payload);
        flash(t('phase5.funding.allocationCreated'));
      }
      setAllocationForm({
        funding_source_id: '',
        funding_inflow_id: '',
        recipient_organization_id: '',
        lga_id: '',
        amount: '',
        currency: 'NGN',
        period: currentPeriod(),
        purpose: '',
        status: 'planned',
        disbursed_on: '',
      });
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError, t));
      setFieldErrors(getFieldErrors(saveError));
    } finally {
      setSavingAllocation(false);
    }
  }

  function startEditAllocation(allocation) {
    setEditingAllocation(allocation);
    setAllocationForm({
      funding_source_id: allocation.funding_source_id || '',
      funding_inflow_id: allocation.funding_inflow_id || '',
      recipient_organization_id: allocation.recipient_organization_id || '',
      lga_id: allocation.lga_id || '',
      amount: String(allocation.amount ?? ''),
      currency: allocation.currency || 'NGN',
      period: allocation.period || '',
      purpose: allocation.purpose || '',
      status: allocation.status || 'planned',
      disbursed_on: allocation.disbursed_on || '',
    });
    setTab('allocations');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeAllocation(allocation) {
    if (!window.confirm(t('phase5.funding.confirmDeleteAllocation'))) return;
    setBusyId(allocation.id);
    setError('');
    try {
      await deleteFundingAllocation(allocation.id);
      flash(t('phase5.funding.allocationDeleted'));
      await load();
    } catch (deleteError) {
      setError(errorMessage(deleteError, t));
    } finally {
      setBusyId('');
    }
  }

  const tabs = [
    { key: 'summary', label: t('phase5.funding.tabs.summary') },
    { key: 'allocations', label: t('phase5.funding.tabs.allocations') },
    { key: 'sources', label: t('phase5.funding.tabs.sources') },
    ...(manager ? [{ key: 'inflows', label: t('phase5.funding.tabs.inflows') }] : []),
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title={t('phase5.funding.title')} intro={t('phase5.funding.intro')} />

        {fromCache && <Alert variant="warning">{t('phase5.offline.showingSaved')}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('phase5.funding.title')}>
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                onClick={() => setTab(item.key)}
                className={`min-h-tap rounded-xl px-4 py-2 text-sm font-semibold ${
                  tab === item.key
                    ? 'bg-placa-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <Select
            label={t('phase5.funding.periodFilter')}
            value={periodFilter}
            onChange={(event) => setPeriodFilter(event.target.value)}
            className="w-full sm:w-52"
          >
            <option value="">{t('phase5.funding.allPeriods')}</option>
            {periodOptions.map((period) => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <p className="text-base text-slate-600">{t('common.loading')}</p>
        ) : (
          <>
            {tab === 'summary' && (
              <section className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-medium text-slate-500">
                      {t('phase5.funding.totalAllocated')}
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
                      {formatMoney(summary?.total_allocated)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-medium text-slate-500">
                      {t('phase5.funding.allocationCount')}
                    </p>
                    <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
                      {summary?.allocation_count ?? 0}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="placa-card">
                    <h2 className="text-lg font-bold text-ink">{t('phase5.funding.byLga')}</h2>
                    {summary?.by_lga?.length ? (
                      <ul className="mt-3 space-y-2">
                        {summary.by_lga.map((row) => (
                          <li
                            key={row.lga_id || 'unplaced'}
                            className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0 last:pb-0"
                          >
                            <span className="text-slate-700">{row.lga_name}</span>
                            <span className="font-semibold tabular-nums text-ink">
                              {formatMoney(row.total)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-slate-600">{t('phase5.funding.emptySummary')}</p>
                    )}
                  </div>
                  <div className="placa-card">
                    <h2 className="text-lg font-bold text-ink">{t('phase5.funding.bySource')}</h2>
                    {summary?.by_source?.length ? (
                      <ul className="mt-3 space-y-2">
                        {summary.by_source.map((row) => (
                          <li
                            key={row.funding_source_id || 'unspecified'}
                            className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0 last:pb-0"
                          >
                            <span className="text-slate-700">{row.source_name}</span>
                            <span className="font-semibold tabular-nums text-ink">
                              {formatMoney(row.total)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-slate-600">{t('phase5.funding.emptySummary')}</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {tab === 'allocations' && (
              <section className="space-y-4">
                {manager && (
                  <form onSubmit={saveAllocation} className="placa-card space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold text-ink">
                        {editingAllocation
                          ? t('phase5.funding.editAllocation')
                          : t('phase5.funding.newAllocation')}
                      </h2>
                      {editingAllocation && (
                        <Button variant="ghost" onClick={() => setEditingAllocation(null)}>
                          {t('phase5.programmes.cancelEdit')}
                        </Button>
                      )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Select
                        label={t('phase5.funding.source')}
                        value={allocationForm.funding_source_id}
                        onChange={(event) =>
                          updateAllocationForm('funding_source_id', event.target.value)
                        }
                      >
                        <option value="">{t('phase5.funding.noSource')}</option>
                        {sources.map((source) => (
                          <option key={source.id} value={source.id}>
                            {source.name}
                          </option>
                        ))}
                      </Select>
                      <Select
                        label={t('phase5.funding.inflow')}
                        value={allocationForm.funding_inflow_id}
                        onChange={(event) =>
                          updateAllocationForm('funding_inflow_id', event.target.value)
                        }
                      >
                        <option value="">{t('phase5.funding.noInflow')}</option>
                        {inflows.map((inflow) => (
                          <option key={inflow.id} value={inflow.id}>
                            {inflow.source?.name || inflow.reference || inflow.id} ·{' '}
                            {formatMoney(inflow.amount, inflow.currency)}
                          </option>
                        ))}
                      </Select>
                      <Select
                        label={t('phase5.funding.lga')}
                        value={allocationForm.lga_id}
                        onChange={(event) => updateAllocationForm('lga_id', event.target.value)}
                      >
                        <option value="">{t('phase5.funding.chooseLga')}</option>
                        {lgas.map((lga) => (
                          <option key={lga.id} value={lga.id}>
                            {lga.name}
                          </option>
                        ))}
                      </Select>
                      <Select
                        label={t('phase5.funding.organization')}
                        value={allocationForm.recipient_organization_id}
                        onChange={(event) =>
                          updateAllocationForm('recipient_organization_id', event.target.value)
                        }
                        hint={t('phase5.funding.recipientHint')}
                      >
                        <option value="">{t('phase5.funding.lgaOnly')}</option>
                        {organizationOptions.map((organization) => (
                          <option key={organization.id} value={organization.id}>
                            {organization.name}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <Input
                        label={t('phase5.funding.amount')}
                        type="number"
                        min="0"
                        step="0.01"
                        value={allocationForm.amount}
                        onChange={(event) => updateAllocationForm('amount', event.target.value)}
                        error={fieldErrors.amount}
                        required
                      />
                      <Input
                        label={t('phase5.funding.period')}
                        value={allocationForm.period}
                        onChange={(event) => updateAllocationForm('period', event.target.value)}
                        hint={t('phase5.funding.periodHint')}
                        error={fieldErrors.period}
                        required
                      />
                      <Select
                        label={t('phase5.funding.allocationStatus')}
                        value={allocationForm.status}
                        onChange={(event) => updateAllocationForm('status', event.target.value)}
                      >
                        {ALLOCATION_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {t(`status.${status}`)}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label={t('phase5.funding.disbursedOn')}
                        type="date"
                        value={allocationForm.disbursed_on}
                        onChange={(event) =>
                          updateAllocationForm('disbursed_on', event.target.value)
                        }
                      />
                      <Input
                        label={t('phase5.funding.purpose')}
                        value={allocationForm.purpose}
                        onChange={(event) => updateAllocationForm('purpose', event.target.value)}
                      />
                    </div>

                    <Button type="submit" loading={savingAllocation}>
                      {editingAllocation ? t('common.save') : t('phase5.funding.createAllocation')}
                    </Button>
                  </form>
                )}

                {allocations.length === 0 ? (
                  <div className="placa-card">
                    <p className="text-base text-slate-700">{t('phase5.funding.emptyAllocations')}</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {allocations.map((allocation) => (
                      <li key={allocation.id} className="placa-card">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-bold text-ink">
                              {formatMoney(allocation.amount, allocation.currency)}
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                              {allocation.recipient?.name || allocation.lga?.name || '—'}
                              {` · ${allocation.period}`}
                              {allocation.source?.name ? ` · ${allocation.source.name}` : ''}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {allocation.disbursed_on
                                ? `${t('phase5.funding.disbursedOn')}: ${formatDate(
                                    allocation.disbursed_on,
                                    i18n.language
                                  )}`
                                : t('phase5.funding.notDisbursed')}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge status={allocation.status} />
                            {manager && (
                              <>
                                <Button
                                  variant="ghost"
                                  onClick={() => startEditAllocation(allocation)}
                                >
                                  {t('common.edit')}
                                </Button>
                                <Button
                                  variant="danger"
                                  loading={busyId === allocation.id}
                                  onClick={() => removeAllocation(allocation)}
                                >
                                  {t('common.delete')}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                        {allocation.purpose && (
                          <p className="mt-2 text-sm leading-relaxed text-slate-700">
                            {allocation.purpose}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {tab === 'sources' && (
              <section className="space-y-4">
                {manager && (
                  <form onSubmit={saveSource} className="placa-card space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="text-lg font-bold text-ink">
                        {editingSource
                          ? t('phase5.funding.editSource')
                          : t('phase5.funding.newSource')}
                      </h2>
                      {editingSource && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditingSource(null);
                            setSourceForm({
                              name: '',
                              type: 'government',
                              description: '',
                              is_active: true,
                            });
                          }}
                        >
                          {t('phase5.programmes.cancelEdit')}
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label={t('phase5.funding.sourceName')}
                        value={sourceForm.name}
                        onChange={(event) =>
                          setSourceForm((current) => ({ ...current, name: event.target.value }))
                        }
                        error={fieldErrors.name}
                        required
                      />
                      <Select
                        label={t('phase5.funding.sourceType')}
                        value={sourceForm.type}
                        onChange={(event) =>
                          setSourceForm((current) => ({ ...current, type: event.target.value }))
                        }
                      >
                        {SOURCE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {t(`phase5.funding.sourceTypes.${type}`)}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label htmlFor="source-description" className="placa-label">
                        {t('phase5.funding.description')}
                      </label>
                      <textarea
                        id="source-description"
                        className="placa-input min-h-20"
                        value={sourceForm.description}
                        onChange={(event) =>
                          setSourceForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={sourceForm.is_active}
                        onChange={(event) =>
                          setSourceForm((current) => ({
                            ...current,
                            is_active: event.target.checked,
                          }))
                        }
                        className="h-4 w-4"
                      />
                      {t('phase5.funding.activeSource')}
                    </label>
                    <Button type="submit" loading={savingSource}>
                      {editingSource ? t('common.save') : t('phase5.funding.createSource')}
                    </Button>
                  </form>
                )}

                {sources.length === 0 ? (
                  <div className="placa-card">
                    <p className="text-base text-slate-700">{t('phase5.funding.emptySources')}</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {sources.map((source) => (
                      <li key={source.id} className="placa-card">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-bold text-ink">{source.name}</h2>
                            <p className="mt-1 text-sm text-slate-600">
                              {t(`phase5.funding.sourceTypes.${source.type}`)}
                              {source.is_active ? '' : ` · ${t('phase5.funding.inactiveSource')}`}
                            </p>
                            {source.description && (
                              <p className="mt-1 text-sm text-slate-700">{source.description}</p>
                            )}
                          </div>
                          {manager && (
                            <div className="flex flex-wrap gap-2">
                              <Button variant="ghost" onClick={() => startEditSource(source)}>
                                {t('common.edit')}
                              </Button>
                              <Button
                                variant="danger"
                                loading={busyId === source.id}
                                onClick={() => removeSource(source)}
                              >
                                {t('common.delete')}
                              </Button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {tab === 'inflows' && manager && (
              <section className="space-y-4">
                <form onSubmit={saveInflow} className="placa-card space-y-4">
                  <h2 className="text-lg font-bold text-ink">{t('phase5.funding.newInflow')}</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                      label={t('phase5.funding.source')}
                      value={inflowForm.funding_source_id}
                      onChange={(event) =>
                        setInflowForm((current) => ({
                          ...current,
                          funding_source_id: event.target.value,
                        }))
                      }
                      error={fieldErrors.funding_source_id}
                      required
                    >
                      <option value="">{t('phase5.funding.chooseSource')}</option>
                      {sources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.name}
                        </option>
                      ))}
                    </Select>
                    <Input
                      label={t('phase5.funding.amount')}
                      type="number"
                      min="0"
                      step="0.01"
                      value={inflowForm.amount}
                      onChange={(event) =>
                        setInflowForm((current) => ({ ...current, amount: event.target.value }))
                      }
                      error={fieldErrors.amount}
                      required
                    />
                    <Input
                      label={t('phase5.funding.receivedOn')}
                      type="date"
                      value={inflowForm.received_on}
                      onChange={(event) =>
                        setInflowForm((current) => ({ ...current, received_on: event.target.value }))
                      }
                      error={fieldErrors.received_on}
                      required
                    />
                    <Input
                      label={t('phase5.funding.reference')}
                      value={inflowForm.reference}
                      onChange={(event) =>
                        setInflowForm((current) => ({ ...current, reference: event.target.value }))
                      }
                    />
                  </div>
                  <Input
                    label={t('phase5.funding.purpose')}
                    value={inflowForm.purpose}
                    onChange={(event) =>
                      setInflowForm((current) => ({ ...current, purpose: event.target.value }))
                    }
                  />
                  <Button type="submit" loading={savingInflow}>
                    {t('phase5.funding.createInflow')}
                  </Button>
                </form>

                {inflows.length === 0 ? (
                  <div className="placa-card">
                    <p className="text-base text-slate-700">{t('phase5.funding.emptyInflows')}</p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {inflows.map((inflow) => (
                      <li key={inflow.id} className="placa-card">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h2 className="text-lg font-bold text-ink">
                              {formatMoney(inflow.amount, inflow.currency)}
                            </h2>
                            <p className="mt-1 text-sm text-slate-600">
                              {inflow.source?.name || '—'}
                              {` · ${formatDate(inflow.received_on, i18n.language)}`}
                              {inflow.reference ? ` · ${inflow.reference}` : ''}
                            </p>
                            {inflow.purpose && (
                              <p className="mt-1 text-sm text-slate-700">{inflow.purpose}</p>
                            )}
                          </div>
                          <Button
                            variant="danger"
                            loading={busyId === inflow.id}
                            onClick={() => removeInflow(inflow)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}

        <p className="text-sm leading-relaxed text-slate-600">{t('phase5.funding.privacyNote')}</p>
      </div>
    </AppShell>
  );
}
