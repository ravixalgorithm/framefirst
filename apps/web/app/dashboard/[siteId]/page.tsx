import { notFound } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  ExternalLink,
  Globe2,
  Info,
  Link2
} from "lucide-react";

import { AudienceMap } from "../../../components/audience-map";
import { DataTable } from "../../../components/data-table";
import { LiveVisitors } from "../../../components/live-visitors";
import { TrafficBars } from "../../../components/traffic-bars";
import { getAnalytics, getProject } from "../../../lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../../../components/ui/card";
import { Button } from "../../../components/ui/button";

export const dynamic = "force-dynamic";

type PageProps = {
  params: {
    siteId: string;
  };
};

export default async function DashboardPage({ params }: PageProps) {
  const [analytics, project] = await Promise.all([
    getAnalytics(params.siteId),
    getProject(params.siteId)
  ]);

  if (!project) {
    notFound();
  }

  const totalUtmVisitors = analytics.utmSources.reduce(
    (total, source) => total + source.visitors,
    0
  );
  const utmVisitorBase = Math.max(totalUtmVisitors, 1);
  const sessionFrequency = analytics.summary.sessions / Math.max(analytics.summary.visitors, 1);

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-12 sm:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-transparent">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">{project.name}</p>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-4 sm:mt-0">
          <LiveVisitors siteId={params.siteId} />
          {project.siteUrl ? (
            <Button variant="outline" asChild className="w-full sm:w-auto">
              <a href={project.siteUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} className="mr-2" aria-hidden="true" />
                Open site
              </a>
            </Button>
          ) : null}
        </div>
      </div>

      {/* TRAFFIC SECTION */}
      <section className="bg-card rounded-xl border shadow-sm flex flex-col pt-4 sm:pt-6">
        <div className="px-4 sm:px-6 mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Traffic performance</h2>
              <Info size={14} className="text-muted-foreground" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">{formatNumber(analytics.summary.visitors)}</span>
            </div>
            <div className="text-sm text-muted-foreground pt-2">
              You gained <span className="text-primary font-medium">{formatNumber(analytics.summary.visitors)} visitors</span> last 7 days. That's a solid trend.
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-violet-100 text-violet-800 px-3.5 py-1.5 rounded-full text-sm font-semibold shrink-0 w-fit mt-2 sm:mt-8 border border-violet-200 ">
            <ArrowUpRight size={16} strokeWidth={2.5} />
            Increased by {formatPercent((analytics.summary.visitors / Math.max(analytics.summary.pageviews, 1)) * 100)}
          </div>
        </div>
        <div className="pb-4 sm:pb-6 -mx-2 sm:mx-4">
          <TrafficBars points={analytics.chart} />
        </div>
      </section>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[2fr_1fr]">
        
        {/* QUALITY & SUMMARY */}
        <section className="bg-card rounded-xl border shadow-sm flex flex-col p-4 sm:p-6 space-y-6">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold sm:text-lg">Session quality</h2>
            <Info size={14} className="text-muted-foreground" />
          </div>
          <div className="space-y-4">
            <div className="flex items-baseline justify-between border-b sm:border-0 pb-3 sm:pb-0">
              <span className="text-2xl font-bold">{formatNumber(analytics.summary.pageviews)}</span>
              <span className="text-sm text-muted-foreground">Pageviews</span>
            </div>
            <div className="flex items-baseline justify-between border-b sm:border-0 pb-3 sm:pb-0">
              <span className="text-2xl font-bold">{formatNumber(analytics.summary.sessions)}</span>
              <span className="text-sm text-muted-foreground">Sessions</span>
            </div>
            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground flex items-center gap-2">
                Frequency
              </span>
              <strong className="font-semibold">{sessionFrequency.toFixed(1)}</strong>
            </div>
            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground flex items-center gap-2">
                Duration
              </span>
              <strong className="font-semibold">{formatDuration(analytics.summary.avgSessionDuration)}</strong>
            </div>
            <div className="flex items-center justify-between text-sm py-1">
              <span className="text-muted-foreground flex items-center gap-2">
                Bounce rate
              </span>
              <strong className="font-semibold">{formatPercent(analytics.summary.bounceRate)}</strong>
            </div>
          </div>
        </section>

        {/* SOURCES / DISCOVERY */}
        <section className="bg-card rounded-xl border shadow-sm flex flex-col p-4 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold sm:text-lg">Discovery</h2>
            <Info size={14} className="text-muted-foreground" />
          </div>
          {analytics.utmSources.map((source) => (
            <div key={source.utm_source} className="flex items-center justify-between text-sm border-b sm:border-0 pb-3 sm:pb-0">
              <span className="text-foreground font-medium truncate mr-2">{labelFromSource(source.utm_source)}</span>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{formatNumber(source.visitors)}</span>
                <strong className="font-semibold w-10 text-right">{formatPercent((source.visitors / utmVisitorBase) * 100)}</strong>
              </div>
            </div>
          ))}
          {analytics.utmSources.length === 0 ? (
            <div className="text-sm text-muted-foreground">No campaign sources recorded yet.</div>
          ) : null}
        </section>

        {/* TOP PAGES */}
        <section className="bg-card rounded-xl border shadow-sm flex flex-col pt-4 sm:pt-6 lg:col-span-2">
          <div className="px-4 sm:px-6 flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold sm:text-lg">Top performing pages</h2>
            <Info size={14} className="text-muted-foreground" />
          </div>
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <div className="flex flex-col gap-4">
              {analytics.topPages.map((page, i) => (
                <div key={i} className="flex flex-col p-4 border rounded-lg bg-card shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-muted-foreground">{formatNumber(page.pageviews)} Pageviews • {formatNumber(page.visitors)} Visitors</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-primary -mt-1 -mr-2">View details</Button>
                  </div>
                  <div className="font-medium text-sm truncate">{page.url}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* AUDIENCE MAP */}
        <section className="bg-card rounded-xl border shadow-sm flex flex-col pt-4 sm:pt-6 lg:col-span-2">
          <div className="px-4 sm:px-6 flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold sm:text-lg">Audience location</h2>
            <Info size={14} className="text-muted-foreground" />
          </div>
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
            <AudienceMap countries={analytics.countries} />
          </div>
        </section>

        {/* TOP REFERRERS */}
        <section className="bg-card rounded-xl border shadow-sm flex flex-col pt-4 sm:pt-6 lg:col-span-2">
          <div className="px-4 sm:px-6 flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold sm:text-lg">Top referrers</h2>
            <Info size={14} className="text-muted-foreground" />
          </div>
          <div className="px-4 sm:px-6 pb-4 sm:pb-6">
             <div className="flex flex-col gap-4">
              {analytics.topReferrers.map((referrer, i) => (
                <div key={i} className="flex flex-col p-4 border rounded-lg bg-card shadow-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs text-muted-foreground">{formatNumber(referrer.visitors)} Visitors</span>
                    <Button variant="ghost" size="sm" className="h-6 text-xs text-primary -mt-1 -mr-2">View details</Button>
                  </div>
                  <div className="font-medium text-sm truncate">{referrer.referrer}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

function SummaryItem({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <div className="text-sm font-medium text-muted-foreground mb-2">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{detail}</div>
    </div>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return `${minutes}m ${remainingSeconds}s`;
}

function labelFromSource(source: string): string {
  return source
    .split(/[-_\s]+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
