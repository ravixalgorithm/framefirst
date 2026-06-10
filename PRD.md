# Frame First — Product Requirements Document

> Conversion intelligence platform built specifically for Framer websites.  
> Version: 0.1 (pre-build)  
> Status: Planning → Build

---

## 1. What We're Building

Frame First is an analytics and conversion intelligence platform for people who build landing pages on Framer. It tracks visitors, shows heatmaps, runs A/B tests, manages UTM-tracked links, and uses AI to suggest improvements — all connected through a native Framer plugin that installs in one click.

**Core value proposition:** Most analytics tools show you what happened. Frame First tells you what to do next.

---

## 2. Target Users

- Indie founders and solopreneurs with Framer landing pages
- Designers building client sites on Framer
- Startups running paid ads to Framer landing pages
- No-code builders who understand conversion but don't want to touch code

They are non-technical but not unsophisticated. They know what CVR means. They use tools like Notion, Linear, Webflow. They pay $10–30/mo for SaaS without much friction.

---

## 3. The Three Products

### 3.1 Framer Plugin (distribution channel)
A native Framer plugin listed on the Framer Marketplace. This is the primary acquisition surface.

**What it does:**
- Authenticates user with Frame First via email OTP
- Reads `framer.getPublishInfo()` to get site URL
- Creates a project in Frame First and receives a `site_id`
- Calls `framer.setCustomCode()` to inject `track.js` into `<head>` of the published site
- Shows a mini dashboard inside the Framer editor: live visitors, today's CVR, active A/B tests
- **Heatmaps**: Renders click heatmaps directly overlaid on the live Framer canvas for the active page, avoiding the need for external screenshots.
- Deep links to the full web dashboard for detailed views

**Key constraint:** User must still hit "Publish" in Framer for tracking to go live. Plugin shows a clear prompt for this.

### 3.2 Web Dashboard
Next.js app at `app.framefirst.io`. The full analytics and settings interface.

**Pages:**
- `/login` — email + OTP auth
- `/dashboard/[projectId]` — overview: metrics, visitor chart, top pages, top referrers
- `/dashboard/[projectId]/utm` — link builder + UTM dashboard with campaign CVR
- `/dashboard/[projectId]/ab-tests` — A/B test creation, results, variant heatmaps
- `/dashboard/[projectId]/settings` — conversion goal setup, notification rules, project config

### 3.3 Mobile App
Expo (React Native) app for iOS and Android. Read-only analytics access plus conditional push notifications.

**Screens:**
- Overview tab — live visitor count (SSE), today's metrics, 24h sparkline
- Tests tab — active A/B tests, probability bars, winner badges
- Alerts tab — notification rule toggles with threshold config

**Notification types:**
- Traffic spike (current visitors > N × baseline)
- CVR drop (below threshold %)
- A/B test winner (probability_best > 95%)
- Link milestone (click count crosses round number)

---

## 4. Feature Modules

### 4.1 Event Collection
- `track.js` is a vanilla JS snippet, <8kb gzipped, async non-blocking
- Loaded via `<script src="https://cdn.framefirst.io/track.js" data-site="SITE_ID" async>`
- Tracks: pageviews, click coordinates (x_pct, y_pct), element selectors, form submits
- Listens for Framer's native `framer:click` and `framer:formsubmit` events
- Generates/persists `anonymous_id` in localStorage, `session_id` resets after 30min inactivity
- Parses UTM params from URL on every pageview
- Posts to `POST /collect` — fire and forget, never blocks page

### 4.2 Link Intelligence
- Short URLs at `go.framefirst.io/:slug`
- Each link has: slug, destination URL, full UTM bundle, click counter, geo + device breakdown
- Redirect handler: logs click event to `/collect`, then 302 to destination
- UTM builder UI with custom slug support and bulk CSV import (phase 2)
- UTM dashboard: campaign performance table, CVR per UTM source, top converting channels

