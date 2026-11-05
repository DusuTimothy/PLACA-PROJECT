import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { listOrganizations } from '../services/programmeApi';
import { createUser, listUsers, resendInvitation, updateUser } from '../services/userApi';
import { errorMessage, getFieldErrors } from '../utils/errors';
import {
  canChangeRoles,
  canCreatePartnerStaff,
  canManageTargetUserRole,
  formatDate,
  getAllowedRolesToAssign,
  isElevatedRole,
} from '../utils/roles';

const emptyForm = {
  name: '',
  email: '',
  organization_id: '',
};

export default function UsersPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const canCreate = canCreatePartnerStaff(user?.role);

  // The user list does not depend on the interface language. Keeping the
  // latest translator in a ref stops a language switch from refetching data and
  // briefly replacing the list with a loading message.
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);

  const initialOrgId = searchParams.get('organization_id') || searchParams.get('org_id') || '';

  const [filters, setFilters] = useState({ search: '', role: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ data: [], pagination: null });
  const [approvedOrgs, setApprovedOrgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(null);
  const [warning, setWarning] = useState('');
  const [busyId, setBusyId] = useState(null);

  const [showForm, setShowForm] = useState(Boolean(initialOrgId && canCreate));
  const [form, setForm] = useState({ ...emptyForm, organization_id: initialOrgId });
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [editingUserId, setEditingUserId] = useState(null);
  const [selectedRole, setSelectedRole] = useState('');
  const [savingRoleId, setSavingRoleId] = useState(null);

  const allowedRoles = getAllowedRolesToAssign(user?.role);

  // Load approved organizations for the partner staff form dropdown.
  // Only approved organizations may be linked to partner staff.
  useEffect(() => {
    let active = true;
    setLoadingOrgs(true);
    listOrganizations({ status: 'approved', limit: 100 })
      .then((res) => {
        if (!active) return;
        let orgs = (res?.data || []).filter((org) => org.status === 'approved');
        // Respect current user's permitted scope if restricted to an LGA.
        if (user?.role === 'laca_officer' && user?.lga_id) {
          orgs = orgs.filter((org) => org.lga_id === user.lga_id);
        }
        setApprovedOrgs(orgs);
      })
      .catch((orgError) => {
        if (active) {
          setError(errorMessage(orgError, t));
        }
      })
      .finally(() => {
        if (active) setLoadingOrgs(false);
      });

    return () => {
      active = false;
    };
  }, [user?.role, user?.lga_id, t]);

  // Keep form organization_id in sync if URL query param changes.
  useEffect(() => {
    if (initialOrgId) {
      setForm((prev) => ({ ...prev, organization_id: initialOrgId }));
      if (canCreate) {
        setShowForm(true);
      }
    }
  }, [initialOrgId, canCreate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listUsers({
        page,
        limit: 20,
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.role ? { role: filters.role } : {}),
      });
      setResult(data);
    } catch (loadError) {
      setError(errorMessage(loadError, tRef.current));
    } finally {
      setLoading(false);
    }
  }, [page, filters.search, filters.role]);

  useEffect(() => {
    load();
  }, [load]);

  function updateFilter(key, value) {
    setPage(1);
    setEditingUserId(null);
    setSelectedRole('');
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function updateForm(key, value) {
    setFieldErrors((current) => ({ ...current, [key]: undefined }));
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    if (!canCreate) {
      setError(t('users.unauthorizedAction'));
      return;
    }

    const errors = {};
    if (!form.name.trim() || form.name.trim().length < 2) {
      errors.name = t('common.required');
    }
    if (!form.email.trim() || !form.email.includes('@')) {
      errors.email = t('common.required');
    }
    if (!form.organization_id) {
      errors.organization_id = t('common.required');
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSaving(true);
    setError('');
    setNotice(null);
    setWarning('');
    setFieldErrors({});

    try {
      const response = await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        role: 'partner_staff',
        organization_id: form.organization_id,
        language: i18n.language === 'ha' ? 'ha' : 'en',
        send_email: true,
      });

      const createdUser = response?.user;
      const emailSent = Boolean(response?.emailSent);
      const delivery = response?.emailDelivery || {};
      const sandboxed = Boolean(delivery.sandboxed);
      const reason = delivery.reason;

      // Report actual email delivery status as confirmed by the API.
      // Do not expose temporary passwords or tokens in UI or logs.
      if (emailSent) {
        if (sandboxed) {
          setNotice({
            variant: 'info',
            text: t('users.successSandboxed', {
              name: createdUser?.name || form.name.trim(),
            }),
          });
        } else {
          setNotice({
            variant: 'success',
            text: t('users.successSent', {
              name: createdUser?.name || form.name.trim(),
              email: createdUser?.email || form.email.trim(),
            }),
          });
        }
      } else {
        // Email was not sent; explain why clearly.
        if (reason === 'not_configured') {
          setWarning(
            t('users.emailNotConfigured', {
              name: createdUser?.name || form.name.trim(),
            })
          );
        } else if (reason === 'send_failed') {
          setWarning(
            t('users.emailSendFailed', {
              name: createdUser?.name || form.name.trim(),
            })
          );
        } else {
          setWarning(
            t('users.emailNotSent', {
              name: createdUser?.name || form.name.trim(),
            })
          );
        }
      }

      setForm(emptyForm);
      setShowForm(false);
      await load();
    } catch (createError) {
      setError(errorMessage(createError, t));
      setFieldErrors(getFieldErrors(createError));
    } finally {
      setSaving(false);
    }
  }

  async function handleResend(targetUser) {
    setBusyId(targetUser.id);
    setError('');
    setNotice(null);
    setWarning('');
    try {
      const response = await resendInvitation(targetUser.id);
      const emailSent = Boolean(response?.emailSent);
      const delivery = response?.emailDelivery || {};
      const sandboxed = Boolean(delivery.sandboxed);
      const reason = delivery.reason;

      if (emailSent) {
        if (sandboxed) {
          setNotice({
            variant: 'info',
            text: t('users.resendSandboxed'),
          });
        } else {
          setNotice({
            variant: 'success',
            text: t('users.resendSuccess', { email: targetUser.email }),
          });
        }
      } else {
        if (reason === 'not_configured') {
          setWarning(t('users.emailNotConfigured', { name: targetUser.name }));
        } else {
          setWarning(t('users.resendFailed'));
        }
      }
    } catch (resendError) {
      setError(errorMessage(resendError, t));
    } finally {
      setBusyId(null);
    }
  }

  function openRoleChange(targetUser) {
    setError('');
    setNotice(null);
    setWarning('');
    if (editingUserId === targetUser.id) {
      setEditingUserId(null);
      setSelectedRole('');
    } else {
      setEditingUserId(targetUser.id);
      setSelectedRole(targetUser.role || '');
    }
  }

  async function handleSaveRole(targetUser) {
    if (!canManageTargetUserRole(user, targetUser)) {
      if (targetUser.id === user?.id) {
        setError(t('users.cannotChangeSelf'));
      } else {
        setError(t('errors.ROLE_CHANGE_NOT_ALLOWED'));
      }
      return;
    }

    if (!selectedRole || selectedRole === targetUser.role) {
      setError(t('users.roleUnchanged'));
      return;
    }

    if (user?.role !== 'admin' && selectedRole === 'admin') {
      setError(t('errors.ROLE_NOT_ALLOWED'));
      return;
    }

    const isElevated = isElevatedRole(selectedRole);
    const newRoleLabel = t(`roles.${selectedRole}`, { defaultValue: selectedRole });
    const oldRoleLabel = t(`roles.${targetUser.role}`, { defaultValue: targetUser.role });

    const confirmMessage = isElevated
      ? t('users.confirmRoleChangeElevated', {
          name: targetUser.name,
          newRole: newRoleLabel,
        })
      : t('users.confirmRoleChange', {
          name: targetUser.name,
          oldRole: oldRoleLabel,
          newRole: newRoleLabel,
        });

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setSavingRoleId(targetUser.id);
    setError('');
    setNotice(null);
    setWarning('');

    try {
      await updateUser(targetUser.id, { role: selectedRole });
      setNotice({
        variant: 'success',
        text: t('users.roleChangedSuccess', {
          name: targetUser.name,
          role: newRoleLabel,
        }),
      });
      setEditingUserId(null);
      setSelectedRole('');
      await load();
    } catch (updateError) {
      setError(errorMessage(updateError, t));
    } finally {
      setSavingRoleId(null);
    }
  }

  const pagination = result.pagination;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{t('users.title')}</h1>
          <p className="mt-1 max-w-2xl text-base leading-relaxed text-slate-600">
            {t('users.intro')}
          </p>
        </div>

        {error && <Alert variant="error">{error}</Alert>}
        {warning && <Alert variant="warning">{warning}</Alert>}
        {notice && <Alert variant={notice.variant}>{notice.text}</Alert>}

        <div className="flex flex-wrap items-end gap-3">
          <Input
            label={t('users.searchLabel')}
            type="search"
            value={filters.search}
            onChange={(event) => updateFilter('search', event.target.value)}
            placeholder={t('users.searchPlaceholder')}
            className="w-full sm:max-w-xs"
          />
          <Select
            label={t('users.roleFilter')}
            value={filters.role}
            onChange={(event) => updateFilter('role', event.target.value)}
            className="w-full sm:w-48"
          >
            <option value="">{t('users.allRoles')}</option>
            {['partner_staff', 'laca_officer', 'placa_officer', 'placa_director', 'admin'].map(
              (roleKey) => (
                <option key={roleKey} value={roleKey}>
                  {t(`roles.${roleKey}`)}
                </option>
              )
            )}
          </Select>
          {canCreate && (
            <Button
              variant={showForm ? 'secondary' : 'primary'}
              onClick={() => setShowForm((value) => !value)}
            >
              {showForm ? t('common.cancel') : t('users.addPartnerStaff')}
            </Button>
          )}
        </div>

        {canCreate && showForm && (
          <form onSubmit={handleCreate} className="placa-card space-y-4" noValidate>
            <h2 className="text-lg font-bold text-ink">{t('users.formTitle')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('users.name')}
                required
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                placeholder={t('users.namePlaceholder')}
                error={fieldErrors.name}
              />
              <Input
                label={t('users.email')}
                type="email"
                required
                value={form.email}
                onChange={(event) => updateForm('email', event.target.value)}
                placeholder={t('users.emailPlaceholder')}
                error={fieldErrors.email}
              />
              <Select
                label={t('users.organization')}
                required
                value={form.organization_id}
                onChange={(event) => updateForm('organization_id', event.target.value)}
                error={fieldErrors.organization_id}
                disabled={loadingOrgs}
                className="sm:col-span-2"
              >
                <option value="">{t('users.chooseOrganization')}</option>
                {approvedOrgs.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                    {org.lga?.name ? ` (${org.lga.name})` : ''}
                  </option>
                ))}
              </Select>
            </div>
            <p className="placa-hint">{t('users.inviteNote')}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" loading={saving}>
                {t('users.createAndInvite')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setFieldErrors({});
                }}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-base text-slate-600">{t('common.loading')}</p>
        ) : result.data.length === 0 ? (
          <div className="placa-card">
            <p className="text-base text-slate-700">{t('users.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {result.data.map((u) => (
              <li key={u.id} className="placa-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-ink">
                      {u.name}
                      {user?.id === u.id && (
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {t('users.selfAccount')}
                        </span>
                      )}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {t(`roles.${u.role}`, { defaultValue: u.role })}
                      {u.organization?.name ? ` · ${u.organization.name}` : ''}
                      {u.lga?.name ? ` · ${u.lga.name}` : ''}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {u.email || u.phone || ''}
                      {u.created_at && (
                        <span className="text-slate-400">
                          {' · '}
                          {formatDate(u.created_at, i18n.language)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={u.is_active ? 'active' : 'suspended'} />
                    {canManageTargetUserRole(user, u) && (
                      <Button
                        variant="secondary"
                        onClick={() => openRoleChange(u)}
                        aria-label={`${t('users.changeRole')} - ${u.name}`}
                      >
                        {t('users.changeRole')}
                      </Button>
                    )}
                    {canCreate && u.role === 'partner_staff' && u.email && (
                      <Button
                        variant="secondary"
                        loading={busyId === u.id}
                        onClick={() => handleResend(u)}
                      >
                        {t('users.resendInvite')}
                      </Button>
                    )}
                  </div>
                </div>

                {canManageTargetUserRole(user, u) && editingUserId === u.id && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      handleSaveRole(u);
                    }}
                    className="mt-4 space-y-3 border-t border-slate-200 pt-4"
                  >
                    <div>
                      <h3 className="text-sm font-semibold text-ink">
                        {t('users.changeRoleTitle', { name: u.name })}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {t('users.currentRole', {
                          role: t(`roles.${u.role}`, { defaultValue: u.role }),
                        })}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <Select
                        id={`user-role-${u.id}`}
                        label={t('users.newRole')}
                        value={selectedRole}
                        onChange={(event) => setSelectedRole(event.target.value)}
                        className="w-full sm:w-64"
                      >
                        <option value="">{t('users.selectRole')}</option>
                        {allowedRoles.map((roleKey) => (
                          <option key={roleKey} value={roleKey}>
                            {t(`roles.${roleKey}`)}
                          </option>
                        ))}
                      </Select>
                      <div className="flex gap-2">
                        <Button
                          type="submit"
                          loading={savingRoleId === u.id}
                        >
                          {t('users.saveRole')}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            setEditingUserId(null);
                            setSelectedRole('');
                          }}
                        >
                          {t('common.cancel')}
                        </Button>
                      </div>
                    </div>
                    {selectedRole && isElevatedRole(selectedRole) && (
                      <p
                        role="alert"
                        className="rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800"
                      >
                        {t('users.elevatedRoleWarning')}
                      </p>
                    )}
                  </form>
                )}
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
