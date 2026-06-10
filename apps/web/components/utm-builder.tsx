"use client";

import { Copy, ExternalLink, Link2, MousePointerClick, Plus, Target, Trash2, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { MetricCard } from "./metric-card";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import type { UtmLink } from "../lib/api";

type UtmBuilderProps = {
  siteId: string;
  initialLinks: UtmLink[];
};

const shortBase = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/go` : "http://localhost:3000/go";

export function UtmBuilder({ siteId, initialLinks }: UtmBuilderProps) {
  const router = useRouter();
  const [links, setLinks] = useState(initialLinks);
  const [destination, setDestination] = useState("https://example.com/pricing");
  const [source, setSource] = useState("newsletter");
  const [medium, setMedium] = useState("email");
  const [campaign, setCampaign] = useState("launch");
  const [term, setTerm] = useState("");
  const [content, setContent] = useState("hero");
  const [customSlug, setCustomSlug] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generatedSlug = useMemo(() => slugify(`${source}-${campaign}`), [campaign, source]);
  const slug = slugify(customSlug) || generatedSlug;
  const preview = `${shortBase}/${slug || "campaign"}`;
  const totalClicks = links.reduce((total, link) => total + link.clicks, 0);
  const totalVisitors = links.reduce((total, link) => total + link.visitors, 0);
  const totalConversions = links.reduce((total, link) => total + link.conversions, 0);
  const bestLink = [...links].sort((a, b) => b.conversions - a.conversions)[0];
  const destinationPreview = useMemo(
    () => buildTrackedUrl({ campaign, content, destination, medium, source, term }),
    [campaign, content, destination, medium, source, term]
  );

  async function addLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!isValidHttpUrl(destination)) {
      setError("Enter a valid destination URL, including https://.");
      return;
    }

    if (!source.trim() || !campaign.trim()) {
      setError("Source and campaign are required.");
      return;
    }

    setIsSubmitting(true);
    const safeSlug = uniqueSlug(slug || "campaign", links);

    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: siteId,
          slug: safeSlug,
          destinationUrl: destination,
          utmSource: source,
          utmMedium: medium,
          utmCampaign: campaign,
          utmTerm: term || undefined,
          utmContent: content || undefined,
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create link");
      }

      const next = await response.json();
      setLinks((current) => [next, ...current]);
      setCustomSlug("");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyValue(id: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(id);
    window.setTimeout(() => setCopied(null), 1400);
  }

  async function deleteLink(id: string) {
    if (pendingDelete !== id) {
      setPendingDelete(id);
      return;
    }

    try {
      const response = await fetch(`/api/links/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete link");
      }
      setLinks((current) => current.filter((link) => link.id !== id));
      router.refresh();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    } finally {
      setPendingDelete(null);
    }
  }

  function parseExistingUrl() {
    setError(null);

    try {
      const url = new URL(destination);
      setSource(url.searchParams.get("utm_source") ?? source);
      setMedium(url.searchParams.get("utm_medium") ?? medium);
      setCampaign(url.searchParams.get("utm_campaign") ?? campaign);
      setTerm(url.searchParams.get("utm_term") ?? "");
      setContent(url.searchParams.get("utm_content") ?? "");
    } catch {
      setError("Paste a valid URL before parsing UTM parameters.");
    }
  }

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          label="Links"
          value={String(links.length)}
          sub="Active campaigns"
        />
        <MetricCard
          label="Clicks"
          value={formatNumber(totalClicks)}
          sub="All tracked links"
        />
        <MetricCard
          label="Campaign CVR"
          value={formatPercent(totalVisitors === 0 ? 0 : (totalConversions / totalVisitors) * 100)}
          sub="Visitor conversion"
        />
        <MetricCard
          label="Best campaign"
          value={bestLink?.campaign ?? "--"}
          sub={bestLink ? `${bestLink.conversions} conversions` : "No data"}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-xl">Create link</CardTitle>
            <Link2 size={18} className="text-muted-foreground" aria-hidden="true" />
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={addLink}>
              <div className="flex flex-col gap-2">
                <label htmlFor="destination" className="text-sm font-medium">Destination</label>
                <Input
                  id="destination"
                  type="url"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                />
              </div>
              <Button variant="outline" type="button" onClick={parseExistingUrl} className="w-full sm:w-auto">
                Parse existing UTM URL
              </Button>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="source" className="text-sm font-medium">Source</label>
                  <Input
                    id="source"
                    value={source}
                    onChange={(event) => setSource(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="medium" className="text-sm font-medium">Medium</label>
                  <select
                    id="medium"
                    value={medium}
                    onChange={(event) => setMedium(event.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="email">email</option>
                    <option value="social">social</option>
                    <option value="paid">paid</option>
                    <option value="referral">referral</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label htmlFor="campaign" className="text-sm font-medium">Campaign</label>
                  <Input
                    id="campaign"
                    value={campaign}
                    onChange={(event) => setCampaign(event.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label htmlFor="content" className="text-sm font-medium">Content</label>
                  <Input
                    id="content"
                    value={content}
                    onChange={(event) => setContent(event.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="term" className="text-sm font-medium">Term</label>
                <Input
                  id="term"
                  placeholder="Optional paid keyword"
                  value={term}
                  onChange={(event) => setTerm(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="slug" className="text-sm font-medium">Custom slug</label>
                <Input
                  id="slug"
                  placeholder={generatedSlug || "launch-campaign"}
                  value={customSlug}
                  onChange={(event) => setCustomSlug(event.target.value)}
                />
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-md border text-sm mt-6">
                <span className="truncate mr-4 flex-1">{preview}</span>
                <Button variant="secondary" size="sm" type="button" onClick={() => copyValue("preview", preview)}>
                  <Copy size={14} className="mr-2" aria-hidden="true" />
                  {copied === "preview" ? "Copied" : "Copy"}
                </Button>
              </div>
              <code className="block p-3 bg-muted/30 rounded-md border text-xs text-muted-foreground break-all mt-2">
                {destinationPreview}
              </code>
              {error ? <div className="text-sm text-destructive font-medium mt-2">{error}</div> : null}
              <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
                <Plus size={16} className="mr-2" aria-hidden="true" />
                Create link
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              {links.map((link) => {
                const cvr = link.visitors === 0 ? 0 : (link.conversions / link.visitors) * 100;
                const shortUrl = `${shortBase}/${link.slug}`;

                return (
                  <article className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 rounded-lg border bg-card text-card-foreground shadow-sm gap-4" key={link.id}>
                    <div className="flex flex-col flex-1 min-w-0">
                      <strong className="text-sm font-semibold truncate">{shortUrl}</strong>
                      <span className="text-xs text-muted-foreground truncate">{link.destination}</span>
                    </div>
                    <div className="flex flex-wrap md:flex-nowrap items-center gap-3 sm:gap-6 text-sm text-muted-foreground w-full md:w-auto">
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">{link.clicks}</span> clicks
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-medium text-foreground">{cvr.toFixed(1)}%</span> CVR
                      </div>
                      <div className="flex items-center gap-1 truncate max-w-[100px] sm:max-w-none">
                        {link.topCountry || "Unknown"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end md:justify-start border-t md:border-0 pt-3 md:pt-0">
                      <Button variant="ghost" size="sm" type="button" onClick={() => copyValue(link.id, shortUrl)} className="text-muted-foreground hover:text-foreground">
                        <Copy size={15} className="mr-2" aria-hidden="true" />
                        {copied === link.id ? "Copied" : "Copy"}
                      </Button>
                      <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground">
                        <a href={link.destination} target="_blank" rel="noreferrer">
                          <ExternalLink size={15} className="mr-2" aria-hidden="true" />
                          Open
                        </a>
                      </Button>
                      <Button variant="ghost" size="sm" type="button" onClick={() => deleteLink(link.id)} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                        <Trash2 size={15} className="mr-2" aria-hidden="true" />
                        {pendingDelete === link.id ? "Confirm" : "Delete"}
                      </Button>
                    </div>
                  </article>
                );
              })}
              {links.length === 0 ? (
                <div className="p-8 text-center border rounded-lg border-dashed text-sm text-muted-foreground">
                  No campaign links yet. Create one to start tracking source quality.
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function storageKey(siteId: string): string {
  return `framefirst:${siteId}:utm-links`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function parseLinks(value: string, fallback: UtmLink[]): UtmLink[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as UtmLink[]) : fallback;
  } catch {
    return fallback;
  }
}

function uniqueSlug(base: string, links: UtmLink[]): string {
  const existing = new Set(links.map((link) => link.slug));

  if (!existing.has(base)) {
    return base;
  }

  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}`;

    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return `${base}-${Date.now().toString(36)}`;
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function buildTrackedUrl({
  campaign,
  content,
  destination,
  medium,
  source,
  term
}: {
  campaign: string;
  content: string;
  destination: string;
  medium: string;
  source: string;
  term: string;
}): string {
  try {
    const url = new URL(destination);
    url.searchParams.set("utm_source", source);
    url.searchParams.set("utm_medium", medium);
    url.searchParams.set("utm_campaign", campaign);

    if (term) {
      url.searchParams.set("utm_term", term);
    }

    if (content) {
      url.searchParams.set("utm_content", content);
    }

    return url.toString();
  } catch {
    const params = new URLSearchParams({
      utm_source: source,
      utm_medium: medium,
      utm_campaign: campaign
    });

    if (term) {
      params.set("utm_term", term);
    }

    if (content) {
      params.set("utm_content", content);
    }

    return `${destination}?${params.toString()}`;
  }
}