### 4.3 Heatmaps (Framer Plugin Only)
- Click coordinates stored as x_pct (0–1) and y_pct (0–1) — viewport-relative
- Aggregated server-side per URL on demand
- Rendered natively via the Framer Plugin directly onto the user's Framer canvas. (Moved to the plugin because rendering a reliable visual preview of the site inside the external web dashboard is too fragile).
- Per-variant heatmaps inside A/B test detail view (also via plugin integration)
- No real-time heatmap rendering client-side — computed on request

### 4.4 A/B Testing
- Variant assignment: MurmurHash(anonymous_id + test_id) mod 100 → consistent, no cookies needed
- Traffic splits configurable per variant (must sum to 100%)
- Goal types: pageview URL, element click selector, custom event name
- Statistics: Bayesian inference, Beta distribution, probability of being best
- Auto-status: "Winner found" when any variant hits >95% probability
- Per-variant heatmaps, CVR, visitor counts in detail view

### 4.5 AI Advisor (Phase 2)
- Reads: CVR, heatmap hotspots, funnel drop-off points, A/B test results, UTM source breakdown
- Outputs: 3–5 ranked suggestions per project, structured JSON
- Powered by Anthropic Claude API with structured output prompting
- Example suggestions:
  - "Your CTA button gets 40% fewer clicks than your hero headline — try moving it above the fold"
  - "Instagram traffic bounces 2× faster than email — your page may not match what your bio promises"
  - "Variant B converts 18% better but only for email traffic — consider a traffic-source-specific landing page"

### 4.6 Conversion Goals
- Defined per project in settings
- Types: pageview of URL, click on CSS selector, custom event name
- CVR = sessions that hit the goal / total sessions
- Used by: overview metrics, A/B test results, notification rules, AI advisor

---

## 5. Data Architecture

### Event Schema (ClickHouse)
```sql
CREATE TABLE events (
  site_id       String,
  session_id    String,
  anonymous_id  String,
  event_type    Enum('pageview','click','custom','formsubmit'),
  url           String,
  referrer      String,
  utm_source    String,
  utm_medium    String,
  utm_campaign  String,
  utm_term      String,
  utm_content   String,
  x_pct         Float32,
  y_pct         Float32,
  element_selector String,
  variant_id    String,
  country       String,
  device        String,
  timestamp     DateTime
) ENGINE = MergeTree()
ORDER BY (site_id, timestamp);
```

### Postgres Tables
- `users` — id, email, created_at
- `projects` — id, user_id, name, site_url, snippet_key, conversion_goal (jsonb)
- `links` — id, project_id, slug, destination_url, utm_source, utm_medium, utm_campaign, utm_term, utm_content
- `ab_tests` — id, project_id, name, status, variants (jsonb), winner_variant_id, goal_event
- `notification_rules` — id, project_id, user_id, type, threshold, enabled
- `devices` — id, user_id, push_token, platform

### Redis Usage
- Live visitor counts: sorted set `site:{site_id}:live` with anonymous_id + timestamp
- Rate limiting: `ratelimit:{site_id}` counter, 1000 req/min
- Analytics cache: `analytics:{site_id}:{from}:{to}` TTL 60s
- Notification dedup: `notif:{rule_id}:sent` TTL 1h

---

## 6. API Surface

### Public (no auth)
- `POST /collect` — ingest events from track.js
- `GET /go/:slug` — UTM redirect handler

### Authenticated
- `POST /auth/magic` — send OTP
- `GET /auth/verify` — validate OTP, return JWT
- `POST /auth/refresh` — rotate tokens
- `GET /live/:site_id` — SSE stream for live visitor count
- `GET /analytics/:site_id?from=&to=` — aggregated analytics
- `GET /heatmap/:site_id?url=` — click coordinate data
- `POST /projects` — create project
- `GET /projects` — list user projects
- `GET|POST|DELETE /links` — link CRUD
- `GET|POST /ab-tests` — test CRUD
- `GET /ab-tests/:id/assign?anonymous_id=` — variant assignment
- `GET /ab-tests/:id/results` — Bayesian stats
- `GET|POST|PATCH /notification-rules` — alert config
- `POST /devices` — register push token

---

