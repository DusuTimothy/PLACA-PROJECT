import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PageHeader from '../components/ui/PageHeader';
import Select from '../components/ui/Select';
import { useAuth } from '../context/AuthContext';
import {
  deleteDocument,
  downloadDocument,
  listDocuments,
  updateDocument,
  uploadDocument,
} from '../services/phase5Api';
import { errorMessage, getFieldErrors } from '../utils/errors';
import { isPlaca } from '../utils/roles';
import { safeFilename, saveBlob } from '../utils/download';

const CATEGORIES = ['guideline', 'training_material', 'workplan', 'policy'];

function formatSize(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '';
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const manager = isPlaca(user?.role);

  const [result, setResult] = useState({ data: [], pagination: null });
  const [filters, setFilters] = useState({ search: '', category: '', language: '' });
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    title: '',
    category: 'guideline',
    language: i18n.language === 'ha' ? 'ha' : 'en',
    is_public: false,
    file: null,
  });
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await listDocuments({
        limit: 50,
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.category ? { category: filters.category } : {}),
        ...(filters.language ? { language: filters.language } : {}),
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
  }, [filters.search, filters.category, filters.language]);

  function updateForm(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleUpload(event) {
    event.preventDefault();
    setUploading(true);
    setError('');
    setNotice('');
    setFieldErrors({});
    try {
      const payload = new FormData();
      payload.append('title', form.title);
      payload.append('category', form.category);
      payload.append('language', form.language);
      payload.append('is_public', form.is_public ? 'true' : 'false');
      if (form.file) payload.append('file', form.file);

      await uploadDocument(payload);
      setForm({
        title: '',
        category: 'guideline',
        language: i18n.language === 'ha' ? 'ha' : 'en',
        is_public: false,
        file: null,
      });
      event.target.reset();
      setNotice(t('phase5.documents.uploaded'));
      await load();
    } catch (uploadError) {
      setError(errorMessage(uploadError, t));
      setFieldErrors(getFieldErrors(uploadError));
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(document) {
    setBusyId(document.id);
    setError('');
    try {
      const blob = await downloadDocument(document.id);
      saveBlob(
        blob,
        safeFilename(document.original_name || document.title, 'placa-document')
      );
    } catch (downloadError) {
      setError(errorMessage(downloadError, t));
    } finally {
      setBusyId('');
    }
  }

  async function handleDelete(document) {
    if (!window.confirm(t('phase5.documents.confirmDelete', { title: document.title }))) return;
    setBusyId(document.id);
    setError('');
    try {
      await deleteDocument(document.id);
      setNotice(t('phase5.documents.deleted'));
      await load();
    } catch (deleteError) {
      setError(errorMessage(deleteError, t));
    } finally {
      setBusyId('');
    }
  }

  async function saveEdit(event) {
    event.preventDefault();
    setBusyId(editing.id);
    setError('');
    try {
      await updateDocument(editing.id, {
        title: editing.title,
        category: editing.category,
        language: editing.language,
        is_public: editing.is_public,
      });
      setEditing(null);
      setNotice(t('phase5.documents.updated'));
      await load();
    } catch (updateError) {
      setError(errorMessage(updateError, t));
    } finally {
      setBusyId('');
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title={t('phase5.documents.title')} intro={t('phase5.documents.intro')} />

        {fromCache && <Alert variant="warning">{t('phase5.offline.showingSaved')}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        {manager && (
          <form onSubmit={handleUpload} className="placa-card space-y-4">
            <h2 className="text-lg font-bold text-ink">{t('phase5.documents.uploadTitle')}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={t('phase5.documents.titleField')}
                value={form.title}
                onChange={(event) => updateForm('title', event.target.value)}
                error={fieldErrors.title}
                required
              />
              <Select
                label={t('phase5.documents.category')}
                value={form.category}
                onChange={(event) => updateForm('category', event.target.value)}
              >
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {t(`phase5.documents.categories.${category}`)}
                  </option>
                ))}
              </Select>
              <Select
                label={t('common.language')}
                value={form.language}
                onChange={(event) => updateForm('language', event.target.value)}
              >
                <option value="en">{t('common.english')}</option>
                <option value="ha">{t('common.hausa')}</option>
              </Select>
              <div>
                <label htmlFor="document-file" className="placa-label">
                  {t('phase5.documents.file')}
                </label>
                <input
                  id="document-file"
                  type="file"
                  required
                  onChange={(event) => updateForm('file', event.target.files?.[0] || null)}
                  className="placa-input py-2"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg"
                />
                <p className="placa-hint">{t('phase5.documents.fileHint')}</p>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(event) => updateForm('is_public', event.target.checked)}
                className="h-4 w-4"
              />
              {t('phase5.documents.public')}
            </label>
            <Button type="submit" loading={uploading}>
              {t('phase5.documents.upload')}
            </Button>
          </form>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <Input
            label={t('phase5.documents.search')}
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            className="w-full sm:w-64"
          />
          <Select
            label={t('phase5.documents.category')}
            value={filters.category}
            onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
            className="w-full sm:w-56"
          >
            <option value="">{t('phase5.documents.allCategories')}</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`phase5.documents.categories.${category}`)}
              </option>
            ))}
          </Select>
          <Select
            label={t('common.language')}
            value={filters.language}
            onChange={(event) => setFilters((current) => ({ ...current, language: event.target.value }))}
            className="w-full sm:w-40"
          >
            <option value="">{t('phase5.documents.allLanguages')}</option>
            <option value="en">{t('common.english')}</option>
            <option value="ha">{t('common.hausa')}</option>
          </Select>
        </div>

        {loading ? (
          <p className="text-base text-slate-600">{t('common.loading')}</p>
        ) : result.data.length === 0 ? (
          <div className="placa-card">
            <p className="text-base text-slate-700">{t('phase5.documents.empty')}</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {result.data.map((document) => (
              <li key={document.id} className="placa-card">
                {editing?.id === document.id ? (
                  <form onSubmit={saveEdit} className="space-y-3">
                    <Input
                      label={t('phase5.documents.titleField')}
                      value={editing.title}
                      onChange={(event) => setEditing({ ...editing, title: event.target.value })}
                      required
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Select
                        label={t('phase5.documents.category')}
                        value={editing.category}
                        onChange={(event) => setEditing({ ...editing, category: event.target.value })}
                      >
                        {CATEGORIES.map((category) => (
                          <option key={category} value={category}>
                            {t(`phase5.documents.categories.${category}`)}
                          </option>
                        ))}
                      </Select>
                      <Select
                        label={t('common.language')}
                        value={editing.language}
                        onChange={(event) => setEditing({ ...editing, language: event.target.value })}
                      >
                        <option value="en">{t('common.english')}</option>
                        <option value="ha">{t('common.hausa')}</option>
                      </Select>
                    </div>
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        checked={editing.is_public}
                        onChange={(event) => setEditing({ ...editing, is_public: event.target.checked })}
                        className="h-4 w-4"
                      />
                      {t('phase5.documents.public')}
                    </label>
                    <div className="flex gap-2">
                      <Button type="submit" loading={busyId === document.id}>
                        {t('common.save')}
                      </Button>
                      <Button variant="secondary" onClick={() => setEditing(null)}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-ink">{document.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {t(`phase5.documents.categories.${document.category}`)}
                        {` · ${document.language === 'ha' ? t('common.hausa') : t('common.english')}`}
                        {document.size_bytes ? ` · ${formatSize(document.size_bytes)}` : ''}
                        {document.is_public ? ` · ${t('phase5.documents.public')}` : ''}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {document.uploader?.name || t('phase5.documents.unknownUploader')}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        loading={busyId === document.id}
                        onClick={() => handleDownload(document)}
                      >
                        {t('phase5.documents.download')}
                      </Button>
                      {manager && (
                        <>
                          <Button variant="ghost" onClick={() => setEditing({ ...document })}>
                            {t('common.edit')}
                          </Button>
                          <Button
                            variant="danger"
                            loading={busyId === document.id}
                            onClick={() => handleDelete(document)}
                          >
                            {t('common.delete')}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm leading-relaxed text-slate-600">{t('phase5.documents.offlineNote')}</p>
      </div>
    </AppShell>
  );
}
