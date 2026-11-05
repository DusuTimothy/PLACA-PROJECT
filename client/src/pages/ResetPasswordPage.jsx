import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthLayout from '../components/layout/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import api from '../services/api';
import { errorMessage, getFieldErrors } from '../utils/errors';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/reset-password', { token, password });
      setMessage(data.message);
    } catch (submitError) {
      setFieldErrors(getFieldErrors(submitError));
      setError(errorMessage(submitError, t));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <div className="placa-card space-y-4">
          <h1 className="text-2xl font-bold">{t('auth.resetTitle')}</h1>
          <Alert variant="error">{t('errors.RESET_INVALID')}</Alert>
          <Link to="/login" className="font-semibold text-placa-700 underline">
            {t('auth.backToSignIn')}
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="placa-card">
        <h1 className="text-2xl font-bold text-ink">{t('auth.resetTitle')}</h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">{t('auth.resetIntro')}</p>

        {message && (
          <div className="mt-4 space-y-3">
            <Alert variant="success">{message}</Alert>
            <Link to="/login" className="inline-block font-semibold text-placa-700 underline">
              {t('auth.backToSignIn')}
            </Link>
          </div>
        )}
        {error && (
          <div className="mt-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {!message && (
          <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
            <Input
              label={t('auth.newPassword')}
              hint={t('auth.passwordRules')}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              error={fieldErrors.password}
              required
            />
            <Input
              label={t('auth.confirmPassword')}
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
            />
            <Button type="submit" fullWidth loading={submitting}>
              {t('auth.resetButton')}
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
