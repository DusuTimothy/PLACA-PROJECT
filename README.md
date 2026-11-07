# PLACA Coordination and Reporting Platform

Plateau State Agency for the Control of AIDS (PLACA) coordination and reporting
platform.

The platform stores **counts only**. It never stores a beneficiary name, address,
phone number or HIV test result.

## Phase status

**Phase 1 — Foundation is complete.** It covers:

- PostgreSQL schema, migrations and seed data (17 LGAs, 14 indicators, guides)
- Email/phone login, JWT access tokens (15 minutes), rotating refresh tokens
  (7 days, httpOnly cookie)
- Invitations and temporary passwords with a forced password change
- Two-step verification (TOTP) for `placa_director` and `admin`
- Role-based access control and LGA/organization scoping
- Per-IP rate limits and per-account lockout after 5 wrong passwords
- Append-only audit log enforced by a database trigger
- English and Hausa interface shell, responsive auth screens, session handling
- Public landing page at `/` with published, counts-only results; the signed-in
  application lives at `/app`

**Phase 2 — Workplans, organization approval and report intake is complete.**
It adds:

- Organization registration with a `pending → approved → suspended` review flow
- Quarterly workplans: partners set targets by indicator and LGA, submit them,
  and PLACA officers approve or return them with a note
- Report intake: partners enter period totals, the server checks consistency on
  submit, and PLACA officers validate or return the report with a reason
- One report per organization, period type, year and period, so a retried or
  duplicate submission can never be counted twice
- Role-aware navigation, English/Hausa labels and responsive programme screens

**Phase 3 — Guided paper-style reporting is implemented.** It adds:

- A numbered, paper-order count form per indicator: total first, then sex and
  age groups, with the same field order as the printed tally sheet
- Inline English/Hausa messages while typing, before the server is called
- Progress per row group (“12 of 14 filled”) and a numeric keypad on phones
- The server remains authoritative: the same consistency rules are rechecked on
  submit

**Phase 4 — Dashboards, aggregation and exports are implemented and awaiting
review.** They add:

- Role-scoped dashboards for partners, LACA officers and PLACA staff, with
  Recharts totals, trends, reporting coverage and LGA rows
- A deliberate aggregation job that writes validated totals into
  `public_summary`, with small LGA cells withheld
- CSV and printable PDF exports with the same filters and role scope as the
  report list
- An admin-only, read-only audit-log screen at `/app/audit-logs`
- A production preflight command that checks secrets, migrations, audit
  triggers, demo-data leftovers and small-cell suppression

