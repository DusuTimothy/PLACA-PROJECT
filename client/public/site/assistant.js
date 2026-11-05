/* PLACA floating assistant for the public landing page.
   Plain JavaScript on purpose: the landing page has no framework. The widget
   is stateless, calls the public endpoint, and never receives a Gemini key. */

(function () {
  'use strict';

  var MAX_MESSAGE = 1000;
  var HISTORY_TURNS = 6;
  var PANEL_ID = 'placa-assistant-panel';
  var LAUNCHER_ID = 'placa-assistant-launcher';

  var publicApi = window.PLACA_PUBLIC || null;

  function t(key, variables) {
    if (publicApi && typeof publicApi.t === 'function') {
      return publicApi.t(key, variables);
    }
    return key;
  }

  function getLanguage() {
    if (publicApi && typeof publicApi.getLanguage === 'function') {
      return publicApi.getLanguage();
    }
    return 'en';
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  if (document.getElementById(LAUNCHER_ID)) return;

  var state = {
    open: false,
    sending: false,
    messages: [],
    retryText: '',
    errorCode: ''
  };

  var refs = {};

  function build() {
    var launcher = make('button', 'placa-assistant-launcher');
    launcher.id = LAUNCHER_ID;
    launcher.type = 'button';
    launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', PANEL_ID);

    var icon = make('span', 'placa-assistant-icon');
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML =
      '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">' +
      '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.4 3.6A.75.75 0 0 1 4.5 19v-2.3A2.5 2.5 0 0 1 4 15.2V5.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>' +
      '<path d="M8 8h8M8 11.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>' +
      '</svg>';
    var launcherLabel = make('span', 'placa-assistant-launcher-label');
    launcher.appendChild(icon);
    launcher.appendChild(launcherLabel);

    var panel = make('section', 'placa-assistant-panel');
    panel.id = PANEL_ID;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-labelledby', 'placa-assistant-title');
    panel.hidden = true;

    var header = make('div', 'placa-assistant-header');
    var headingWrap = make('div', 'placa-assistant-heading');
    var title = make('h2', 'placa-assistant-title');
    title.id = 'placa-assistant-title';
    var badge = make('p', 'placa-assistant-badge');
    headingWrap.appendChild(title);
    headingWrap.appendChild(badge);

    var actions = make('div', 'placa-assistant-actions');
    var newChat = make('button', 'placa-assistant-text-button');
    newChat.type = 'button';
    var close = make('button', 'placa-assistant-close');
    close.type = 'button';
    close.appendChild(make('span', null, '\u00d7'));
    close.firstChild.setAttribute('aria-hidden', 'true');
    actions.appendChild(newChat);
    actions.appendChild(close);
    header.appendChild(headingWrap);
    header.appendChild(actions);

    var notes = make('div', 'placa-assistant-notes');
    var note = make('p', 'placa-assistant-note');
    var disclaimer = make('p', 'placa-assistant-disclaimer');
    notes.appendChild(note);
    notes.appendChild(disclaimer);

    var messagesBox = make('div', 'placa-assistant-messages');
    var empty = make('p', 'placa-assistant-empty');
    var status = make('p', 'placa-assistant-status');
    status.setAttribute('role', 'status');
    status.hidden = true;
    var retry = make('button', 'placa-assistant-retry');
    retry.type = 'button';
    retry.hidden = true;

    var form = make('form', 'placa-assistant-form');
    var label = make('label', 'placa-assistant-label');
    var inputId = 'placa-assistant-message';
    label.setAttribute('for', inputId);
    var input = make('textarea', 'placa-assistant-input');
    input.id = inputId;
    input.rows = 3;
    input.maxLength = MAX_MESSAGE;
    var counter = make('p', 'placa-assistant-counter');
    var row = make('div', 'placa-assistant-form-row');
    var send = make('button', 'placa-assistant-send');
    send.type = 'submit';
    row.appendChild(counter);
    row.appendChild(send);
    form.appendChild(label);
    form.appendChild(input);
    form.appendChild(row);

    var footer = make('p', 'placa-assistant-footer');
    var signIn = make('a', 'placa-assistant-link');
    signIn.href = '/app/login';
    footer.appendChild(signIn);

    panel.appendChild(header);
    panel.appendChild(notes);
    panel.appendChild(messagesBox);
    panel.appendChild(status);
    panel.appendChild(retry);
    panel.appendChild(form);
    panel.appendChild(footer);

    document.body.appendChild(launcher);
    document.body.appendChild(panel);

    refs = {
      launcher: launcher,
      launcherLabel: launcherLabel,
      panel: panel,
      title: title,
      badge: badge,
      newChat: newChat,
      close: close,
      note: note,
      disclaimer: disclaimer,
      messagesBox: messagesBox,
      empty: empty,
      status: status,
      retry: retry,
      form: form,
      label: label,
      input: input,
      counter: counter,
      send: sendMessage,
      signIn: signIn
    };

    launcher.addEventListener('click', function () {
      if (state.open) closePanel();
      else openPanel();
    });
    close.addEventListener('click', closePanel);
    newChat.addEventListener('click', startNewChat);
    retry.addEventListener('click', function () {
      if (state.retryText) sendMessage(state.retryText);
    });
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      sendMessage(input.value);
    });
    input.addEventListener('input', function () {
      updateCounter();
      updateSendButton();
    });
  }

  function applyLabels() {
    if (!refs.launcher) return;
    refs.launcher.setAttribute('aria-label', t('assistant.widgetOpen'));
    refs.launcherLabel.textContent = t('assistant.launcher');
    refs.title.textContent = t('assistant.widgetTitle');
    refs.badge.textContent = t('assistant.widgetGuestBadge');
    refs.newChat.textContent = t('assistant.widgetNewChat');
    refs.close.setAttribute('aria-label', t('assistant.widgetClose'));
    refs.note.textContent = t('assistant.widgetPublicNote');
    refs.disclaimer.textContent = t('assistant.widgetDisclaimer');
    refs.empty.textContent = t('assistant.empty');
    refs.retry.textContent = t('assistant.widgetRetry');
    refs.label.textContent = t('assistant.widgetInputLabel');
    refs.input.setAttribute('aria-label', t('assistant.widgetInputLabel'));
    refs.input.placeholder = t('assistant.placeholder');
    refs.signIn.textContent = t('assistant.widgetSignIn');
    refs.sendingLabel = t('assistant.sending');
    refs.sendLabel = t('assistant.send');
    updateCounter();
    updateSendButton();
  }

  function updateCounter() {
    if (!refs.counter || !refs.input) return;
    refs.counter.textContent = t('assistant.charactersLeft', {
      count: MAX_MESSAGE - refs.input.value.length
    });
  }

  function updateSendButton() {
    if (!refs.send || !refs.input) return;
    refs.send.disabled = state.sending || !refs.input.value.trim();
    refs.send.textContent = state.sending
      ? refs.sendingLabel || t('assistant.sending')
      : refs.sendLabel || t('assistant.send');
  }

  function setStatus(message, isError) {
    if (!refs.status) return;
    refs.status.hidden = !message;
    refs.status.textContent = message || '';
    refs.status.className =
      'placa-assistant-status' + (isError ? ' is-error' : '');
  }

  function setSending(sending) {
    state.sending = sending;
    if (refs.input) refs.input.disabled = sending;
    updateSendButton();
  }

  function focusableInPanel() {
    if (!refs.panel) return [];
    return Array.prototype.slice.call(
      refs.panel.querySelectorAll('button:not([disabled]), textarea:not([disabled]), a[href]')
    );
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePanel();
      return;
    }
    if (event.key !== 'Tab') return;

    var focusable = focusableInPanel();
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openPanel() {
    if (state.open) return;
    state.open = true;
    refs.panel.hidden = false;
    refs.launcher.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', onKeyDown);
    refs.input.focus();
  }

  function closePanel() {
    if (!state.open) return;
    state.open = false;
    refs.panel.hidden = true;
    refs.launcher.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', onKeyDown);
    refs.launcher.focus();
  }

  function startNewChat() {
    if (state.sending) return;
    state.messages = [];
    state.retryText = '';
    state.errorCode = '';
    refs.input.value = '';
    refs.retry.hidden = true;
    setStatus('', false);
    renderMessages();
    updateCounter();
    updateSendButton();
    refs.input.focus();
  }

  function renderMessages() {
    if (!refs.messagesBox) return;
    refs.messagesBox.textContent = '';
    refs.empty.hidden = state.messages.length > 0;

    if (!state.messages.length) {
      refs.messagesBox.appendChild(refs.empty);
      return;
    }

    var list = make('ol', 'placa-assistant-list');
    state.messages.forEach(function (message) {
      var isUser = message.role === 'user';
      var item = make(
        'li',
        'placa-assistant-message ' + (isUser ? 'is-user' : 'is-assistant')
      );
      item.appendChild(
        make(
          'p',
          'placa-assistant-role',
          isUser ? t('assistant.you') : t('assistant.assistantName')
        )
      );
      item.appendChild(make('p', 'placa-assistant-body', message.content));
      if (!isUser) {
        item.appendChild(
          make('p', 'placa-assistant-generated', t('assistant.generatedNotice'))
        );
      }
      list.appendChild(item);
    });
    refs.messagesBox.appendChild(list);
    refs.messagesBox.appendChild(refs.empty);
    refs.messagesBox.scrollTop = refs.messagesBox.scrollHeight;
  }

  function messageForCode(code) {
    switch (code) {
      case 'AI_NOT_CONFIGURED':
        return t('assistant.errorNotConfigured');
      case 'AI_UNAVAILABLE':
        return t('assistant.errorUnavailable');
      case 'AI_TIMEOUT':
        return t('assistant.errorTimeout');
      case 'AI_BLOCKED':
        return t('assistant.errorBlocked');
      case 'RATE_LIMITED':
        return t('assistant.errorRateLimited');
      case 'VALIDATION_FAILED':
        return t('assistant.errorValidation');
      default:
        return t('assistant.errorGeneric');
    }
  }

  async function sendMessage(text) {
    var message = String(text || '').trim();
    if (!message || state.sending) return;

    if (message.length > MAX_MESSAGE) {
      state.errorCode = 'VALIDATION_FAILED';
      setStatus(t('assistant.errorValidation'), true);
      return;
    }

    var history = state.messages
      .slice(-HISTORY_TURNS)
      .map(function (item) {
        return { role: item.role, content: item.content };
      });

    state.messages.push({ role: 'user', content: message });
    refs.input.value = '';
    state.retryText = '';
    state.errorCode = '';
    refs.retry.hidden = true;
    renderMessages();
    updateCounter();
    setSending(true);
    setStatus(t('assistant.thinking'), false);

    try {
      var response = await fetch('/api/public/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          message: message,
          language: getLanguage(),
          history: history
        })
      });

      var data = null;
      try {
        data = await response.json();
      } catch (_error) {
        data = null;
      }

      if (!response.ok) {
        throw {
          code: (data && data.error) || 'AI_UNAVAILABLE'
        };
      }

      var reply =
        data &&
        data.data &&
        data.data.messages &&
        data.data.messages[0] &&
        data.data.messages[0].content;

      if (!reply) throw { code: 'AI_UNAVAILABLE' };
      state.messages.push({ role: 'assistant', content: reply });
      renderMessages();
      setStatus('', false);
    } catch (error) {
      state.messages.pop();
      state.retryText = message;
      state.errorCode = (error && error.code) || 'AI_UNAVAILABLE';
      refs.input.value = message;
      refs.retry.hidden = false;
      renderMessages();
      updateCounter();
      setStatus(messageForCode(state.errorCode), true);
    } finally {
      setSending(false);
      refs.input.focus();
    }
  }

  function onLanguageChanged() {
    applyLabels();
    renderMessages();
    if (state.sending) setStatus(t('assistant.thinking'), false);
    else if (state.errorCode) setStatus(messageForCode(state.errorCode), true);
  }

  build();
  applyLabels();
  renderMessages();
  updateSendButton();
  window.addEventListener('placa:language-changed', onLanguageChanged);

  window.PLACA_ASSISTANT = {
    open: openPanel,
    close: closePanel,
    send: sendMessage,
    reset: startNewChat
  };
})();
