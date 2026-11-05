import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';

export default function LanguageSwitch({ compact = false }) {
  const { language, changeLanguage } = useLanguage();
  const { t } = useTranslation();

  return (
    <div
      role="group"
      aria-label={t('common.language')}
      className="inline-flex rounded-xl border border-slate-300 bg-white p-1"
    >
      {[
        ['en', t('common.english')],
        ['ha', t('common.hausa')],
      ].map(([code, label]) => (
        <button
          key={code}
          type="button"
          onClick={() => changeLanguage(code)}
          aria-pressed={language === code}
          className={`min-h-[36px] rounded-lg px-3 text-sm font-semibold transition ${
            language === code ? 'bg-placa-600 text-white' : 'text-slate-700 hover:bg-slate-100'
          } ${compact ? 'px-2' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
