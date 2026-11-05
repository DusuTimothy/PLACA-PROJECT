import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import GuideBody from './GuideBody';
import { listGuides } from '../../services/phase5Api';

/**
 * Inline help for one form field.
 *
 * The text comes from the same guide library PLACA officers edit in the app, so
 * a corrected explanation reaches the field without a new release. The request
 * is cached, so the hint still opens when the phone has no signal.
 */
export default function FieldHint({ pageKey, fieldKey, label }) {
  const { t, i18n } = useTranslation();
  const [guide, setGuide] = useState(null);

  useEffect(() => {
    let active = true;
    const language = i18n.language === 'ha' ? 'ha' : 'en';
    listGuides({ page_key: pageKey, field_key: fieldKey, language, limit: 10 })
      .then((result) => {
        if (active) setGuide((result?.data || [])[0] || null);
      })
      .catch(() => {
        if (active) setGuide(null);
      });
    return () => {
      active = false;
    };
  }, [pageKey, fieldKey, i18n.language]);

  if (!guide) return null;

  return (
    <details className="mt-1 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
      <summary className="cursor-pointer font-semibold">
        {label || t('phase5.hints.open')}
      </summary>
      <div className="mt-2">
        <GuideBody markdown={guide.body_md} />
      </div>
    </details>
  );
}
