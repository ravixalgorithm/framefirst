# TASKS.md — Frame First Build Plan

> Each task = one Claude Code / Codex session.  
> Paste the prompt block directly. Always start with: *"Read AGENT.md first, then do the following:"*

---

## Phase 0 — Foundation

Do these in order. Each one blocks the next.

---

### 0.1 — Monorepo scaffold

**Output:** Repo skeleton, docker-compose working, all packages linked  
**Blocks:** Everything

```
Create a pnpm monorepo with workspaces: apps/api, apps/web, apps/plugin, 
apps/mobile, packages/db, packages/types.

Root package.json scripts:
- dev: run all apps concurrently
- build: build all apps
- lint: eslint all packages

Add:
- docker-compose.yml with Postgres 16, Redis 7, ClickHouse 24 (with named volumes)
- .env.example with all vars from AGENT.md
- tsconfig.base.json with strict mode on
- eslint.config.js shared config
- .gitignore

packages/types: empty index.ts, will hold shared types
packages/db: empty, will hold Drizzle schema

No business logic. Just scaffold.
```

---

### 0.2 — Postgres schema + Drizzle migrations

**Output:** `packages/db/src/schema.ts` with all tables, first migration runs clean  
**Blocks:** 0.4, 0.5

```
In packages/db, set up Drizzle ORM with postgres-js driver.

Create schema.ts with all tables exactly as defined in AGENT.md:
users, projects, links, ab_tests, notification_rules, devices.

Add:
- drizzle.config.ts pointing to DATABASE_URL
- src/index.ts that exports db client and all schema tables
- src/migrate.ts script that runs migrations
- package.json script: "migrate": "tsx src/migrate.ts"

Generate and run the initial migration. Confirm all tables exist
with: \dt in psql.
```

---

### 0.3 — ClickHouse events table + insert helper

**Output:** Events table created, insert function tested  
**Blocks:** 0.5, 0.8

```
In packages/db, add ClickHouse support using @clickhouse/client.

Create src/clickhouse.ts:
- Client setup using CLICKHOUSE_HOST, CLICKHOUSE_DB, CLICKHOUSE_USER, 
  CLICKHOUSE_PASSWORD from env
- Run the CREATE TABLE IF NOT EXISTS events DDL from AGENT.md
- Export an insertEvent(event: EventRow) function that uses 
  client.insert() with format JSONEachRow
- Export a queryEvents(sql: string) function for raw queries

Add EventRow type to packages/types/src/events.ts matching 
the ClickHouse schema exactly.

Add a test script src/test-insert.ts that inserts one test event 
and then queries it back. Confirm it works.
```

---

### 0.4 — Auth service

**Output:** `/auth/magic`, `/auth/verify`, `/auth/refresh` working end-to-end  
**Blocks:** Everything that needs user identity

```
In apps/api (Fastify), build the auth system.

Setup:
- Fastify with @fastify/cors, @fastify/rate-limit, @fastify/jwt
- dotenv config loading
- Drizzle db client from packages/db

Routes:
POST /auth/magic
- Body: { email: string }
- Generate a 6-digit numeric OTP
- Store in Redis with key auth:otp:{email}, TTL 10 minutes
- Send email via Resend with the OTP
- Return { message: "OTP sent" }

GET /auth/verify?token={email}:{otp}
- Parse email and OTP from token param (base64 encoded)
- Validate against Redis
- If valid: upsert user in Postgres, delete OTP from Redis
- Return { accessToken, refreshToken }
- Access token: JWT with { userId, email }, expires 15min
- Refresh token: opaque UUID stored in Postgres with expiry, returned as httpOnly cookie

POST /auth/refresh
- Read refresh token from httpOnly cookie
- Validate against Postgres
- Rotate: delete old, create new
- Return new accessToken

Add fastify.authenticate decorator that validates Bearer JWT
and attaches req.user = { id, email } to the request.

Add JSON schema validation to all routes.
```

---

### 0.5 — Event ingest endpoint

**Output:** `POST /collect` accepting events, writing to ClickHouse via queue  
**Blocks:** track.js (0.6)

