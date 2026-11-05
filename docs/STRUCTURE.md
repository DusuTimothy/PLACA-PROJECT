# Project structure

```
PLACA_PROJECT/
├── client/                     # React frontend (Vite, Tailwind, PWA)
│   ├── public/                 # Public site at / (plain HTML, CSS, JS)
│   │   ├── index.html          # Landing page and public results
│   │   └── site/               # Styles, scripts, logo and photographs
│   ├── scripts/                # Post-build canonical/sitemap generation
│   ├── app.html                # Entry for the signed-in app at /app
│   ├── src/
│   │   ├── components/         # Layout, protected routes, UI primitives
│   │   ├── context/            # Auth and language state
│   │   ├── locales/            # en.json and ha.json
│   │   ├── pages/              # Auth, dashboard, programme, resource and coordination pages
│   │   ├── services/           # API client, offline cache/outbox, Phase 5 endpoints
│   │   └── utils/              # Error, field-message, role and period helpers
│   └── vitest.config.js        # jsdom component smoke tests
├── server/
│   ├── migrations/             # Schema + append-only audit protection
│   ├── seeders/                # LGAs, indicators, organizations, users, guides
│   ├── scripts/                # createAdmin.js, aggregate.js, preflight.js, verify-api.mjs
│   └── src/
│       ├── config/             # Env validation, database, logger
│       ├── controllers/        # HTTP request/response layer
│       ├── middleware/         # Auth, RBAC, validation, limits, audit context
│       ├── models/             # Sequelize models and audit hooks
│       ├── routes/             # /api route trees
│       ├── schemas/            # Zod request validation
│       ├── services/           # Auth, users, TOTP, email, audit
│       └── utils/              # Tokens, passwords, errors, sanitising
├── nginx/                      # Production static host and /api reverse proxy
├── docs/                       # Structure and phase notes
├── docker-compose.yml
├── .env.example
└── README.md
```

## Route map

| Method | Path | Access |
| --- | --- | --- |
| `GET` | `/` | Public landing page and published results |
| `GET` | `/app` | Staff application shell (noindex) |
| `GET` | `/health` | Public |
| `GET` | `/api/public/summary` | Public, no session; aggregate counts only |
| `POST` | `/api/auth/login` | Public, rate limited |
| `POST` | `/api/auth/refresh` | Refresh cookie |
| `POST` | `/api/auth/logout` | Refresh cookie |
| `POST` | `/api/auth/accept-invitation` | Invitation token |
| `POST` | `/api/auth/verify-email` | Verification token |
| `POST` | `/api/auth/forgot-password` | Public (same response for unknown accounts) |
| `POST` | `/api/auth/reset-password` | Reset token |
| `POST` | `/api/auth/totp/setup` | Setup or access token |
| `POST` | `/api/auth/totp/enable` | Setup or access token |
| `POST` | `/api/auth/change-password` | Signed in (also while password change is pending) |
| `GET/PATCH` | `/api/auth/me` | Signed in |
| `GET/POST` | `/api/users` | PLACA officer/director, admin, LACA officer |
| `GET/PATCH` | `/api/users/:id` | Role- and LGA-scoped |
| `POST` | `/api/users/:id/reset-password` | Role-scoped |
| `POST` | `/api/users/:id/resend-invitation` | Role-scoped |
| `GET` | `/api/lgas` | Signed in with a changed password |
| `GET` | `/api/indicators` | Signed in with a changed password |
| `GET` | `/api/audit-logs` | Admin only |
| `GET` | `/api/organizations` | Programme roles, scoped to own organization or LGA |
| `POST` | `/api/organizations` | LACA officer (own LGA) and PLACA officer/director |
| `GET/PATCH` | `/api/organizations/:id` | Own organization, own LGA, or PLACA |
| `POST` | `/api/organizations/:id/approve` | PLACA officer/director |
| `POST` | `/api/organizations/:id/suspend` | PLACA officer/director |
| `GET` | `/api/workplans` | Programme roles, scoped |
| `POST` | `/api/workplans` | Partner staff (own organization) |
| `GET` | `/api/workplans/:id` | Own organization, own LGA, or PLACA |
| `PATCH/DELETE` | `/api/workplans/:id` | Partner staff, draft or returned only |
| `POST` | `/api/workplans/:id/submit` | Partner staff |
| `POST` | `/api/workplans/:id/review` | PLACA officer/director |
| `GET` | `/api/reports` | Programme roles, scoped |
| `POST` | `/api/reports` | Partner staff (own organization) |
| `GET` | `/api/reports/:id` | Own organization, own LGA, or PLACA |
| `PATCH/DELETE` | `/api/reports/:id` | Partner staff, draft or returned only |
| `POST` | `/api/reports/:id/submit` | Partner staff; runs consistency checks |
| `POST` | `/api/reports/:id/review` | PLACA officer/director |
| `GET` | `/api/reports/export` | Programme roles, scoped; CSV |
| `GET` | `/api/reports/export/pdf` | Programme roles, scoped; PDF |
| `GET` | `/api/dashboard/overview` | Programme roles, scoped |
| `GET` | `/api/aggregation/status` | PLACA officer/director |
| `POST` | `/api/aggregation/run` | PLACA officer/director |
| `GET` | `/api/guides` | Signed in; audience-filtered |
| `GET` | `/api/guides/progress` | Signed in; own progress |
| `POST` | `/api/guides/progress/:key` | Signed in; own progress |
| `POST/PATCH/DELETE` | `/api/guides` | PLACA officer/director |
| `GET` | `/api/documents` | Signed in; public and internal catalogue |
| `POST/PATCH/DELETE` | `/api/documents` | PLACA officer/director |
| `GET` | `/api/documents/:id/download` | Signed in |
| `GET` | `/api/support-requests` | Programme roles, scoped |
| `POST` | `/api/support-requests` | Partner staff |
| `POST` | `/api/support-requests/:id/decision` | PLACA officer/director |
| `POST` | `/api/support-requests/:id/supplies` | PLACA officer/director |
| `POST` | `/api/support-requests/:id/confirm-receipt` | Partner staff |
| `POST` | `/api/support-requests/:id/status` | PLACA officer/director |
| `GET` | `/api/equipment` | Programme roles |
| `GET` | `/api/equipment/stock` | Programme roles, scoped |
| `POST/PATCH/DELETE` | `/api/equipment` | PLACA officer/director |
| `PUT` | `/api/equipment/:id/stock` | PLACA officer/director |
| `GET` | `/api/funding/sources` | Programme roles, scoped |
| `GET` | `/api/funding/allocations` | Programme roles, scoped |
| `GET` | `/api/funding/summary` | Programme roles, scoped |
| `GET` | `/api/funding/inflows` | PLACA officer/director |
| `POST/PATCH/DELETE` | `/api/funding/*` | PLACA officer/director |
| `GET` | `/api/programmes` | Programme roles, scoped |
| `POST` | `/api/programmes` | Programme roles, placed by role |
| `PATCH/DELETE` | `/api/programmes/:id` | Own organization/LGA, or PLACA |
| `GET` | `/api/notifications` | Signed in; own notifications |
| `GET` | `/api/notifications/unread` | Signed in; own count |
| `POST` | `/api/notifications/:id/read` | Signed in; own notification |
| `POST` | `/api/notifications/read-all` | Signed in; own notifications |

