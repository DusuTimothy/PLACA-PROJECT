import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthLayout from '../components/layout/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { useAuth } from '../context/AuthContext';
import { errorMessage, getFieldErrors } from '../utils/errors';

export default function ChangePasswordPage() {
  const { user, changePassword } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setFieldErrors({});

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setSubmitting(true);
    try {
      await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      navigate('/dashboard', { replace: true });
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
        <h1 className="text-2xl font-bold text-ink">{t('auth.changeTitle')}</h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">
          {user?.must_change_password ? t('auth.changeIntro') : t('auth.resetIntro')}
        </p>

        {error && (
          <div className="mt-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5" noValidate>
          <Input
            label={t('auth.currentPassword')}
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            error={fieldErrors.current_password}
            required
          />
          <Input
            label={t('auth.newPassword')}
            hint={t('auth.passwordRules')}
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            error={fieldErrors.new_password}
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
            {t('auth.changeButton')}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
