# AGENT.md - Frame First

> Read this file at the start of every coding session.
> It is the current source of truth for what we are building and how the codebase works.

---

## What Is Frame First

Frame First is a conversion intelligence platform for websites.

The first release is **not Framer-only**. It ships as a general tracking script that any
website owner can paste into a global site layout. Framer remains an important niche and
will get a native plugin later, but plugin approval should not block launch.

Core loop:

```text
user creates project in web dashboard
  -> dashboard gives one script tag
  -> user installs script globally on their site
  -> track.js sends events to /collect
  -> API validates site_id and queues event
  -> worker writes event to ClickHouse
  -> dashboard reads analytics from API
```

## Current Build Strategy

Build the product experience first with local mock data. Do not make Supabase,
ClickHouse, Redis, or Docker a blocker for dashboard functionality or UI polish.

The web app defaults to mocked data through `apps/web/lib/api.ts`. Real API calls are
an integration layer to wire after the required workflows and UI are complete. Set
`NEXT_PUBLIC_USE_REAL_API=1` only when intentionally testing the backend path.

The mock app should still behave like a real product. Project creation persists in the
running Next.js process, while UTM links, A/B test actions, and settings persist per
project in browser localStorage.

## Product Surfaces

1. **Generic tracking script**
   - Works on any website.
   - Installed with one script tag.
   - Tracks pageviews, clicks, form submits, UTM params, and SPA route changes.

2. **Web dashboard**
   - Main setup and analytics UI.
   - Users create projects, copy the script tag, view analytics, configure goals,
     inspect heatmaps, manage UTM links, and later create A/B tests.
   - Current priority: feature-complete mock UI before real database/API wiring.

3. **Framer plugin**
   - Later install path and mini dashboard inside Framer.
   - Uses the same account and same projects as the web dashboard.
   - Injects the same generic `track.js` using `framer.setCustomCode()`.

4. **Mobile app**
   - Later read-only analytics and push notification companion.

---

## Current Monorepo Structure

```text
apps/
  api/          Fastify API, event collection, track.js build, workers
  web/          Next.js dashboard
packages/
  db/           Drizzle schema, Supabase/Postgres client, ClickHouse helpers
  types/        Shared TypeScript event and API types

docker-compose.yml
pnpm-workspace.yaml
tsconfig.base.json
.env.example
```

Planned later:

```text
apps/plugin    Framer plugin
apps/mobile    Expo mobile app
```

---

## Storage And Infrastructure

### Supabase Postgres

Supabase Postgres stores product/configuration data:

- `users`
- `projects`
- `links`
- `ab_tests`
- `notification_rules`
- `devices`

The local Docker Postgres exists only for development convenience.

### ClickHouse

ClickHouse stores high-volume analytics events:

- pageviews
- clicks
- form submits
- custom events
- UTM fields
- anonymous/session IDs
- variant IDs
- URL/referrer/device/country fields

### Redis

Redis stores short-lived operational state:

- live visitor sorted sets
- rate limits
- analytics caches
- project validation cache
- queue backing state
- later notification dedupe keys

### BullMQ

BullMQ workers perform background work:

- write collected events to ClickHouse
- later notification checks
- later heavier aggregation jobs

---

## Environment Variables

```env
# App
NODE_ENV=development
API_PORT=3001
PUBLIC_API_URL=http://localhost:3001
TRACK_JS_CDN_URL=http://localhost:3001/track.js

# Supabase
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/framefirst
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ClickHouse
CLICKHOUSE_HOST=http://localhost:8123
CLICKHOUSE_DB=framefirst
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=default

# Redis
REDIS_URL=redis://localhost:6379

# Product domains
APP_ORIGIN=http://localhost:3000
COLLECT_ALLOWED_ORIGINS=*

# Later features
ANTHROPIC_API_KEY=
EXPO_ACCESS_TOKEN=
```

---

## Authentication Model

Use **Supabase Auth** for early release unless there is a strong reason to own custom auth.

There are two trust zones:

### Public Event Collection

`track.js` is public and unauthenticated.

It sends a public `site_id` / `snippetKey` with each event. That key is not a secret.
It only tells Frame First which project the event belongs to.

`POST /collect` must:

- accept unauthenticated browser requests
- validate that `site_id` exists
- optionally validate request origin against project `allowedDomains`
- rate-limit by `site_id`
- return `200 { ok: true }` even for invalid projects
- never expose private analytics data

### Private Analytics Access

Dashboard, plugin, and mobile APIs require a Supabase bearer token.

Protected routes must:

- verify the token through Supabase
- attach `request.user = { id, email }`
- upsert the app-level `users` row when needed
- verify project ownership before returning data

The same account must work across dashboard, Framer plugin, and mobile app.

---

## Event Collection Flow

