import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import UsersPage from '../UsersPage';
import { AuthProvider } from '../../context/AuthContext';
import { LanguageProvider } from '../../context/LanguageContext';
import { refreshSession } from '../../services/api';
import { listOrganizations } from '../../services/programmeApi';
import { createUser, listUsers, resendInvitation, updateUser } from '../../services/userApi';
import i18n from '../../i18n';

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
  updateUser: vi.fn(),
}));

vi.mock('../../services/phase5Api', () => ({
  unreadNotifications: vi.fn().mockResolvedValue(0),
}));

describe('UsersPage Hausa localization', () => {
  it('supports Hausa translations for role change controls, confirmation and success notice', async () => {
    await i18n.changeLanguage('ha');

    listOrganizations.mockResolvedValue({ data: [] });
    listUsers.mockResolvedValue({
      data: [
        {
          id: 'u-1',
          name: 'Existing Staff',
          email: 'existing@pyi.org',
          role: 'partner_staff',
          is_active: true,
          created_at: '2026-02-01T10:00:00.000Z',
        },
      ],
      pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    refreshSession.mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 'director-1',
        name: 'Jane Director',
        role: 'placa_director',
        language: 'ha',
        must_change_password: false,
      },
    });

    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    updateUser.mockResolvedValueOnce({
      user: {
        id: 'u-1',
        name: 'Existing Staff',
        role: 'placa_officer',
      },
    });

    render(
      <MemoryRouter initialEntries={['/users']}>
        <AuthProvider>
          <LanguageProvider>
            <UsersPage />
          </LanguageProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Gudanar da masu amfani' });

    // Trigger button in Hausa
    const changeRoleBtn = await screen.findByRole('button', { name: /canza matsayi/i });
    await user.click(changeRoleBtn);
    screen.debug(undefined, 20000);

    // Form heading in Hausa
    expect(
      await screen.findByRole('heading', { name: 'Canza matsayi ga Existing Staff' })
    ).toBeInTheDocument();

    const select = screen.getByLabelText(/^sabuwar matsayi/i);
    await user.selectOptions(select, 'placa_officer');

    // Elevated warning in Hausa
    expect(
      screen.getByText('Wannan matsayi yana ba da damar gudanarwa a fadin dandalin.')
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /ajiye matsayi/i }));

    expect(confirmSpy).toHaveBeenCalledWith(
      "Ba wa Existing Staff babban matsayi na Jami'in PLACA? Wannan zai ba da damar gudanarwa a dandalin."
    );
    expect(updateUser).toHaveBeenCalledWith('u-1', { role: 'placa_officer' });

    expect(
      await screen.findByText("An sabunta matsayin Existing Staff zuwa Jami'in PLACA.")
    ).toBeInTheDocument();

    confirmSpy.mockRestore();
    await i18n.changeLanguage('en');
  });
});
