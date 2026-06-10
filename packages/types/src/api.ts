import type { EventRow } from "./events.js";

export type ApiError = {
  error: string;
  code: string;
};

export type OkResponse = {
  ok: true;
};

type CollectRequiredFields =
  | "site_id"
  | "session_id"
  | "anonymous_id"
  | "event_type"
  | "url";

export type CollectRequest = Pick<EventRow, CollectRequiredFields> &
  Partial<Omit<EventRow, CollectRequiredFields>>;

export type CollectResponse = OkResponse;

export type ConversionGoalType = "pageview" | "click" | "event";

export type ConversionGoal = {
  type: ConversionGoalType;
  value: string;
};

export type Project = {
  id: string;
  userId: string;
  name: string;
  siteUrl: string | null;
  snippetKey: string;
  allowedDomains: string[];
  conversionGoal: ConversionGoal | null;
  createdAt: string;
  updatedAt: string;
  isActive?: boolean;
};

export type CreateProjectRequest = {
  name: string;
  siteUrl?: string;
  allowedDomains?: string[];
};

export type CreateProjectResponse = {
  project: Project;
  scriptTag: string;
};

export type ListProjectsResponse = {
  projects: Project[];
};

export type AnalyticsSummary = {
  visitors: number;
  pageviews: number;
  sessions: number;
  bounceRate: number;
  avgSessionDuration: number;
  cvr: number | null;
};

export type AnalyticsResponse = {
  summary: AnalyticsSummary;
  chart: Array<{ date: string; visitors: number; pageviews: number }>;
  topPages: Array<{ url: string; pageviews: number; visitors: number }>;
  topReferrers: Array<{ referrer: string; visitors: number }>;
  devices: Array<{ device: string; count: number }>;
  countries: Array<{ country: string; visitors: number }>;
  utmSources: Array<{ utm_source: string; visitors: number; cvr: number | null }>;
};

export type LiveVisitorsEvent = {
  count: number;
};

export type UtmLink = {
  id: string;
  slug: string;
  destinationUrl: string;
  clicks: number;
  cvr: number;
  topCountry: string;
  visitors: number;
  conversions: number;
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  destination?: string;
};

export type AbTestVariant = {
  id: string;
  name: string;
  weight: number;
  visitors: number;
  conversions: number;
  cvr: number;
  probabilityBest: number;
};

export type AbTest = {
  id: string;
  name: string;
  status: string;
  variants: AbTestVariant[];
  goalEvent?: { type: string; value: string };
  goal?: string;
  winnerVariantId?: string | null;
  winnerId?: string | null;
  visitors: number;
  daysRunning: number;
};

export type NotificationRule = {
  id: string;
  label: string;
  threshold: number | null;
  enabled: boolean;
};

export type ProjectSettings = {
  conversionGoal: { type: string; value: string };
  notifications: NotificationRule[];
};
