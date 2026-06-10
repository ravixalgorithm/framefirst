"use client";

import React, { useState, useRef, useEffect, type PointerEvent } from "react";

type TrafficPoint = {
  date: string;
  visitors: number;
  pageviews: number;
};

type TrafficMetric = "visitors" | "pageviews";

type ChartCoordinate = {
  date: string;
  value: number;
  x: number;
  y: number;
};

const chartHeight = 260;
const chartPadding = {
  bottom: 10,
  left: 40, // Increased to fit Y-axis labels outside the grid
  right: 20,
  top: 22
};
const tooltipHeight = 76;
const tooltipWidth = 166;

export function TrafficBars({ points }: { points: TrafficPoint[] }) {
  const [selectedIndex, setSelectedIndex] = useState(Math.max(points.length - 1, 0));
  const [chartWidth, setChartWidth] = useState(720);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setChartWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Generate the last 7 days up to today
  const paddedPoints = React.useMemo(() => {
    const today = new Date();
    const days = [];
    const pointsByDate = new Map(
      points.map((point) => [point.date.slice(0, 10), point] as const)
    );

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().slice(0, 10);
      const existing = pointsByDate.get(dateString);
      
      days.push({
        date: dateString,
        visitors: existing?.visitors ?? 0,
        pageviews: existing?.pageviews ?? 0
      });
    }
    return days;
  }, [points]);

  const dataMax = Math.max(
    ...paddedPoints.flatMap((point) => [point.visitors, point.pageviews]),
    1
  );
  
  // Ensure the chart always leaves ~15-20% empty space above the highest data point for a cleaner look
  const max = Math.ceil(dataMax * 1.15) + (dataMax <= 10 ? 1 : 0);
  
  // Helpers depend on chartWidth now
  const xStep = (pointCount: number) => {
    const innerWidth = chartWidth - chartPadding.left - chartPadding.right;
    return pointCount > 1 ? innerWidth / (pointCount - 1) : innerWidth;
  };

  const coordinatesFor = (pts: TrafficPoint[], metric: TrafficMetric): ChartCoordinate[] => {
    const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
    const step = xStep(pts.length);
    return pts.map((point, index) => {
      const value = point[metric];
      return {
        date: point.date,
        value,
        x: chartPadding.left + step * index,
        y: chartPadding.top + (1 - value / max) * innerHeight
      };
    });
  };

  const visitors = coordinatesFor(paddedPoints, "visitors");
  const pageviews = coordinatesFor(paddedPoints, "pageviews");
  const firstPoint = paddedPoints[0];
  const firstVisitor = visitors[0];
  const firstPageview = pageviews[0];

  if (!firstPoint || !firstVisitor || !firstPageview) {
    return <div className="p-4 text-center text-sm text-muted-foreground">No traffic yet.</div>;
  }

  const activeIndex = clamp(selectedIndex, 0, paddedPoints.length - 1);
  const activePoint = paddedPoints[activeIndex] ?? firstPoint;
  const activeVisitor = visitors[activeIndex] ?? firstVisitor;
  const activePageview = pageviews[activeIndex] ?? firstPageview;
  
  const innerHeight = chartHeight - chartPadding.top - chartPadding.bottom;
  let step = 1;
  if (max > 12) step = Math.ceil(max / 5);
  
  const ticks = [];
  for (let i = 0; i <= max; i += step) {
    ticks.push({
      ratio: i / max,
      value: i,
      y: chartPadding.top + (1 - i / max) * innerHeight
    });
  }

  const tooltipX = clamp(
    activePageview.x - tooltipWidth / 2,
    chartPadding.left,
    chartWidth - chartPadding.right - tooltipWidth
  );

  function selectNearestPoint(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * chartWidth;
    const nearestIndex = Math.round((svgX - chartPadding.left) / xStep(paddedPoints.length));
    setSelectedIndex(clamp(nearestIndex, 0, paddedPoints.length - 1));
  }

  return (
    <div ref={containerRef} className="w-full relative group" aria-label="Daily traffic">
      <div className="absolute top-0 right-4 flex items-center gap-4 text-xs font-medium text-muted-foreground z-10 bg-background/80 px-2 py-1 rounded-md backdrop-blur-sm">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-muted-foreground" />
          Visitors
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Pageviews
        </span>
      </div>

      <svg
        className="w-full select-none"
        style={{ height: chartHeight }}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        preserveAspectRatio="none"
        role="img"
        onPointerMove={selectNearestPoint}
        onPointerLeave={() => setSelectedIndex(points.length - 1)}
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {ticks.map((tick) => (
          <g key={tick.ratio}>
            <text className="fill-muted-foreground text-[10px] font-medium" x={chartPadding.left - 8} y={tick.y + 3} textAnchor="end">
              {formatCompact(tick.value)}
            </text>
            <line
              className="stroke-border stroke-[1.5px] opacity-40"
              x1={chartPadding.left}
              x2={chartWidth - chartPadding.right}
              y1={tick.y}
              y2={tick.y}
            />
          </g>
        ))}

        {/* Lines with Glow */}
        <path className="fill-none stroke-muted-foreground stroke-[2px] transition-all duration-300" style={{ filter: 'url(#glow)' }} d={straightPath(visitors)} />
        <path className="fill-none stroke-primary stroke-[2px] transition-all duration-300" style={{ filter: 'url(#glow)' }} d={straightPath(pageviews)} />
        
        {/* Permanent Line Points */}
        {visitors.map((p, i) => (
          <circle key={`v-${i}`} cx={p.x} cy={p.y} r="3" className="fill-background stroke-muted-foreground stroke-[2px]" style={{ filter: 'url(#glow)' }} />
        ))}
        {pageviews.map((p, i) => (
          <circle key={`p-${i}`} cx={p.x} cy={p.y} r="3" className="fill-background stroke-primary stroke-[2px]" style={{ filter: 'url(#glow)' }} />
        ))}
        
        {/* Active Hover Elements */}
        <line
          className="stroke-foreground/30 stroke-[1.5px] opacity-0 group-hover:opacity-100 transition-opacity"
          strokeDasharray="4"
          x1={activePageview.x}
          x2={activePageview.x}
          y1={chartPadding.top}
          y2={chartHeight - chartPadding.bottom}
        />
        <circle className="fill-background stroke-muted-foreground stroke-[2.5px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" cx={activeVisitor.x} cy={activeVisitor.y} r="5.5" />
        <circle className="fill-background stroke-primary stroke-[2.5px] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" cx={activePageview.x} cy={activePageview.y} r="5.5" />
        
        {/* Original White Card Tooltip */}
        <g className="opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none drop-shadow-md" transform={`translate(${tooltipX} ${chartPadding.top + 8})`}>
          <rect className="fill-card stroke-border stroke-1" width={tooltipWidth} height={tooltipHeight} rx="6" />
          <text className="fill-foreground text-xs font-semibold" x="12" y="24">
            {formatShortDate(activePoint.date)}
          </text>
          <text className="fill-muted-foreground text-xs" x="12" y="46">
            Visitors
          </text>
          <text className="fill-foreground text-xs font-medium text-right" x={tooltipWidth - 12} y="46" textAnchor="end">
            {formatCompact(activePoint.visitors)}
          </text>
          <text className="fill-muted-foreground text-xs" x="12" y="64">
            Pageviews
          </text>
          <text className="fill-foreground text-xs font-medium text-right" x={tooltipWidth - 12} y="64" textAnchor="end">
            {formatCompact(activePoint.pageviews)}
          </text>
        </g>
      </svg>


      <div className="flex justify-between text-xs text-muted-foreground mt-1 select-none relative" style={{ marginLeft: chartPadding.left, marginRight: chartPadding.right }}>
        {paddedPoints.map((p, i) => (
          <span key={i} className="text-center absolute whitespace-nowrap" style={{ left: `${(i / (paddedPoints.length - 1)) * 100}%`, transform: 'translateX(-50%)' }}>
            {formatShortDate(p.date)}
          </span>
        ))}
        {/* Invisible spacer to give the container height */}
        <span className="opacity-0">{formatShortDate(paddedPoints[0]?.date ?? "")}</span>
      </div>
    </div>
  );
}

function straightPath(points: ChartCoordinate[]): string {
  const [first, ...rest] = points;

  if (!first) {
    return "";
  }

  let path = `M ${first.x} ${first.y}`;

  for (const point of rest) {
    path += ` L ${point.x} ${point.y}`;
  }

  return path;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: "compact"
  }).format(value);
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short"
  }).format(new Date(value));
}
