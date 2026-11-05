import { useTranslation } from 'react-i18next';

const styles = {
  draft: 'border-slate-300 bg-slate-100 text-slate-700',
  pending: 'border-amber-300 bg-amber-50 text-amber-900',
  submitted: 'border-amber-300 bg-amber-50 text-amber-900',
  approved: 'border-green-300 bg-green-50 text-green-900',
  validated: 'border-green-300 bg-green-50 text-green-900',
  returned: 'border-red-300 bg-red-50 text-red-900',
  suspended: 'border-red-300 bg-red-50 text-red-900',
  aggregated: 'border-sky-300 bg-sky-50 text-sky-900',
};

export default function StatusBadge({ status }) {
  const { t } = useTranslation();
  const style = styles[status] || styles.draft;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${style}`}
    >
      {t(`status.${status}`, { defaultValue: status })}
    </span>
  );
}
