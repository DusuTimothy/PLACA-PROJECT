import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import {
  sendAssistantMessage,
  sendPublicAssistantMessage,
} from '../../services/assistantApi';
import { errorMessage } from '../../utils/errors';

const MAX_MESSAGE_LENGTH = 1000;
const PUBLIC_HISTORY_TURNS = 6;

function ChatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none">
      <path
        d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.4 3.6A.75.75 0 0 1 4.5 19v-2.3A2.5 2.5 0 0 1 4 15.2V5.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M8 8h8M8 11.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WidgetMessage({ message, t }) {
  const isUser = message.role === 'user';
  return (
    <li className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-2xl border px-3 py-2 text-sm leading-relaxed ${
          isUser
            ? 'border-placa-200 bg-placa-50 text-placa-950'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-500">
          {isUser ? t('assistant.you') : t('assistant.assistantName')}
        </p>
        <p className="mt-1 whitespace-pre-wrap break-words">{message.content}</p>
        {!isUser && (
          <p className="mt-2 border-t border-slate-100 pt-1 text-[0.65rem] leading-relaxed text-slate-500">
            {t('assistant.generatedNotice')}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Floating assistant available on every screen of the React app, including the
 * sign-in pages. Signed-in users get the same saved conversations as the full
 * assistant page. Visitors use the stateless public endpoint and are told that
 * their chat is not saved.
 *
 * The widget is mounted at the application root so it survives route changes.
 * It is not a modal: the rest of the page stays usable, and Escape closes it.
 */
export default function AssistantWidget() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const panelId = useId();
  const titleId = `${panelId}-title`;

  const language = i18n.language === 'ha' ? 'ha' : 'en';
  const isAccount = Boolean(user && !user.must_change_password);

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [failedText, setFailedText] = useState('');
  const [conversationId, setConversationId] = useState(null);

  const launcherRef = useRef(null);
  const panelRef = useRef(null);
  const textareaRef = useRef(null);
  const endRef = useRef(null);
  const identityRef = useRef(user?.id || 'guest');

  const close = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  // A shared device must not show the previous person's chat to the next user.
  useEffect(() => {
    const identity = user?.id || 'guest';
    if (identityRef.current === identity) return;
    identityRef.current = identity;
    setMessages([]);
    setConversationId(null);
    setDraft('');
    setError('');
    setFailedText('');
  }, [user?.id]);

  useEffect(() => {
    if (!open) return undefined;

    textareaRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = panelRef.current?.querySelectorAll(
        'button:not([disabled]), textarea:not([disabled]), a[href]'
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    function onPointerDown(event) {
      if (
        panelRef.current?.contains(event.target) ||
        launcherRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open, close]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [messages, sending]);

  function startNewChat() {
    if (sending) return;
    setMessages([]);
    setConversationId(null);
    setDraft('');
    setError('');
    setFailedText('');
    textareaRef.current?.focus();
  }

  async function submit(textOverride) {
    const text = String(textOverride ?? draft).trim();
    if (!text || sending) return;

    const pendingId = `pending-${Date.now()}`;
    const optimistic = {
      id: pendingId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };
    const history = messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .slice(-PUBLIC_HISTORY_TURNS)
      .map((message) => ({ role: message.role, content: message.content }));

    setSending(true);
    setError('');
    setFailedText('');
    setDraft('');
    setMessages((current) => [...current, optimistic]);

    try {
      if (isAccount) {
        const result = await sendAssistantMessage({
          ...(conversationId ? { conversation_id: conversationId } : {}),
          message: text,
          language,
        });

        if (result?.conversation?.id) setConversationId(result.conversation.id);
        const nextMessages = (result?.messages || []).map((message, index) => ({
          ...message,
          id: message.id || `account-${Date.now()}-${index}`,
        }));
        setMessages((current) => [
          ...current.filter((message) => message.id !== pendingId),
          ...nextMessages,
        ]);
      } else {
        const result = await sendPublicAssistantMessage({
          message: text,
          language,
          history,
        });
        const nextMessages = (result?.messages || []).map((message, index) => ({
          ...message,
          id: message.id || `public-${Date.now()}-${index}`,
        }));
        setMessages((current) => [
          ...current.filter((message) => message.id !== pendingId),
          optimistic,
          ...nextMessages,
        ]);
      }
    } catch (sendError) {
      setMessages((current) => current.filter((message) => message.id !== pendingId));
      setDraft(text);
      setFailedText(text);
      setError(errorMessage(sendError, t));
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    submit();
  }

  const badge = isAccount
    ? t('assistant.widgetSavedBadge')
    : t('assistant.widgetGuestBadge');
  const note = isAccount ? t('assistant.widgetAccountNote') : t('assistant.widgetPublicNote');

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={t('assistant.widgetOpen')}
        className="fixed bottom-4 right-4 z-[60] inline-flex min-h-tap items-center gap-2 rounded-full bg-placa-600 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:bg-placa-700 focus-visible:ring-4 focus-visible:ring-placa-300 sm:bottom-5 sm:right-5"
      >
        <ChatIcon />
        <span>{t('assistant.widgetLauncher')}</span>
      </button>

      {open && (
        <section
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          className="fixed inset-x-3 bottom-20 z-[60] flex max-h-[calc(100dvh-7rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-auto sm:right-5 sm:w-[24rem] sm:bottom-24"
        >
          <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="text-base font-bold text-ink">
                {t('assistant.widgetTitle')}
              </h2>
              <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {badge}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={startNewChat}
                disabled={sending || messages.length === 0}
                className="min-h-tap rounded-lg px-2 py-1 text-xs font-semibold text-placa-700 hover:bg-placa-50 disabled:text-slate-400"
              >
                {t('assistant.newChat')}
              </button>
              <button
                type="button"
                onClick={close}
                aria-label={t('assistant.widgetClose')}
                className="flex min-h-tap h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
              >
                <span aria-hidden="true" className="text-xl leading-none">
                  ×
                </span>
              </button>
            </div>
          </div>

          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2">
            <p className="text-xs leading-relaxed text-slate-600">{note}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              {t('assistant.widgetDisclaimer')}
            </p>
          </div>

          <div className="min-h-[9rem] flex-1 overflow-y-auto px-4 py-3">
            {messages.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                {t('assistant.empty')}
              </p>
            ) : (
              <ol className="space-y-2" aria-live="polite">
                {messages.map((message) => (
                  <WidgetMessage key={message.id} message={message} t={t} />
                ))}
              </ol>
            )}

            {sending && (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-600" role="status">
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-placa-300 border-t-placa-700"
                />
                <span>{t('assistant.thinking')}</span>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {error && (
            <div role="alert" className="mx-4 mt-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
              <p>{error}</p>
              {failedText && (
                <button
                  type="button"
                  onClick={() => submit(failedText)}
                  disabled={sending}
                  className="mt-2 min-h-tap rounded-lg border border-red-400 bg-white px-3 py-1 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:text-slate-400"
                >
                  {t('assistant.widgetRetry')}
                </button>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-2 border-t border-slate-100 p-3">
            <label htmlFor={`${panelId}-message`} className="placa-label text-sm">
              {t('assistant.widgetInputLabel')}
            </label>
            <textarea
              ref={textareaRef}
              id={`${panelId}-message`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('assistant.placeholder')}
              maxLength={MAX_MESSAGE_LENGTH}
              disabled={sending}
              className="placa-input min-h-[4.5rem] resize-none text-sm disabled:bg-slate-100"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                {t('assistant.charactersLeft', {
                  count: MAX_MESSAGE_LENGTH - draft.length,
                })}
              </span>
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                className="inline-flex min-h-tap items-center justify-center rounded-xl bg-placa-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-placa-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {sending ? t('assistant.sending') : t('assistant.send')}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 text-xs">
              {isAccount ? (
                <Link
                  to="/assistant"
                  onClick={close}
                  className="font-semibold text-placa-700 underline-offset-2 hover:underline"
                >
                  {t('assistant.widgetFullPage')}
                </Link>
              ) : (
                <Link
                  to="/login"
                  onClick={close}
                  className="font-semibold text-placa-700 underline-offset-2 hover:underline"
                >
                  {t('assistant.widgetSignIn')}
                </Link>
              )}
            </div>
          </form>
        </section>
      )}
    </>
  );
}
