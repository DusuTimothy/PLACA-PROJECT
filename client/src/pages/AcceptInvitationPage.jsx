import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthLayout from '../components/layout/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { errorMessage, getFieldErrors } from '../utils/errors';

export default function AcceptInvitationPage() {
  const { acceptInvitation } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    if (!token) {
      setError(t('errors.INVITATION_INVALID'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      const payload = { token, password, language };
      if (name.trim()) payload.name = name.trim();
      if (phone.trim()) payload.phone = phone.trim();
      await acceptInvitation(payload);
      navigate('/dashboard', { replace: true });
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
          <h1 className="text-2xl font-bold">{t('auth.acceptTitle')}</h1>
          <Alert variant="error">{t('errors.INVITATION_INVALID')}</Alert>
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
        <h1 className="text-2xl font-bold text-ink">{t('auth.acceptTitle')}</h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">{t('auth.acceptIntro')}</p>

        {error && (
          <div className="mt-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

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
          <Input
            label={t('common.fullName')}
            optionalLabel
            autoComplete="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            error={fieldErrors.name}
          />
          <Input
            label={t('dashboard.phone')}
            optionalLabel
            type="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            error={fieldErrors.phone}
          />
          <Button type="submit" fullWidth loading={submitting}>
            {t('auth.acceptButton')}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