```
In apps/api, add the event ingest route.

POST /collect (no auth required)
- JSON Schema: all fields from EventRow type in packages/types
- Validate site_id exists in Postgres projects table
  (cache result in Redis: project:{snippetKey} TTL 5min)
- If invalid site_id: return 200 anyway (don't leak info, don't block)
- Add to BullMQ queue "events" with the event payload
- Return 200 { ok: true } immediately

BullMQ worker (src/workers/events.ts):
- Process queue "events"
- Call insertEvent from packages/db
- On failure: retry 3 times with exponential backoff, then dead-letter

Rate limiting on /collect: 1000 req/min per site_id using Redis
CORS: allow all origins (this endpoint is called from third-party sites)

Add queue health check to GET /health route.
```

---

### 0.6 — track.js browser snippet

**Output:** `track.js` <8kb gzipped, posting real events to /collect  
**Blocks:** Plugin (Phase 1)

```
Build track.js as a self-contained vanilla JS module in apps/api/src/track/.

Behavior on load:
1. Read data-site from own script tag
2. Get or create anonymous_id from localStorage (key: _ff_aid)
3. Get or create session_id from sessionStorage (key: _ff_sid)
   - Session expires after 30min of inactivity (update lastActive on each event)
4. Parse UTM params from window.location.search
5. Fire a pageview event to POST /collect with:
   url, referrer, utm params, anonymous_id, session_id, site_id,
   country (blank, filled server-side), device (navigator.userAgent parsed)

Click tracking:
- document.addEventListener('click') 
- Capture: x_pct (e.clientX / window.innerWidth), y_pct (e.clientY / window.innerHeight)
- element_selector: e.target.tagName + '#' + id + '.' + first class
- Fire click event to /collect

Framer events:
- Listen for 'framer:click' and 'framer:formsubmit' custom events
- Forward to /collect as event_type 'click' and 'formsubmit'

A/B tests:
- On load, call GET /ab-tests/active?site_id= 
- For each running test, GET /ab-tests/:id/assign?anonymous_id=
- Store assignments in sessionStorage as _ff_variants JSON
- Attach variant_id to all subsequent events

Rules:
- Zero dependencies, vanilla JS only
- All network calls via fetch() with keepalive: true
- Wrap everything in try/catch — never throw uncaught errors
- Never block — all async, fire and forget
- Build with esbuild targeting ES2018, minify, must be under 8kb gzipped

Add build script: "build:track" that outputs to public/track.js
```

---

### 0.7 — Live visitor count via SSE

**Output:** `GET /live/:site_id` streaming live count, verified in browser  
**Blocks:** Plugin mini dashboard, mobile overview

```
In apps/api, build the live visitor SSE system.

In the /collect handler (after validation, before queue):
- On event_type = 'pageview':
  ZADD site:{site_id}:live {timestamp} {anonymous_id}
  PUBLISH site:{site_id}:live-update "ping"

GET /live/:site_id (auth required)
- Set headers for SSE: Content-Type text/event-stream, Cache-Control no-cache
- Every 5 seconds:
  ZREMRANGEBYSCORE site:{site_id}:live -inf {now - 5min}
  ZCARD site:{site_id}:live → count
  Write SSE: data: {"count": N}\n\n
- On Redis message on site:{site_id}:live-update: trigger immediate count push
- On client disconnect: clean up Redis subscription

Test it:
- Open two browser tabs to a test page with track.js
- SSE should show count = 2
- Close one tab, after 5min it should drop to 1
```

---

### 0.8 — Analytics query layer

**Output:** `GET /analytics/:site_id` returning all dashboard metrics  
**Blocks:** Web dashboard (Phase 2)

```
In apps/api, build the analytics query endpoint.

GET /analytics/:site_id?from={ISO date}&to={ISO date}
Auth required. Default: last 7 days if no params.

Query ClickHouse and return single JSON response:
{
  summary: {
    visitors: number,        // COUNT DISTINCT anonymous_id
    pageviews: number,       // COUNT where event_type = 'pageview'
    sessions: number,        // COUNT DISTINCT session_id
    bounceRate: number,      // sessions with 1 pageview / total sessions (%)
    avgSessionDuration: number, // avg seconds between first and last event per session
    cvr: number              // if project has conversion_goal set: goal sessions / total (%)
  },
  chart: [                   // daily breakdown
    { date: string, visitors: number, pageviews: number }
  ],
  topPages: [
    { url: string, pageviews: number, visitors: number }
  ],
  topReferrers: [
    { referrer: string, visitors: number }
  ],
  devices: [
    { device: string, count: number }
  ],
  countries: [
    { country: string, visitors: number }
  ],
  utmSources: [
    { utm_source: string, visitors: number, cvr: number }
  ]
}

Cache in Redis: analytics:{site_id}:{from}:{to} TTL 60s.

Validate that requesting user owns the project (site_id = project.snippetKey).
```

