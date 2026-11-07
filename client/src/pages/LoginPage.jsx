import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthLayout from '../components/layout/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import { useAuth } from '../context/AuthContext';
import { errorMessage, getErrorCode, getFieldErrors } from '../utils/errors';
import DemoAccountsPanel from '../components/auth/DemoAccountsPanel';
import { demoModeEnabled } from '../config/demoAccounts';

export default function LoginPage() {
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function completeLogin(result) {
    if (result.totpSetupRequired) {
      // Kept in sessionStorage so a page refresh during setup can resume.
      window.sessionStorage.setItem('placa_setup_token', result.setupToken);
      navigate('/totp-setup', {
        replace: true,
        state: { setupToken: result.setupToken },
      });
      return;
    }

    if (result.user?.must_change_password) {
      navigate('/change-password', { replace: true });
      return;
    }

    navigate(location.state?.from || '/dashboard', { replace: true });
  }

  function showLoginError(submitError) {
    const code = getErrorCode(submitError);
    if (code === 'TOTP_REQUIRED') {
      setNeedTotp(true);
    }
    setFieldErrors(getFieldErrors(submitError));
    setError(errorMessage(submitError, t));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setSubmitting(true);

    try {
      const payload = { identifier, password };
      if (needTotp) payload.totp_code = totpCode;

      completeLogin(await login(payload));
    } catch (submitError) {
      showLoginError(submitError);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoSignIn(account) {
    setError('');
    setFieldErrors({});
    setIdentifier(account.email);
    setPassword(account.password);
    setSubmitting(true);

    try {
      completeLogin(
        await login({ identifier: account.email, password: account.password })
      );
    } catch (submitError) {
      showLoginError(submitError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="placa-card">
        <h1 className="text-2xl font-bold text-ink">
          {needTotp ? t('auth.totpTitle') : t('auth.signInTitle')}
        </h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">
          {needTotp ? t('auth.totpIntro') : t('auth.signInIntro')}
        </p>

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
            inputMode="email"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            error={fieldErrors.identifier}
            required
          />

          <Input
            label={t('auth.passwordLabel')}
            hint={t('auth.passwordHint')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            error={fieldErrors.password}
            required
          />

          {needTotp && (
            <Input
              label={t('auth.totpCode')}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={totpCode}
              onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ''))}
              error={fieldErrors.totp_code}
              required
            />
          )}

          <Button type="submit" fullWidth loading={submitting}>
            {needTotp ? t('auth.totpButton') : t('auth.signInButton')}
          </Button>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <Link to="/forgot-password" className="font-semibold text-placa-700 underline">
            {t('auth.forgotPassword')}
          </Link>
          <span className="text-slate-500">{t('auth.temporaryNote')}</span>
        </div>
      </div>

      {demoModeEnabled && (
        <DemoAccountsPanel onSignIn={handleDemoSignIn} busy={submitting} />
      )}
    </AuthLayout>
  );
}
