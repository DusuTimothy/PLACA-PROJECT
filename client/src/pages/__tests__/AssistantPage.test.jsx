import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AssistantPage from '../AssistantPage';
import { AuthProvider } from '../../context/AuthContext';
import { LanguageProvider } from '../../context/LanguageContext';
import { refreshSession } from '../../services/api';
import {
  getAssistantConversation,
  listAssistantConversations,
  sendAssistantMessage,
} from '../../services/assistantApi';
import i18n from '../../i18n';

vi.mock('../../services/api', () => ({
  default: { post: vi.fn(), get: vi.fn(), patch: vi.fn() },
  refreshSession: vi.fn(),
  setAccessToken: vi.fn(),
}));

vi.mock('../../services/assistantApi', () => ({
  listAssistantConversations: vi.fn(),
  getAssistantConversation: vi.fn(),
  deleteAssistantConversation: vi.fn(),
  sendAssistantMessage: vi.fn(),
}));

vi.mock('../../services/phase5Api', () => ({
  unreadNotifications: vi.fn().mockResolvedValue(0),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/assistant']}>
      <AuthProvider>
        <LanguageProvider>
          <AssistantPage />
        </LanguageProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('AssistantPage', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');

    refreshSession.mockResolvedValue({
      accessToken: 'test-token',
      user: {
        id: 'user-1',
        name: 'Grace Pam',
        role: 'partner_staff',
        language: 'en',
        must_change_password: false,
      },
    });
    listAssistantConversations.mockResolvedValue({ data: [] });
  });

  it('shows the safety notice and opens a saved conversation', async () => {
    listAssistantConversations.mockResolvedValue({
      data: [
        {
          id: 'conversation-1',
          title: 'Earlier question',
          language: 'en',
          last_message_at: '2026-01-01T10:00:00.000Z',
        },
      ],
    });
    getAssistantConversation.mockResolvedValue({
      id: 'conversation-1',
      title: 'Earlier question',
      language: 'en',
      messages: [
        { id: 'm1', role: 'user', content: 'Earlier question', created_at: '2026-01-01T10:00:00.000Z' },
        { id: 'm2', role: 'assistant', content: 'Earlier answer', created_at: '2026-01-01T10:01:00.000Z' },
      ],
    });

    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('heading', { name: 'AI assistant' })).toBeInTheDocument();
    expect(screen.getByText(/not guaranteed, official or medical advice/i)).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /Earlier question/i }));

    expect(await screen.findByText('Earlier answer')).toBeInTheDocument();
    expect(getAssistantConversation).toHaveBeenCalledWith('conversation-1');
  });

  it('shows a thinking state, sends only the new message and renders the reply', async () => {
    let resolveSend;
    sendAssistantMessage.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      })
    );

    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: 'AI assistant' });
    await user.type(screen.getByLabelText('Your message'), 'How do I report?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Assistant is thinking…')).toBeInTheDocument();
    expect(screen.getByText('How do I report?')).toBeInTheDocument();
    expect(sendAssistantMessage).toHaveBeenCalledWith({
      message: 'How do I report?',
      language: 'en',
    });

    resolveSend({
      conversation: {
        id: 'conversation-1',
        title: 'How do I report?',
        language: 'en',
        last_message_at: '2026-01-01T10:01:00.000Z',
      },
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'How do I report?',
          created_at: '2026-01-01T10:00:00.000Z',
        },
        {
          id: 'm2',
          role: 'assistant',
          content: 'Open the Reports page.',
          created_at: '2026-01-01T10:01:00.000Z',
        },
      ],
    });

    expect(await screen.findByText('Open the Reports page.')).toBeInTheDocument();
    expect(screen.getByText(/AI-generated\. Check important details/i)).toBeInTheDocument();
  });

  it('restores the question and shows a clear error when the assistant fails', async () => {
    sendAssistantMessage.mockRejectedValue({
      response: {
        status: 502,
        data: { error: 'AI_UNAVAILABLE' },
      },
    });

    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('heading', { name: 'AI assistant' });
    await user.type(screen.getByLabelText('Your message'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(
      await screen.findByText('The assistant is unavailable right now. Try again in a moment.')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Your message')).toHaveValue('Hello');
  });
});