---

## Phase 1 — Framer Plugin

All tasks can be done after Phase 0 is complete.

---

### 1.1 — Plugin scaffold + dev mode

**Output:** Plugin loading inside Framer editor, "Hello Frame First" visible  
**Blocks:** 1.2, 1.3, 1.4

```
In apps/plugin, scaffold a Framer plugin.

Run: npm create framer-plugin@latest
Choose: React + TypeScript

Then:
- Install Tailwind CSS + configure for the plugin
- Create src/App.tsx with a simple "Frame First" header and loading state
- Confirm it loads in Framer: Plugin menu → Enable Dev Tools → Open Dev Plugin → localhost:5173
- Confirm framer.getPublishInfo() returns data (log to console)
- Set up proxy in vite.config.ts so /api/* proxies to http://localhost:3001

Create a shared API client src/lib/api.ts that:
- Reads token from framer.getPluginData('ff_token')
- Adds Authorization: Bearer {token} header to all requests
- Points to VITE_API_URL (default http://localhost:3001)
```

---

### 1.2 — Plugin auth flow

**Output:** User can log in via OTP inside the plugin, token stored  
**Blocks:** 1.3

```
In apps/plugin, build the auth screens.

Screen 1 - Email entry:
- Input for email (pre-filled from framer.getCurrentUser().email if available)
- "Send code" button → POST /auth/magic
- Transition to OTP screen

Screen 2 - OTP entry:
- 6 individual digit inputs (auto-advance on input)
- "Verify" button → GET /auth/verify?token={base64(email:otp)}
- On success: store JWT with framer.setPluginData('ff_token', accessToken)
- Store expiry timestamp: framer.setPluginData('ff_token_exp', expiry)
- Navigate to main app

On plugin open:
- Check for ff_token and ff_token_exp
- If token exists and not expired: skip auth, show main UI
- If expired: show auth screen
- If no token: show auth screen

Show loading states and error messages inline (no alerts/modals).
```

---

### 1.3 — Snippet injection + project creation

**Output:** track.js injected into user's Framer site via setCustomCode  
**Blocks:** 1.4

```
In apps/plugin, build the setup flow that runs after auth.

Step 1 - Site detection:
- Call framer.getPublishInfo()
- Extract siteUrl from production?.url ?? staging?.currentPageUrl
- POST /projects with { name: "My Framer Site", siteUrl }
  (backend creates or finds existing project for this URL + user)
- Receive back { id, snippetKey } from API

Step 2 - Inject snippet:
- Call framer.setCustomCode({
    html: `<script src="${import.meta.env.VITE_TRACK_JS_URL}" data-site="${snippetKey}" async></script>`,
    location: 'headEnd'
  })
- Store project id: framer.setPluginData('ff_project_id', id)

Step 3 - Verify screen:
- Show: "Tracking installed. Now publish your site to activate."
- Show a "Publish site" reminder with Framer's publish shortcut
- Poll GET /analytics/:site_id every 8 seconds
- When first event arrives (visitors > 0 or pageviews > 0):
  Show green checkmark: "Tracking active"
  Auto-navigate to main dashboard UI

Also check framer.getCustomCode() on plugin open:
- If code.headEnd.disabled = true: show warning banner "Tracking disabled in site settings"
```

---

### 1.4 — Plugin mini dashboard

**Output:** Live stats visible inside Framer editor  
**Blocks:** Nothing (last plugin task)

