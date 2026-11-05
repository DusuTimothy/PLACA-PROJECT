import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PageHeader from '../components/ui/PageHeader';
import Select from '../components/ui/Select';
import { useAuth } from '../context/AuthContext';
import { listLgas } from '../services/programmeApi';
import {
  createEquipment,
  deleteEquipment,
  listStock,
  setStock,
  updateEquipment,
} from '../services/phase5Api';
import { errorMessage, getFieldErrors } from '../utils/errors';
import { isPlaca } from '../utils/roles';

export default function EquipmentPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const manager = isPlaca(user?.role);

  const [items, setItems] = useState([]);
  const [lgas, setLgas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [savingItem, setSavingItem] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [form, setForm] = useState({ name: '', description: '', unit: 'unit' });
  const [editing, setEditing] = useState(null);
  const [stockForm, setStockForm] = useState({ itemId: '', lga_id: '', quantity: '' });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await listStock();
      setItems(data?.data || []);
      setFromCache(Boolean(data?.from_cache));
    } catch (loadError) {
      setError(errorMessage(loadError, t));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (manager) {
      listLgas()
        .then((rows) => setLgas(rows || []))
        .catch(() => setLgas([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setSavingItem(true);
    setError('');
    setNotice('');
    setFieldErrors({});
    try {
      await createEquipment({
        name: form.name,
        description: form.description || null,
        unit: form.unit || 'unit',
      });
      setForm({ name: '', description: '', unit: 'unit' });
      setNotice(t('phase5.equipment.created'));
      await load();
    } catch (saveError) {
      setError(errorMessage(saveError, t));
      setFieldErrors(getFieldErrors(saveError));
    } finally {
      setSavingItem(false);
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    setBusyId(editing.id);
    setError('');
    try {
      await updateEquipment(editing.id, {
        name: editing.name,
        description: editing.description || null,
        unit: editing.unit,
        is_active: editing.is_active,
      });
      setEditing(null);
      setNotice(t('phase5.equipment.updated'));
      await load();
    } catch (updateError) {
      setError(errorMessage(updateError, t));
    } finally {
      setBusyId('');
    }
  }

  async function handleDelete(item) {
    if (!window.confirm(t('phase5.equipment.confirmDelete', { name: item.name }))) return;
    setBusyId(item.id);
    setError('');
    try {
      await deleteEquipment(item.id);
      setNotice(t('phase5.equipment.deleted'));
      await load();
    } catch (deleteError) {
      setError(errorMessage(deleteError, t));
    } finally {
      setBusyId('');
    }
  }

  function startStock(item) {
    setStockForm({ itemId: item.id, lga_id: '', quantity: '' });
    setNotice('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveStock(event) {
    event.preventDefault();
    setBusyId(stockForm.itemId);
    setError('');
    try {
      await setStock(stockForm.itemId, {
        lga_id: stockForm.lga_id || null,
        quantity: Number(stockForm.quantity),
      });
      setStockForm({ itemId: '', lga_id: '', quantity: '' });
      setNotice(t('phase5.equipment.stockSaved'));
      await load();
    } catch (stockError) {
      setError(errorMessage(stockError, t));
    } finally {
      setBusyId('');
    }
  }

  const stockItem = items.find((item) => item.id === stockForm.itemId);

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title={t('phase5.equipment.title')} intro={t('phase5.equipment.intro')} />

        {fromCache && <Alert variant="warning">{t('phase5.offline.showingSaved')}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        {manager && (
          <form onSubmit={handleCreate} className="placa-card space-y-4">
            <h2 className="text-lg font-bold text-ink">{t('phase5.equipment.addTitle')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('phase5.equipment.name')}
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                error={fieldErrors.name}
                required
              />
              <Input
                label={t('phase5.equipment.unit')}
                value={form.unit}
                onChange={(event) => updateForm('unit', event.target.value)}
                hint={t('phase5.equipment.unitHint')}
              />
            </div>
            <div>
              <label htmlFor="equipment-description" className="placa-label">
                {t('phase5.equipment.description')}
              </label>
              <textarea
                id="equipment-description"
                className="placa-input min-h-20"
                value={form.description}
                onChange={(event) => updateForm('description', event.target.value)}
              />
            </div>
            <Button type="submit" loading={savingItem}>
              {t('phase5.equipment.add')}
            </Button>
          </form>
        )}

        {manager && stockItem && (
          <form onSubmit={saveStock} className="placa-card space-y-4">
            <h2 className="text-lg font-bold text-ink">
              {t('phase5.equipment.stockTitle', { name: stockItem.name })}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label={t('phase5.equipment.stockLocation')}
                value={stockForm.lga_id}
                onChange={(event) => setStockForm((current) => ({ ...current, lga_id: event.target.value }))}
              >
                <option value="">{t('phase5.equipment.stateStore')}</option>
                {lgas.map((lga) => (
                  <option key={lga.id} value={lga.id}>
                    {lga.name}
                  </option>
                ))}
              </Select>
              <Input
                label={t('phase5.equipment.quantity')}
                type="number"
                min="0"
                value={stockForm.quantity}
                onChange={(event) => setStockForm((current) => ({ ...current, quantity: event.target.value }))}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" loading={busyId === stockForm.itemId}>
                {t('common.save')}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setStockForm({ itemId: '', lga_id: '', quantity: '' })}
              >
                {t('common.cancel')}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <p className="text-base text-slate-600">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <div className="placa-card">
            <p className="text-base text-slate-700">{t('phase5.equipment.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="placa-card">
                {editing?.id === item.id ? (
                  <form onSubmit={saveEdit} className="space-y-3">
                    <Input
                      label={t('phase5.equipment.name')}
                      value={editing.name}
                      onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                      required
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        label={t('phase5.equipment.unit')}
                        value={editing.unit}
                        onChange={(event) => setEditing({ ...editing, unit: event.target.value })}
                      />
                      <label className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                        <input
                          type="checkbox"
                          checked={editing.is_active}
                          onChange={(event) =>
                            setEditing({ ...editing, is_active: event.target.checked })
                          }
                          className="h-4 w-4"
                        />
                        {t('phase5.equipment.active')}
                      </label>
                    </div>
                    <div>
                      <label htmlFor={`description-${item.id}`} className="placa-label">
                        {t('phase5.equipment.description')}
                      </label>
                      <textarea
                        id={`description-${item.id}`}
                        className="placa-input min-h-20"
                        value={editing.description || ''}
                        onChange={(event) =>
                          setEditing({ ...editing, description: event.target.value })
                        }
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" loading={busyId === item.id}>
                        {t('common.save')}
                      </Button>
                      <Button variant="secondary" onClick={() => setEditing(null)}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold text-ink">{item.name}</h2>
                        {item.description && (
                          <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                        )}
                        <p className="mt-1 text-xs text-slate-500">
                          {t('phase5.equipment.unit')}: {item.unit}
                          {item.is_active ? '' : ` · ${t('phase5.equipment.inactive')}`}
                        </p>
                      </div>
                      {manager && (
                        <div className="flex flex-wrap gap-2">
                          <Button variant="secondary" onClick={() => startStock(item)}>
                            {t('phase5.equipment.setStock')}
                          </Button>
                          <Button variant="ghost" onClick={() => setEditing({ ...item })}>
                            {t('common.edit')}
                          </Button>
                          <Button
                            variant="danger"
                            loading={busyId === item.id}
                            onClick={() => handleDelete(item)}
                          >
                            {t('common.delete')}
                          </Button>
                        </div>
                      )}
                    </div>

                    {item.stock_levels?.length > 0 ? (
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {item.stock_levels.map((level) => (
                          <li
                            key={level.id}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                          >
                            <span className="font-medium text-slate-700">
                              {level.lga?.name || t('phase5.equipment.stateStore')}
                            </span>
                            <span className="font-bold tabular-nums text-ink">{level.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-600">{t('phase5.equipment.noStock')}</p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
