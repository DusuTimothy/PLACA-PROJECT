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
  createProgramme,
  deleteProgramme,
  listProgrammes,
  updateProgramme,
} from '../services/phase5Api';
import { errorMessage, getFieldErrors } from '../utils/errors';
import { canViewProgramme, formatDate, isPlaca } from '../utils/roles';

const KINDS = ['skills_training', 'orphan_support', 'stigma_support', 'testing_campaign'];
const STATUSES = ['planned', 'active', 'completed', 'cancelled'];

const emptyForm = {
  kind: 'skills_training',
  name: '',
  description: '',
  lga_id: '',
  organization_id: '',
  start_date: '',
  end_date: '',
  status: 'planned',
};

export default function ProgrammesPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const manager = isPlaca(user?.role);
  const viewer = canViewProgramme(user?.role);

  const [result, setResult] = useState({ data: [], pagination: null });
  const [lgas, setLgas] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [filters, setFilters] = useState({ kind: '', status: '', search: '' });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await listProgrammes({
        limit: 50,
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search ? { search: filters.search } : {}),
      });
      setResult(data || { data: [], pagination: null });
      setFromCache(Boolean(data?.from_cache));
    } catch (loadError) {
      setError(errorMessage(loadError, t));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.kind, filters.status, filters.search]);

  useEffect(() => {
    if (!viewer) return;
    listLgas()
      .then((rows) => setLgas(rows || []))
      .catch(() => setLgas([]));
    listOrganizations({ limit: 100, status: 'approved' })
      .then((data) => setOrganizations(data?.data || []))
      .catch(() => setOrganizations([]));
  }, [viewer]);

  const organizationOptions = useMemo(() => {
    if (!form.lga_id) return organizations;
    return organizations.filter((organization) => organization.lga_id === form.lga_id);
  }, [organizations, form.lga_id]);

  function updateForm(key, value) {
    setForm((current) => {
      if (key === 'lga_id') return { ...current, lga_id: value, organization_id: '' };
      return { ...current, [key]: value };
    });
  }

  function startNew() {
    setEditingId('');
    setForm(emptyForm);
    setFieldErrors({});
    setNotice('');
  }

  function startEdit(programme) {
    setEditingId(programme.id);
    setForm({
      kind: programme.kind,
      name: programme.name,
      description: programme.description || '',
      lga_id: programme.lga_id || '',
      organization_id: programme.organization_id || '',
      start_date: programme.start_date || '',
      end_date: programme.end_date || '',
      status: programme.status,
    });
    setFieldErrors({});
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    setFieldErrors({});

    const payload = {
      kind: form.kind,
      name: form.name.trim(),
      description: form.description.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status,
    };
    if (user?.role === 'laca_officer') {
      payload.lga_id = user.lga_id;
    } else if (manager && form.lga_id) {
      payload.lga_id = form.lga_id;
    }
    if (manager) payload.organization_id = form.organization_id || null;

    try {
      if (editingId) {
        await updateProgramme(editingId, payload);
        setNotice(t('phase5.programmes.updated'));
      } else {
        await createProgramme(payload);
        setNotice(t('phase5.programmes.created'));
      }
      startNew();
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError, t));
      setFieldErrors(getFieldErrors(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(programme) {
    if (!window.confirm(t('phase5.programmes.confirmDelete', { name: programme.name }))) return;
    setBusyId(programme.id);
    setError('');
    try {
      await deleteProgramme(programme.id);
      if (editingId === programme.id) startNew();
      setNotice(t('phase5.programmes.deleted'));
      await load();
    } catch (deleteError) {
      setError(errorMessage(deleteError, t));
    } finally {
      setBusyId('');
    }
  }

  const canEdit = (programme) => {
    if (manager) return true;
    if (user?.role === 'laca_officer') return programme.lga_id === user.lga_id;
    if (user?.role === 'partner_staff') return programme.organization_id === user.organization_id;
    return false;
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title={t('phase5.programmes.title')} intro={t('phase5.programmes.intro')} />

        {fromCache && <Alert variant="warning">{t('phase5.offline.showingSaved')}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        {viewer && (
          <form onSubmit={handleSubmit} className="placa-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-ink">
                {editingId ? t('phase5.programmes.editTitle') : t('phase5.programmes.newTitle')}
              </h2>
              {editingId && (
                <Button variant="ghost" onClick={startNew}>
                  {t('phase5.programmes.cancelEdit')}
                </Button>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label={t('phase5.programmes.kind')}
                value={form.kind}
                onChange={(event) => updateForm('kind', event.target.value)}
                required
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`phase5.programmes.kinds.${kind}`)}
                  </option>
                ))}
              </Select>
              <Select
                label={t('phase5.programmes.status')}
                value={form.status}
                onChange={(event) => updateForm('status', event.target.value)}
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`status.${status}`)}
                  </option>
                ))}
              </Select>
            </div>

            <Input
              label={t('phase5.programmes.name')}
              value={form.name}
              onChange={(event) => updateForm('name', event.target.value)}
              error={fieldErrors.name}
              required
            />

            <div>
              <label htmlFor="programme-description" className="placa-label">
                {t('phase5.programmes.description')}
              </label>
              <textarea
                id="programme-description"
                className="placa-input min-h-24"
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
              />
              <p className="placa-hint">{t('phase5.programmes.descriptionHint')}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {manager && (
                <>
                  <Select
                    label={t('phase5.programmes.lga')}
                    value={form.lga_id}
                    onChange={(event) => updateForm('lga_id', event.target.value)}
                    error={fieldErrors.lga_id}
                    required
                  >
                    <option value="">{t('phase5.programmes.chooseLga')}</option>
                    {lgas.map((lga) => (
                      <option key={lga.id} value={lga.id}>
                        {lga.name}
                      </option>
                    ))}
                  </Select>
                  <Select
                    label={t('phase5.programmes.organization')}
                    value={form.organization_id}
                    onChange={(event) => updateForm('organization_id', event.target.value)}
                    hint={t('phase5.programmes.organizationHint')}
                  >
                    <option value="">{t('phase5.programmes.lgaWide')}</option>
                    {organizationOptions.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {organization.name}
                      </option>
                    ))}
                  </Select>
                </>
              )}
              {user?.role === 'laca_officer' && (
                <p className="text-sm text-slate-600 sm:col-span-2">
                  {t('phase5.programmes.lgaFixed', { lga: user?.lga?.name || '' })}
                </p>
              )}
              {user?.role === 'partner_staff' && (
                <p className="text-sm text-slate-600 sm:col-span-2">
                  {t('phase5.programmes.organizationFixed', {
                    organization: user?.organization?.name || '',
                  })}
                </p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('phase5.programmes.startDate')}
                type="date"
                value={form.start_date}
                onChange={(event) => updateForm('start_date', event.target.value)}
                error={fieldErrors.start_date}
              />
              <Input
                label={t('phase5.programmes.endDate')}
                type="date"
                value={form.end_date}
                onChange={(event) => updateForm('end_date', event.target.value)}
                error={fieldErrors.end_date}
              />
            </div>

            <Button type="submit" loading={saving}>
              {editingId ? t('common.save') : t('phase5.programmes.create')}
            </Button>
          </form>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <Input
            label={t('phase5.programmes.search')}
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            className="w-full sm:w-64"
          />
          <Select
            label={t('phase5.programmes.kind')}
            value={filters.kind}
            onChange={(event) => setFilters((current) => ({ ...current, kind: event.target.value }))}
            className="w-full sm:w-56"
          >
            <option value="">{t('phase5.programmes.allKinds')}</option>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`phase5.programmes.kinds.${kind}`)}
              </option>
            ))}
          </Select>
          <Select
            label={t('phase5.programmes.status')}
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            className="w-full sm:w-48"
          >
            <option value="">{t('phase5.programmes.allStatuses')}</option>
            {STATUSES.map((status) => (
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
            <p className="text-base text-slate-700">{t('phase5.programmes.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {result.data.map((programme) => (
              <li key={programme.id} className="placa-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-ink">{programme.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {t(`phase5.programmes.kinds.${programme.kind}`)}
                      {programme.organization?.name ? ` · ${programme.organization.name}` : ''}
                      {programme.lga?.name ? ` · ${programme.lga.name}` : ''}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {programme.start_date
                        ? `${formatDate(programme.start_date, i18n.language)} – ${
                            programme.end_date
                              ? formatDate(programme.end_date, i18n.language)
                              : t('phase5.programmes.ongoing')
                          }`
                        : t('phase5.programmes.noDates')}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={programme.status} />
                    {canEdit(programme) && (
                      <>
                        <Button variant="ghost" onClick={() => startEdit(programme)}>
                          {t('common.edit')}
                        </Button>
                        <Button
                          variant="danger"
                          loading={busyId === programme.id}
                          onClick={() => handleDelete(programme)}
                        >
                          {t('common.delete')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {programme.description && (
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{programme.description}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm leading-relaxed text-slate-600">{t('phase5.programmes.privacyNote')}</p>
      </div>
    </AppShell>
  );
}