```
In apps/plugin, build the main dashboard UI shown after setup.

Layout (max 320px wide, designed for Framer plugin panel):

Header:
- Frame First logo + project name
- "Open full dashboard" → openLink to app.framefirst.io/dashboard/{projectId}

Live count section:
- Large number showing live visitors now
- Connect to GET /live/:site_id SSE using EventSource
- "● Live" green dot indicator
- Falls back to polling if SSE fails

Today's stats (3 cards in a row):
- Pageviews today
- Unique visitors today
- CVR today (show "--" if no conversion goal set)

Active A/B tests:
- List of running tests (GET /ab-tests?project_id=)
- Each shows: test name, days running, leading variant name + CVR
- "Winner found" badge if probability_best > 95%
- Empty state: "No active tests — create one in the dashboard"

Refresh button in header. Auto-refresh stats every 60s.
Settings gear icon → shows: "Tracking: active ✓", "View snippet", "Disconnect"
```

---

## Phase 2 — Web Dashboard

Can be built in parallel with Phase 1 once Phase 0 is done.

---

### 2.1 — Next.js app shell + auth

**Output:** Login page working, protected dashboard layout with sidebar  
**Blocks:** All Phase 2 tasks

```
In apps/web, create a Next.js 14 app with App Router.

Auth:
- /login page: email input → POST /auth/magic → OTP input → GET /auth/verify
- Store accessToken in httpOnly cookie via Next.js middleware (not localStorage)
- middleware.ts: check cookie on all /dashboard/* routes, redirect to /login if missing
- /auth/callback route handler that sets cookie and redirects to /dashboard

Layout:
- app/(dashboard)/layout.tsx with sidebar:
  - Frame First logo
  - Project switcher dropdown (GET /projects)
  - Nav links: Overview, Heatmaps, UTM Links, A/B Tests, Settings
  - User email + logout button at bottom

Use shadcn/ui: run npx shadcn@latest init, add: button, card, 
input, select, badge, dialog, tabs, table, skeleton components.

Dark mode: next-themes, class-based dark mode.
Fonts: Geist from next/font.
```

---

### 2.2 — Analytics overview page

**Output:** `/dashboard/[projectId]` showing real data with charts  
**Blocks:** Nothing (independent page)

```
In apps/web, build the main analytics overview page.

app/(dashboard)/dashboard/[projectId]/page.tsx

Top section - 4 metric cards side by side:
- Visitors (with % change vs previous period)
- Pageviews
- Bounce Rate
- CVR (shows "--" if no goal set, with link to settings)

Date range selector: 7d / 30d / 90d pills (default 7d)

Main chart:
- Line chart using Recharts (visitors + pageviews on same chart, two Y axes)
- X axis: dates, Y axis: counts
- Responsive container, dark mode aware colors

Bottom two columns:
Left: Top pages table (url, pageviews, visitors - truncate long URLs)
Right: Top referrers table (referrer, visitors)

Live visitors badge in the page header (SSE, same as plugin)

Loading: use shadcn Skeleton components while data loads
Error state: show error card if API fails

All data from GET /analytics/:site_id?from=&to= — fetch in Server Component, 
pass to client components only what needs interactivity.
```

---

### 2.3 — Heatmap page

**Output:** `/dashboard/[projectId]/heatmaps` with clickable heatmap overlay  
**Blocks:** Nothing

```
In apps/web, build the heatmap visualization page.

Add to apps/api: GET /heatmap/:site_id?url=
- Query ClickHouse: SELECT x_pct, y_pct, count(*) as count 
  FROM events WHERE site_id=? AND url=? AND event_type='click'
  GROUP BY x_pct, y_pct
- Return array of { x_pct, y_pct, count }

Frontend page:
Page selector:
- Dropdown of top pages from GET /analytics (topPages array)
- URL input for custom page

Heatmap display:
- Iframe loading the selected page URL (or show "Upload screenshot" if iframe blocked)
- Canvas overlay positioned absolutely on top of iframe
- Draw heatmap: for each click point, draw radial gradient circle
  radius=30px, color from rgba(255,0,0,0) to rgba(255,0,0,0.6)
  opacity proportional to count (normalize to max count in dataset)
- Opacity slider (0-100%) to control heatmap intensity

Stats sidebar:
- Total clicks on this page
- Top 5 clicked elements (by element_selector)

If project has active A/B tests: show variant selector tabs
(reload heatmap data filtered by variant_id)
```

---

### 2.4 — UTM link builder + dashboard

**Output:** `/dashboard/[projectId]/utm` fully working  
**Blocks:** Nothing

