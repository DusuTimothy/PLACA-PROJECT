import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppShell from '../components/layout/AppShell';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import PageHeader from '../components/ui/PageHeader';
import {
  deleteAssistantConversation,
  getAssistantConversation,
  listAssistantConversations,
  sendAssistantMessage,
} from '../services/assistantApi';
import { errorMessage } from '../utils/errors';
import { formatDate } from '../utils/roles';

const MAX_MESSAGE_LENGTH = 2000;

function voiceErrorMessage(code, t) {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return t('assistant.micDenied');
    case 'audio-capture':
      return t('assistant.micUnavailable');
    case 'language-not-supported':
      return t('assistant.voiceLanguage');
    default:
      return t('assistant.voiceError');
  }
}

function MessageBubble({ message, t, language }) {
  const isUser = message.role === 'user';
  return (
    <li className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[92%] rounded-2xl border px-4 py-3 sm:max-w-[85%] ${
          isUser
            ? 'border-placa-200 bg-placa-50 text-placa-950'
            : 'border-slate-200 bg-white text-slate-800'
        }`}
      >
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
          {isUser ? t('assistant.you') : t('assistant.assistantName')}
          {message.created_at ? ` · ${formatDate(message.created_at, language)}` : ''}
        </p>
        <p className="mt-2 whitespace-pre-wrap break-words text-base leading-relaxed">
          {message.content}
        </p>
        {!isUser && (
          <p className="mt-3 border-t border-slate-100 pt-2 text-xs leading-relaxed text-slate-500">
            {t('assistant.generatedNotice')}
          </p>
        )}
      </div>
    </li>
  );
}

export default function AssistantPage() {
  const { t, i18n } = useTranslation();
  const language = i18n.language === 'ha' ? 'ha' : 'en';

  const [conversations, setConversations] = useState([]);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');

  const [loadingList, setLoadingList] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [notice, setNotice] = useState('');

  const [listening, setListening] = useState(false);
  const [readAloud, setReadAloud] = useState(false);

  const endRef = useRef(null);
  const recognitionRef = useRef(null);

  // SpeechRecognition is a powerful feature: browsers only expose it on HTTPS
  // or localhost. Plain HTTP on a LAN address or server IP cannot use the mic.
  const secureContext =
    typeof window === 'undefined' || window.isSecureContext !== false;
  const hasRecognitionApi =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const supportsRecognition = hasRecognitionApi && secureContext;
  const supportsSpeech =
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis !== 'undefined' &&
    typeof window.SpeechSynthesisUtterance !== 'undefined';

  useEffect(() => {
    let active = true;
    setLoadingList(true);
    setListError('');

    listAssistantConversations({ limit: 20 })
      .then((result) => {
        if (active) setConversations(result?.data || []);
      })
      .catch((loadError) => {
        if (active) setListError(errorMessage(loadError, t));
      })
      .finally(() => {
        if (active) setLoadingList(false);
      });

    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [messages, sending]);

  useEffect(
    () => () => {
      recognitionRef.current?.abort?.();
      if (supportsSpeech) window.speechSynthesis.cancel();
    },
    [supportsSpeech]
  );

  function stopSpeech() {
    if (supportsSpeech) window.speechSynthesis.cancel();
  }

  // Prefer an installed voice for the interface language, then any voice for
  // that language, then the browser default. This avoids silence on devices
  // that have no exact en-NG or ha-NG voice.
  function pickVoice(preferredLang) {
    if (!supportsSpeech || typeof window.speechSynthesis.getVoices !== 'function') {
      return null;
    }
    let voices = [];
    try {
      voices = window.speechSynthesis.getVoices() || [];
    } catch {
      return null;
    }
    if (voices.length === 0) return null;

    const wanted = String(preferredLang || '').toLowerCase();
    const base = wanted.split('-')[0];
    return (
      voices.find((voice) => String(voice.lang || '').toLowerCase() === wanted) ||
      voices.find((voice) =>
        String(voice.lang || '').toLowerCase().startsWith(`${base}-`)
      ) ||
      voices.find((voice) => String(voice.lang || '').toLowerCase() === base) ||
      voices.find((voice) => voice.default) ||
      null
    );
  }

  function speak(text) {
    if (!supportsSpeech || !text) return;
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();

    const preferredLang = language === 'ha' ? 'ha-NG' : 'en-NG';
    const voice = pickVoice(preferredLang);
    const utterance = new window.SpeechSynthesisUtterance(text);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang || preferredLang;
    } else {
      utterance.lang = preferredLang;
    }
    utterance.rate = 0.95;
    utterance.onerror = (event) => {
      const reason = event?.error;
      if (reason && reason !== 'canceled' && reason !== 'interrupted') {
        setError(t('assistant.voicePlaybackError'));
      }
    };
    window.speechSynthesis.speak(utterance);
  }

  function toggleReadAloud() {
    if (!supportsSpeech) return;
    const next = !readAloud;
    setReadAloud(next);
    if (!next) {
      stopSpeech();
      return;
    }
    const lastAnswer = [...messages].reverse().find((item) => item.role === 'assistant');
    if (lastAnswer) speak(lastAnswer.content);
  }

  function stopListening() {
    recognitionRef.current?.stop?.();
    setListening(false);
  }

  function startListening() {
    if (!supportsRecognition || listening || sending) return;
    stopSpeech();
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = language === 'ha' ? 'ha-NG' : 'en-NG';
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results || [])
        .map((result) => result?.[0]?.transcript || '')
        .join(' ')
        .trim();
      if (transcript) {
        setDraft((current) => (current ? `${current} ${transcript}` : transcript));
      }
    };
    recognition.onerror = (event) => {
      setError(voiceErrorMessage(event?.error, t));
      setListening(false);
    };
    recognition.onend = () => setListening(false);

    try {
      recognition.start();
      setListening(true);
      setError('');
    } catch {
      setError(t('assistant.voiceError'));
      setListening(false);
    }
  }

  async function openConversation(id) {
    if (sending) return;
    stopListening();
    stopSpeech();
    setLoadingConversation(true);
    setError('');
    setNotice('');
    try {
      const data = await getAssistantConversation(id);
      setConversation({
        id: data.id,
        title: data.title,
        language: data.language,
        last_message_at: data.last_message_at,
        updated_at: data.updated_at,
        created_at: data.created_at,
      });
      setMessages(data.messages || []);
      setDraft('');
    } catch (loadError) {
      setError(errorMessage(loadError, t));
    } finally {
      setLoadingConversation(false);
    }
  }

  function startNewChat() {
    if (sending) return;
    stopListening();
    stopSpeech();
    setConversation(null);
    setMessages([]);
    setDraft('');
    setError('');
    setNotice('');
  }

  async function handleSend(event) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    const optimisticId = `pending-${Date.now()}`;
    const optimistic = {
      id: optimisticId,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    };

    setSending(true);
    setError('');
    setNotice('');
    setDraft('');
    setMessages((current) => [...current, optimistic]);

    try {
      const result = await sendAssistantMessage({
        ...(conversation?.id ? { conversation_id: conversation.id } : {}),
        message: text,
        language,
      });

      const newMessages = result?.messages || [];
      if (result?.conversation) {
        setConversation(result.conversation);
        setConversations((current) => [
          result.conversation,
          ...current.filter((item) => item.id !== result.conversation.id),
        ].slice(0, 20));
      }
      setMessages((current) => [
        ...current.filter((item) => item.id !== optimisticId),
        ...newMessages,
      ]);

      const answer = newMessages.find((item) => item.role === 'assistant');
      if (readAloud && answer) speak(answer.content);
    } catch (sendError) {
      // Nothing was saved on the server, so restore the question for a retry.
      setMessages((current) => current.filter((item) => item.id !== optimisticId));
      setDraft(text);
      setError(errorMessage(sendError, t));
    } finally {
      setSending(false);
    }
  }

  async function removeConversation() {
    if (!conversation || deleting) return;
    if (!window.confirm(t('assistant.confirmDelete'))) return;

    setDeleting(true);
    setError('');
    try {
      await deleteAssistantConversation(conversation.id);
      setConversations((current) =>
        current.filter((item) => item.id !== conversation.id)
      );
      startNewChat();
      setNotice(t('assistant.deleted'));
    } catch (deleteError) {
      setError(errorMessage(deleteError, t));
    } finally {
      setDeleting(false);
    }
  }

  const voiceButtonClass =
    'inline-flex min-h-tap items-center justify-center rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400';

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('assistant.title')}
          intro={t('assistant.intro')}
          actions={
            <Button
              variant="secondary"
              onClick={startNewChat}
              disabled={sending}
            >
              {t('assistant.newChat')}
            </Button>
          }
        />

        <Alert variant="warning" title={t('assistant.disclaimerTitle')}>
          {t('assistant.disclaimer')}
        </Alert>

        {error && <Alert variant="error">{error}</Alert>}
        {notice && <Alert variant="success">{notice}</Alert>}

        <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <aside className="placa-card h-fit" aria-labelledby="assistant-recent-heading">
            <h2 id="assistant-recent-heading" className="text-base font-bold text-ink">
              {t('assistant.recentChats')}
            </h2>

            {loadingList && (
              <p className="mt-3 text-sm text-slate-600">{t('common.loading')}</p>
            )}
            {listError && (
              <p className="mt-3 text-sm font-medium text-red-800">{listError}</p>
            )}
            {!loadingList && !listError && conversations.length === 0 && (
              <p className="mt-3 text-sm text-slate-600">
                {t('assistant.noConversations')}
              </p>
            )}

            {conversations.length > 0 && (
              <ul className="mt-3 space-y-2">
                {conversations.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openConversation(item.id)}
                      disabled={sending}
                      aria-current={conversation?.id === item.id ? 'true' : undefined}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                        conversation?.id === item.id
                          ? 'border-placa-300 bg-placa-50'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <span className="block truncate text-sm font-semibold text-ink">
                        {item.title || t('assistant.untitled')}
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {formatDate(item.last_message_at || item.updated_at, language)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>

          <section
            className="placa-card flex min-h-[30rem] flex-col"
            aria-labelledby="assistant-chat-heading"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 id="assistant-chat-heading" className="text-lg font-bold text-ink">
                  {conversation?.title || t('assistant.newChat')}
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {t('assistant.languageNote')}
                </p>
              </div>
              {conversation && (
                <button
                  type="button"
                  onClick={removeConversation}
                  disabled={deleting || sending}
                  className="min-h-tap rounded-xl px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:text-slate-400"
                >
                  {t('assistant.delete')}
                </button>
              )}
            </div>

            <div className="mt-4 flex-1 overflow-y-auto">
              {loadingConversation ? (
                <p className="text-sm text-slate-600">{t('common.loading')}</p>
              ) : messages.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                  <p className="text-sm leading-relaxed text-slate-700">
                    {t('assistant.empty')}
                  </p>
                </div>
              ) : (
                <ol className="space-y-3" aria-live="polite">
                  {messages.map((message) => (
                    <MessageBubble
                      key={message.id}
                      message={message}
                      t={t}
                      language={language}
                    />
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

            <form onSubmit={handleSend} className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <label htmlFor="assistant-message" className="placa-label">
                {t('assistant.yourMessage')}
              </label>
              <textarea
                id="assistant-message"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t('assistant.placeholder')}
                maxLength={MAX_MESSAGE_LENGTH}
                disabled={sending}
                aria-describedby="assistant-message-hint"
                className="placa-input min-h-[6rem] resize-y disabled:bg-slate-100"
              />
              <p id="assistant-message-hint" className="placa-hint">
                {t('assistant.charactersLeft', {
                  count: MAX_MESSAGE_LENGTH - draft.length,
                })}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  loading={sending}
                  disabled={!draft.trim() || sending}
                >
                  {t('assistant.send')}
                </Button>

                {supportsRecognition ? (
                  <button
                    type="button"
                    onClick={listening ? stopListening : startListening}
                    aria-pressed={listening}
                    disabled={sending}
                    className={voiceButtonClass}
                  >
                    {listening ? t('assistant.listening') : t('assistant.speak')}
                  </button>
                ) : (
                  <p className="text-xs leading-relaxed text-slate-500">
                    {hasRecognitionApi && !secureContext
                      ? t('assistant.voiceInsecure')
                      : t('assistant.voiceUnsupported')}
                  </p>
                )}

                {supportsSpeech && (
                  <button
                    type="button"
                    onClick={toggleReadAloud}
                    aria-pressed={readAloud}
                    className={voiceButtonClass}
                  >
                    {readAloud ? t('assistant.voiceOff') : t('assistant.voiceOn')}
                  </button>
                )}
              </div>

              {(supportsRecognition || supportsSpeech) && (
                <p className="text-xs leading-relaxed text-slate-500">
                  {t('assistant.voiceHint')}
                </p>
              )}
            </form>
          </section>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h2 className="text-sm font-bold text-ink">{t('assistant.privacyTitle')}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            {t('assistant.privacyBody')}
          </p>
        </div>
      </div>
    </AppShell>
  );
}
