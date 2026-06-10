import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

type MetricCardProps = {
  label: string;
  value: string;
  sub: string;
  delta?: string;
  trend?: number[];
  trendLabel?: string;
  tone?: "neutral" | "good" | "warn";
  variant?: "default" | "sparkline";
  activeRange?: string;
  featured?: boolean;
};

const defaultTrend = [18, 22, 46, 31, 34, 25, 39, 36, 43, 33, 52, 47, 42, 29, 55, 38, 45, 44, 58];

export function MetricCard({
  delta,
  label,
  trend = defaultTrend,
  trendLabel,
  tone = "neutral",
  value,
  sub,
  variant = "default",
  activeRange = "1M",
  featured = false
}: MetricCardProps) {
  if (variant === "sparkline") {
    const isDown = delta?.trim().startsWith("-");
    const TrendIcon = isDown ? TrendingDown : TrendingUp;

    return (
      <Card className={`overflow-hidden shadow-sm ${tone}${featured ? " border-zinc-400" : ""}`}>
        <CardContent className="p-4 flex flex-col justify-between h-full min-h-[188px]">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-muted-foreground">{label}</div>
              <div className="text-2xl font-bold">{value}</div>
            </div>
            <span className="text-muted-foreground" aria-hidden="true">
              <ArrowRight size={16} />
            </span>
          </div>
          <Sparkline points={trend} tone={tone} />
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mt-2">
            <TrendIcon size={13} aria-hidden="true" className={tone === "good" ? "text-emerald-500" : tone === "warn" ? "text-red-500" : ""} />
            <span className={tone === "good" ? "text-emerald-500" : tone === "warn" ? "text-red-500" : ""}>{trendLabel ?? delta ?? sub}</span>
          </div>
          <div className="mt-2 grid grid-cols-6 gap-1 text-[11px] font-semibold text-muted-foreground text-center" aria-hidden="true">
            {["1D", "1W", "1M", "3M", "6M", "1Y"].map((range) => (
              <span className={`grid place-items-center min-h-[22px] rounded-sm ${range === activeRange ? "bg-muted text-foreground" : ""}`} key={range}>
                {range}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{sub}</span>
          {delta ? (
            <span
              className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                tone === "good"
                  ? "bg-emerald-100 text-emerald-800"
                  : tone === "warn"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-zinc-100 text-zinc-800"
              }`}
            >
              {delta}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function Sparkline({
  points,
  tone
}: {
  points: number[];
  tone: "neutral" | "good" | "warn";
}) {
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = Math.max(max - min, 1);
  const coordinates = points.map((point, index) => {
    const x = (index / Math.max(points.length - 1, 1)) * 220;
    const y = 76 - ((point - min) / range) * 66;

    return [x, y] as const;
  });
  const line = coordinates
    .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${line} L 220 82 L 0 82 Z`;

  return (
    <svg className={`metric-sparkline ${tone}`} viewBox="0 0 220 84" role="img" aria-hidden="true">
      <path className="spark-area" d={area} />
      <path className="spark-line" d={line} />
    </svg>
  );
}