```
In apps/api, add:
POST /links — create link (validate slug uniqueness, store in Postgres)
GET /links?project_id= — list with click counts joined from ClickHouse
  (ClickHouse: SELECT utm_campaign, count(*) FROM events 
   WHERE event_type='pageview' AND utm_source != '' GROUP BY utm_campaign)
GET /go/:slug — redirect handler (already in plan)

In apps/web, build app/(dashboard)/dashboard/[projectId]/utm/page.tsx:

Top section - Create link form:
- Destination URL input
- Custom slug input (auto-suggest from destination URL)
- UTM fields: source, medium, campaign, term (optional), content (optional)
- Preview of final short URL: go.framefirst.io/{slug}
- "Create link" button

Links table below:
Columns: Short URL (copy button), Destination (truncated), Clicks, 
Top Country, CVR, Created date
- Clicking short URL copies to clipboard
- Delete button per row

Summary cards above table:
- Total links, Total clicks this month, Best performing campaign (by CVR)

"Add UTM to existing URL" helper: paste any URL → parses existing UTM params 
into the form fields for editing
```

---

### 2.5 — A/B test engine backend

**Output:** Variant assignment + Bayesian stats API working  
**Blocks:** 2.6

```
In apps/api, build the A/B testing backend.

GET /ab-tests/active?site_id=  (no auth — called by track.js)
- Returns all running tests for a site_id
- Response: [{ id, variants: [{id, weight}], goalEvent }]
- Cache in Redis 60s

GET /ab-tests/:id/assign?anonymous_id=  (no auth — called by track.js)
- Compute: MurmurHash3(anonymous_id + test_id) % 100 → number 0-99
- Map to variant based on cumulative weights
  e.g. variants [{id:'a',weight:50},{id:'b',weight:50}]:
  0-49 → 'a', 50-99 → 'b'
- Return { variantId: string }
- This must be deterministic: same anonymous_id + test_id always same variant

GET /ab-tests/:id/results  (auth required)
- For each variant, query ClickHouse:
  visitors = COUNT DISTINCT anonymous_id WHERE variant_id = ?
  conversions = COUNT DISTINCT session_id WHERE variant_id = ? AND 
    (event matches test.goalEvent)
  cvr = conversions / visitors
- Bayesian probability of being best:
  Model each variant as Beta(conversions+1, visitors-conversions+1)
  Sample 10000 times from each, probability_best = fraction of samples 
  where this variant was max
  (use a simple deterministic approximation, not actual Monte Carlo)
- Return:
  { variants: [{id, name, visitors, conversions, cvr, probabilityBest}],
    winnerId: string|null (if any variant > 0.95),
    totalVisitors: number }

PATCH /ab-tests/:id  (auth required)
- Update status: 'running' | 'paused' | 'complete'
- If complete + winnerVariantId provided: store winner
```

---

### 2.6 — A/B test UI

**Output:** `/dashboard/[projectId]/ab-tests` fully working  
**Blocks:** Nothing

```
In apps/web, build the A/B testing pages.

List page: app/(dashboard)/dashboard/[projectId]/ab-tests/page.tsx
- Table: Test name, Status badge, Visitors, Leading variant, Days running
- "Create test" button → opens dialog

Create test dialog:
- Test name input
- Goal event: dropdown (pageview | click | custom event)
  - If pageview: URL input
  - If click: CSS selector input with helper text
  - If custom: event name input
- Variants section: 
  - Start with 2 variants (Control, Variant A)
  - Add variant button (max 4)
  - Each variant: name input + weight slider
  - Weights auto-balance, must sum to 100
- "Create test" → POST /ab-tests

Detail page: app/(dashboard)/dashboard/[projectId]/ab-tests/[testId]/page.tsx
- Header: test name, status badge, goal, days running
- "Pause" / "Resume" / "Declare winner" action buttons

Stats section:
- Bar chart: CVR per variant (Recharts)
- Table: Variant | Visitors | Conversions | CVR | Probability of best
  - Probability shown as progress bar (green when > 95%)
- Winner banner when probabilityBest > 95%: 
  "Variant B is the winner with 97% confidence"

Heatmap tabs: one tab per variant, loads heatmap filtered by variant_id
```

---

### 2.7 — Conversion goal + project settings

**Output:** Project settings page, CVR showing across all dashboard pages  
**Blocks:** Nothing (but makes everything more useful)

