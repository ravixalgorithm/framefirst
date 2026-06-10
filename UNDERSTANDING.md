# Frame First - My Understanding

This file is my current read of the product from `PRD.md`, `TASKS.md`, `AGENT.md`,
and your latest corrections. It is meant to be corrected before implementation starts.

## Product Summary

Frame First is a conversion intelligence platform that starts with a general website
tracking script and later adds a deeper Framer-native plugin.

The original wedge is Framer, but the early release should not be limited to Framer.
Anyone who can paste a script tag into a site should be able to use Frame First.

The core promise is:

> Most analytics tools show what happened. Frame First tells users what to do next.

## Product Surfaces

1. General Tracking Script
   - This is the earliest release path.
   - Works for any website, not just Framer.
   - User creates a project in the dashboard and copies one script tag.
   - The script tag goes into the global site `<head>`, theme, template, or app layout.
   - Once installed globally, it can collect analytics across the whole site.

2. Web Dashboard
   - The main analytics and setup app at `app.framefirst.io`.
   - Users create projects, get their script tag, view analytics, configure goals,
     inspect heatmaps, create UTM links, and manage A/B tests.
   - This becomes the first product people can use before the Framer plugin is approved.

3. Framer Plugin
   - The Framer-native install and mini-dashboard experience.
   - It may ship later because Framer Marketplace validation takes time.
   - Existing users should be able to log in with the same account and see analytics
     for projects they already created manually.
   - The plugin can create or find a project, inject the same `track.js` snippet with
     `framer.setCustomCode()`, and show live/basic analytics inside Framer.

4. Mobile App
   - A read-only analytics companion app built with Expo.
   - Shows live visitors, current metrics, active A/B tests, and alert settings.
   - Sends push notifications for traffic spikes, CVR drops, A/B winners, and link milestones.

## Target Users

The intended users are non-technical but capable landing page and website owners:

- General website owners who can paste one script tag into a CMS, site builder, or codebase.
- Indie founders and solopreneurs with landing pages.
- Designers building client sites.
- Startups running paid traffic to landing pages.
- Framer users, still an important early niche.
- No-code builders who care about conversion but do not want implementation friction.

They understand concepts like CVR, campaigns, and landing page optimization.

## Core Product Loop

The earliest loop is:

1. User creates an account in the web dashboard.
2. User creates a project.
3. Frame First generates a public `site_id` / `snippetKey`.
4. Dashboard shows a script tag for that project.
5. User pastes the script tag into the global site layout.
6. `track.js` runs on every page where it is installed.
7. `track.js` sends events to `POST /collect`.
8. API validates the `site_id`, queues the event, and responds immediately.
9. Worker writes event data to ClickHouse.
10. Dashboard reads analytics from the API and shows the user what is happening.

The Framer plugin later becomes a faster install path for the same tracking system.

## One Script Tag Question

Yes, one script tag can collect analytics for the whole site if it is installed globally.

For example:

```html
<script src="https://cdn.framefirst.io/track.js" data-site="SITE_ID" async></script>
```

This works site-wide only when the script is included on every page. That usually means:

- In Framer: add it through site-level custom code, so it applies to all published pages.
- In Next.js: add it in the root layout.
- In WordPress: add it through the theme header or a global scripts plugin.
- In Webflow or similar builders: add it to global custom code.
- In a static site: add it to the shared HTML template.

If the user pastes it on only one page, Frame First can only collect analytics for that
one page.

For single-page apps, `track.js` should also detect client-side route changes using
history listeners, so navigation inside React, Next.js client routes, Framer, or other
SPA-like sites still produces pageview events.

## Technical Architecture

The repo is intended to be a pnpm monorepo:

```text
apps/api       Fastify backend and public APIs
apps/web       Next.js 14 dashboard
apps/plugin    Framer plugin built with Vite and React
apps/mobile    Expo React Native app
packages/db    Drizzle schema, Supabase/Postgres client, ClickHouse helpers
packages/types Shared TypeScript types and API contracts
```

Infrastructure:

- Supabase Postgres for app/product data in production.
- Local Postgres for development if useful.
- ClickHouse for high-volume event analytics.
- Redis for queues, live visitor state, rate limits, caching, and notification deduping.
- BullMQ for async event writes and background notification jobs.

## Data Model

Supabase Postgres owns relational product data:

- `users`
- `projects`
- `links`
- `ab_tests`
- `notification_rules`
- `devices`
- possibly `refresh_tokens` if we keep custom auth instead of Supabase Auth
- possibly `project_domains` if we want domain allowlisting

ClickHouse owns raw analytics events:

- pageviews
- clicks
- form submissions
- custom events
- UTM data
- anonymous/session IDs
- variant IDs
- URL/referrer/device/country fields

Redis owns short-lived operational state:

- live visitor sorted sets
- API rate limits
- analytics cache entries
- project validation cache
- notification deduplication keys

## Authentication Model

There are two different trust zones.

### Public Event Collection

`track.js` does not log in as a user.

It sends events with a public `site_id` / `snippetKey`. That identifier is not a secret.
It only tells Frame First which project the event belongs to.

`POST /collect` should:

- accept unauthenticated requests from websites
- validate that the `site_id` exists
- optionally validate the request origin/domain against allowed domains for the project
- rate-limit by `site_id`
- return `200 { ok: true }` even for invalid site IDs, so we do not leak project existence
- never expose private analytics data

This is similar to how analytics tools work: the tracking code is public, but dashboards
are private.

### Private Analytics Access

