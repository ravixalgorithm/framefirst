"use client";

import { useMemo, useState } from "react";

import type { HeatmapReport } from "../lib/demo-data";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type HeatmapExplorerProps = {
  heatmap: HeatmapReport;
  pageOptions: string[];
};

export function HeatmapExplorer({ heatmap, pageOptions }: HeatmapExplorerProps) {
  const [selectedPage, setSelectedPage] = useState(pageOptions[0] ?? "/");

  const maxCount = useMemo(
    () => Math.max(...heatmap.points.map((point) => point.count), 1),
    [heatmap.points]
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-lg">Click heatmap</CardTitle>
        <select
          className="rounded-lg border bg-background px-3 py-2 text-sm"
          value={selectedPage}
          onChange={(event) => setSelectedPage(event.target.value)}
        >
          {pageOptions.map((page) => (
            <option key={page} value={page}>
              {page}
            </option>
          ))}
        </select>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl border bg-muted/30">
          <div className="absolute inset-0 bg-gradient-to-b from-background/40 to-background/80" />
          {heatmap.points.map((point) => (
            <span
              key={`${point.x_pct}-${point.y_pct}`}
              className="heatmap-layer absolute rounded-full bg-orange-500/70 blur-md"
              style={{
                left: `${point.x_pct}%`,
                top: `${point.y_pct}%`,
                width: `${24 + (point.count / maxCount) * 48}px`,
                height: `${24 + (point.count / maxCount) * 48}px`,
                transform: "translate(-50%, -50%)",
                opacity: 0.35 + (point.count / maxCount) * 0.45,
              }}
            />
          ))}
          <div className="absolute inset-x-0 bottom-0 bg-background/90 px-4 py-3 text-sm text-muted-foreground">
            Preview for <span className="font-medium text-foreground">{selectedPage}</span>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {heatmap.topElements.map((element) => (
            <div key={element.selector} className="rounded-lg border px-3 py-2 text-sm">
              <div className="font-medium">{element.selector}</div>
              <div className="text-muted-foreground">{element.share.toFixed(1)}% of clicks</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
