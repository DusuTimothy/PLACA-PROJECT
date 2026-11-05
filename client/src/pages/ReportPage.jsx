import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import GuidedCounts from '../components/reports/GuidedCounts';
import FieldHint from '../components/guides/FieldHint';
import {
  breakdownLabel,
  buildEntryMap,
  buildValues as toApiValues,
  collectIssues,
} from '../components/reports/guidedCounts';
import { useAuth } from '../context/AuthContext';
import {
  createReport,
  deleteReport,
  getReport,
  listIndicators,
  reviewReport,
  submitReport,
  updateReport,
} from '../services/programmeApi';
import { errorMessage, getFieldErrors } from '../utils/errors';
import { deleteDraft, getDraft, saveDraft } from '../services/offlineDb';
import { isNetworkError, useOnline } from '../services/offline';
import { queueReport, queueReportSubmit, queueReportUpdate } from '../services/phase5Api';
import {
  canAuthor,
  canReview,
  currentYear,
  formatDate,
  periodLabel,
} from '../utils/roles';

const CATEGORY_ORDER = ['reach', 'testing', 'referral', 'welfare', 'training'];

function newClientUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function ReportPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const author = canAuthor(user?.role);
  const reviewer = canReview(user?.role);

  const [report, setReport] = useState(null);
  const [clientUuid, setClientUuid] = useState(newClientUuid);
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState('');
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [restored, setRestored] = useState(false);
  const [practice, setPractice] = useState(false);
  const online = useOnline();

  const draftKey = isNew
    ? `report:new:${user?.id || 'anon'}`
    : `report:${id}`;
  const practiceKey = `practice:${user?.id || 'anon'}`;

  const [indicators, setIndicators] = useState([]);
  const [referenceLoading, setReferenceLoading] = useState(true);

  const [periodType, setPeriodType] = useState('quarterly');
  const [periodYear, setPeriodYear] = useState(String(currentYear()));
  const [periodNumber, setPeriodNumber] = useState('4');
  const [entries, setEntries] = useState({});
  const [preserved, setPreserved] = useState([]);
  const [editing, setEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState('');
  const [returnReason, setReturnReason] = useState('');

  const load = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setError('');
    try {
      const data = await getReport(id);
      setReport(data);
      setPeriodType(data.period_type);
      setPeriodYear(String(data.period_year));
      setPeriodNumber(String(data.period_number));

      const { entries: loadedEntries, preserved: loadedPreserved } = buildEntryMap(data.values);
      setEntries(loadedEntries);
      setPreserved(loadedPreserved);
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
    listIndicators()
      .then((data) => {
        if (active) setIndicators(data);
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

  const groupedIndicators = useMemo(() => {
    const groups = new Map();
    for (const indicator of indicators) {
      if (!groups.has(indicator.category)) groups.set(indicator.category, []);
      groups.get(indicator.category).push(indicator);
    }
    return [...groups.entries()].sort(
      ([left], [right]) => CATEGORY_ORDER.indexOf(left) - CATEGORY_ORDER.indexOf(right)
    );
  }, [indicators]);

  const editable = author && (isNew || (report && ['draft', 'returned'].includes(report.status)));
  const canAct = author && report && ['draft', 'returned'].includes(report.status);
  const reviewable = reviewer && report?.status === 'submitted';

  function buildDraft() {
    return {
      client_uuid: clientUuid,
      period_type: periodType,
      period_year: periodYear,
      period_number: periodNumber,
      entries,
      preserved,
      saved_at: new Date().toISOString(),
    };
  }

  function applyDraft(draft) {
    if (!draft) return;
    if (draft.client_uuid) setClientUuid(draft.client_uuid);
    if (draft.period_type) setPeriodType(draft.period_type);
    if (draft.period_year) setPeriodYear(String(draft.period_year));
    if (draft.period_number) setPeriodNumber(String(draft.period_number));
    setEntries(draft.entries || {});
    setPreserved(draft.preserved || []);
    setRestored(true);
  }

  // A new report may have been started before the phone lost signal. Restore
  // it so the person does not retype the paper tally.
  useEffect(() => {
    if (!isNew || !author) return undefined;
    let active = true;
    getDraft(draftKey).then((draft) => {
      if (active) applyDraft(draft);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, author, draftKey]);

  // Autosave the form on this device while it is being edited. This runs on
  // every keystroke group but writes at most once a second.
  useEffect(() => {
    if (!author || !editable) return undefined;
    const hasWork =
      Object.values(entries).some((value) => String(value ?? '').trim() !== '') ||
      preserved.length > 0;
    if (!hasWork) return undefined;

    const timer = setTimeout(() => {
      const key = practice ? practiceKey : draftKey;
      saveDraft(key, buildDraft()).then(() => {
        setDraftSavedAt(new Date().toISOString());
      });
    }, 900);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    entries,
    preserved,
    periodType,
    periodYear,
    periodNumber,
    author,
    editable,
    practice,
    draftKey,
    practiceKey,
    clientUuid,
  ]);

  function discardDraft() {
    deleteDraft(draftKey);
    setEntries({});
    setPreserved([]);
    setClientUuid(newClientUuid());
    setPeriodType('quarterly');
    setPeriodYear(String(currentYear()));
    setPeriodNumber('4');
    setRestored(false);
    setDraftSavedAt('');
    setNotice('');
  }

  function togglePractice() {
    if (practice) {
      deleteDraft(practiceKey);
      setPractice(false);
      setEntries({});
      setPreserved([]);
      setNotice('');
      return;
    }
    setPractice(true);
    setEntries({});
    setPreserved([]);
    setNotice(t('phase5.reports.practiceStarted'));
  }

  function updatePeriodType(value) {
    setPeriodType(value);
    if (value === 'annual') setPeriodNumber('1');
    else if (value === 'quarterly' && Number(periodNumber) > 4) setPeriodNumber('1');
  }

  const issues = useMemo(
    () => collectIssues(indicators, entries, t),
    [indicators, entries, t]
  );

  function buildValues() {
    return toApiValues(entries, preserved);
  }

  async function handleCreate(event) {
    event.preventDefault();

    if (practice) {
      await saveDraft(practiceKey, buildDraft());
      setNotice(t('phase5.reports.practiceSaved'));
      return;
    }

    setSaving(true);
    setError('');
    setFieldErrors({});
    const payload = {
      client_uuid: clientUuid,
      period_type: periodType,
      period_year: Number(periodYear),
      period_number: Number(periodNumber),
      values: buildValues(),
    };

    try {
      const created = await createReport(payload);
      await deleteDraft(draftKey);
      navigate(`/reports/${created.id}`, { replace: true });
    } catch (createError) {
      if (isNetworkError(createError)) {
        // Keep the tally on this device and send it when signal returns. The
        // server uses client_uuid so a retry cannot create a duplicate.
        await saveDraft(draftKey, buildDraft());
        const queued = await queueReport(payload);
        setDraftSavedAt(new Date().toISOString());
        setNotice(
          queued ? t('phase5.reports.queuedCreate') : t('phase5.reports.savedOnDevice')
        );
      } else {
        setError(errorMessage(createError, t));
        setFieldErrors(getFieldErrors(createError));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    setNotice('');
    setFieldErrors({});
    try {
      const updated = await updateReport(report.id, { values: buildValues() });
      setReport(updated);
      await deleteDraft(draftKey);
      setDraftSavedAt('');
      setEditing(false);
      setNotice(t('reports.saved'));
    } catch (saveError) {
      if (isNetworkError(saveError)) {
        await saveDraft(draftKey, buildDraft());
        const queued = await queueReportUpdate(report.id, buildValues());
        setDraftSavedAt(new Date().toISOString());
        setNotice(
          queued ? t('phase5.reports.queuedUpdate') : t('phase5.reports.savedOnDevice')
        );
      } else {
        setError(errorMessage(saveError, t));
        setFieldErrors(getFieldErrors(saveError));
      }
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
        const updated = await submitReport(report.id);
        setReport(updated);
        setNotice(t('reports.submitted'));
      }
      if (action === 'validate') {
        const updated = await reviewReport(report.id, { decision: 'validate' });
        setReport(updated);
        setNotice(t('reports.validated'));
      }
      if (action === 'return') {
        const updated = await reviewReport(report.id, {
          decision: 'return',
          reason: returnReason,
        });
        setReport(updated);
        setReturnReason('');
        setNotice(t('reports.returned'));
      }
      if (action === 'delete') {
        if (!window.confirm(t('reports.confirmDelete'))) return;
        await deleteReport(report.id);
        navigate('/reports', { replace: true });
      }
    } catch (actionError) {
      if (action === 'submit' && isNetworkError(actionError)) {
        const queued = await queueReportSubmit(report.id);
        setNotice(
          queued ? t('phase5.reports.queuedSubmit') : t('phase5.reports.savedOnDevice')
        );
      } else {
        setError(errorMessage(actionError, t));
      }
    } finally {
      setActionBusy('');
    }
  }

  if (isNew && !author) return <Navigate to="/reports" replace />;

  if (loading || (isNew && referenceLoading)) {
    return (
      <AppShell>
        <p className="text-base text-slate-600">{t('common.loading')}</p>
      </AppShell>
    );
  }

  const title = practice
    ? t('phase5.reports.practiceTitle')
    : isNew
      ? t('reports.newTitle')
      : `${periodLabel(
          report.period_type,
          report.period_number,
          report.period_year,
          i18n.language
        )}`;

  const periodOptions =
    periodType === 'quarterly'
      ? [1, 2, 3, 4]
      : periodType === 'annual'
        ? [1]
        : Array.from({ length: 12 }, (_, index) => index + 1);

  function periodOptionLabel(number) {
    if (periodType === 'quarterly') return t('periods.quarter', { number });
    if (periodType === 'annual') return t('periods.annual');
    return t(`months.${number}`, { defaultValue: String(number) });
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/reports" className="text-sm font-semibold text-placa-700">
              ← {t('reports.backToList')}
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
            {!isNew && report?.organization && (
              <p className="mt-1 text-base text-slate-600">
                {report.organization.name}
                {report.lga?.name ? ` · ${report.lga.name}` : ''}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isNew && author && (
              <Button
                variant={practice ? 'primary' : 'secondary'}
                onClick={togglePractice}
              >
                {practice ? t('phase5.reports.exitPractice') : t('phase5.reports.practiceMode')}
              </Button>
            )}
            {!isNew && <StatusBadge status={report?.status} />}
          </div>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        {practice && (
          <Alert variant="info" title={t('phase5.reports.practiceTitle')}>
            {t('phase5.reports.practiceIntro')}
          </Alert>
        )}

        {restored && !practice && (
          <Alert variant="warning" title={t('phase5.reports.draftRestoredTitle')}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{t('phase5.reports.draftRestoredBody')}</span>
              <Button variant="secondary" onClick={discardDraft}>
                {t('phase5.reports.discardDraft')}
              </Button>
            </div>
          </Alert>
        )}

        {!online && <Alert variant="warning">{t('phase5.reports.offlineNotice')}</Alert>}

        {editable && draftSavedAt && (
          <p className="text-sm font-medium text-slate-600">
            {t('phase5.reports.savedOnDevice')}
          </p>
        )}

        {!isNew && report?.status === 'returned' && report.return_reason && (
          <Alert variant="warning" title={t('reports.returnedTitle')}>
            {report.return_reason}
          </Alert>
        )}

        {!isNew && (
          <div className="placa-card">
            <dl className="grid gap-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="font-medium text-slate-500">{t('reports.period')}</dt>
                <dd className="text-base font-semibold text-ink">
                  {periodLabel(
                    report.period_type,
                    report.period_number,
                    report.period_year,
                    i18n.language
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">{t('reports.periodType')}</dt>
                <dd className="text-base font-semibold text-ink">
                  {t(`periods.${report.period_type}`)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">{t('reports.lastUpdated')}</dt>
                <dd className="text-base font-semibold text-ink">
                  {formatDate(report.updated_at, i18n.language)}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">{t('reports.submittedBy')}</dt>
                <dd className="text-base font-semibold text-ink">
                  {report.submitter?.name || t('reports.notSubmitted')}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {isNew ? (
          <form onSubmit={handleCreate} className="space-y-5">
            <div className="placa-card grid gap-4 sm:grid-cols-3">
              <Select
                label={t('reports.periodType')}
                value={periodType}
                onChange={(event) => updatePeriodType(event.target.value)}
                error={fieldErrors.period_type}
              >
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
                required
                value={periodYear}
                onChange={(event) => setPeriodYear(event.target.value)}
                error={fieldErrors.period_year}
              />
              <Select
                label={t('reports.periodNumber')}
                value={periodNumber}
                onChange={(event) => setPeriodNumber(event.target.value)}
                error={fieldErrors.period_number}
              >
                {periodOptions.map((number) => (
                  <option key={number} value={String(number)}>
                    {periodOptionLabel(number)}
                  </option>
                ))}
              </Select>
              <div className="sm:col-span-3">
                <FieldHint pageKey="report" fieldKey="quarter" />
              </div>
            </div>

            <section className="placa-card space-y-4" aria-labelledby="counts-heading">
              <h2 id="counts-heading" className="text-lg font-bold text-ink">
                {t('reports.countsTitle')}
              </h2>
              <p className="placa-hint">{t('reports.countsHint')}</p>
              <GuidedCounts
                groupedIndicators={groupedIndicators}
                entries={entries}
                setEntries={setEntries}
                issuesByIndicator={issues.byIndicator}
                t={t}
              />
            </section>

            {issues.count > 0 && (
              <Alert variant="error" title={t('reports.issuesTitle')}>
                {t('reports.issuesIntro', { count: issues.count })}
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={saving} disabled={issues.count > 0}>
                {practice ? t('phase5.reports.savePractice') : t('reports.createDraft')}
              </Button>
              <Button variant="secondary" onClick={() => navigate('/reports')}>
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <>
            <section className="placa-card space-y-4" aria-labelledby="report-counts">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="report-counts" className="text-lg font-bold text-ink">
                  {t('reports.countsTitle')}
                </h2>
                {editable && !editing && (
                  <Button variant="secondary" onClick={() => setEditing(true)}>
                    {t('reports.editCounts')}
                  </Button>
                )}
              </div>

              {editing ? (
                <>
                  <p className="placa-hint">{t('reports.countsHint')}</p>
                  {preserved.length > 0 && (
                    <Alert variant="info">{t('reports.breakdownPreserved')}</Alert>
                  )}
                  <GuidedCounts
                    groupedIndicators={groupedIndicators}
                    entries={entries}
                    setEntries={setEntries}
                    issuesByIndicator={issues.byIndicator}
                    t={t}
                  />
                  {issues.count > 0 && (
                    <Alert variant="error" title={t('reports.issuesTitle')}>
                      {t('reports.issuesIntro', { count: issues.count })}
                    </Alert>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleSave} loading={saving} disabled={issues.count > 0}>
                      {t('common.save')}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setEditing(false);
                        const { entries: loadedEntries, preserved: loadedPreserved } =
                          buildEntryMap(report.values);
                        setEntries(loadedEntries);
                        setPreserved(loadedPreserved);
                      }}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                </>
              ) : (
                <ValuesTable values={report.values} t={t} />
              )}
            </section>

            {canAct && !editing && (
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => runAction('submit')}
                  loading={actionBusy === 'submit'}
                  disabled={report.values.length === 0}
                >
                  {t('reports.submit')}
                </Button>
                {report.status === 'draft' && (
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
              <section className="placa-card space-y-4" aria-labelledby="report-review">
                <h2 id="report-review" className="text-lg font-bold text-ink">
                  {t('reports.reviewTitle')}
                </h2>
                <p className="placa-hint">{t('reports.reviewHint')}</p>
                <Button onClick={() => runAction('validate')} loading={actionBusy === 'validate'}>
                  {t('reports.validate')}
                </Button>
                <div className="border-t border-slate-200 pt-4">
                  <label htmlFor="return-reason" className="placa-label">
                    {t('reports.returnReason')}
                  </label>
                  <textarea
                    id="return-reason"
                    className="placa-input min-h-24"
                    value={returnReason}
                    onChange={(event) => setReturnReason(event.target.value)}
                    placeholder={t('reports.returnPlaceholder')}
                  />
                  <Button
                    variant="secondary"
                    className="mt-3"
                    onClick={() => runAction('return')}
                    loading={actionBusy === 'return'}
                    disabled={!returnReason.trim()}
                  >
                    {t('reports.return')}
                  </Button>
                </div>
              </section>
            )}
          </>
        )}

        <p className="text-sm leading-relaxed text-slate-600">{t('reports.privacyNote')}</p>
      </div>
    </AppShell>
  );
}

function ValuesTable({ values, t }) {
  if (!values.length) {
    return <p className="text-base text-slate-700">{t('reports.noCounts')}</p>;
  }

  const groups = new Map();
  for (const value of values) {
    const key = value.indicator_id;
    if (!groups.has(key)) {
      groups.set(key, { indicator: value.indicator, items: [] });
    }
    groups.get(key).items.push(value);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3">{t('reports.indicator')}</th>
            <th className="py-2 pr-3">{t('reports.breakdown')}</th>
            <th className="py-2 text-right">{t('reports.count')}</th>
          </tr>
        </thead>
        <tbody>
          {[...groups.values()].map(({ indicator, items }) =>
            items.map((item, index) => (
              <tr key={item.id} className="border-b border-slate-100 last:border-0">
                <td className="py-3 pr-3">
                  {index === 0 ? (
                    <>
                      <span className="font-semibold text-ink">{indicator?.name}</span>
                      <span className="block text-xs text-slate-500">{indicator?.code}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">{indicator?.name}</span>
                  )}
                </td>
                <td className="py-3 pr-3 text-slate-700">
                  {breakdownLabel(item.disaggregation_key, t)}
                </td>
                <td className="py-3 text-right text-base font-bold text-ink">
                  {item.value.toLocaleString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
