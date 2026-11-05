import { useTranslation } from 'react-i18next';

export default function Spinner({ label }) {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3" role="status">
      <span
        aria-hidden="true"
        className="h-10 w-10 animate-spin rounded-full border-4 border-placa-200 border-t-placa-600"
      />
      <span className="text-base text-slate-600">{label || t('common.loading')}</span>
    </div>
  );
}