`/api/organizations`, `/api/workplans` and `/api/reports` are closed to `admin`
by design: the admin role manages accounts and the audit log, never programme
data.

## Programme workflow (Phase 2)

- Partners author and submit; PLACA officers approve/validate or return with a
  written note. LACA officers read within their own LGA.
- Workplan statuses: `draft`, `submitted`, `approved`, `returned`. An approved
  plan is locked; a returned plan is edited and resubmitted in place.
- Report statuses: `draft`, `submitted`, `validated`, `returned`, `aggregated`.
  `aggregated` is reserved for the Phase 4 aggregation job.
- Reports are unique per organization, period type, year and period. A device
  `client_uuid` makes retried sends idempotent.
- Submission checks cross-indicator rules, breakdown-versus-total bounds and
  complete sex/age sums. Violations return `REPORT_INCONSISTENT` with a list of
  plain-language messages.
- Phase 3 report forms use the guided paper-order count entry: total first, then
  sex and age groups. Inline checks mirror the server rules; the server remains
  authoritative on submit.
- Migration `20260101000300-workplan-review-and-report-integrity.js` adds the
  workplan review columns and the report period uniqueness index.

## Phase 5 modules and offline behaviour

- `client/src/services/offlineDb.js` opens a lazy Dexie database with three
  stores: `cache` for the last good read, `drafts` for form work, and `outbox`
  for writes waiting on signal. It becomes a quiet no-op when IndexedDB is
  unavailable.
- `client/src/services/offline.js` provides read-through caching, the online
  listener and hooks for the outbox. `phase5Api.js` wraps every Phase 5 endpoint
  and flushes the outbox oldest first.
- Offline write kinds: `support_request_create`, `report_create`,
  `report_update`, `report_submit`. Report creation stays idempotent because the
  device sends the same `client_uuid` on retry. Support requests use their own
  `client_uuid` for the same reason.
- `ReportPage` autosaves a draft on the device, restores it after a reload,
  queues network failures and offers a practice mode that never calls the API.
