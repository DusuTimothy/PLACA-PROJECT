import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import UsersPage from '../UsersPage';
import { AuthProvider } from '../../context/AuthContext';
import { LanguageProvider } from '../../context/LanguageContext';
import { refreshSession } from '../../services/api';
import { listOrganizations } from '../../services/programmeApi';
import { createUser, listUsers, resendInvitation } from '../../services/userApi';

vi.mock('../../services/api', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn() },
  refreshSession: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock('../../services/programmeApi', () => ({
  listOrganizations: vi.fn(),
}));

vi.mock('../../services/userApi', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
  resendInvitation: vi.fn(),
}));

vi.mock('../../services/phase5Api', () => ({
  unreadNotifications: vi.fn().mockResolvedValue(0),
}));

const mockApprovedOrgs = [
  {
    id: 'org-app-1',
    name: 'Plateau Youth Initiative',
    status: 'approved',
    lga_id: 'lga-1',
    lga: { name: 'Jos North' },
  },
  {
    id: 'org-app-2',
    name: 'Rural Health Alliance',
    status: 'approved',
    lga_id: 'lga-2',
    lga: { name: 'Pankshin' },
  },
];

const mockUsersList = [
  {
    id: 'u-1',
    name: 'Existing Staff',
    email: 'existing@pyi.org',
    role: 'partner_staff',
    is_active: true,
    created_at: '2026-02-01T10:00:00.000Z',
    organization: { name: 'Plateau Youth Initiative' },
    lga: { name: 'Jos North' },
  },
];