```
In apps/web, build app/(dashboard)/dashboard/[projectId]/settings/page.tsx

Sections:

1. Conversion Goal
- Radio: "Page visit" | "Button/element click" | "Custom event"
- Page visit: URL input (e.g. /thank-you)
- Element click: CSS selector input (e.g. #signup-btn, .cta-button)
- Custom event: event name input (matches what's passed to track custom events)
- Save → PATCH /projects/:id with { conversionGoal: { type, value } }

2. Project Info
- Project name (editable)
- Site URL (read-only, set by plugin)
- Snippet key (read-only, with copy button)
- Snippet status: "Active" or "Not detected" (check last event timestamp)

3. Tracking snippet
- Code block showing the full script tag
- Copy button
- "Verify installation" button → calls GET /analytics, checks for recent events

4. Notification rules (links to mobile section, preview of rules)
- List of active rules with quick toggles
- "Manage in mobile app" note
```

---

## Phase 3 — Mobile App

Can be built in parallel with Phase 2.

---

### 3.1 — Expo scaffold + auth

**Output:** App running on iOS sim and Android, login working  
**Blocks:** 3.2, 3.3, 3.4

```
In apps/mobile, create Expo app:
npx create-expo-app@latest --template blank-typescript

Setup:
- Expo Router for file-based routing
- NativeWind v4 for styling
- expo-secure-store for JWT storage
- @gorhom/bottom-sheet for project switcher
- axios for API calls

Auth screens:
- app/login.tsx: email input → POST /auth/magic → show OTP screen
- OTP screen: 6 digit inputs, auto-advance, "Verify" → GET /auth/verify
- On success: store in SecureStore with keys ff_access_token, ff_refresh_token

Create src/lib/api.ts:
- Axios instance with base URL from EXPO_PUBLIC_API_URL env var
- Request interceptor: add Authorization: Bearer from SecureStore
- Response interceptor: on 401, try POST /auth/refresh, retry once

Tabs layout: app/(tabs)/_layout.tsx
- Tab 1: Overview (chart-bar icon)
- Tab 2: Tests (a-b icon or flask)
- Tab 3: Alerts (bell icon)

Project switcher:
- Header right button → opens BottomSheet with project list
- GET /projects → flat list of project name cards
- Selected project stored in Zustand store
- All tabs re-fetch on project switch

app/_layout.tsx: check SecureStore for token, redirect to /login if missing
```

---

### 3.2 — Live overview screen

**Output:** Overview tab showing live data with SSE  
**Blocks:** Nothing

```
In apps/mobile, build app/(tabs)/index.tsx (Overview)

Top section - Live visitors:
- Large number, updated via SSE
- Use react-native-sse or EventSource polyfill for React Native
- Connect to GET /live/:site_id on mount, disconnect on unmount
- "● N people here now" with pulsing green dot animation
- If SSE fails: fall back to polling every 30s

Stats cards (2x2 grid):
- Visitors today
- Pageviews today  
- CVR today
- Bounce rate today
All from GET /analytics/:site_id?from={today}&to={today}

24h sparkline:
- react-native-svg LineChart
- Data: GET /analytics with hourly breakdown for last 24h
- Simple line, no axes, just the shape

Top 3 pages:
- Flat list: page URL (truncated) + pageview count
- "View all →" links to full analytics (web link)

Pull to refresh (RefreshControl)
"Last updated X seconds ago" footer text
Auto-refresh every 60s when app is in foreground
```

---

### 3.3 — Push notification backend

**Output:** BullMQ worker sending real push notifications  
**Blocks:** 3.4