## 7. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| API | Fastify (Node.js) | Fast, low overhead, good plugin ecosystem |
| Event DB | ClickHouse | Handles billions of rows, fast time-series aggregation |
| App DB | Postgres + Drizzle ORM | Relational data, type-safe queries |
| Cache / realtime | Redis | Pub/sub for live counts, rate limiting, caching |
| Queue | BullMQ (Redis-backed) | Async event writes, notification worker |
| Web frontend | Next.js 14 App Router | SSR, file-based routing, API routes |
| UI components | shadcn/ui + Tailwind | Fast, accessible, easy to customize |
| Charts | Recharts | React-native, easy to use |
| Plugin | framer-plugin + Vite + React | Official Framer toolchain |
| Mobile | Expo SDK 51 + React Native | Cross-platform, fast iteration |
| Mobile styling | NativeWind | Tailwind in React Native |
| Email | Resend | Simple API, good DX |
| Monorepo | pnpm workspaces | Shared packages, fast installs |
| Bundle (track.js) | esbuild | Sub-second builds, smallest output |
| AI | Anthropic Claude API | Structured suggestions from analytics data |

---

## 8. Distribution Strategy

**Primary channel: Framer Marketplace**
- Plugin listed at `framer.com/marketplace/plugins/frame-first`
- Review timeline: ~7 days initial check + ~14 days design review = budget 5 weeks
- Plugin is fully testable via Framer dev mode (localhost) before marketplace approval

**Beta strategy (runs during review period):**
- Share dev plugin URL directly with 10–20 Framer users
- They enable Developer Tools in Framer → load URL → fully working
- Get real data, fix real bugs before public launch

**Community:**
- Framer Discord (40k+ members) — #landing-pages, #growth, #analytics channels
- Framer Community forum
- Twitter/X build-in-public around real conversion data from own sites

**Creator partnerships:**
- Framer template creators and tutorial YouTubers — free Pro + affiliate link
- Target: 3–4 active creators with 10k–100k followers in the Framer space

**UTM links as standalone hook:**
- `go.framefirst.io/xyz` works without any site installation
- Marketers use the link builder for campaigns before installing tracking
- Freemium entry point — upgrade when they want heatmaps + A/B tests

---

## 9. Competitor Context

| Tool | What they do | Our gap |
|---|---|---|
| Flowpoint Analytics | Framer plugin, one-click tracking install | No A/B testing, no UTM intelligence, no AI suggestions |
| Hotjar | Heatmaps, session replay | Not Framer-native, complex, expensive |
| Mixpanel | Event analytics | No heatmaps, no A/B, not Framer-native |
| Google Analytics | Traffic analytics | No heatmaps, no A/B, hard to use for conversions |
| UTM.io | Link UTM management | No analytics, no A/B, no heatmaps |

Frame First's unique combination: Framer-native + heatmaps + A/B testing + UTM intelligence + AI suggestions in one product.

---

## 10. Framer Plugin Technical Notes

- `framer.setCustomCode({ html, location })` — injects script into head/body of all published pages
- `framer.getPublishInfo()` — returns staging and production URLs, deploy time
- `framer.getCurrentUser()` — returns Framer user email (pre-fill auth)
- `framer.setPluginData(key, value)` / `framer.getPluginData(key)` — persist data across sessions
- `framer.getCustomCode()` — check if snippet is installed and whether user disabled it
- Plugin runs from localhost during development — no marketplace approval needed for testing
- `framer:click` and `framer:formsubmit` — native Framer events track.js listens to
- Private plugins available for beta testing by contacting Framer directly

---

## 11. What "Done" Looks Like for v1

- [ ] track.js collecting events from a real live Framer site
- [ ] Plugin installable from Framer marketplace (or dev URL for beta)
- [ ] Web dashboard showing real analytics data for a project
- [ ] Heatmap visible via Framer Plugin canvas overlay
- [ ] One A/B test running with real variant assignment
- [ ] UTM link created, clicked, tracked through to conversion
- [ ] Mobile app showing live visitor count and sending one push notification
- [ ] First paying customer

---

*Last updated: based on planning conversations. Update version number when major decisions change.*