- Help guides, field hints and the guide editor share the `guides` table.
  Documents, equipment, support requests, funding, programmes and notifications
  each have a page under `client/src/pages/` and a route in `App.jsx`.
- Admin remains outside programme data. Guides, documents and notifications are
  readable by every signed-in account, but `/api/organizations`,
  `/api/workplans`, `/api/reports`, `/api/support-requests`, `/api/equipment`,
  `/api/funding` and `/api/programmes` stay closed to `admin`.
- `20260101000400-phase-5-offline-and-resources.js` adds
  `support_requests.client_uuid`, the Phase 5 tables and their indexes.

## Public site and app paths

- `/` is a plain HTML page in `client/public/` so search engines can index the
  agency's mandate and published results. It is not part of the React bundle.
- `/app` is the signed-in React app. `BrowserRouter` uses `basename="/app"`, so
  every existing route moves under that prefix (`/app/login`,
  `/app/dashboard`, and so on). `/app/audit-logs` is the admin-only, read-only
  audit history.
- `APP_BASE_PATH` (default `/app`) controls email links. `CLIENT_URL` plus this
  path produce invitation, verification and reset URLs.
- The public results endpoint is the only session-free API route. It reads
  `public_summary`, `lgas` and `indicators` only, never reports or users.

## Production serving

- `docker compose --profile production up -d --build` runs a one-shot
  `client-build` service, then serves the build from nginx.
- `nginx/nginx.conf` maps `/app/...` to `app.html` and `/` to real static files.
  Unknown public paths return 404 instead of the app shell.
- Hashed bundles under `/assets/` are cached for a year. HTML, `sw.js` and the
  PWA manifest are never cached. Security headers are in
  `nginx/security-headers.conf`.
- `SITE_URL` is optional. Unset, canonical links stay relative and no sitemap is
  generated. Set at build time, `scripts/generate-site-meta.mjs` rewrites
  canonical, `hreflang` and `og:url` to absolute URLs and writes `sitemap.xml`.
- There is no TLS block yet; add one when a domain and certificate exist.

## Seeding and the first admin

- `npm run seed` loads production reference data only (17 LGAs, 14 indicators,
  56 starter guides).
- `npm run seed:demo` adds the demo organizations and logins. It is refused when
  `NODE_ENV=production` unless `ALLOW_DEMO_SEED=true`.
- On a fresh production database, create the first administrator with
  `npm run admin:create -- --email admin@your-domain.org --name "PLACA Administrator"`.
  The CLI prints a one-time password and forces a change at first sign-in.
  `--promote` elevates an existing account and revokes its sessions.
- All seed files are tracked in `SequelizeData`, so re-running them is safe.

## Phase plan

1. **Foundation** — complete: schema, auth, roles, audit, bilingual shell, and
   the public landing page with published counts.
2. **Workplans, organization approval and report intake** — complete: partner
   authoring, PLACA review, LGA scoping, report consistency checks and
   counts-only intake.
3. **Guided paper-style reporting** — complete: paper-order count entry,
   inline sex/age and cross-indicator messages, progress per group.
4. **Dashboards, aggregation, exports and audit** — implemented, awaiting
   review: role-scoped dashboards, the aggregation job that fills
   `public_summary` with small-cell suppression, CSV and PDF exports, the
   read-only admin audit-log screen and the production preflight command.
5. **Offline cache and outbox, resource/guide library, support requests,
   equipment, funding, programmes, documents and notifications** — next. The
   original brief's teaching layer (getting-started checklist, guided tour,
   field hints, paper mapping, practice mode, glossary, help centre and guide
   editor) belongs here with the resource library.
6. **Hardening, accessibility pass, deployment runbook and the server test
   suite.**

## Checks

- Client unit tests: `cd client && npm test` (Vitest, 18 tests).
- End-to-end API checks: `cd server && npm run verify:api`. This runs
  `scripts/verify-api.mjs` against a live server, prints `ok`/`FAIL` per check
  (152 today) and exits non-zero on failure. It needs a demo database whose
  programme logins are past the forced password change, and it leaves test
  records behind.
- Production readiness: `cd server && npm run preflight`. It checks secrets,
  HTTPS/CORS settings, the database, required tables, migrations, audit
  triggers, demo-data leftovers, the public small-cell rule and pending
  aggregation.
- Neither test layer runs in CI yet. The server has no unit/integration suite;
  Jest is configured but empty.

## Quick debugging

- Logs: `docker compose logs -f server` or `docker compose logs -f client`
- Database shell: `docker compose exec postgres psql -U placa -d placa`
- Restart one service: `docker compose restart server`
- Re-run schema from scratch in development only:
  `cd server && npm run db:reset`
