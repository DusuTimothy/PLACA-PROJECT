import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthLayout from '../components/layout/AuthLayout';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import api from '../services/api';
import { errorMessage } from '../utils/errors';

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleVerify() {
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/verify-email', { token });
      setMessage(data.message);
    } catch (submitError) {
      setError(errorMessage(submitError, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="placa-card">
        <h1 className="text-2xl font-bold text-ink">{t('auth.verifyTitle')}</h1>

        {!token && (
          <div className="mt-4">
            <Alert variant="error">{t('errors.VALIDATION_FAILED')}</Alert>
          </div>
        )}
        {message && (
          <div className="mt-4">
            <Alert variant="success">{message}</Alert>
          </div>
        )}
        {error && (
          <div className="mt-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {token && !message && (
          <div className="mt-5 space-y-4">
            <p className="text-base leading-relaxed text-slate-600">{t('auth.verifyIntro')}</p>
            <Button onClick={handleVerify} fullWidth loading={submitting}>
              {t('auth.verifyButton')}
            </Button>
          </div>
        )}

        <p className="mt-5 text-sm">
          <Link to="/login" className="font-semibold text-placa-700 underline">
            {t('auth.backToSignIn')}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
