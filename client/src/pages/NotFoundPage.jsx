import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="placa-card w-full max-w-md text-center">
        <p className="text-5xl font-black text-placa-600">404</p>
        <h1 className="mt-3 text-2xl font-bold text-ink">{t('notFound.title')}</h1>
        <p className="mt-2 text-base text-slate-600">{t('notFound.intro')}</p>
        <Link
          to={user ? '/dashboard' : '/login'}
          className="mt-6 inline-flex min-h-tap items-center justify-center rounded-xl bg-placa-600 px-5 py-3 font-semibold text-white hover:bg-placa-700"
        >
          {user ? t('notFound.home') : t('auth.backToSignIn')}
        </Link>
      </div>
    </div>
  );
}
