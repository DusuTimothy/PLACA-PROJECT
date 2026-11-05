import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthLayout from '../components/layout/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import api from '../services/api';
import { errorMessage, getFieldErrors } from '../utils/errors';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { identifier });
      setMessage(data.message);
    } catch (submitError) {
      setFieldErrors(getFieldErrors(submitError));
      setError(errorMessage(submitError, t));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="placa-card">
        <h1 className="text-2xl font-bold text-ink">{t('auth.forgotTitle')}</h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">{t('auth.forgotIntro')}</p>

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

        <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
          <Input
            label={t('auth.identifierLabel')}
            hint={t('auth.identifierHint')}
            autoComplete="username"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            error={fieldErrors.identifier}
            required
          />
          <Button type="submit" fullWidth loading={submitting}>
            {t('auth.forgotButton')}
          </Button>
        </form>

        <p className="mt-5 text-sm">
          <Link to="/login" className="font-semibold text-placa-700 underline">
            {t('auth.backToSignIn')}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
