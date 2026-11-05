import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import {
  approveOrganization,
  createOrganization,
  listLgas,
  listOrganizations,
  suspendOrganization,
} from '../services/programmeApi';
import { errorMessage, getFieldErrors } from '../utils/errors';
import { canManageOrganizations, isPlaca } from '../utils/roles';

const TYPES = ['ngo', 'cbo', 'faith_based', 'private_sector', 'government_mda', 'laca'];

const emptyForm = {
  name: '',
  type: 'cbo',
  lga_id: '',
  focus_areas: '',
  contact_name: '',
  contact_phone: '',
  contact_email: '',
};

export default function OrganizationsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const canRegister = canManageOrganizations(user?.role);
  const canApprove = isPlaca(user?.role);

  const [filters, setFilters] = useState({ search: '', status: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], pagination: null });
  const [lgas, setLgas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listOrganizations({
        page,
        limit: 20,
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      });
      setResult(data);
    } catch (loadError) {
      setError(errorMessage(loadError, t));
    } finally {
      setLoading(false);
    }
  }, [page, filters.search, filters.status, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    listLgas()
      .then((data) => {
        if (active) setLgas(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  function updateFilter(key, value) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateForm(key, value) {
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    setFieldErrors({});
    try {
      await createOrganization({
        name: form.name,
        type: form.type,
        lga_id: form.lga_id,
        focus_areas: form.focus_areas
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        contact_email: form.contact_email || null,
      });
      setForm(emptyForm);
      setShowForm(false);
      setNotice(t('organizations.created'));
      await load();
    } catch (createError) {
      setError(errorMessage(createError, t));
      setFieldErrors(getFieldErrors(createError));
    } finally {
      setSaving(false);
    }
  }

  async function handleDecision(organization, action) {
    if (action === 'suspend' && !window.confirm(t('organizations.confirmSuspend', { name: organization.name }))) {
      return;
    }
    setBusyId(organization.id);
    setError('');
    setNotice('');
    try {
      if (action === 'approve') {
        await approveOrganization(organization.id);
        setNotice(t('organizations.approved', { name: organization.name }));
      } else {
        await suspendOrganization(organization.id);
        setNotice(t('organizations.suspended', { name: organization.name }));
      }
      await load();
    } catch (decisionError) {
      setError(errorMessage(decisionError, t));
    } finally {
      setBusyId(null);
    }
  }

  const pagination = result.pagination;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t('organizations.title')}</h1>
          <p className="mt-1 max-w-2xl text-base leading-relaxed text-slate-600">
            {t('organizations.intro')}
          </p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        <div className="flex flex-wrap items-end gap-3">
          <Input
            label={t('organizations.searchLabel')}
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder={t('organizations.searchPlaceholder')}
            className="w-full sm:max-w-xs"
          />
          <Select
            label={t('organizations.statusFilter')}
            value={filters.status}
            onChange={(event) => updateFilter('status', event.target.value)}
            className="w-full sm:w-44"
          >
            <option value="">{t('organizations.allStatuses')}</option>
            {['pending', 'approved', 'suspended'].map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </Select>
          {canRegister && (
            <Button
              variant={showForm ? 'secondary' : 'primary'}
              onClick={() => setShowForm((value) => !value)}
            >
              {showForm ? t('common.cancel') : t('organizations.add')}
            </Button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="placa-card space-y-4">
            <h2 className="text-lg font-bold text-ink">{t('organizations.formTitle')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('organizations.name')}
                required
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                error={fieldErrors.name}
              />
              <Select
                label={t('organizations.type')}
                required
                value={form.type}
                onChange={(event) => updateForm('type', event.target.value)}
                error={fieldErrors.type}
              >
                {TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`orgTypes.${type}`)}
                  </option>
                ))}
              </Select>
              <Select
                label={t('organizations.lga')}
                required
                value={form.lga_id}
                onChange={(event) => updateForm('lga_id', event.target.value)}
                error={fieldErrors.lga_id}
              >
                <option value="">{t('organizations.chooseLga')}</option>
                {lgas.map((lga) => (
                  <option key={lga.id} value={lga.id}>
                    {lga.name}
                  </option>
                ))}
              </Select>
              <Input
                label={t('organizations.focusAreas')}
                hint={t('organizations.focusHint')}
                value={form.focus_areas}
                onChange={(event) => updateForm('focus_areas', event.target.value)}
                error={fieldErrors.focus_areas}
              />
              <Input
                label={t('organizations.contactName')}
                value={form.contact_name}
                onChange={(event) => updateForm('contact_name', event.target.value)}
                error={fieldErrors.contact_name}
              />
              <Input
                label={t('organizations.contactPhone')}
                type="tel"
                inputMode="tel"
                value={form.contact_phone}
                onChange={(event) => updateForm('contact_phone', event.target.value)}
                error={fieldErrors.contact_phone}
              />
              <Input
                label={t('organizations.contactEmail')}
                type="email"
                value={form.contact_email}
                onChange={(event) => updateForm('contact_email', event.target.value)}
                error={fieldErrors.contact_email}
                className="sm:col-span-2"
              />
            </div>
            <p className="placa-hint">{t('organizations.pendingNote')}</p>
            <Button type="submit" loading={saving}>
              {t('organizations.create')}
            </Button>
          </form>
        )}

        {loading ? (
          <p className="text-base text-slate-600">{t('common.loading')}</p>
        ) : result.data.length === 0 ? (
          <div className="placa-card">
            <p className="text-base text-slate-700">{t('organizations.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {result.data.map((organization) => (
              <li key={organization.id} className="placa-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-ink">{organization.name}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {t(`orgTypes.${organization.type}`)} · {organization.lga?.name}
                    </p>
                    {organization.focus_areas?.length > 0 && (
                      <p className="mt-1 text-sm text-slate-600">
                        {t('organizations.focusLabel')}: {organization.focus_areas.join(', ')}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-slate-600">
                      {organization.contact_name || t('organizations.noContact')}
                      {organization.contact_phone ? ` · ${organization.contact_phone}` : ''}
                      {organization.contact_email ? ` · ${organization.contact_email}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={organization.status} />
                    {canApprove && organization.status !== 'approved' && (
                      <Button
                        variant="secondary"
                        loading={busyId === organization.id}
                        onClick={() => handleDecision(organization, 'approve')}
                      >
                        {t('organizations.approve')}
                      </Button>
                    )}
                    {canApprove && organization.status === 'approved' && (
                      <>
                        <Button
                          variant="secondary"
                          onClick={() => navigate(`/users?organization_id=${organization.id}`)}
                        >
                          {t('organizations.inviteStaff')}
                        </Button>
                        <Button
                          variant="danger"
                          loading={busyId === organization.id}
                          onClick={() => handleDecision(organization, 'suspend')}
                        >
                          {t('organizations.suspend')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
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
