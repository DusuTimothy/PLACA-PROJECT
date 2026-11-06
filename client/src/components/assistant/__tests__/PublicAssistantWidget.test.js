import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function findScript() {
  const candidates = [
    resolve(process.cwd(), 'public/site/assistant.js'),
    resolve(process.cwd(), 'client/public/site/assistant.js'),
  ];
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Could not locate the public assistant widget script');
  return found;
}

const script = readFileSync(findScript(), 'utf8');

const strings = {
  'assistant.widgetOpen': 'Open PLACA assistant',
  'assistant.launcher': 'Ask PLACA',
  'assistant.widgetTitle': 'PLACA assistant',
  'assistant.widgetGuestBadge': 'Not saved',
  'assistant.widgetNewChat': 'New chat',
  'assistant.widgetClose': 'Close assistant',
  'assistant.widgetPublicNote':
    'You are not signed in. This chat is not saved and will clear when you leave or refresh.',
  'assistant.widgetDisclaimer':
    'AI can make mistakes. Answers are not official or medical advice.',
  'assistant.empty': 'Start with a question.',
  'assistant.widgetRetry': 'Try again',
  'assistant.widgetInputLabel': 'Message the assistant',
  'assistant.placeholder': 'Ask a general question…',
  'assistant.widgetSignIn': 'Sign in to save chats',
  'assistant.sending': 'Sending…',
  'assistant.send': 'Send',
  'assistant.charactersLeft': '{{count}} characters left',
  'assistant.thinking': 'Assistant is thinking…',
  'assistant.you': 'You',
  'assistant.assistantName': 'PLACA assistant',
  'assistant.generatedNotice': 'AI-generated. Check important details.',
  'assistant.errorNotConfigured':
    'The assistant is not set up yet. Ask a PLACA administrator to add the Gemini API key.',
  'assistant.errorUnavailable': 'The assistant is unavailable right now.',
  'assistant.errorTimeout': 'The assistant took too long to answer.',
  'assistant.errorBlocked': 'The assistant could not answer that request.',
  'assistant.errorRateLimited': 'Too many messages. Please wait a few minutes.',
  'assistant.errorValidation': 'Please type a question of 1000 characters or fewer.',
  'assistant.errorGeneric': 'The assistant could not answer. Please try again.',
};

function t(key, variables) {
  const value = strings[key] || key;
  if (!variables) return value;
  return value.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
    variables[name] === undefined ? '' : String(variables[name])
  );
}

function loadWidget() {
  window.PLACA_PUBLIC = { t, getLanguage: () => 'en' };
  new Function(script)();
}

function submit(text) {
  const input = document.getElementById('placa-assistant-message');
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const form = document.querySelector('.placa-assistant-form');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('public landing-page assistant widget', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { messages: [{ role: 'assistant', content: 'Published results are counts only.' }] },
        }),
      })
    );
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete window.PLACA_ASSISTANT;
    delete window.PLACA_PUBLIC;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('opens, sends only the public payload and renders the answer', async () => {
    loadWidget();

    const launcher = document.getElementById('placa-assistant-launcher');
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    expect(launcher).toHaveAccessibleName('Open PLACA assistant');

    launcher.click();
    expect(launcher).toHaveAttribute('aria-expanded', 'true');
    expect(document.getElementById('placa-assistant-panel').hidden).toBe(false);
    expect(document.body.textContent).toContain('You are not signed in');
    expect(document.getElementById('placa-assistant-message')).toHaveFocus();

    const sendButton = document.querySelector('.placa-assistant-send');
    expect(sendButton).toHaveTextContent('Send');
    expect(sendButton).toBeDisabled();
    submit('What do you publish?');
    expect(sendButton).toHaveTextContent('Sending…');

    expect(document.body.textContent).toContain('Assistant is thinking…');

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/public/assistant/chat');
    expect(options.credentials).toBe('omit');
    expect(options.headers.Authorization).toBeUndefined();
    expect(JSON.parse(options.body)).toEqual({
      message: 'What do you publish?',
      language: 'en',
      history: [],
    });

    await waitFor(() => {
      expect(document.body.textContent).toContain('Published results are counts only.');
    });
    expect(sendButton).toHaveTextContent('Send');
    expect(sendButton).toBeDisabled();
  });

  it('shows an explicit setup error and offers a retry', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'AI_NOT_CONFIGURED' }),
    });
    loadWidget();

    document.getElementById('placa-assistant-launcher').click();
    submit('Hello');

    await waitFor(() => {
      expect(document.body.textContent).toContain('The assistant is not set up yet');
    });

    const input = document.getElementById('placa-assistant-message');
    expect(input.value).toBe('Hello');
    const retry = document.querySelector('.placa-assistant-retry');
    expect(retry.hidden).toBe(false);

    retry.click();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(document.body.textContent).toContain('Published results are counts only.');
    });
  });

  it('closes with Escape and returns focus to the launcher', () => {
    loadWidget();

    const launcher = document.getElementById('placa-assistant-launcher');
    launcher.click();
    expect(document.getElementById('placa-assistant-panel').hidden).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(document.getElementById('placa-assistant-panel').hidden).toBe(true);
    expect(launcher).toHaveAttribute('aria-expanded', 'false');
    expect(launcher).toHaveFocus();
  });

  it('closes on an outside click without clearing the draft', () => {
    loadWidget();

    const launcher = document.getElementById('placa-assistant-launcher');
    launcher.click();
    const input = document.getElementById('placa-assistant-message');
    input.value = 'Keep this draft';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }));

    const panel = document.getElementById('placa-assistant-panel');
    expect(panel.hidden).toBe(true);
    expect(input.value).toBe('Keep this draft');
    expect(launcher).toHaveAttribute('aria-expanded', 'false');

    launcher.click();
    expect(panel.hidden).toBe(false);
    expect(input.value).toBe('Keep this draft');
  });
});
