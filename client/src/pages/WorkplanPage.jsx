import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import {
  createWorkplan,
  deleteWorkplan,
  getWorkplan,
  listIndicators,
  listLgas,
  reviewWorkplan,
  submitWorkplan,
  updateWorkplan,
} from '../services/programmeApi';
import { errorMessage, getFieldErrors } from '../utils/errors';
import {
  canAuthor,
  canReview,
  currentQuarter,
  currentYear,
  formatDate,
} from '../utils/roles';

let rowSequence = 0;
function newRow(overrides = {}) {
  rowSequence += 1;
  return {
    key: `row-${rowSequence}`,
    indicator_id: '',
    lga_id: '',
    target_value: '',
    ...overrides,
  };
}

function TargetEditor({ rows, setRows, indicators, lgas, t }) {
  function update(key, field, value) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row))
    );
  }

  return (
    <div className="space-y-3">
      <div className="hidden gap-2 px-1 text-xs font-bold uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_auto]">
        <span>{t('workplans.indicator')}</span>
        <span>{t('workplans.lga')}</span>
        <span>{t('workplans.target')}</span>
        <span className="sr-only">{t('workplans.removeTarget')}</span>
      </div>

      {rows.map((row) => (
        <div
          key={row.key}
          className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem_auto] sm:items-center sm:border-0 sm:p-1"
        >
          <select
            aria-label={t('workplans.indicator')}
            className="placa-input"
            value={row.indicator_id}
            onChange={(event) => update(row.key, 'indicator_id', event.target.value)}
          >
            <option value="">{t('workplans.chooseIndicator')}</option>
            {indicators.map((indicator) => (
              <option key={indicator.id} value={indicator.id}>
                {indicator.name}
              </option>
            ))}
          </select>
          <select
            aria-label={t('workplans.lga')}
            className="placa-input"
            value={row.lga_id}
            onChange={(event) => update(row.key, 'lga_id', event.target.value)}
          >
            <option value="">{t('workplans.chooseLga')}</option>
            {lgas.map((lga) => (
              <option key={lga.id} value={lga.id}>
                {lga.name}
              </option>
            ))}
          </select>
          <input
            aria-label={t('workplans.target')}
            className="placa-input"
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="0"
            value={row.target_value}
            onChange={(event) => update(row.key, 'target_value', event.target.value)}
          />
          <button
            type="button"
            className="min-h-tap rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
          >
            {t('workplans.removeTarget')}
          </button>
        </div>
      ))}

      <Button
        variant="secondary"
        onClick={() => setRows((current) => [...current, newRow()])}
      >
        {t('workplans.addTarget')}
      </Button>
    </div>
  );
}