```text
Browser (track.js)
  -> POST /collect
  -> validate site_id from Supabase/Postgres, cached in Redis
  -> validate allowed domain if configured
  -> rate-limit per site_id in Redis
  -> update Redis live visitor state for pageviews
  -> enqueue event in BullMQ
  -> return immediately
  -> worker writes to ClickHouse async
```

Never await ClickHouse writes inside `/collect`.

---

## track.js Rules

`track.js` is built from `apps/api/src/track/index.ts`.

It must:

- be dependency-free vanilla browser code
- stay under 8kb gzipped
- never throw uncaught errors
- never block page render
- work on any website, not just Framer
- read `data-site` from its own script tag
- support optional `data-endpoint` override for development/testing
- create `anonymous_id` in localStorage
- create `session_id` in sessionStorage
- expire sessions after 30 minutes of inactivity
- send pageview, click, formsubmit, and custom events
- parse UTM params
- detect SPA route changes
- listen for Framer custom events when present

Example:

```html
<script src="https://cdn.framefirst.io/track.js" data-site="SITE_ID" async></script>
```

One script tag tracks the whole site only if installed globally.

---

## API Routes

Currently implemented:

| Method | Route | Auth | Description |
|---|---:|---:|---|
| GET | `/health` | No | Redis, ClickHouse, queue health |
| POST | `/collect` | No | Ingest events from `track.js` |
| GET | `/analytics/:site_id` | Yes | Aggregated dashboard metrics |
| GET | `/live/:site_id` | Yes | SSE live visitor count |
| GET | `/projects` | Yes | List projects for logged-in user |
| POST | `/projects` | Yes | Create project and return script tag |

Planned:

| Method | Route | Auth | Description |
|---|---:|---:|---|
| GET | `/heatmap/:site_id?url=` | Yes | Click coordinate data |
| GET/POST/DELETE | `/links` | Yes | UTM link CRUD |
| GET | `/go/:slug` | No | UTM redirect |
| GET/POST/PATCH | `/ab-tests` | Mixed | A/B testing |
| GET/POST/PATCH | `/notification-rules` | Yes | Alert config |
| POST | `/devices` | Yes | Register mobile push token |

---

## Coding Rules

- TypeScript everywhere, strict mode on, no `any`.
- Shared event/API types live in `packages/types`.
- Product schema and DB helpers live in `packages/db`.
- API errors use `{ error: string, code: string }`.
- Every Fastify route needs JSON Schema validation when accepting input.
- ClickHouse writes are async via BullMQ.
- Redis cache keys need TTLs.
- Protected routes must verify ownership.
- Do not duplicate type definitions across apps.
- Do not make the Framer plugin a launch blocker.

---

## Local Dev Setup

UI-first mode:

```bash
pnpm install
pnpm dev
```

Full local backend mode:

```bash
pnpm install
pnpm dev:infra
pnpm db:generate
pnpm db:migrate
pnpm db:seed:dev
pnpm --filter @framefirst/api build:track
pnpm dev:full
```

`pnpm dev` runs the mock-first web dashboard. `pnpm dev:full` runs the API, event
worker, and web dashboard together from the pnpm monorepo. Use `pnpm dev:backend`
when you only need API + worker.

API:

```text
http://localhost:3001
```

Dashboard:

```text
http://localhost:3000/projects
http://localhost:3000/dashboard/ff_dev_site
```

Generated local tracker:

```text
apps/api/public/track.js
```

Local seeded project:

```text
snippetKey/site_id: ff_dev_site
test page: http://localhost:3001/test-site
script tag: <script src="http://localhost:3001/track.js" data-site="ff_dev_site" async></script>
```

For local public `/collect` testing, Supabase env vars may be blank. Protected routes
use the default dev user `dev@framefirst.local` until Supabase Auth is configured.

---

## Current Build Status

The first foundation slice is in place:

- pnpm workspace scaffold
- shared types package
- Supabase/Postgres Drizzle schema
- initial Drizzle migration
- ClickHouse events table helper
- Fastify API shell
- Supabase bearer-token auth plugin
- Next.js dashboard app
- projects page at `http://localhost:3000/projects`
- mock-first dashboard data layer in `apps/web/lib/api.ts`
- feature pages for overview, heatmaps, UTM links, A/B tests, and settings
- local-working mock workflows for project creation, UTM link creation/deletion,
  A/B pause/resume/winner selection, and settings toggles/goals
- restrained minimal dashboard UI with responsive browser QA screenshots
- project create/list endpoints
- public `/collect` endpoint
- `/analytics/:site_id` endpoint
- `/live/:site_id` SSE endpoint
- Redis project cache, rate limit, and live visitor state update
- BullMQ event queue and worker
- generic browser `track.js` with SPA route tracking
- local dashboard at `http://localhost:3000/dashboard/ff_dev_site`

Next highest-value slice:

1. Add mock login/onboarding and installation verification flow.
2. Add deeper workflow states: empty/loading/error states and inline validation.
3. Add Supabase login and real API/database wiring after the UI/product flow is stable.
