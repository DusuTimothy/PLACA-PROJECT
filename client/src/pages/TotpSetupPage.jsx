import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthLayout from '../components/layout/AuthLayout';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { errorMessage, getErrorCode } from '../utils/errors';

/**
 * Director and admin accounts must use an authenticator app.
 *
 * Login returns a short-lived setup token (not an access token). This page uses
 * it only to start setup and to finish with a valid 6-digit code.
 */
export default function TotpSetupPage() {
  const { applySession } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const setupToken =
    location.state?.setupToken || window.sessionStorage.getItem('placa_setup_token');

  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    if (!setupToken) {
      setLoading(false);
      return undefined;
    }

    api
      .post('/auth/totp/setup', { setup_token: setupToken })
      .then(({ data }) => {
        if (active) setSetup(data);
      })
      .catch((setupError) => {
        if (active) setError(errorMessage(setupError, t));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [setupToken, t]);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const { data } = await api.post('/auth/totp/enable', {
        setup_token: setupToken,
        code,
      });
      applySession(data);
      window.sessionStorage.removeItem('placa_setup_token');
      navigate(data.user.must_change_password ? '/change-password' : '/dashboard', {
        replace: true,
      });
    } catch (submitError) {
      if (getErrorCode(submitError) === 'TOTP_SETUP_TOKEN_INVALID') {
        window.sessionStorage.removeItem('placa_setup_token');
      }
      setError(errorMessage(submitError, t));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <AuthLayout>
        <div className="placa-card">
          <Spinner />
        </div>
      </AuthLayout>
    );
  }

  // After loading finishes, no setup object means either the token was missing
  // or the setup call failed. Both need the restart message, not an empty form.
  if (!setupToken || !setup) {
    return (
      <AuthLayout>
        <div className="placa-card space-y-4">
          <h1 className="text-2xl font-bold">{t('auth.setupTitle')}</h1>
          <Alert variant="error">{error || t('auth.setupRestart')}</Alert>
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
        <h1 className="text-2xl font-bold text-ink">{t('auth.setupTitle')}</h1>
        <p className="mt-2 text-base leading-relaxed text-slate-600">{t('auth.setupIntro')}</p>

        {error && (
          <div className="mt-4">
            <Alert variant="error">{error}</Alert>
          </div>
        )}

        {setup && (
          <div className="mt-5 space-y-5">
            <div className="flex justify-center rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <img
                src={setup.qrDataUrl}
                alt={t('auth.setupQrAlt')}
                className="h-56 w-56"
                width="224"
                height="224"
              />
            </div>

            <div>
              <p className="placa-label">{t('auth.setupSecretLabel')}</p>
              <code className="block select-all break-all rounded-xl border border-slate-300 bg-white p-3 text-center text-base font-bold tracking-wider">
                {setup.secret}
              </code>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label={t('auth.setupCodeLabel')}
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
                required
              />
              <Button type="submit" fullWidth loading={submitting}>
                {t('auth.setupButton')}
              </Button>
            </form>
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