The current API checks and client/server unit tests pass against the build;
see [Testing](#testing) for the commands.

**Phase 5 — Offline work, resources and coordination modules are implemented
and awaiting review.** They add:

- Offline cache and outbox: a report or support request is kept on the device
  when signal drops and sent when it returns; report retries stay idempotent
  through the existing `client_uuid`
- A help library with searchable guides, field hints beside report counts and a
  PLACA-only guide editor, all readable in English and Hausa
- A shared document library with validated uploads, download and public flags
- Support requests for equipment, training and technical help, from request to
  approval, delivery, receipt and closure
- Equipment catalogue and stock levels at state and LGA level
- Funding sources, inflows, allocations and a role-scoped summary
- Welfare and campaign programmes placed by LGA and partner
- In-app notifications for reviews, support, funding and other work
- Report practice mode and saved drafts, so a field worker can try the form or
  stop mid-tally without losing the paper count

Phase 5 keeps the same boundary: admin accounts manage accounts and the audit
log, and never see programme data. The guide editor is limited to PLACA roles.

## Quick start with Docker

```bash
cp .env.example .env
docker compose up -d
docker compose exec server npx sequelize-cli db:migrate
docker compose exec server npm run seed:demo
```

Then open:

- Public site: http://localhost:5173/
- Staff sign-in: http://localhost:5173/app/login
- API health: http://localhost:5000/health

`npm run seed` loads only production reference data (LGAs, indicators,
guides). `npm run seed:demo` additionally loads the demo organizations and
logins listed below.

## Programme work (Phases 2-5)

| Role | What they can do |
| --- | --- |
| Partner staff | Keep their organization's contact details current; author, edit and submit their own workplans and reports; request support; read their allocations and programmes |
| LACA officer | Register organizations in their own LGA; read organizations, workplans, reports, programmes, equipment and allocations in that LGA |
| PLACA officer | Approve or suspend organizations; approve or return workplans; validate or return reports; manage guides, documents, equipment, support requests, programmes and funding |
| PLACA director | Same programme access as a PLACA officer |
| System admin | Accounts and the audit log only; no programme data |

Workflow:

- Workplans: `draft → submitted → approved` or `returned`. A returned plan is
  edited and resubmitted in place. An approved plan is locked so its targets stay
  comparable with the reports for the same quarter.
- Reports: `draft → submitted → validated` or `returned`. A returned report is
  corrected and resubmitted in place.
- One report may exist per organization, period type, year and period. Retried
  sends use a device-generated `client_uuid`, so the same report is updated
  rather than duplicated.
- On submit, the server checks that breakdowns do not exceed their total, that
  complete sex or age breakdowns add up, and that cross-indicator rules hold
  (for example, people linked to treatment cannot exceed people referred).
- Phase 2 report screens accept **totals only** for speed and reliability. The
  guided sex-and-age paper-style forms arrive in Phase 3.
- Every create, update, submit and review writes to the append-only audit log.

## AI assistant (Gemini)

A general assistant is available in two forms: a floating chat widget on every
screen (including the public landing page), and the full page at
`/app/assistant`. It answers general questions in English and Hausa, keeps each
signed-in user's conversations so they can continue later, and supports browser
voice input plus read-aloud answers on the full page.

Visitors who are not signed in can use the same floating widget through a
stateless public endpoint. That chat is not saved, cannot read any PLACA record,
and has a smaller per-IP rate limit. Signing in switches the widget to the saved
account conversation.

Setup:

1. Create a key in [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Add it to `.env` on the server. The key is never bundled into the client:

   ```bash
   GEMINI_API_KEY=your-server-side-key
   # Optional overrides:
   GEMINI_MODEL=gemini-2.5-flash
   GEMINI_TIMEOUT_MS=30000
   ```

3. Apply the migration and restart the API:

   ```bash
   cd server
   npm run migrate
   ```

The assistant is optional. Without a key, the rest of the platform works and
the assistant widget/page shows a clear `AI_NOT_CONFIGURED` setup message. The
production preflight warns when the key is missing.

Privacy and safety:

- Signed-in chat sends only the user's own conversation text and a fixed public
  system instruction to Gemini. Name, email, role, organization, LGA, tokens and
  all programme records stay in PLACA.
- Public chat is stateless. The browser may send at most six recent turns; the
  server sanitizes them, stores nothing and cannot read private records.
- The server rebuilds signed-in history from `chat_messages`; the browser cannot
  submit fake previous turns.
- The widget clears the previous person's chat when a different user signs in.
- Conversations are private to their owner and excluded from the audit log.
- Answers are labelled as AI-generated and are not guaranteed, official or
  medical advice. Users are told not to enter personal information.

See [docs/AI_ASSISTANT.md](docs/AI_ASSISTANT.md) for the endpoint map, error
codes, rate limit, privacy boundary and voice-browser behaviour.

## Production on a fresh database

Demo accounts are refused when `NODE_ENV=production`, so a fresh production
database needs four explicit steps:

```bash
# 1. Strong secrets first. The server refuses to boot while a secret starts
#    with "dev-". Set at least JWT_ACCESS_SECRET, JWT_REFRESH_SECRET and
#    TOTP_ENCRYPTION_KEY in .env.

# 2. Schema and reference data only (17 LGAs, indicators, starter guides)
docker compose exec server npx sequelize-cli db:migrate
docker compose exec server npm run seed

# 3. The first administrator. A one-time password is printed once.
docker compose exec server npm run admin:create -- \
  --email admin@your-domain.org \
  --name "PLACA Administrator"

# 4. Preflight. Fix every FAIL before opening the platform to users.
docker compose exec server npm run preflight
```

The command creates an unplaced `admin` account with a forced password change.
The person signs in, changes the password, and completes mandatory authenticator
setup. After that, further admins can be created from the admin account through
`POST /api/users`, or promoted with:

```bash
docker compose exec server npm run admin:create -- \
  --email existing.user@your-domain.org --promote
```

`--promote` clears any partner/LGA placement, revokes the user's sessions, and
leaves their password unchanged. Both commands write an audit row.

Safety rules:

- Never run `npm run seed:demo` in production. The demo seeders throw unless
  `ALLOW_DEMO_SEED=true` is set deliberately.
- Do not insert admin rows with raw SQL; you would bypass password hashing,
  placement rules and audit history.
- Keep the first admin's temporary password out of chat and shell history.
  Omit `--password` and let the command generate one.
- Run `npm run preflight` after every deploy. It fails on development secrets,
  missing migrations, missing audit triggers, demo accounts, or small LGA cells
  in `public_summary`.

## Public site

`/` is a plain, pre-rendered HTML page for search engines and low-bandwidth
visitors. It explains PLACA's mandate, shows the 17 LGAs, describes how
reporting works, and displays published counts. The signed-in React application
is served from `/app`; invitation, verification and reset links use
`APP_BASE_PATH` so they always point at the right place.

The public results section calls `GET /api/public/summary`, which needs no
session. It reads only:

- `public_summary` — pre-aggregated counts
- `lgas` — the 17 public LGA names
- `indicators` — public indicator names and units

It never reads users, organizations, reports, report values, documents or the
audit log. `public_summary` stays empty until approved reports are aggregated,
so the page shows an honest empty state rather than invented numbers.

The aggregation job must suppress or round small cells before writing
`public_summary`. A public page must never make an individual identifiable,
especially in a small LGA.

### Domain and SEO

There is no public domain yet, so `client/public/index.html` uses **relative**
canonical and `hreflang` URLs (`/`, `/?lang=en`, `/?lang=ha`). They resolve
correctly on any host and never point crawlers at a domain that does not exist.

When a domain is assigned, set `SITE_URL` for the client build:

```bash
cd client
SITE_URL=https://placa.example.gov.ng npm run build
```

The `postbuild` script then rewrites the marked canonical and `hreflang` tags
to absolute URLs, adds an absolute `og:url`, writes `dist/sitemap.xml`, and
adds a `Sitemap:` line to `dist/robots.txt`. Without `SITE_URL` none of that
happens; the build still succeeds and the page still works. Docker Compose
passes `SITE_URL` from `.env` to the `client-build` service.

The page is bilingual: English content is in the HTML, and Hausa translations
are in `client/public/site/main.js`.

### Programme highlights

The highlights block in `client/public/index.html` is **curated static
content** for now. Edit it directly when a project, location and result have
been approved. Keep it to public project names, LGAs, periods and counts, and
never add beneficiary-level detail. When highlights need to change without a
redeploy, move that block into an admin-managed content table in a later phase;
the markup can stay the same.

### Photographs

The landing page currently uses development photographs from published
coverage of public PLACA events (Vanguard, May 2024; Lightbearer News, December
2024 and August 2026). They live in `client/public/site/images/` as 900×675
JPEG and WebP pairs.

Before launch, replace them with official photographs supplied by PLACA and
confirm consent from anyone recognisable. Keep the 4:3 crop, avoid images of
beneficiaries, and never show or imply a person's HIV status. Each image is a
`<picture>` with a WebP source and JPEG fallback; keep the `width`, `height`
and `alt` text so the layout does not shift.

Facebook, Instagram and X block automated downloads, so images posted there
must be saved manually by the agency and copied into the same folder.

### Production with nginx

The `production` profile builds the client once, then serves the static files
from nginx and proxies `/api` to the API container:

```bash
# Build the client (honours SITE_URL) and start the stack
docker compose --profile production up -d --build

# Landing page, staff app, API health
curl -I http://localhost/
curl -I http://localhost/app/login
curl http://localhost/api/public/summary
```

`nginx/nginx.conf` handles the two HTML entries explicitly: `/app/...` always
returns `app.html` (React Router owns those paths), while `/` only serves real
files and returns 404 for anything else. Hashed bundles under `/assets/` are
cached for a year; HTML, the service worker and the PWA manifest are never
cached. Shared security headers live in `nginx/security-headers.conf`.

There is no TLS block yet. When a domain and certificate are available, add a
`listen 443 ssl` server and enable HSTS.

## Run without Docker

Requires Node 20+ and PostgreSQL 15+.

```bash
# API
cd server
npm install
npm run migrate
npm run seed:demo
npm run seed:analytics-demo   # synthetic dashboard data for local chart testing
npm run dev            # http://localhost:5000

# Client (second terminal)
cd client
npm install
cp .env.example .env   # optional: VITE_API_URL, VITE_PROXY_TARGET, SITE_URL
npm run dev            # http://localhost:5173, proxies /api to :5000
```

The client has its own `client/.env` because Vite reads `.env` files from the
client directory, not the repository root. Only `VITE_*` variables reach browser
code; `SITE_URL` is used by the post-build script. When running through Docker
Compose, the root `.env` is passed to the client container instead.

Set `DB_HOST=localhost` (and the published port) in `.env` when the database is
not running inside Compose.

### Connecting to Aiven PostgreSQL

Aiven requires TLS with its own CA. Download `ca.pem` from the service's
**Connection information** page, place it in `server/src/certs/` (the Compose
server service mounts `server/` at `/app`), and set:

```bash
DB_HOST=<service>.aivencloud.com
DB_PORT=<port>
DB_NAME=defaultdb
DB_USER=avnadmin
DB_PASSWORD=<password>
DB_SSL=true
DB_SSL_CA=./src/certs/aiven-ca.pem
DB_SSL_REJECT_UNAUTHORIZED=true
```

The API and `sequelize-cli` (migrations and seeders) both read
`server/src/config/databaseSsl.js`, so they use the same TLS settings.
`DB_SSL_REJECT_UNAUTHORIZED=true` verifies the certificate chain and hostname.
`DB_SSL_MODE` can be used instead of `DB_SSL` with libpq names (`disable`,
`require`, `verify-ca`, `verify-full`); `require` encrypts without verifying,
while the verifying modes check the chain. `DB_SSL_CA` also accepts the PEM text
directly, and `*.pem` files are ignored by git.

The analytics demo seeder adds clearly labeled synthetic reports for 2025–2026
to the local database. The dashboard marks periods that include synthetic data.
To remove only this dataset and rebuild the affected summaries, run
`cd server && npm run seed:analytics-demo:undo`. Both commands refuse to run
unless the environment is development and the database host is a loopback
address.

## Testing

There are two layers today: client unit tests and an end-to-end API script.

**Client unit tests** (Vitest, Testing Library, jsdom):

```bash
cd client
npm test
```

The suite covers the sign-in form (validation, the TOTP step, error display),
the `/app` route table (login screen, guards, redirects), the guided count
helpers (paper-order cells, preserved composite values, inline consistency
messages), the user role-change controls, and the AI assistant page
(conversation continuation, sending/loading, failure state and safety notice).

**Server unit tests** (Jest):

```bash
cd server
npm test
```

These cover the assistant's Zod validation, the exact Gemini payload (only
conversation text, key in a server header), owner-scoped history, the
missing-key/setup error, provider failures and blocked responses. They are
focused tests with mocked HTTP; no Gemini key is needed.

**API checks** (needs a running server and a demo database):

```bash
cd server
npm run verify:api
```

`server/scripts/verify-api.mjs` signs in as the demo partner, LACA and PLACA
officer accounts and walks the Phase 1 to Phase 5 rules: organization scope,
approval and suspension, workplan lock and review, report period uniqueness,
consistency checks on submit, return-and-resubmit, aggregation and small-cell
suppression, dashboards, CSV/PDF exports, offline idempotency, guides, documents,
support requests, equipment, funding, programmes, notifications, the admin
boundary, and attempts to widen scope with query filters. It prints `ok`/`FAIL`
per check and exits non-zero if any check fails. Current count: **152 checks**,
all passing.

Configuration:

| Variable | Default | Meaning |
| --- | --- | --- |
| `API_BASE_URL` | `http://localhost:5000/api` | API root to test |
| `VERIFY_PASSWORD` | `ChangeMe#2026` | password shared by the four demo programme logins |

The four programme accounts must be past their forced password change, because
programme routes stay closed until then. In this workspace that means:

```bash
cd server
VERIFY_PASSWORD='TestPass#2026' npm run verify:api
```

The script writes records: one `Test Community Health Initiative` organization,
2026 Q4 workplans for Hope Foundation and Rural Health Initiative, a 2025 Q4
Hope workplan, and two Hope reports for 2026. It does not clean up, so run it
against a disposable database. This workspace's database already holds the
records from the last run, so reset it first (`npm run db:reset`) if you want a
clean 152/152; note that the reset also restores the seeded passwords and removes
the current demo records.

**Not covered yet:**

- The server unit suite is focused on the assistant; broader service
  integration tests are still on the hardening plan, and the API script above is
  the end-to-end check.
- No browser automation is committed. Layout, language and print checks were
  run manually during Phases 2 to 5.

## Demo accounts

Every seeded account starts with the password **`ChangeMe#2026`** and is forced
to choose a new password at first sign-in.

| Role | Email |
| --- | --- |
| System admin | `admin@placa.gov.ng` |
| PLACA director | `director@placa.gov.ng` |
| PLACA officer | `officer@placa.gov.ng` |
| LACA officer (Jos North) | `laca.josnorth@placa.gov.ng` |
| LACA officer (Barkin Ladi) | `laca.barkinladi@placa.gov.ng` |
| Partner staff (Hope Foundation) | `partner@hopefoundation.org` |
| Partner staff (Rural Health) | `partner@ruralhealth.ng` |

Demo logins accept either the email address or the seeded phone number
(`08030000001`–`08030000007`).

Director and admin accounts must set up an authenticator app (Google
Authenticator, Authy, 1Password) the first time they sign in. **Do not use these
demo passwords in production.**

### The local demo database in this workspace

The long-running development database has moved past the forced password
change, so `ChangeMe#2026` no longer works for most accounts. Current state:

| Role | Email | Password | Notes |
| --- | --- | --- | --- |
| System admin | `admin@placa.gov.ng` | `AdminPass#2026` | TOTP enabled; needs a live 6-digit code |
| PLACA director | `director@placa.gov.ng` | `TestPass#2026` | authenticator setup still pending |
| PLACA officer | `officer@placa.gov.ng` | `TestPass#2026` | |
| LACA officer (Jos North) | `laca.josnorth@placa.gov.ng` | `TestPass#2026` | |
| LACA officer (Barkin Ladi) | `laca.barkinladi@placa.gov.ng` | `ChangeMe#2026` | still forced to change |
| Partner staff (Hope Foundation) | `partner@hopefoundation.org` | `TestPass#2026` | |
| Partner staff (Rural Health) | `partner@ruralhealth.ng` | `TestPass#2026` | |

These are local development values only. `npm run db:reset` restores the seeded
passwords, forces a change again and removes the test records. The admin TOTP
secret is kept outside the repository, in the developer's own setup file.

## Security notes

- Access tokens are kept in memory in the browser; refresh tokens are httpOnly
  cookies and only their SHA-256 hash is stored in the database.
- A reused refresh token revokes the whole token family.
- `users.totp_secret` is encrypted with pgcrypto using `TOTP_ENCRYPTION_KEY`.
- `audit_logs` rejects `UPDATE`, `DELETE` and `TRUNCATE` with a database trigger.
  Audit rows contain the acting user, IP, request id and scrubbed old/new values.
- The admin role manages accounts and reads the audit log. It cannot edit
  programme data.
- The no-login public endpoint reads only pre-aggregated counts and public
  reference data. It is rate limited and cached for five minutes.
- The server refuses to boot in production if a secret still begins with `dev-`.

## Useful commands

```bash
# Migrations and seeds
cd server
npm run migrate
npm run seed            # reference data only (LGAs, indicators, guides)
npm run seed:demo       # reference data + demo organizations and logins
npm run seed:analytics-demo      # synthetic quarterly dashboard data (local development only)
npm run seed:analytics-demo:undo # remove only that synthetic data
npm run db:reset        # undo all, migrate, reference seed, demo seed
npm run admin:create -- --email admin@your-domain.org --name "PLACA Administrator"

# Checks
cd server && npm run verify:api     # end-to-end API checks (152)
cd server && npm run preflight      # production readiness checks
cd client && npm test               # unit tests (18)

# Client production build
cd client
npm run build
npm run preview          # / is the public page, /app is the staff app

# Same, with absolute canonical URLs and sitemap.xml
SITE_URL=https://placa.example.gov.ng npm run build

# Production stack (static build + nginx + API)
docker compose --profile production up -d --build
```

## Project structure

See [docs/STRUCTURE.md](docs/STRUCTURE.md) for the directory layout and the
phase plan.

## License

Open Source
# PLACA-PROJECT
