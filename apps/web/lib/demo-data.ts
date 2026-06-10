import type {
  AbTest,
  AnalyticsResponse,
  ListProjectsResponse,
  Project,
  ProjectSettings,
  UtmLink,
} from "@framefirst/types/api";

export const DEMO_SITE_ID = "ff_demo_design";

const now = new Date().toISOString();

export const demoProject: Project = {
  id: "00000000-0000-4000-8000-000000000101",
  userId: "00000000-0000-4000-8000-000000000001",
  name: "Acme Landing Page",
  siteUrl: "https://acme.example.com",
  snippetKey: DEMO_SITE_ID,
  allowedDomains: ["acme.example.com", "www.acme.example.com"],
  conversionGoal: { type: "pageview", value: "/pricing" },
  createdAt: now,
  updatedAt: now,
  isActive: true,
};

export const demoProjects: ListProjectsResponse = {
  projects: [
    demoProject,
    {
      ...demoProject,
      id: "00000000-0000-4000-8000-000000000102",
      name: "Mobile App Waitlist",
      siteUrl: "https://waitlist.example.com",
      snippetKey: "ff_demo_waitlist",
      isActive: false,
    },
    {
      ...demoProject,
      id: "00000000-0000-4000-8000-000000000103",
      name: "Docs & Blog",
      siteUrl: "https://docs.example.com",
      snippetKey: "ff_demo_docs",
      isActive: true,
    },
  ],
};

export const demoAnalytics: AnalyticsResponse = {
  summary: {
    visitors: 12840,
    pageviews: 31250,
    sessions: 15420,
    bounceRate: 38.4,
    avgSessionDuration: 184,
    cvr: 4.8,
  },
  chart: [
    { date: "2026-06-02", visitors: 1420, pageviews: 3480 },
    { date: "2026-06-03", visitors: 1680, pageviews: 4010 },
    { date: "2026-06-04", visitors: 1910, pageviews: 4520 },
    { date: "2026-06-05", visitors: 1760, pageviews: 4210 },
    { date: "2026-06-06", visitors: 2100, pageviews: 5120 },
    { date: "2026-06-07", visitors: 1980, pageviews: 4890 },
    { date: "2026-06-08", visitors: 1990, pageviews: 5020 },
  ],
  topPages: [
    { url: "/", pageviews: 11200, visitors: 6200 },
    { url: "/pricing", pageviews: 8400, visitors: 5100 },
    { url: "/features", pageviews: 5200, visitors: 3800 },
    { url: "/blog/launch", pageviews: 3100, visitors: 2400 },
    { url: "/signup", pageviews: 3350, visitors: 2900 },
  ],
  topReferrers: [
    { referrer: "google.com", visitors: 4200 },
    { referrer: "newsletter", visitors: 2800 },
    { referrer: "twitter.com", visitors: 1600 },
    { referrer: "producthunt.com", visitors: 980 },
  ],
  devices: [
    { device: "mobile", count: 7200 },
    { device: "desktop", count: 4800 },
    { device: "tablet", count: 840 },
  ],
  countries: [
    { country: "US", visitors: 4200 },
    { country: "GB", visitors: 1800 },
    { country: "DE", visitors: 1200 },
    { country: "IN", visitors: 980 },
    { country: "CA", visitors: 760 },
  ],
  utmSources: [
    { utm_source: "newsletter", visitors: 2800, cvr: 5.2 },
    { utm_source: "google", visitors: 4200, cvr: 4.1 },
    { utm_source: "twitter", visitors: 1600, cvr: 3.4 },
    { utm_source: "producthunt", visitors: 980, cvr: 6.8 },
  ],
};

export const demoLinks: UtmLink[] = [
  {
    id: "link-1",
    slug: "launch-email",
    destinationUrl: "https://acme.example.com/pricing",
    destination: "https://acme.example.com/pricing",
    source: "newsletter",
    medium: "email",
    campaign: "spring-launch",
    term: "",
    content: "hero-cta",
    clicks: 1840,
    cvr: 5.6,
    topCountry: "US",
    visitors: 1420,
    conversions: 80,
  },
  {
    id: "link-2",
    slug: "twitter-thread",
    destinationUrl: "https://acme.example.com/features",
    destination: "https://acme.example.com/features",
    source: "twitter",
    medium: "social",
    campaign: "founder-thread",
    term: "",
    content: "thread-link",
    clicks: 920,
    cvr: 3.9,
    topCountry: "GB",
    visitors: 710,
    conversions: 28,
  },
];

export const demoAbTests: AbTest[] = [
  {
    id: "ab-1",
    name: "Pricing hero CTA",
    status: "running",
    goalEvent: { type: "click", value: "#pricing-cta" },
    goal: "click #pricing-cta",
    winnerVariantId: null,
    winnerId: null,
    visitors: 4200,
    daysRunning: 12,
    variants: [
      {
        id: "v-a",
        name: "Start free trial",
        weight: 50,
        visitors: 2100,
        conversions: 126,
        cvr: 6.0,
        probabilityBest: 72,
      },
      {
        id: "v-b",
        name: "See pricing",
        weight: 50,
        visitors: 2100,
        conversions: 98,
        cvr: 4.7,
        probabilityBest: 28,
      },
    ],
  },
  {
    id: "ab-2",
    name: "Signup form length",
    status: "completed",
    goalEvent: { type: "pageview", value: "/welcome" },
    goal: "pageview /welcome",
    winnerVariantId: "v-short",
    winnerId: "v-short",
    visitors: 1800,
    daysRunning: 21,
    variants: [
      {
        id: "v-short",
        name: "Short form",
        weight: 50,
        visitors: 900,
        conversions: 162,
        cvr: 18.0,
        probabilityBest: 91,
      },
      {
        id: "v-long",
        name: "Long form",
        weight: 50,
        visitors: 900,
        conversions: 108,
        cvr: 12.0,
        probabilityBest: 9,
      },
    ],
  },
];

export const demoSettings: ProjectSettings = {
  conversionGoal: { type: "pageview", value: "/pricing" },
  notifications: [
    { id: "n-1", label: "traffic_spike", threshold: 500, enabled: true },
    { id: "n-2", label: "conversion_drop", threshold: 2, enabled: false },
  ],
};

export type HeatmapReport = {
  totalClicks: number;
  topElements: Array<{ selector: string; share: number }>;
  points: Array<{ x_pct: number; y_pct: number; count: number }>;
};

export const demoHeatmap: HeatmapReport = {
  totalClicks: 4820,
  topElements: [
    { selector: "button.hero-cta", share: 28.4 },
    { selector: "a.pricing-link", share: 18.2 },
    { selector: "nav.primary", share: 12.6 },
  ],
  points: [
    { x_pct: 52, y_pct: 18, count: 420 },
    { x_pct: 48, y_pct: 62, count: 310 },
    { x_pct: 72, y_pct: 44, count: 180 },
    { x_pct: 30, y_pct: 78, count: 140 },
    { x_pct: 64, y_pct: 28, count: 220 },
  ],
};

export function demoProjectForSite(siteId: string): Project {
  const match = demoProjects.projects.find((project) => project.snippetKey === siteId);
  return match ?? { ...demoProject, snippetKey: siteId, name: demoProject.name };
}
