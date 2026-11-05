import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import AssistantWidget from '../AssistantWidget';
import i18n from '../../../i18n';
import {
  sendAssistantMessage,
  sendPublicAssistantMessage,
} from '../../../services/assistantApi';

const auth = vi.hoisted(() => ({ user: null }));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: auth.user }),
}));

vi.mock('../../../services/assistantApi', () => ({
  sendAssistantMessage: vi.fn(),
  sendPublicAssistantMessage: vi.fn(),
}));

function tree() {
  return (
    <MemoryRouter>
      <I18nextProvider i18n={i18n}>
        <AssistantWidget />
      </I18nextProvider>
    </MemoryRouter>
  );
}

function renderWidget() {
  return render(tree());
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('AssistantWidget', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await i18n.changeLanguage('en');
    auth.user = null;
  });

  it('opens and closes for keyboard users on the public app', async () => {
    const user = userEvent.setup();
    renderWidget();

    const launcher = screen.getByRole('button', { name: 'Open PLACA assistant' });
    expect(launcher).toHaveAttribute('aria-expanded', 'false');

    await user.click(launcher);
    expect(launcher).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/You are not signed in/i)).toBeInTheDocument();
    expect(screen.getByText(/not official or medical advice/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Message the assistant')).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(launcher).toHaveFocus();
  });

  it('sends a public message with bounded local history and shows loading', async () => {
    const pending = deferred();
    sendPublicAssistantMessage.mockReturnValue(pending.promise);

    const user = userEvent.setup();
    renderWidget();
    await user.click(screen.getByRole('button', { name: 'Open PLACA assistant' }));
    await user.type(screen.getByLabelText('Message the assistant'), 'What does PLACA publish?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(sendPublicAssistantMessage).toHaveBeenCalledWith({
      message: 'What does PLACA publish?',
      language: 'en',
      history: [],
    });
    expect(screen.getByRole('status')).toHaveTextContent('Assistant is thinking…');

    pending.resolve({
      messages: [
        {
          role: 'assistant',
          content: 'Published results are counts only.',
        },
      ],
    });

    expect(await screen.findByText('Published results are counts only.')).toBeInTheDocument();
    expect(screen.getByText(/AI-generated. Check important details/i)).toBeInTheDocument();
    expect(sendAssistantMessage).not.toHaveBeenCalled();
  });

  it('uses saved account conversations and includes the conversation id next time', async () => {
    auth.user = {
      id: 'user-1',
      role: 'partner_staff',
      language: 'en',
      must_change_password: false,
    };

    sendAssistantMessage
      .mockResolvedValueOnce({
        conversation: {
          id: 'conversation-1',
          title: 'How do I report?',
          language: 'en',
        },
        messages: [
          { id: 'm1', role: 'user', content: 'How do I report?' },
          {
            id: 'm2',
            role: 'assistant',
            content: 'Open the Reports page to start a report.',
          },
        ],
      })
      .mockResolvedValueOnce({
        conversation: {
          id: 'conversation-1',
          title: 'How do I report?',
          language: 'en',
        },
        messages: [
          { id: 'm3', role: 'user', content: 'And then?' },
          { id: 'm4', role: 'assistant', content: 'Submit it for review.' },
        ],
      });

    const user = userEvent.setup();
    renderWidget();
    await user.click(screen.getByRole('button', { name: 'Open PLACA assistant' }));

    expect(screen.getByText(/saved to your account/i)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Message the assistant'), 'How do I report?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Open the Reports page to start a report.')).toBeInTheDocument();
    expect(sendAssistantMessage).toHaveBeenNthCalledWith(1, {
      message: 'How do I report?',
      language: 'en',
    });
    expect(sendPublicAssistantMessage).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Message the assistant'), 'And then?');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Submit it for review.')).toBeInTheDocument();
    expect(sendAssistantMessage).toHaveBeenNthCalledWith(2, {
      conversation_id: 'conversation-1',
      message: 'And then?',
      language: 'en',
    });
  });

  it('shows a clear setup error, restores the question and allows a retry', async () => {
    sendPublicAssistantMessage.mockRejectedValueOnce({
      response: { status: 503, data: { error: 'AI_NOT_CONFIGURED' } },
    });

    const user = userEvent.setup();
    renderWidget();
    await user.click(screen.getByRole('button', { name: 'Open PLACA assistant' }));
    await user.type(screen.getByLabelText('Message the assistant'), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(/not set up yet/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Message the assistant')).toHaveValue('Hello');

    sendPublicAssistantMessage.mockResolvedValueOnce({
      messages: [{ role: 'assistant', content: 'Now the assistant can answer.' }],
    });
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Now the assistant can answer.')).toBeInTheDocument();
    expect(sendPublicAssistantMessage).toHaveBeenCalledTimes(2);
  });

  it('clears the previous account chat when the signed-in user changes', async () => {
    auth.user = {
      id: 'user-1',
      role: 'partner_staff',
      language: 'en',
      must_change_password: false,
    };
    sendAssistantMessage.mockResolvedValueOnce({
      conversation: { id: 'conversation-1', title: 'Earlier', language: 'en' },
      messages: [
        { id: 'm1', role: 'user', content: 'Earlier question' },
        { id: 'm2', role: 'assistant', content: 'Earlier private answer' },
      ],
    });

    const user = userEvent.setup();
    const view = renderWidget();
    await user.click(screen.getByRole('button', { name: 'Open PLACA assistant' }));
    await user.type(screen.getByLabelText('Message the assistant'), 'Earlier question');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('Earlier private answer')).toBeInTheDocument();

    auth.user = null;
    view.rerender(tree());

    await waitFor(() => {
      expect(screen.queryByText('Earlier private answer')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/You are not signed in/i)).toBeInTheDocument();
  });
});