export default function WorkplanPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const author = canAuthor(user?.role);
  const reviewer = canReview(user?.role);

  const [workplan, setWorkplan] = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  const [lgas, setLgas] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [referenceLoading, setReferenceLoading] = useState(true);

  const [year, setYear] = useState(String(currentYear()));
  const [quarter, setQuarter] = useState(String(currentQuarter()));
  const [rows, setRows] = useState([newRow()]);
  const [editing, setEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [returnNote, setReturnNote] = useState('');

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setError('');
    try {
      const data = await getWorkplan(id);
      if (!data) throw new Error('Workplan data is missing');
      const targets = data.targets || [];
      setWorkplan({ ...data, targets });
      setYear(String(data.year));
      setQuarter(String(data.quarter));
      setRows(
        targets.length
          ? targets.map((target) =>
              newRow({
                indicator_id: target.indicator_id,
                lga_id: target.lga_id,
                target_value: String(target.target_value),
              })
            )
          : [newRow()]
      );
      setEditing(false);
    } catch (loadError) {
      setError(errorMessage(loadError, t));
    } finally {
      setLoading(false);
    }
  }, [id, isNew, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    Promise.all([listLgas(), listIndicators({ is_active: 'true' })])
      .then(([lgaData, indicatorData]) => {
        if (!active) return;
        setLgas(lgaData);
        setIndicators(indicatorData);
      })
      .catch((referenceError) => {
        if (active) setError(errorMessage(referenceError, t));
      })
      .finally(() => {
        if (active) setReferenceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t]);

  const editable = author && (isNew || (workplan && ['draft', 'returned'].includes(workplan.status)));
  const canActOnPlan = author && workplan && ['draft', 'returned'].includes(workplan.status);
  const reviewable = reviewer && workplan?.status === 'submitted';

  const cleanRows = useMemo(
    () =>
      rows
        .filter((row) => row.indicator_id && row.lga_id && row.target_value !== '')
        .map((row) => ({
          indicator_id: row.indicator_id,
          lga_id: row.lga_id,
          target_value: Number(row.target_value),
        })),
    [rows]
  );

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const created = await createWorkplan({
        year: Number(year),
        quarter: Number(quarter),
        targets: cleanRows,
      });
      navigate(`/workplans/${created.id}`, { replace: true });
    } catch (createError) {
      setError(errorMessage(createError, t));
      setFieldErrors(getFieldErrors(createError));
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const updated = await updateWorkplan(workplan.id, { targets: cleanRows });
      setWorkplan(updated);
      setEditing(false);
      setNotice(t('workplans.saved'));
    } catch (saveError) {
      setError(errorMessage(saveError, t));
      setFieldErrors(getFieldErrors(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function runAction(action) {
    setActionBusy(action);
    setError('');
    setNotice('');
    try {
      if (action === 'submit') {
        const updated = await submitWorkplan(workplan.id);
        setWorkplan(updated);
        setNotice(t('workplans.submitted'));
      }
      if (action === 'approve') {
        const updated = await reviewWorkplan(workplan.id, { decision: 'approve' });
        setWorkplan(updated);
        setNotice(t('workplans.approved'));
      }
      if (action === 'return') {
        const updated = await reviewWorkplan(workplan.id, {
          decision: 'return',
          note: returnNote,
        });
        setWorkplan(updated);
        setReturnNote('');
        setNotice(t('workplans.returned'));
      }
      if (action === 'delete') {
        if (!window.confirm(t('workplans.confirmDelete'))) return;
        await deleteWorkplan(workplan.id);
        navigate('/workplans', { replace: true });
      }
    } catch (actionError) {
      setError(errorMessage(actionError, t));
    } finally {
      setActionBusy('');
    }
  }

  if (isNew && !author) return <Navigate to="/workplans" replace />;

  if (loading || (isNew && referenceLoading)) {
    return (
      <AppShell>
        <p className="text-base text-slate-600">{t('common.loading')}</p>
      </AppShell>
    );
  }

  const title = isNew
    ? t('workplans.newTitle')
    : `${t('workplans.title')} · ${t('periods.quarter', { number: workplan?.quarter })} ${
        workplan?.year
      }`;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/workplans" className="text-sm font-semibold text-placa-700">
              ← {t('workplans.backToList')}
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
            {!isNew && workplan?.organization && (
              <p className="mt-1 text-base text-slate-600">
                {workplan.organization.name}
                {workplan.organization.lga?.name
                  ? ` · ${workplan.organization.lga.name}`
                  : ''}
              </p>
            )}
          </div>
          {!isNew && <StatusBadge status={workplan?.status} />}
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        {!isNew && workplan?.status === 'returned' && workplan.review_note && (
          <Alert variant="warning" title={t('workplans.returnedTitle')}>
            {workplan.review_note}
          </Alert>
        )}

        {isNew ? (
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="placa-card grid gap-4 sm:grid-cols-2">
              <Input
                label={t('workplans.year')}
                type="number"
                min="2000"
                max="2100"
                required
                value={year}
                onChange={(event) => setYear(event.target.value)}
                error={fieldErrors.year}
              />
              <Select
                label={t('workplans.quarter')}
                required
                value={quarter}
                onChange={(event) => setQuarter(event.target.value)}
                error={fieldErrors.quarter}
              >
                {[1, 2, 3, 4].map((value) => (
                  <option key={value} value={String(value)}>
                    {t('periods.quarter', { number: value })}
                  </option>
                ))}
              </Select>
            </div>

            <section className="placa-card space-y-4" aria-labelledby="targets-heading">
              <h2 id="targets-heading" className="text-lg font-bold text-ink">
                {t('workplans.targetsTitle')}
              </h2>
              <p className="placa-hint">{t('workplans.targetsHint')}</p>
              <TargetEditor
                rows={rows}
                setRows={setRows}
                indicators={indicators}
                lgas={lgas}
                t={t}
              />
            </section>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={saving} disabled={cleanRows.length === 0}>
                {t('workplans.createDraft')}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/workplans')}>
                {t('common.cancel')}
              </Button>
            </div>
            {cleanRows.length === 0 && (
              <p className="text-sm text-slate-600">{t('workplans.targetRequired')}</p>
            )}
          </form>
        ) : (
          <>
            <div className="placa-card space-y-2">
              <dl className="grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="font-medium text-slate-500">{t('workplans.planPeriod')}</dt>
                  <dd className="text-base font-semibold text-ink">
                    {t('periods.quarter', { number: workplan.quarter })} {workplan.year}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">{t('workplans.lastUpdated')}</dt>
                  <dd className="text-base font-semibold text-ink">
                    {formatDate(workplan.updated_at, i18n.language)}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-slate-500">{t('workplans.targetsLabel')}</dt>
                  <dd className="text-base font-semibold text-ink">
                    {t('workplans.targetsCount', { count: workplan.targets?.length || 0 })}
                  </dd>
                </div>
              </dl>
            </div>

            <section className="placa-card space-y-4" aria-labelledby="plan-targets">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="plan-targets" className="text-lg font-bold text-ink">
                  {t('workplans.targetsTitle')}
                </h2>
                {editable && !editing && (
                  <Button variant="secondary" onClick={() => setEditing(true)}>
                    {t('workplans.editTargets')}
                  </Button>
                )}
              </div>

              {editing ? (
                <>
                  <TargetEditor
                    rows={rows}
                    setRows={setRows}
                    indicators={indicators}
                    lgas={lgas}
                    t={t}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleSave} loading={saving} disabled={cleanRows.length === 0}>
                      {t('common.save')}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing(false);
                        setRows(
                          (workplan.targets || []).map((target) =>
                            newRow({
                              indicator_id: target.indicator_id,
                              lga_id: target.lga_id,
                              target_value: String(target.target_value),
                            })
                          )
                        );
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                        <th className="py-2 pr-3">{t('workplans.indicator')}</th>
                        <th className="py-2 pr-3">{t('workplans.lga')}</th>
                        <th className="py-2 text-right">{t('workplans.target')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(workplan.targets || []).map((target) => (
                        <tr key={target.id} className="border-b border-slate-100 last:border-0">
                          <td className="py-3 pr-3">
                            <span className="font-semibold text-ink">
                              {target.indicator?.name}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {target.indicator?.code}
                            </span>
                          </td>
                          <td className="py-3 pr-3 text-slate-700">{target.lga?.name}</td>
                          <td className="py-3 text-right text-base font-bold text-ink">
                            {Number(target.target_value || 0).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {canActOnPlan && !editing && (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => runAction('submit')}
                  loading={actionBusy === 'submit'}
                  disabled={(workplan.targets?.length || 0) === 0}
                >
                  {t('workplans.submit')}
                </Button>
                {workplan.status === 'draft' && (
                  <Button
                    variant="danger"
                    onClick={() => runAction('delete')}
                    loading={actionBusy === 'delete'}
                  >
                    {t('common.delete')}
                  </Button>
                )}
              </div>
            )}

            {reviewable && (
              <section className="placa-card space-y-4" aria-labelledby="review-heading">
                <h2 id="review-heading" className="text-lg font-bold text-ink">
                  {t('workplans.reviewTitle')}
                </h2>
                <p className="placa-hint">{t('workplans.reviewHint')}</p>
                <Button
                  onClick={() => runAction('approve')}
                  loading={actionBusy === 'approve'}
                >
                  {t('workplans.approve')}
                </Button>
                <div className="border-t border-slate-200 pt-4">
                  <label htmlFor="return-note" className="placa-label">
                    {t('workplans.returnNote')}
                  </label>
                  <textarea
                    id="return-note"
                    className="placa-input min-h-24"
                    value={returnNote}
                    onChange={(event) => setReturnNote(event.target.value)}
                    placeholder={t('workplans.returnPlaceholder')}
                  />
                  <Button
                    variant="secondary"
                    className="mt-3"
                    onClick={() => runAction('return')}
                    loading={actionBusy === 'return'}
                    disabled={!returnNote.trim()}
                  >
                    {t('workplans.return')}
                  </Button>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
