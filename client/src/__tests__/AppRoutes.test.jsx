import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { LanguageProvider } from '../context/LanguageContext';
import api, { refreshSession } from '../services/api';
import { listGuideProgress, listGuides, unreadNotifications } from '../services/phase5Api';

vi.mock('../services/api', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn() },
  refreshSession: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock('../services/phase5Api', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listGuides: vi.fn(),
    listGuideProgress: vi.fn(),
    unreadNotifications: vi.fn(),
  };
});

function renderAt(path) {
  return render(
    <MemoryRouter basename="/app" initialEntries={[path]}>
      <AuthProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('app routes under /app', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshSession.mockRejectedValue(new Error('no session'));
    api.get.mockResolvedValue({ data: { data: [], pagination: null } });
    listGuides.mockResolvedValue({ data: [], pagination: null });
    listGuideProgress.mockResolvedValue([]);
    unreadNotifications.mockResolvedValue(0);
  });

  it('shows the sign-in page at /app/login', async () => {
    renderAt('/app/login');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('sends a signed-out visitor from /app/dashboard to sign in', async () => {
    renderAt('/app/dashboard');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('sends an admin away from programme pages to the dashboard', async () => {
    refreshSession.mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 'admin-1',
        name: 'System Administrator',
        role: 'admin',
        must_change_password: false,
      },
    });

    renderAt('/app/organizations');

    expect(
      await screen.findByRole('heading', { name: 'Welcome, System Administrator' })
    ).toBeInTheDocument();
  });

  it('lets an admin open the shared help library', async () => {
    refreshSession.mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 'admin-1',
        name: 'System Administrator',
        role: 'admin',
        must_change_password: false,
      },
    });

    renderAt('/app/help');

    expect(await screen.findByRole('heading', { name: 'Help library' })).toBeInTheDocument();
  });

  it('sends a partner away from the PLACA-only guide editor', async () => {
    refreshSession.mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 'partner-1',
        name: 'Partner User',
        role: 'partner_staff',
        must_change_password: false,
        organization_id: 'org-1',
        lga_id: 'lga-1',
      },
    });

    renderAt('/app/guide-editor');

    expect(await screen.findByRole('heading', { name: 'Welcome, Partner User' })).toBeInTheDocument();
  });

  it('sends a partner away from the PLACA-only user management', async () => {
    refreshSession.mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 'partner-1',
        name: 'Partner User',
        role: 'partner_staff',
        must_change_password: false,
        organization_id: 'org-1',
        lga_id: 'lga-1',
      },
    });

    renderAt('/app/users');

    expect(await screen.findByRole('heading', { name: 'Welcome, Partner User' })).toBeInTheDocument();
  });

  it('lets a PLACA officer open the user management page', async () => {
    refreshSession.mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 'placa-1',
        name: 'PLACA Officer',
        role: 'placa_officer',
        must_change_password: false,
      },
    });

    renderAt('/app/users');

    expect(await screen.findByRole('heading', { name: 'User management' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Organizations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Users' })).toBeInTheDocument();
  });

  it('lets desktop users collapse and expand the sidebar', async () => {
    refreshSession.mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 'placa-1',
        name: 'PLACA Officer',
        role: 'placa_officer',
        must_change_password: false,
      },
    });

    renderAt('/app/dashboard');
    await screen.findByRole('heading', { name: 'Welcome, PLACA Officer' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
  });

  it('opens the mobile navigation drawer with the same role-aware links', async () => {
    refreshSession.mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 'partner-1',
        name: 'Partner User',
        role: 'partner_staff',
        must_change_password: false,
        organization_id: 'org-1',
      },
    });

    renderAt('/app/dashboard');
    await screen.findByRole('heading', { name: 'Welcome, Partner User' });

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Main menu' });
    expect(within(drawer).getByRole('link', { name: 'Organizations' })).toBeInTheDocument();
    expect(within(drawer).queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
  });
});
