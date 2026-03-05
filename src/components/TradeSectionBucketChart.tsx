import { useState, useMemo } from "react";
import { Trade } from "@/types/trade";
import {
  buildTradeSectionBucketData,
  type TradeSectionDimension,
  type BucketRow,
} from "@/utils/tradeSectionBuckets";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

const CHART_HEIGHT = 420;

const OVERLAY_OPTIONS: { id: keyof BucketRow; label: string; color: string }[] = [
  { id: "trades", label: "Trades", color: "hsl(var(--chart-1))" },
  { id: "shares", label: "Shares", color: "hsl(var(--chart-2))" },
  { id: "mistakes", label: "Mistakes", color: "hsl(var(--destructive))" },
  { id: "profitFactor", label: "Profit Factor", color: "hsl(var(--chart-3))" },
  { id: "winPct", label: "W vs L %", color: "hsl(var(--success))" },
];

interface TradeSectionBucketChartProps {
  trades: Trade[];
  dimension: TradeSectionDimension;
}

export function TradeSectionBucketChart({ trades, dimension }: TradeSectionBucketChartProps) {
  const [overlays, setOverlays] = useState<Record<string, boolean>>({
    trades: true,
    shares: true,
    mistakes: false,
    profitFactor: false,
    winPct: false,
  });

  const bucketData = useMemo(
    () => buildTradeSectionBucketData(trades, dimension),
    [trades, dimension]
  );

  const chartData = useMemo(() => (bucketData.length === 0 ? [] : bucketData), [bucketData]);

  const activeOverlays = useMemo(
    () => OVERLAY_OPTIONS.filter((opt) => overlays[opt.id]),
    [overlays]
  );
  const hasOverlay = activeOverlays.length > 0;
  const rightMargin = 20 + activeOverlays.length * 48;
  const tooltipStyle: React.CSSProperties = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
  };

  if (bucketData.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-12 text-muted-foreground text-sm">
        No data for this view. Add trades or adjust filters.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex flex-col min-h-[500px]">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <span className="text-sm font-semibold text-foreground">{dimension}</span>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <Checkbox checked disabled className="pointer-events-none opacity-80" />
            P&L
          </label>
          {OVERLAY_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={cn(
                "flex items-center gap-2 text-sm cursor-pointer",
                overlays[opt.id] ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <Checkbox
                checked={!!overlays[opt.id]}
                onCheckedChange={(c) =>
                  setOverlays((prev) => ({ ...prev, [opt.id]: !!c }))
                }
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-[380px]">
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: rightMargin, bottom: 60, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              angle={chartData.length > 8 ? -45 : 0}
              textAnchor={chartData.length > 8 ? "end" : "middle"}
              height={chartData.length > 8 ? 72 : 36}
              interval={0}
            />
            <YAxis
              yAxisId="left"
              orientation="left"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => {
                const n = Number(v);
                if (!Number.isFinite(n)) return "—";
                const abs = Math.abs(n);
                if (abs >= 1000) return `${n < 0 ? "-" : ""}$${(abs / 1000).toFixed(0)}k`;
                return `$${n}`;
              }}
              label={{
                value: "P&L",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
              }}
            />
            {activeOverlays.map((opt, index) => {
              const maxVal = chartData.length
                ? Math.max(
                    ...chartData.map((d) => {
                      const v = d[opt.id];
                      return typeof v === "number" && Number.isFinite(v) ? v : 0;
                    }),
                    1
                  )
                : 1;
              const domain: [number, number] =
                opt.id === "winPct"
                  ? [0, 100]
                  : opt.id === "profitFactor"
                    ? [0, Math.min(10, Math.max(maxVal, 1))]
                    : [0, maxVal];
              const tickFormatter = (v: number) =>
                opt.id === "shares" && v >= 1000
                  ? `${(v / 1000).toFixed(0)}k`
                  : opt.id === "winPct"
                    ? `${Number(v).toFixed(0)}%`
                    : Number.isFinite(v) ? String(Math.round(v)) : "—";
              return (
                <YAxis
                  key={opt.id}
                  yAxisId={`right-${opt.id}`}
                  orientation="right"
                  stroke={opt.color}
                  tick={{ fontSize: 10, fill: opt.color }}
                  width={44}
                  domain={domain}
                  tickFormatter={tickFormatter}
                  axisLine={{ stroke: opt.color }}
                  label={{
                    value: opt.label,
                    angle: 90,
                    position: "insideRight",
                    style: { fontSize: 10, fill: opt.color },
                  }}
                />
              );
            })}
            <Tooltip
              contentStyle={tooltipStyle}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as BucketRow;
                const pnlStr = Number.isFinite(p.pnl) ? `$${p.pnl.toFixed(2)}` : "—";
                return (
                  <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
                    <div className="font-medium text-foreground mb-1">{p.name}</div>
                    <div className="text-muted-foreground space-y-0.5">
                      <div>P&L: {pnlStr}</div>
                      <div>Trades: {p.trades}</div>
                      <div>Shares: {p.shares.toLocaleString()}</div>
                      <div>Mistakes: {p.mistakes}</div>
                      <div>Profit Factor: {Number.isFinite(p.profitFactor) ? p.profitFactor.toFixed(2) : "—"}</div>
                      <div>Win %: {Number.isFinite(p.winPct) ? `${p.winPct.toFixed(1)}%` : "—"}</div>
                    </div>
                  </div>
                );
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="pnl" radius={[4, 4, 0, 0]} name="P&L">
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    entry.pnl >= 0
                      ? "hsl(var(--success))"
                      : "hsl(var(--destructive))"
                  }
                />
              ))}
            </Bar>
            {activeOverlays.map((opt) => (
              <Line
                key={opt.id}
                yAxisId={`right-${opt.id}`}
                type="monotone"
                dataKey={opt.id}
                stroke={opt.color}
                strokeWidth={2}
                dot={{ r: 2 }}
                name={opt.label}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
