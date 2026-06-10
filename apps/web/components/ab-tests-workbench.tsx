"use client";

import { FlaskConical, Pause, Play, Target, TestTube2, Trash2, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { MetricCard } from "./metric-card";
import type { AbTest, AbTestVariant } from "../lib/api";

export function AbTestsWorkbench({
  initialTests
}: {
  initialTests: AbTest[];
}) {
  const [tests, setTests] = useState(initialTests);
  const [isMutating, setIsMutating] = useState(false);
  const router = useRouter();
  const running = tests.filter((test) => test.status === "running").length;
  const winnerReady = tests.filter((test) => test.winnerId).length;
  const totalVisitors = tests.reduce(
    (total, test) =>
      total + test.variants.reduce((variantTotal, variant) => variantTotal + variant.visitors, 0),
    0
  );

  useEffect(() => {
    setTests(initialTests);
  }, [initialTests]);

  function toggleStatus(id: string, currentStatus: string) {
    if (isMutating) return;
    setIsMutating(true);
    fetch(`/api/ab-tests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: currentStatus === "paused" ? "running" : "paused" })
    }).then(() => {
      setIsMutating(false);
      router.refresh();
    }).catch(() => setIsMutating(false));
  }

  function declareWinner(id: string, winnerVariantId: string | null) {
    if (isMutating) return;
    setIsMutating(true);
    fetch(`/api/ab-tests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "complete", winnerVariantId })
    }).then(() => {
      setIsMutating(false);
      router.refresh();
    }).catch(() => setIsMutating(false));
  }



  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          label="Tests"
          value={String(tests.length)}
          sub="Total experiments"
        />
        <MetricCard
          label="Running"
          value={String(running)}
          sub="Collecting data"
        />
        <MetricCard
          label="Visitors"
          value={formatNumber(totalVisitors)}
          sub="In experiments"
        />
        <MetricCard
          label="Winners"
          value={String(winnerReady)}
          sub="Ready to ship"
          tone={winnerReady > 0 ? "good" : "neutral"}
        />
      </section>

      <section className="grid gap-6">
        <div className="grid gap-6">
          {tests.map((test) => {
            const leader = [...test.variants].sort(
              (a, b) => b.probabilityBest - a.probabilityBest
            )[0];

            return (
              <Card key={test.id}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-semibold">{test.name}</CardTitle>
                    <CardDescription>
                      {test.goalEvent ? `${goalLabel(test.goalEvent.type as any)} ${test.goalEvent.value}` : "No goal"}
                    </CardDescription>
                  </div>
                  <Badge variant={test.status === "running" ? "default" : "secondary"}>
                    {test.status}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                    <span>{test.daysRunning} days</span>
                    <span>{leader?.name ?? "--"} leading</span>
                    {test.winnerId ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <Trophy size={14} aria-hidden="true" />
                        Winner selected
                      </span>
                    ) : null}
                  </div>
                  <div className="space-y-4">
                    {test.variants.map((variant: AbTestVariant) => (
                      <div className="space-y-2" key={variant.id}>
                        <div className="flex items-center justify-between text-sm">
                          <strong className="font-medium text-foreground">{variant.name}</strong>
                          <span className="font-medium text-foreground">{variant.cvr.toFixed(1)}% CVR</span>
                        </div>
                        <div className="h-2 w-full bg-secondary overflow-hidden rounded-full">
                          <div className="h-full bg-primary" style={{ width: `${variant.probabilityBest}%` }} />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{variant.visitors} visitors</span>
                          <span>{variant.conversions} conversions</span>
                          <span>{variant.probabilityBest}% best</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
                <CardFooter className="flex gap-3">
                  <Button
                    variant="outline"
                    disabled={test.status === "complete" || isMutating}
                    onClick={() => toggleStatus(test.id, test.status)}
                  >
                    {test.status === "paused" ? (
                      <Play size={16} className="mr-2" aria-hidden="true" />
                    ) : (
                      <Pause size={16} className="mr-2" aria-hidden="true" />
                    )}
                    {test.status === "paused" ? "Resume" : "Pause"}
                  </Button>
                  <Button 
                    variant="default"
                    disabled={isMutating} 
                    onClick={() => declareWinner(test.id, leader?.id ?? null)}
                  >
                    <Trophy size={16} className="mr-2" aria-hidden="true" />
                    Declare winner
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

function goalLabel(type: "pageview" | "click" | "custom"): string {
  if (type === "pageview") {
    return "Visit";
  }

  if (type === "click") {
    return "Click";
  }

  return "Event";
}

function goalPlaceholder(type: "pageview" | "click" | "custom"): string {
  if (type === "pageview") {
    return "/thank-you";
  }

  if (type === "click") {
    return ".primary-cta";
  }

  return "signup_completed";
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || `variant-${Date.now().toString(36)}`;
}
