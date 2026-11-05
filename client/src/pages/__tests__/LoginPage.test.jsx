import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LoginPage from '../LoginPage';
import { AuthProvider } from '../../context/AuthContext';
import { LanguageProvider } from '../../context/LanguageContext';
import api, { refreshSession } from '../../services/api';

// The real API client is replaced, but the page, auth context, i18n and router
// are all real. This catches missing providers, bad hook order and broken
// translation keys without needing a running server or a headless browser.
vi.mock('../../services/api', () => {
  const post = vi.fn();
  return {
    default: { post, get: vi.fn(), patch: vi.fn() },
    refreshSession: vi.fn(),
    setAccessToken: vi.fn(),
  };
});

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <AuthProvider>
        <LanguageProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<div>Dashboard home</div>} />
            <Route path="/change-password" element={<div>Change password screen</div>} />
            <Route path="/totp-setup" element={<div>Authenticator setup screen</div>} />
          </Routes>
        </LanguageProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

async function submitCredentials(user) {
  await user.type(
    screen.getByLabelText(/email address or phone number/i),
    'partner@example.org'
  );
  await user.type(screen.getByLabelText(/^password/i), 'Partner#2026x');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // No existing session when the page opens.
    refreshSession.mockRejectedValue(new Error('no session'));
  });

  it('sends credentials and reaches the dashboard', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce({
      data: {
        accessToken: 'test-token',
        user: {
          id: 'user-1',
          name: 'Grace Pam',
          role: 'partner_staff',
          language: 'en',
          must_change_password: false,
        },
      },
    });

    renderLogin();
    await screen.findByRole('heading', { name: 'Sign in' });
    await submitCredentials(user);

    expect(await screen.findByText('Dashboard home')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      identifier: 'partner@example.org',
      password: 'Partner#2026x',
    });
  });

  it('asks for a security code when the account has 2FA enabled', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce({
      response: {
        status: 401,
        data: { error: 'TOTP_REQUIRED', message: 'Enter the code' },
      },
    });

    renderLogin();
    await screen.findByRole('heading', { name: 'Sign in' });
    await submitCredentials(user);

    expect(await screen.findByLabelText(/6-digit code/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Enter your security code' })).toBeInTheDocument();
  });

  it('shows the server message for a specific field', async () => {
    const user = userEvent.setup();
    api.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: {
          error: 'VALIDATION_FAILED',
          details: [{ path: 'body.identifier', message: 'That email address looks wrong' }],
        },
      },
    });

    renderLogin();
    await screen.findByRole('heading', { name: 'Sign in' });
    await submitCredentials(user);

    expect(await screen.findByText('That email address looks wrong')).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('sends a 2FA-required director to authenticator setup', async () => {
    const user = userEvent.setup();
    api.post.mockResolvedValueOnce({
      data: { totpSetupRequired: true, setupToken: 'setup-token' },
    });

    renderLogin();
    await screen.findByRole('heading', { name: 'Sign in' });
    await submitCredentials(user);

    expect(await screen.findByText('Authenticator setup screen')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('placa_setup_token')).toBe('setup-token');
  });
});
