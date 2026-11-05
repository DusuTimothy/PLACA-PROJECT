import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PageHeader from '../components/ui/PageHeader';
import Select from '../components/ui/Select';
import GuideBody from '../components/guides/GuideBody';
import {
  createGuide,
  deleteGuide,
  listGuides,
  updateGuide,
} from '../services/phase5Api';
import { errorMessage, getFieldErrors } from '../utils/errors';

const ROLES = ['partner_staff', 'laca_officer', 'placa_officer', 'placa_director', 'admin'];

const emptyForm = {
  key: '',
  language: 'en',
  title: '',
  body_md: '',
  audience_roles: [],
  page_key: '',
  field_key: '',
  sort_order: '0',
  is_published: true,
};

export default function GuideEditorPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'ha' ? 'ha' : 'en';

  const [guides, setGuides] = useState([]);
  const [form, setForm] = useState({ ...emptyForm, language });
  const [editingId, setEditingId] = useState('');
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  async function load() {
    setLoading(true);
    setError('');
    try {
      const result = await listGuides({ manage: 'true', language, limit: 100 });
      setGuides(result?.data || []);
    } catch (loadError) {
      setError(errorMessage(loadError, t));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function toggleRole(role) {
    setForm((current) => ({
      ...current,
      audience_roles: current.audience_roles.includes(role)
        ? current.audience_roles.filter((item) => item !== role)
        : [...current.audience_roles, role],
    }));
  }

  function startNew() {
    setEditingId('');
    setForm({ ...emptyForm, language });
    setPreview(false);
    setFieldErrors({});
    setNotice('');
  }

  function startEdit(guide) {
    setEditingId(guide.id);
    setForm({
      key: guide.key,
      language: guide.language,
      title: guide.title,
      body_md: guide.body_md,
      audience_roles: guide.audience_roles || [],
      page_key: guide.page_key || '',
      field_key: guide.field_key || '',
      sort_order: String(guide.sort_order ?? 0),
      is_published: Boolean(guide.is_published),
    });
    setPreview(false);
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
      key: form.key.trim(),
      language: form.language,
      title: form.title.trim(),
      body_md: form.body_md,
      audience_roles: form.audience_roles,
      page_key: form.page_key.trim() || null,
      field_key: form.field_key.trim() || null,
      sort_order: Number(form.sort_order) || 0,
      is_published: form.is_published,
    };

    try {
      if (editingId) {
        await updateGuide(editingId, payload);
        setNotice(t('phase5.guideEditor.updated'));
      } else {
        await createGuide(payload);
        setNotice(t('phase5.guideEditor.created'));
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

  async function handleDelete(guide) {
    if (!window.confirm(t('phase5.guideEditor.confirmDelete', { title: guide.title }))) return;
    setError('');
    try {
      await deleteGuide(guide.id);
      if (editingId === guide.id) startNew();
      setNotice(t('phase5.guideEditor.deleted'));
      await load();
    } catch (deleteError) {
      setError(errorMessage(deleteError, t));
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('phase5.guideEditor.title')}
          intro={t('phase5.guideEditor.intro')}
          actions={
            <Link to="/help" className="text-sm font-semibold text-placa-700">
              ← {t('phase5.help.title')}
            </Link>
          }
        />

        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        <form onSubmit={handleSubmit} className="placa-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-ink">
              {editingId ? t('phase5.guideEditor.editTitle') : t('phase5.guideEditor.newTitle')}
            </h2>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setPreview((value) => !value)}>
                {preview ? t('phase5.guideEditor.write') : t('phase5.guideEditor.preview')}
              </Button>
              {editingId && (
                <Button variant="ghost" onClick={startNew}>
                  {t('phase5.guideEditor.cancelEdit')}
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={t('phase5.guideEditor.key')}
              value={form.key}
              onChange={(event) => update('key', event.target.value)}
              hint={t('phase5.guideEditor.keyHint')}
              error={fieldErrors.key}
              required
            />
            <Select
              label={t('phase5.guideEditor.language')}
              value={form.language}
              onChange={(event) => update('language', event.target.value)}
            >
              <option value="en">{t('common.english')}</option>
              <option value="ha">{t('common.hausa')}</option>
            </Select>
          </div>

          <Input
            label={t('phase5.guideEditor.titleField')}
            value={form.title}
            onChange={(event) => update('title', event.target.value)}
            error={fieldErrors.title}
            required
          />

          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label={t('phase5.guideEditor.pageKey')}
              value={form.page_key}
              onChange={(event) => update('page_key', event.target.value)}
              hint={t('phase5.guideEditor.pageKeyHint')}
            />
            <Input
              label={t('phase5.guideEditor.fieldKey')}
              value={form.field_key}
              onChange={(event) => update('field_key', event.target.value)}
              hint={t('phase5.guideEditor.fieldKeyHint')}
            />
            <Input
              label={t('phase5.guideEditor.sortOrder')}
              type="number"
              min="0"
              value={form.sort_order}
              onChange={(event) => update('sort_order', event.target.value)}
            />
          </div>

          <fieldset>
            <legend className="placa-label">{t('phase5.guideEditor.audience')}</legend>
            <p className="placa-hint">{t('phase5.guideEditor.audienceHint')}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              {ROLES.map((role) => (
                <label key={role} className="inline-flex items-center gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={form.audience_roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    className="h-4 w-4"
                  />
                  {t(`roles.${role}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(event) => update('is_published', event.target.checked)}
              className="h-4 w-4"
            />
            {t('phase5.guideEditor.published')}
          </label>

          {preview ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-2 text-lg font-bold text-ink">{form.title || t('phase5.guideEditor.titleField')}</h3>
              <GuideBody markdown={form.body_md || t('phase5.guideEditor.emptyPreview')} />
            </div>
          ) : (
            <div>
              <label htmlFor="guide-body" className="placa-label">
                {t('phase5.guideEditor.body')}
              </label>
              <textarea
                id="guide-body"
                className="placa-input min-h-[16rem] font-mono text-sm"
                value={form.body_md}
                onChange={(event) => update('body_md', event.target.value)}
                aria-invalid={fieldErrors.body_md ? 'true' : 'false'}
                required
              />
              {fieldErrors.body_md && (
                <p className="mt-1 text-sm font-medium text-red-800">{fieldErrors.body_md}</p>
              )}
              <p className="placa-hint">{t('phase5.guideEditor.bodyHint')}</p>
            </div>
          )}

          <Button type="submit" loading={saving}>
            {editingId ? t('common.save') : t('phase5.guideEditor.create')}
          </Button>
        </form>

        <section aria-labelledby="guide-list">
          <h2 id="guide-list" className="text-xl font-bold text-ink">
            {t('phase5.guideEditor.listTitle')}
          </h2>
          {loading ? (
            <p className="mt-3 text-base text-slate-600">{t('common.loading')}</p>
          ) : guides.length === 0 ? (
            <p className="mt-3 text-base text-slate-700">{t('phase5.guideEditor.empty')}</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {guides.map((guide) => (
                <li
                  key={guide.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3"
                >
                  <div>
                    <p className="font-semibold text-ink">{guide.title}</p>
                    <p className="text-xs text-slate-600">
                      {guide.key} · {guide.language.toUpperCase()}
                      {guide.page_key ? ` · ${guide.page_key}` : ''}
                      {guide.field_key ? ` · ${guide.field_key}` : ''}
                      {guide.is_published ? '' : ` · ${t('status.draft')}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => startEdit(guide)}>
                      {t('common.edit')}
                    </Button>
                    <Button variant="danger" onClick={() => handleDelete(guide)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