function renderUsersPage({ role = 'placa_officer', initialEntries = ['/users'] } = {}) {
  refreshSession.mockResolvedValue({
    accessToken: 'test-token',
    user: {
      id: 'officer-1',
      name: 'John Officer',
      role,
      must_change_password: false,
    },
  });

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <LanguageProvider>
          <UsersPage />
        </LanguageProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('UsersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listOrganizations.mockResolvedValue({ data: mockApprovedOrgs });
    listUsers.mockResolvedValue({
      data: mockUsersList,
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  describe('Role access', () => {
    it('shows the "Invite partner staff" action for PLACA Officers', async () => {
      renderUsersPage({ role: 'placa_officer' });

      expect(await screen.findByRole('heading', { name: 'User management' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /invite partner staff/i })
      ).toBeInTheDocument();
    });

    it('shows the "Invite partner staff" action for PLACA Directors', async () => {
      renderUsersPage({ role: 'placa_director' });

      expect(await screen.findByRole('heading', { name: 'User management' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: /invite partner staff/i })
      ).toBeInTheDocument();
    });

    it('does not show the "Invite partner staff" action to other roles', async () => {
      renderUsersPage({ role: 'laca_officer' });

      expect(await screen.findByRole('heading', { name: 'User management' })).toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: /invite partner staff/i })
      ).not.toBeInTheDocument();
    });
  });

  describe('Approved-organization selection', () => {
    it('requests only approved organizations and populates the dropdown with them', async () => {
      const user = userEvent.setup();
      // Even if API returned mixed statuses, page ensures only approved are shown
      listOrganizations.mockResolvedValueOnce({
        data: [
          ...mockApprovedOrgs,
          { id: 'org-pending', name: 'Pending Org', status: 'pending' },
          { id: 'org-suspended', name: 'Suspended Org', status: 'suspended' },
        ],
      });

      renderUsersPage();
      await screen.findByRole('heading', { name: 'User management' });

      await user.click(screen.getByRole('button', { name: /invite partner staff/i }));

      expect(listOrganizations).toHaveBeenCalledWith({ status: 'approved', limit: 100 });

      const select = screen.getByLabelText(/^organization/i);
      const options = within(select)
        .getAllByRole('option')
        .map((opt) => opt.textContent);

      expect(options).toContain('Plateau Youth Initiative (Jos North)');
      expect(options).toContain('Rural Health Alliance (Pankshin)');
      expect(options.some((text) => text.includes('Pending Org'))).toBe(false);
      expect(options.some((text) => text.includes('Suspended Org'))).toBe(false);
    });

    it('pre-selects organization and opens form when organization_id is in query parameters', async () => {
      renderUsersPage({
        role: 'placa_officer',
        initialEntries: ['/users?organization_id=org-app-2'],
      });

      await screen.findByRole('heading', { name: 'User management' });

      // Form should be automatically open
      expect(screen.getByRole('heading', { name: 'Invite partner staff member' })).toBeInTheDocument();

      const orgSelect = screen.getByLabelText(/^organization/i);
      expect(orgSelect).toHaveValue('org-app-2');
    });
  });

  describe('Required fields validation', () => {
    it('validates required fields before submitting to API', async () => {
      const user = userEvent.setup();
      renderUsersPage();

      await screen.findByRole('heading', { name: 'User management' });
      await user.click(screen.getByRole('button', { name: /invite partner staff/i }));

      // Submit without entering anything
      await user.click(screen.getByRole('button', { name: /create account and send invitation/i }));

      expect(createUser).not.toHaveBeenCalled();
      expect(screen.getAllByText(/required/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Successful invitation workflow', () => {
    it('creates partner staff, shows success only when API confirms email sent, and hides credentials', async () => {
      const user = userEvent.setup();
      createUser.mockResolvedValueOnce({
        user: {
          id: 'u-new',
          name: 'Aisha Bello',
          email: 'aisha@pyi.org',
          role: 'partner_staff',
          organization: { name: 'Plateau Youth Initiative' },
        },
        temporaryPassword: 'SuperSecretTempPassword#123',
        inviteUrl: 'https://example.org/accept-invitation?token=secrettoken999',
        emailSent: true,
        emailDelivery: {
          sent: true,
          sandboxed: false,
          reason: 'delivered',
        },
      });

      renderUsersPage();
      await screen.findByRole('heading', { name: 'User management' });

      await user.click(screen.getByRole('button', { name: /invite partner staff/i }));

      await user.type(screen.getByLabelText(/^full name/i), 'Aisha Bello');
      await user.type(screen.getByLabelText(/^email address/i), 'aisha@pyi.org');
      await user.selectOptions(screen.getByLabelText(/^organization/i), 'org-app-1');

      await user.click(screen.getByRole('button', { name: /create account and send invitation/i }));

      expect(createUser).toHaveBeenCalledWith({
        name: 'Aisha Bello',
        email: 'aisha@pyi.org',
        role: 'partner_staff',
        organization_id: 'org-app-1',
        language: 'en',
        send_email: true,
      });

      // Clear success message confirming email sent
      const alert = await screen.findByRole('status');
      expect(alert).toHaveTextContent(
        'Partner staff account for Aisha Bello was created and an invitation email was sent to aisha@pyi.org.'
      );

      // Security check: Never expose temporary password or tokens in UI
      expect(screen.queryByText(/SuperSecretTempPassword/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/secrettoken999/i)).not.toBeInTheDocument();

      // Form closes and user list refreshes
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Invite partner staff member' })).not.toBeInTheDocument();
      });
      expect(listUsers).toHaveBeenCalledTimes(2);
    });

    it('reports development sandboxed email delivery clearly', async () => {
      const user = userEvent.setup();
      createUser.mockResolvedValueOnce({
        user: {
          id: 'u-dev',
          name: 'Dev Staff',
          email: 'dev@pyi.org',
          role: 'partner_staff',
        },
        emailSent: true,
        emailDelivery: {
          sent: true,
          sandboxed: true,
          reason: 'sandboxed',
        },
      });

      renderUsersPage();
      await screen.findByRole('heading', { name: 'User management' });

      await user.click(screen.getByRole('button', { name: /invite partner staff/i }));
      await user.type(screen.getByLabelText(/^full name/i), 'Dev Staff');
      await user.type(screen.getByLabelText(/^email address/i), 'dev@pyi.org');
      await user.selectOptions(screen.getByLabelText(/^organization/i), 'org-app-1');

      await user.click(screen.getByRole('button', { name: /create account and send invitation/i }));

      const alert = await screen.findByRole('status');
      expect(alert).toHaveTextContent(
        'In development mode, email delivery was sandboxed (message dropped by email service; no real email was delivered).'
      );
    });
  });

  describe('Failure handling', () => {
    it('reports email not configured and never implies email was sent', async () => {
      const user = userEvent.setup();
      createUser.mockResolvedValueOnce({
        user: {
          id: 'u-not-sent',
          name: 'No Email Service',
          email: 'noemail@pyi.org',
          role: 'partner_staff',
        },
        emailSent: false,
        emailDelivery: {
          sent: false,
          reason: 'not_configured',
        },
      });

      renderUsersPage();
      await screen.findByRole('heading', { name: 'User management' });

      await user.click(screen.getByRole('button', { name: /invite partner staff/i }));
      await user.type(screen.getByLabelText(/^full name/i), 'No Email Service');
      await user.type(screen.getByLabelText(/^email address/i), 'noemail@pyi.org');
      await user.selectOptions(screen.getByLabelText(/^organization/i), 'org-app-1');

      await user.click(screen.getByRole('button', { name: /create account and send invitation/i }));

      const alert = await screen.findByRole('status');
      expect(alert).toHaveTextContent(
        'Account for No Email Service was created, but the invitation email was not sent because the email service is not configured (BREVO_API_KEY missing).'
      );
      // Ensure it does NOT imply an email was sent
      expect(screen.queryByText(/an invitation email was sent/i)).not.toBeInTheDocument();
    });

    it('reports email sending failure when delivery fails', async () => {
      const user = userEvent.setup();
      createUser.mockResolvedValueOnce({
        user: {
          id: 'u-failed',
          name: 'Failed Delivery',
          email: 'failed@pyi.org',
          role: 'partner_staff',
        },
        emailSent: false,
        emailDelivery: {
          sent: false,
          reason: 'send_failed',
        },
      });

      renderUsersPage();
      await screen.findByRole('heading', { name: 'User management' });

      await user.click(screen.getByRole('button', { name: /invite partner staff/i }));
      await user.type(screen.getByLabelText(/^full name/i), 'Failed Delivery');
      await user.type(screen.getByLabelText(/^email address/i), 'failed@pyi.org');
      await user.selectOptions(screen.getByLabelText(/^organization/i), 'org-app-1');

      await user.click(screen.getByRole('button', { name: /create account and send invitation/i }));

      const alert = await screen.findByRole('status');
      expect(alert).toHaveTextContent(
        'Account for Failed Delivery was created, but sending the invitation email failed. You can resend the invitation later.'
      );
    });

    it('displays server validation errors under the appropriate field', async () => {
      const user = userEvent.setup();
      createUser.mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: 'VALIDATION_FAILED',
            details: [{ path: 'body.email', message: 'Enter a valid email address' }],
          },
        },
      });

      renderUsersPage();
      await screen.findByRole('heading', { name: 'User management' });

      await user.click(screen.getByRole('button', { name: /invite partner staff/i }));
      await user.type(screen.getByLabelText(/^full name/i), 'Bad Email');
      await user.type(screen.getByLabelText(/^email address/i), 'bad@example.com');
      const orgSelect = screen.getByLabelText(/^organization/i);
      await waitFor(() => expect(orgSelect).toBeEnabled());
      await user.selectOptions(orgSelect, 'org-app-1');

      await user.click(screen.getByRole('button', { name: /create account and send invitation/i }));

      expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    });

    it('displays permission error when user is forbidden', async () => {
      const user = userEvent.setup();
      createUser.mockRejectedValueOnce({
        response: {
          status: 403,
          data: {
            error: 'ROLE_NOT_ALLOWED',
            message: 'You cannot create an account with that role.',
          },
        },
      });

      renderUsersPage();
      await screen.findByRole('heading', { name: 'User management' });

      await user.click(screen.getByRole('button', { name: /invite partner staff/i }));
      await user.type(screen.getByLabelText(/^full name/i), 'Forbidden User');
      await user.type(screen.getByLabelText(/^email address/i), 'forbidden@pyi.org');
      const orgSelect = screen.getByLabelText(/^organization/i);
      await waitFor(() => expect(orgSelect).toBeEnabled());
      await user.selectOptions(orgSelect, 'org-app-1');

      await user.click(screen.getByRole('button', { name: /create account and send invitation/i }));

      expect(
        await screen.findByText('You cannot perform this action with your current role.')
      ).toBeInTheDocument();
    });

    it('displays network error when connection fails', async () => {
      const user = userEvent.setup();
      createUser.mockRejectedValueOnce({
        request: {},
      });

      renderUsersPage();
      await screen.findByRole('heading', { name: 'User management' });

      await user.click(screen.getByRole('button', { name: /invite partner staff/i }));
      await user.type(screen.getByLabelText(/^full name/i), 'Offline Test');
      await user.type(screen.getByLabelText(/^email address/i), 'offline@pyi.org');
      const orgSelect = screen.getByLabelText(/^organization/i);
      await waitFor(() => expect(orgSelect).toBeEnabled());
      await user.selectOptions(orgSelect, 'org-app-1');

      await user.click(screen.getByRole('button', { name: /create account and send invitation/i }));

      expect(
        await screen.findByText(
          'No connection. Your work is still on this device. Try again when signal returns.'
        )
      ).toBeInTheDocument();
    });
  });

  describe('Resend invitation', () => {
    it('resends invitation email for partner staff', async () => {
      const user = userEvent.setup();
      resendInvitation.mockResolvedValueOnce({
        emailSent: true,
        emailDelivery: { sent: true, sandboxed: false },
      });

      renderUsersPage();
      await screen.findByRole('heading', { name: 'User management' });

      const resendBtn = screen.getByRole('button', { name: /resend invitation/i });
      await user.click(resendBtn);

      expect(resendInvitation).toHaveBeenCalledWith('u-1');
      expect(
        await screen.findByText('Invitation email resent to existing@pyi.org.')
      ).toBeInTheDocument();
    });
  });
});