```
In apps/api, build the notification system.

Add to Fastify:
POST /devices  (auth required)
- Body: { pushToken: string, platform: 'ios'|'android' }
- Upsert in Postgres devices table (update token if user already has device)
- Return { ok: true }

BullMQ worker: src/workers/notifications.ts
- Runs every 5 minutes via a repeatable job
- For each enabled notification_rule, for each project:

  traffic_spike:
  - GET current live count from Redis ZCARD
  - GET baseline: avg of last 7 days same hour from ClickHouse
  - If current > threshold * baseline: trigger notification

  cvr_drop:
  - GET current CVR from analytics (last 1h)
  - If cvr < rule.threshold: trigger notification

  ab_winner:
  - GET /ab-tests/results for all running tests
  - If any variant.probabilityBest > 0.95: trigger notification

  link_milestone:
  - Check click counts for all links in project from ClickHouse
  - If any crossed a round milestone (100, 500, 1000, etc.) since last check: trigger

Dedup: before sending, check Redis key notif:{ruleId}:{projectId}:sent
- If exists: skip (TTL 1h)
- If not: send + SET key TTL 1h

Send via Expo Push API:
POST https://exp.host/--/api/v2/push/send
Body: { to: pushToken, title, body, data: { projectId, type } }

Notification messages:
- traffic_spike: "🔥 Traffic spike on {projectName} — {N}x normal"
- cvr_drop: "⚠️ CVR dropped to {N}% on {projectName}"
- ab_winner: "🏆 Test winner found on {projectName} — {variantName} wins"
- link_milestone: "🔗 {slug} just hit {N} clicks"
```

---

### 3.4 — Alerts config + A/B tests tab

**Output:** All three tabs complete, push notifications end-to-end  
**Blocks:** Nothing (final task)

```
In apps/mobile:

Register push token on startup:
- In app/_layout.tsx: request push permission (expo-notifications)
- Get token: Notifications.getExpoPushTokenAsync()
- POST /devices with token on every app open (tokens can rotate)

app/(tabs)/alerts.tsx - Alerts tab:
- Header: "Notifications"
- List of notification rules from GET /notification-rules?project_id=
- Each rule as a card:
  - Toggle switch (PATCH /notification-rules/:id { enabled })
  - Rule description: "Alert when traffic spikes above {threshold}x"
  - For numeric thresholds: tappable to edit inline
- "Add alert" section at bottom:
  - 4 buttons for each type: Traffic Spike, CVR Drop, Test Winner, Link Milestone
  - Tap to create with default threshold → POST /notification-rules
- Empty state: "No alerts set up. Add one to get notified."

app/(tabs)/tests.tsx - Tests tab:
- Header: "A/B Tests"
- List from GET /ab-tests?project_id=
- Each test card:
  - Test name + status badge
  - For each variant: name + small progress bar showing probabilityBest %
  - "Winner" badge (green) if probabilityBest > 95%
  - Days running
- Tapping a test → full-screen modal with variant table
- Badge on tab icon: number of tests with winner waiting
- Empty state: "No active tests. Create one in the web dashboard."
```

---

## Completed Checklist

Track progress here. Check off tasks as they're done.

### Mock-First UI Prototype
- [x] Shared dashboard shell and navigation
- [x] Mock analytics overview
- [x] Mock heatmap page
- [x] Mock UTM link builder
- [x] Mock A/B testing workbench
- [x] Mock project settings
- [x] Local state persistence for projects, UTM links, A/B tests, and settings
- [x] Minimal SaaS UI polish pass
- [x] Responsive/browser QA polish pass
- [ ] Mock login/onboarding and install verification
- [ ] Inline validation, empty states, loading states, and destructive confirmations
- [ ] Replace mock layer with real API calls after UI is stable

### Phase 0
- [x] 0.1 Monorepo scaffold
- [x] 0.2 Postgres schema
- [x] 0.3 ClickHouse table
- [ ] 0.4 Auth service
- [x] 0.5 /collect endpoint
- [x] 0.6 track.js
- [x] 0.7 Live visitor SSE
- [x] 0.8 Analytics query layer

### Phase 1 — Plugin
- [ ] 1.1 Scaffold + dev mode
- [ ] 1.2 Auth flow
- [ ] 1.3 Snippet injection
- [ ] 1.4 Mini dashboard

### Phase 2 — Web Dashboard
- [ ] 2.1 App shell + auth
- [x] 2.2 Analytics overview
- [x] 2.3 Heatmaps
- [x] 2.4 UTM dashboard
- [ ] 2.5 A/B backend
- [x] 2.6 A/B UI
- [x] 2.7 Conversion goals + settings

### Phase 3 — Mobile
- [ ] 3.1 Expo scaffold + auth
- [ ] 3.2 Live overview
- [ ] 3.3 Push notification backend
- [ ] 3.4 Alerts + tests tabs

---

*One task = one AI coding session. Always start with: "Read AGENT.md first, then do the following:"*
