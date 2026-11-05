import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PageHeader from '../components/ui/PageHeader';
import Select from '../components/ui/Select';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { listEquipment } from '../services/phase5Api';
import {
  changeSupportStatus,
  confirmReceipt,
  createSupportRequestOfflineFirst,
  decideSupportRequest,
  listSupportRequests,
  recordSupply,
} from '../services/phase5Api';
import { errorMessage, getFieldErrors } from '../utils/errors';
import { formatDate } from '../utils/roles';
import { isPartner, isPlaca } from '../utils/roles';

const KINDS = ['equipment', 'training', 'technical'];
const STATUSES = ['requested', 'approved', 'rejected', 'in_transit', 'delivered', 'closed'];

function newClientUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export default function SupportRequestsPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const partner = isPartner(user?.role);
  const manager = isPlaca(user?.role);

  const [result, setResult] = useState({ data: [], pagination: null });
  const [equipment, setEquipment] = useState([]);
  const [filters, setFilters] = useState({ status: '', kind: '' });
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [openId, setOpenId] = useState('');
  const [busyId, setBusyId] = useState('');
  const [decision, setDecision] = useState({ id: '', note: '', quantities: {} });
  const [delivery, setDelivery] = useState({ id: '', quantities: {}, note: '' });
  const [form, setForm] = useState({
    client_uuid: newClientUuid(),
    kind: 'equipment',
    description: '',
    items: [{ equipment_item_id: '', qty_requested: '1' }],
  });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await listSupportRequests({
        limit: 50,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.kind ? { kind: filters.kind } : {}),
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
  }, [filters.status, filters.kind]);

  useEffect(() => {
    if (!partner) return;
    listEquipment({ limit: 100 })
      .then((data) => setEquipment(data?.data || []))
      .catch(() => setEquipment([]));
  }, [partner]);

  function updateItem(index, key, value) {
    setForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [key]: value } : item
      ),
    }));
  }

  function addItem() {
    setForm((current) => ({
      ...current,
      items: [...current.items, { equipment_item_id: '', qty_requested: '1' }],
    }));
  }

  function removeItem(index) {
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    setFieldErrors({});

    const items =
      form.kind === 'equipment'
        ? form.items
            .filter((item) => item.equipment_item_id)
            .map((item) => ({
              equipment_item_id: item.equipment_item_id,
              qty_requested: Number(item.qty_requested),
            }))
        : [];

    try {
      const outcome = await createSupportRequestOfflineFirst(
        {
          client_uuid: form.client_uuid,
          kind: form.kind,
          description: form.description,
          items,
        },
        t('phase5.support.requestLabel')
      );

      if (outcome.queued) {
        setNotice(t('phase5.support.queued'));
      } else {
        setNotice(t('phase5.support.created'));
      }

      setForm({
        client_uuid: newClientUuid(),
        kind: 'equipment',
        description: '',
        items: [{ equipment_item_id: '', qty_requested: '1' }],
      });
      if (!outcome.queued) await load();
    } catch (createError) {
      setError(errorMessage(createError, t));
      setFieldErrors(getFieldErrors(createError));
    } finally {
      setSaving(false);
    }
  }

  function startDecision(request) {
    const quantities = {};
    for (const item of request.items || []) quantities[item.id] = String(item.qty_requested);
    setDecision({ id: request.id, note: '', quantities });
    setDelivery({ id: '', quantities: {}, note: '' });
  }

  async function submitDecision(request, approve) {
    setBusyId(request.id);
    setError('');
    try {
      await decideSupportRequest(request.id, {
        decision: approve ? 'approve' : 'reject',
        note: decision.note || undefined,
        items: approve
          ? (request.items || []).map((item) => ({
              id: item.id,
              qty_approved: Number(decision.quantities[item.id] || 0),
            }))
          : undefined,
      });
      setDecision({ id: '', note: '', quantities: {} });
      setNotice(approve ? t('phase5.support.approved') : t('phase5.support.rejected'));
      await load();
    } catch (decisionError) {
      setError(errorMessage(decisionError, t));
    } finally {
      setBusyId('');
    }
  }

  function startDelivery(request) {
    const quantities = {};
    for (const item of request.items || []) {
      const delivered = (request.supply_records || [])
        .filter((record) => record.support_request_item_id === item.id)
        .reduce((total, record) => total + Number(record.qty_delivered || 0), 0);
      quantities[item.id] = String(Math.max(0, Number(item.qty_approved || 0) - delivered));
    }
    setDelivery({ id: request.id, quantities, note: '' });
    setDecision({ id: '', note: '', quantities: {} });
  }

  async function submitDelivery(request) {
    setBusyId(request.id);
    setError('');
    try {
      const items = (request.items || [])
        .map((item) => ({
          support_request_item_id: item.id,
          qty_delivered: Number(delivery.quantities[item.id] || 0),
        }))
        .filter((item) => item.qty_delivered > 0);

      await recordSupply(request.id, { items, note: delivery.note || undefined });
      setDelivery({ id: '', quantities: {}, note: '' });
      setNotice(t('phase5.support.supplied'));
      await load();
    } catch (deliveryError) {
      setError(errorMessage(deliveryError, t));
    } finally {
      setBusyId('');
    }
  }

  async function handleConfirm(request) {
    setBusyId(request.id);
    setError('');
    try {
      await confirmReceipt(request.id);
      setNotice(t('phase5.support.received'));
      await load();
    } catch (confirmError) {
      setError(errorMessage(confirmError, t));
    } finally {
      setBusyId('');
    }
  }

  async function handleClose(request) {
    setBusyId(request.id);
    setError('');
    try {
      await changeSupportStatus(request.id, { status: 'closed' });
      setNotice(t('phase5.support.closed'));
      await load();
    } catch (closeError) {
      setError(errorMessage(closeError, t));
    } finally {
      setBusyId('');
    }
  }

  const canCreate = partner;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title={t('phase5.support.title')} intro={t('phase5.support.intro')} />

        {fromCache && <Alert variant="warning">{t('phase5.offline.showingSaved')}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        {canCreate && (
          <form onSubmit={handleCreate} className="placa-card space-y-4">
            <h2 className="text-lg font-bold text-ink">{t('phase5.support.newTitle')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label={t('phase5.support.kind')}
                value={form.kind}
                onChange={(event) =>
                  setForm((current) => ({ ...current, kind: event.target.value }))
                }
              >
                {KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {t(`phase5.support.kinds.${kind}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="support-description" className="placa-label">
                {t('phase5.support.description')}
              </label>
              <textarea
                id="support-description"
                className="placa-input min-h-24"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                aria-invalid={fieldErrors.description ? 'true' : 'false'}
                required
              />
              {fieldErrors.description && (
                <p className="mt-1 text-sm font-medium text-red-800">{fieldErrors.description}</p>
              )}
              <p className="placa-hint">{t('phase5.support.descriptionHint')}</p>
            </div>

            {form.kind === 'equipment' && (
              <fieldset className="space-y-3">
                <legend className="placa-label">{t('phase5.support.itemsTitle')}</legend>
                <p className="placa-hint">{t('phase5.support.itemsHint')}</p>
                {form.items.map((item, index) => (
                  <div key={index} className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                    <Select
                      label={t('phase5.support.item')}
                      value={item.equipment_item_id}
                      onChange={(event) => updateItem(index, 'equipment_item_id', event.target.value)}
                    >
                      <option value="">{t('phase5.support.chooseItem')}</option>
                      {equipment.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name} ({row.unit})
                        </option>
                      ))}
                    </Select>
                    <Input
                      label={t('phase5.support.quantity')}
                      type="number"
                      min="1"
                      value={item.qty_requested}
                      onChange={(event) => updateItem(index, 'qty_requested', event.target.value)}
                    />
                    <Button
                      variant="ghost"
                      className="self-end"
                      onClick={() => removeItem(index)}
                      disabled={form.items.length === 1}
                    >
                      {t('workplans.removeTarget')}
                    </Button>
                  </div>
                ))}
                <Button variant="secondary" onClick={addItem}>
                  {t('phase5.support.addItem')}
                </Button>
              </fieldset>
            )}

            {fieldErrors.items && (
              <Alert variant="error">{fieldErrors.items}</Alert>
            )}

            <Button type="submit" loading={saving}>
              {t('phase5.support.create')}
            </Button>
            <p className="placa-hint">{t('phase5.support.offlineHint')}</p>
          </form>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <Select
            label={t('phase5.support.statusFilter')}
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            className="w-full sm:w-52"
          >
            <option value="">{t('phase5.support.allStatuses')}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`status.${status}`)}
              </option>
            ))}
          </Select>
          <Select
            label={t('phase5.support.kindFilter')}
            value={filters.kind}
            onChange={(event) => setFilters((current) => ({ ...current, kind: event.target.value }))}
            className="w-full sm:w-52"
          >
            <option value="">{t('phase5.support.allKinds')}</option>
            {KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`phase5.support.kinds.${kind}`)}
              </option>
            ))}
          </Select>
        </div>

        {loading ? (
          <p className="text-base text-slate-600">{t('common.loading')}</p>
        ) : result.data.length === 0 ? (
          <div className="placa-card">
            <p className="text-base text-slate-700">{t('phase5.support.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {result.data.map((request) => {
              const open = openId === request.id;
              const remaining = (request.items || []).map((item) => {
                const delivered = (request.supply_records || [])
                  .filter((record) => record.support_request_item_id === item.id)
                  .reduce((total, record) => total + Number(record.qty_delivered || 0), 0);
                return { item, delivered, remaining: Number(item.qty_approved || 0) - delivered };
              });

              return (
                <li key={request.id} className="placa-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <button
                      type="button"
                      className="text-left"
                      aria-expanded={open}
                      onClick={() => setOpenId(open ? '' : request.id)}
                    >
                      <span className="block text-lg font-bold text-ink">
                        {t(`phase5.support.kinds.${request.kind}`)}
                        {request.organization?.name ? ` · ${request.organization.name}` : ''}
                      </span>
                      <span className="mt-1 block text-sm text-slate-600">
                        {formatDate(request.created_at, i18n.language)}
                        {request.organization?.lga?.name ? ` · ${request.organization.lga.name}` : ''}
                        {request.overdue ? ` · ${t('phase5.support.overdue')}` : ''}
                      </span>
                    </button>
                    <StatusBadge status={request.status} />
                  </div>

                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{request.description}</p>

                  {open && (
                    <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
                      {request.items?.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[28rem] text-left text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                                <th className="py-2 pr-3">{t('phase5.support.item')}</th>
                                <th className="py-2 pr-3 text-right">{t('phase5.support.requested')}</th>
                                <th className="py-2 pr-3 text-right">{t('phase5.support.approvedQty')}</th>
                                <th className="py-2 text-right">{t('phase5.support.deliveredQty')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {request.items.map((item) => {
                                const line = remaining.find((row) => row.item.id === item.id);
                                return (
                                  <tr key={item.id} className="border-b border-slate-100 last:border-0">
                                    <td className="py-2 pr-3">{item.equipment_item?.name || item.equipment_item_id}</td>
                                    <td className="py-2 pr-3 text-right tabular-nums">{item.qty_requested}</td>
                                    <td className="py-2 pr-3 text-right tabular-nums">{item.qty_approved}</td>
                                    <td className="py-2 text-right tabular-nums">{line?.delivered || 0}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {request.decision_note && (
                        <Alert variant="info">{request.decision_note}</Alert>
                      )}

                      {manager && request.status === 'requested' && (
                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <h3 className="font-bold text-ink">{t('phase5.support.decideTitle')}</h3>
                          {decision.id === request.id ? (
                            <>
                              {(request.items || []).map((item) => (
                                <Input
                                  key={item.id}
                                  label={`${item.equipment_item?.name || item.equipment_item_id} — ${t('phase5.support.approvedQty')}`}
                                  type="number"
                                  min="0"
                                  max={item.qty_requested}
                                  value={decision.quantities[item.id] || ''}
                                  onChange={(event) =>
                                    setDecision((current) => ({
                                      ...current,
                                      quantities: { ...current.quantities, [item.id]: event.target.value },
                                    }))
                                  }
                                />
                              ))}
                              <div>
                                <label htmlFor={`decision-note-${request.id}`} className="placa-label">
                                  {t('phase5.support.note')}
                                </label>
                                <textarea
                                  id={`decision-note-${request.id}`}
                                  className="placa-input min-h-20"
                                  value={decision.note}
                                  onChange={(event) =>
                                    setDecision((current) => ({ ...current, note: event.target.value }))
                                  }
                                  placeholder={t('phase5.support.notePlaceholder')}
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  loading={busyId === request.id}
                                  onClick={() => submitDecision(request, true)}
                                >
                                  {t('phase5.support.approve')}
                                </Button>
                                <Button
                                  variant="danger"
                                  loading={busyId === request.id}
                                  onClick={() => submitDecision(request, false)}
                                  disabled={!decision.note.trim()}
                                >
                                  {t('phase5.support.reject')}
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => setDecision({ id: '', note: '', quantities: {} })}
                                >
                                  {t('common.cancel')}
                                </Button>
                              </div>
                            </>
                          ) : (
                            <Button variant="secondary" onClick={() => startDecision(request)}>
                              {t('phase5.support.review')}
                            </Button>
                          )}
                        </div>
                      )}

                      {manager && ['approved', 'in_transit'].includes(request.status) && (
                        <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <h3 className="font-bold text-ink">{t('phase5.support.deliveryTitle')}</h3>
                          {delivery.id === request.id ? (
                            <>
                              {remaining.map(({ item, remaining: left }) => (
                                <Input
                                  key={item.id}
                                  label={`${item.equipment_item?.name || item.equipment_item_id} — ${t('phase5.support.deliverQty')} (${t('phase5.support.remaining', { count: left })})`}
                                  type="number"
                                  min="0"
                                  max={Math.max(0, left)}
                                  value={delivery.quantities[item.id] || ''}
                                  onChange={(event) =>
                                    setDelivery((current) => ({
                                      ...current,
                                      quantities: { ...current.quantities, [item.id]: event.target.value },
                                    }))
                                  }
                                />
                              ))}
                              <div>
                                <label htmlFor={`delivery-note-${request.id}`} className="placa-label">
                                  {t('phase5.support.note')}
                                </label>
                                <textarea
                                  id={`delivery-note-${request.id}`}
                                  className="placa-input min-h-20"
                                  value={delivery.note}
                                  onChange={(event) =>
                                    setDelivery((current) => ({ ...current, note: event.target.value }))
                                  }
                                />
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  loading={busyId === request.id}
                                  onClick={() => submitDelivery(request)}
                                >
                                  {t('phase5.support.recordDelivery')}
                                </Button>
                                <Button
                                  variant="secondary"
                                  onClick={() => setDelivery({ id: '', quantities: {}, note: '' })}
                                >
                                  {t('common.cancel')}
                                </Button>
                              </div>
                            </>
                          ) : (
                            <Button variant="secondary" onClick={() => startDelivery(request)}>
                              {t('phase5.support.startDelivery')}
                            </Button>
                          )}
                        </div>
                      )}

                      {partner && request.status === 'in_transit' && (
                        <Button loading={busyId === request.id} onClick={() => handleConfirm(request)}>
                          {t('phase5.support.confirmReceipt')}
                        </Button>
                      )}

                      {manager && request.status === 'delivered' && (
                        <Button
                          variant="secondary"
                          loading={busyId === request.id}
                          onClick={() => handleClose(request)}
                        >
                          {t('phase5.support.close')}
                        </Button>
                      )}

                      {request.supply_records?.length > 0 && (
                        <div>
                          <h3 className="text-sm font-bold text-ink">{t('phase5.support.deliveries')}</h3>
                          <ul className="mt-1 space-y-1 text-sm text-slate-700">
                            {request.supply_records.map((record) => (
                              <li key={record.id}>
                                {record.equipment_item?.name || record.equipment_item_id}: {record.qty_delivered}
                                {record.delivered_at
                                  ? ` · ${formatDate(record.delivered_at, i18n.language)}`
                                  : ''}
                                {record.received_at ? ` · ${t('phase5.support.receivedShort')}` : ''}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-sm leading-relaxed text-slate-600">{t('phase5.support.privacyNote')}</p>
      </div>
    </AppShell>
  );
}
