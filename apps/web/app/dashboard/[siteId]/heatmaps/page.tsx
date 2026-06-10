import { Flame, MousePointerClick, SlidersHorizontal } from "lucide-react";

import { HeatmapExplorer } from "../../../../components/heatmap-explorer";
import { MetricCard } from "../../../../components/metric-card";
import { getAnalytics, getHeatmap, getProject } from "../../../../lib/api";

type PageProps = {
  params: {
    siteId: string;
  };
};

export default async function HeatmapsPage({ params }: PageProps) {
  const [heatmap, project] = await Promise.all([
    getHeatmap(params.siteId),
    getProject(params.siteId)
  ]);
  const analytics = await getAnalytics(params.siteId);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Heatmaps</h1>
          <p>{project.name}</p>
        </div>
        <div className="page-actions">
          <button className="button" type="button">
            <SlidersHorizontal size={16} aria-hidden="true" />
            Page filter
          </button>
        </div>
      </div>

      <section className="grid metrics">
        <MetricCard
          label="Total clicks"
          value={formatNumber(heatmap.totalClicks)}
          sub="Selected page"
          delta="+14.8%"
          tone="good"
        />
        <MetricCard
          label="Hot element"
          value={heatmap.topElements[0]?.selector ?? "--"}
          sub="Most clicked selector"
        />
        <MetricCard
          label="CTA share"
          value={formatPercent(heatmap.topElements[0]?.share ?? 0)}
          sub="Of all clicks"
          delta="+5.2%"
          tone="good"
        />
        <MetricCard
          label="Dead clicks"
          value="7.1%"
          sub="Non-interactive areas"
          delta="-1.6%"
          tone="good"
        />
      </section>

      <HeatmapExplorer
        heatmap={heatmap}
        pageOptions={analytics.topPages.map((page) => page.url)}
      />
    </>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}