Dashboard, plugin, and mobile app require user login.

Authenticated APIs must verify that the logged-in user owns or has access to the project
before returning analytics, settings, links, tests, or notification rules.

The same account should work everywhere:

- user signs up in the web dashboard first
- user installs script manually and starts collecting data
- later user logs into the Framer plugin with the same email/account
- plugin finds existing projects and can show analytics or install tracking for Framer sites

### Supabase Auth Decision

Since we are already using Supabase Postgres, there are two reasonable auth paths:

1. Use Supabase Auth for email OTP/magic links.
   - Less custom auth code.
   - Supabase manages users, sessions, refresh tokens, and email OTP.
   - Fastest path for early release.

2. Use custom Fastify OTP/JWT auth with Supabase Postgres as the database.
   - More control.
   - More code to build and secure.
   - Requires our own refresh token table and lifecycle.

My recommendation for early release: use Supabase Auth unless there is a strong reason
to own auth ourselves.

## Data Concurrency Model

Many visitors can hit tracked sites at the same time. The tracking path should be fast
and should not wait on analytics writes.

Flow:

1. Visitor loads a tracked page.
2. `track.js` sends a pageview/click/custom event.
3. `POST /collect` validates the project quickly.
4. For pageviews, API updates Redis live visitor state.
5. API pushes the event into a BullMQ queue.
6. API immediately responds to the browser.
7. One or more workers consume queue jobs and write to ClickHouse.
8. Dashboard queries aggregate data from ClickHouse.
9. Expensive analytics responses can be cached in Redis for short periods.

This separates event collection from event processing:

- Public API stays fast.
- ClickHouse writes can be retried.
- Workers can be scaled independently.
- A traffic spike does not block visitors' websites.
- The dashboard can be eventually consistent by a few seconds.

## Event Pipeline

`track.js` should:

- stay below 8kb gzipped
- be dependency-free vanilla JavaScript
- never block rendering
- never throw uncaught errors
- generate and persist `anonymous_id` in localStorage
- generate `session_id` in sessionStorage and reset after 30 minutes of inactivity
- send pageview, click, formsubmit, and custom events
- track click coordinates as viewport-relative percentages
- parse UTM params on pageviews
- detect client-side route changes
- listen for Framer-specific `framer:click` and `framer:formsubmit` events when present
- fetch active A/B tests and attach assigned `variant_id` to subsequent events

## Main Features

### Analytics

Dashboard shows visitors, pageviews, sessions, bounce rate, average session duration,
CVR, charts, top pages, top referrers, devices, countries, and UTM source performance.

### Heatmaps

Clicks are stored as normalized coordinates and aggregated server-side on demand.
The web app renders them as a canvas overlay on top of an iframe or screenshot.

### UTM Links

Users can create short links at `go.framefirst.io/:slug` with UTM metadata.
The redirect handler logs the click and sends the visitor to the destination URL.

### A/B Testing

Variant assignment is deterministic:

```text
MurmurHash(anonymous_id + test_id) mod 100
```

Variant weights must sum to 100.
A winner is found when a variant exceeds 95 percent probability of being best.

### Conversion Goals

Each project can define one conversion goal:

- pageview URL
- element click selector
- custom event name

CVR means sessions that hit the goal divided by total sessions.

### Notifications

Mobile push notifications support:

- traffic spike
- CVR drop
- A/B test winner
- link milestone

### AI Advisor

The AI advisor is later-phase.
It reads analytics, heatmaps, funnels, A/B results, and UTM performance, then returns
ranked conversion suggestions.

## Revised Early Build Order

The earliest release should prioritize a generic script plus dashboard before waiting
for Framer plugin approval.

Suggested order:

1. Monorepo scaffold.
2. Supabase/Postgres schema and migrations.
3. Auth decision and implementation, preferably Supabase Auth for speed.
4. ClickHouse events table and insert helper.
5. Event ingest endpoint.
6. Generic `track.js`.
7. Dashboard project setup page that shows the script tag.
8. Analytics query layer.
9. Dashboard overview showing real data.
10. Live visitor SSE.
11. Heatmaps, UTM links, A/B tests, settings.
12. Framer plugin.
13. Mobile app.

## What V1 Means

V1 is done when:

- a user can sign up
- a user can create a project
- dashboard gives them one script tag
- any website can install that script tag
- events flow into ClickHouse
- dashboard shows real analytics
- at least one heatmap works
- UTM links work
- basic conversion goal tracking works
- Framer plugin can come after, without blocking the first release

## Important Engineering Rules

- TypeScript everywhere with strict mode.
- Shared types belong in `packages/types`; do not duplicate them.
- Every API route should have schema validation and typed request/response contracts.
- API errors should use `{ error, code }`.
- ClickHouse writes must happen through BullMQ, not directly inside request handlers.
- `track.js` must stay dependency-free and resilient.
- Protected routes must verify project ownership.
- Redis cache keys need TTLs.
- Web app uses Next.js App Router and Server Components by default.

## Things To Confirm

1. Should we use Supabase Auth for email OTP/magic login, or only Supabase Postgres?
2. Should each project include an allowed-domain list to prevent copied script tags from
   polluting analytics?
3. Should `site_id` and `snippetKey` be the same public identifier everywhere?
4. Should early V1 include Framer-specific native events, or should generic tracking ship
   first and Framer-specific enhancements come with the plugin?
5. Should A/B testing only measure variants that users create externally, or eventually
   modify page content too?
6. Should AI advisor data structures be prepared now, even if AI suggestions ship later?
