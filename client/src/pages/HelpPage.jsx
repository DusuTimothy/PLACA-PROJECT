import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import PageHeader from '../components/ui/PageHeader';
import GuideBody from '../components/guides/GuideBody';
import { useAuth } from '../context/AuthContext';
import {
  listGuideProgress,
  listGuides,
  markGuideProgress,
} from '../services/phase5Api';
import { errorMessage } from '../utils/errors';
import { isPlaca } from '../utils/roles';

export default function HelpPage() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'ha' ? 'ha' : 'en';
  const editor = isPlaca(user?.role);

  const [guides, setGuides] = useState([]);
  const [progress, setProgress] = useState({});
  const [search, setSearch] = useState('');
  const [openKey, setOpenKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyKey, setBusyKey] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    listGuides({ language, limit: 100 })
      .then((result) => {
        if (!active) return;
        setGuides(result?.data || []);
        setFromCache(Boolean(result?.from_cache));
      })
      .catch((loadError) => {
        if (active) setError(errorMessage(loadError, t));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    listGuideProgress()
      .then((rows) => {
        if (!active) return;
        const map = {};
        for (const row of rows || []) {
          if (row.completed_at) map[row.guide_key] = true;
        }
        setProgress(map);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [language, t]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return guides;
    return guides.filter(
      (guide) =>
        guide.title.toLowerCase().includes(term) ||
        guide.body_md.toLowerCase().includes(term)
    );
  }, [guides, search]);

  const fieldHints = useMemo(() => filtered.filter((guide) => guide.field_key), [filtered]);
  const articles = useMemo(() => filtered.filter((guide) => !guide.field_key), [filtered]);

  async function markDone(guide) {
    setBusyKey(guide.key);
    setNotice('');
    try {
      await markGuideProgress(guide.key, { completed: !progress[guide.key] });
      setProgress((current) => ({ ...current, [guide.key]: !current[guide.key] }));
      setNotice(t('phase5.help.progressSaved'));
    } catch (saveError) {
      setError(errorMessage(saveError, t));
    } finally {
      setBusyKey('');
    }
  }

  function GuideCard({ guide }) {
    const open = openKey === guide.key;
    return (
      <li className="placa-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button
            type="button"
            className="text-left"
            aria-expanded={open}
            onClick={() => setOpenKey(open ? '' : guide.key)}
          >
            <span className="block text-lg font-bold text-ink">{guide.title}</span>
            <span className="mt-1 block text-sm text-slate-600">
              {guide.page_key ? t(`nav.${guide.page_key}`, { defaultValue: guide.page_key }) : ''}
              {progress[guide.key] ? ` · ${t('phase5.help.done')}` : ''}
            </span>
          </button>
          <span className="text-sm font-semibold text-placa-700">
            {open ? t('common.back') : t('phase5.help.open')}
          </span>
        </div>

        {open && (
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            <GuideBody markdown={guide.body_md} />
            <Button
              variant={progress[guide.key] ? 'secondary' : 'primary'}
              loading={busyKey === guide.key}
              onClick={() => markDone(guide)}
            >
              {progress[guide.key] ? t('phase5.help.markUndone') : t('phase5.help.markDone')}
            </Button>
          </div>
        )}
      </li>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('phase5.help.title')}
          intro={t('phase5.help.intro')}
          actions={
            editor ? (
              <Link
                to="/guide-editor"
                className="inline-flex min-h-tap items-center justify-center rounded-xl border-2 border-placa-600 bg-white px-4 py-2 text-base font-semibold text-placa-700 hover:bg-placa-50"
              >
                {t('phase5.help.editGuides')}
              </Link>
            ) : null
          }
        />

        {fromCache && <Alert variant="warning">{t('phase5.offline.showingSaved')}</Alert>}
        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        <Input
          label={t('phase5.help.search')}
          placeholder={t('phase5.help.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        {loading ? (
          <p className="text-base text-slate-600">{t('common.loading')}</p>
        ) : (
          <div className="space-y-8">
            {articles.length > 0 && (
              <section aria-labelledby="help-articles">
                <h2 id="help-articles" className="text-xl font-bold text-ink">
                  {t('phase5.help.articlesTitle')}
                </h2>
                <ul className="mt-3 space-y-3">
                  {articles.map((guide) => (
                    <GuideCard key={guide.id} guide={guide} />
                  ))}
                </ul>
              </section>
            )}

            {fieldHints.length > 0 && (
              <section aria-labelledby="help-hints">
                <h2 id="help-hints" className="text-xl font-bold text-ink">
                  {t('phase5.help.hintsTitle')}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{t('phase5.help.hintsIntro')}</p>
                <ul className="mt-3 space-y-3">
                  {fieldHints.map((guide) => (
                    <GuideCard key={guide.id} guide={guide} />
                  ))}
                </ul>
              </section>
            )}

            {filtered.length === 0 && (
              <div className="placa-card">
                <p className="text-base text-slate-700">{t('phase5.help.empty')}</p>
              </div>
            )}
          </div>
        )}

        <p className="text-sm leading-relaxed text-slate-600">{t('phase5.help.offlineNote')}</p>
      </div>
    </AppShell>
  );
}
