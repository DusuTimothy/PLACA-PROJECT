# AI assistant (Gemini)

The PLACA app includes a general-purpose assistant in two forms:

- A **floating chat widget** on every screen, including the public landing page
  and the signed-in application. It stays available while navigating.
- A **full assistant page** at `/app/assistant` for signed-in users, with saved
  conversation history and browser voice input/read-aloud output.

Both use the same Gemini integration. Signed-in users get saved conversations.
Public visitors get a stateless public chat that is not saved and cannot read
any PLACA record.

The assistant is **general guidance only**. The interface and the system
instruction both say that answers are not guaranteed, official or medical
advice. It cannot read PLACA records.

## Setup

1. Create a Gemini API key in Google AI Studio:
   <https://aistudio.google.com/app/apikey>.
2. Add the key to the repository `.env` (never to client code):

   ```bash
   GEMINI_API_KEY=your-server-side-key
   ```

3. Optional settings:

   | Variable | Default | Meaning |
   | --- | --- | --- |
   | `GEMINI_MODEL` | `gemini-2.5-flash` | Gemini model id |
   | `GEMINI_API_BASE_URL` | `https://generativelanguage.googleapis.com/v1beta` | Provider base URL |
   | `GEMINI_TIMEOUT_MS` | `30000` | Provider timeout |
   | `AI_MAX_HISTORY_MESSAGES` | `12` | Prior turns sent as context for signed-in chats |
   | `AI_RATE_LIMIT_WINDOW_MS` | `900000` | Per-account limit window |
   | `AI_RATE_LIMIT_MAX` | `30` | Model calls allowed per account per window |
   | `PUBLIC_AI_RATE_LIMIT_WINDOW_MS` | `600000` | Public per-IP limit window |
   | `PUBLIC_AI_RATE_LIMIT_MAX` | `8` | Public model calls allowed per IP per window |

4. Apply the migration and restart the API:

   ```bash
   cd server
   npm run migrate
   # restart the server process or container
   ```

When `GEMINI_API_KEY` is empty the rest of the platform still works. Sending a
message returns `AI_NOT_CONFIGURED`, and the widget/page shows a setup message.
The production preflight prints a warning in that case.

## Where the widget appears

- **Public landing page** (`/`): `client/public/site/assistant.js` renders the
  widget and calls `POST /api/public/assistant/chat`. The chat is stateless and
  keyed to the visitor's IP for rate limiting only. Nothing is stored.
- **Signed-in application** (`/app`): the React
  `AssistantWidget` is mounted at the application root, so it survives route
  changes. It uses the same saved-conversation API as `/app/assistant`.
- **Auth screens** (sign-in, password reset): the same React widget falls back
  to the public, stateless mode because there is no usable session. It never
  sends account data to the public endpoint.
- When a user signs out or a different user signs in, the widget clears the
  previous conversation from memory.

## Privacy boundary

- The API key is read only by the server (`server/src/config/env.js`) and is
  sent to Google in the `x-goog-api-key` header.
- The Gemini request contains a fixed server-side system instruction plus
  conversation text. It does **not** contain the user's name, email, phone,
  role, organization, LGA, session token, or any report, workplan, funding,
  support, document or notification record.
- Signed-in history is rebuilt from the server's own `chat_messages` rows. The
  browser cannot submit fake prior turns or arbitrary platform data.
- Public chat is stateless: the browser may send at most six recent turns, each
  capped at 1000 characters. The server sanitizes the roles and text, sends
  nothing to the database, and returns only the new answer.
- The public system instruction tells the model that the visitor is anonymous,
  the chat is not saved, and it cannot see any account or programme record.
- Chat tables are excluded from the audit hooks, so conversation text is not
  copied into `audit_logs`.
- Every signed-in read and write is scoped by `user_id`. A conversation id from
  another account returns 404.
- The interface tells users not to enter names, phone numbers, addresses, HIV
  status or other personal information.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/assistant/conversations` | List the signed-in user's chats |
| `GET` | `/api/assistant/conversations/:id` | Load one chat and its messages |
| `DELETE` | `/api/assistant/conversations/:id` | Delete the user's chat |
| `POST` | `/api/assistant/chat` | Send a message; creates a chat if needed |
| `POST` | `/api/public/assistant/chat` | Anonymous, stateless landing-page chat |

The signed-in routes require an account with a changed password. `POST
/api/assistant/chat` has a separate per-account rate limit. Signed-in input is
validated with Zod (1–2000 characters, optional conversation id, `en` or `ha`).

The public route needs no session and has no access to user or programme
tables. It accepts 1–1000 characters, an optional `en`/`ha` language, and at
most six prior turns of 1000 characters each. It has its own strict per-IP
limit (`PUBLIC_AI_RATE_LIMIT_*`).

## Error states

- `AI_NOT_CONFIGURED` (503): the server has no Gemini key.
- `AI_UNAVAILABLE` (502): the provider failed or returned no text.
- `AI_TIMEOUT` (504): the provider exceeded `GEMINI_TIMEOUT_MS`.
- `AI_BLOCKED` (400): the provider refused the request or its safety filter
  stopped it.
- `AI_CONVERSATION_NOT_FOUND` (404): the chat does not exist for this user.
- `RATE_LIMITED` (429): the account or public IP limit was reached.
- `VALIDATION_FAILED` (400): the message or public transcript failed validation.

The widget and page show loading, thinking, empty, error and retry states. A
failed send does not save a half-turn; the question is restored in the text box
and the widget offers **Try again**. A missing key is reported as a setup
problem, never as a successful answer.

## Testing locally

1. Add `GEMINI_API_KEY` to `.env`, run the migration and start the API on port
   5000.
2. Start the client with `cd client && npm run dev`.
3. Open <http://localhost:5173/> for the public widget or
   <http://localhost:5173/app/login> for the signed-in app. The launcher is at
   the bottom-right. Navigate between pages: the signed-in widget keeps its
   open state and conversation.
4. The public widget can be tested without signing in. It should say the chat
   is not saved. Signing in switches the same widget to saved conversations.

## Voice chat

Voice is a browser feature, not a server upload:

- **Speech input** uses `SpeechRecognition` / `webkitSpeechRecognition` when
  available. The recognised text is placed in the message box for review before
  sending.
- **Read aloud** uses `speechSynthesis` to read assistant answers. It can be
  switched off at any time.

Both features need a secure browser context: HTTPS or `http://localhost`.
`SpeechRecognition` is unavailable on plain HTTP, so access through a server IP
or LAN address will not show the voice input control. Production nginx allows
the microphone for its own origin with `Permissions-Policy: microphone=(self)`;
the app never asks for camera or location access.

Read aloud picks an installed voice for the interface language, then falls back
to the browser default. Some Linux and Android builds ship no speech voices, in
which case the answer is shown but cannot be spoken.

Voice controls are on the full assistant page; the floating widget focuses on
fast text chat. If a browser does not support one of these APIs, the page hides
that control and explains that typing still works. Speech recognition
availability and language quality vary by browser; `ha-NG` voice data is not
guaranteed on every device.
