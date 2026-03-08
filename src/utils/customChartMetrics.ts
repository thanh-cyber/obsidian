import { Trade } from "@/types/trade";

export type ChartType = "line" | "bar" | "pie" | "area" | "scatter";

export type GroupByOption = "none" | "strategy" | "month" | "symbol" | "day";

export type MetricId =
  | "pnl"
  | "pnlPct"
  | "duration"
  | "holdTimeHours"
  | "positionSize"
  | "entryPrice"
  | "exitPrice"
  | "fees"
  | "win"
  | "tradeCount";

export interface MetricDef {
  id: MetricId;
  label: string;
  format: "currency" | "percentage" | "number" | "minutes" | "hours";
  getValue: (t: Trade) => number;
  aggregate: "sum" | "avg" | "count";
}

function getTradeFees(t: Trade): number {
  if (t.executionsList?.length) {
    return t.executionsList.reduce((s, e) => s + (e.fees ?? 0), 0);
  }
  return 0;
}

export const METRICS: MetricDef[] = [
  {
    id: "pnl",
    label: "P&L ($)",
    format: "currency",
    getValue: (t) => Number(t.pnl) || 0,
    aggregate: "sum",
  },
  {
    id: "pnlPct",
    label: "P&L (%)",
    format: "percentage",
    getValue: (t) => Number(t.pnlPercentage) || 0,
    aggregate: "avg",
  },
  {
    id: "duration",
    label: "Duration (min)",
    format: "minutes",
    getValue: (t) => Number(t.duration) || 0,
    aggregate: "avg",
  },
  {
    id: "holdTimeHours",
    label: "Hold time (hours)",
    format: "hours",
    getValue: (t) => (Number(t.duration) || 0) / 60,
    aggregate: "avg",
  },
  {
    id: "positionSize",
    label: "Position size",
    format: "number",
    getValue: (t) => Math.abs(Number(t.positionSize) || 0),
    aggregate: "avg",
  },
  {
    id: "entryPrice",
    label: "Entry price",
    format: "number",
    getValue: (t) => Number(t.entryPrice) || 0,
    aggregate: "avg",
  },
  {
    id: "exitPrice",
    label: "Exit price",
    format: "number",
    getValue: (t) => Number(t.exitPrice) || 0,
    aggregate: "avg",
  },
  {
    id: "fees",
    label: "Fees ($)",
    format: "currency",
    getValue: getTradeFees,
    aggregate: "sum",
  },
  {
    id: "win",
    label: "Win (1=win, 0=loss/BE)",
    format: "number",
    getValue: (t) => (t.pnl > 0.01 ? 1 : 0),
    aggregate: "sum",
  },
  {
    id: "tradeCount",
    label: "Trade count",
    format: "number",
    getValue: () => 1,
    aggregate: "count",
  },
];

export function getGroupKey(trade: Trade, groupBy: GroupByOption): string {
  switch (groupBy) {
    case "strategy":
      return trade.tradeStyle ?? trade.strategyTag ?? "Other";
    case "month": {
      const d = new Date(trade.exitDate);
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    }
    case "symbol":
      return trade.symbol;
    case "day": {
      const d = new Date(trade.exitDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    default:
      return "";
  }
}

export interface DataPoint {
  name: string;
  [key: string]: string | number;
}

export function buildChartData(
  trades: Trade[],
  groupBy: GroupByOption,
  metric1Id: MetricId,
  metric2Id: MetricId | null
): DataPoint[] {
  const m1 = METRICS.find((m) => m.id === metric1Id);
  const m2 = metric2Id ? METRICS.find((m) => m.id === metric2Id) : null;
  if (!m1) return [];

  if (groupBy === "none") {
    // Per-trade: each point is a trade (or index/date as name)
    const sorted = [...trades].sort(
      (a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
    );
    return sorted.map((t, i) => ({
      name: `#${i + 1}`,
      date: new Date(t.exitDate).toLocaleDateString(),
      symbol: t.symbol,
      x: m1.getValue(t),
      y: m2 ? m2.getValue(t) : m1.getValue(t),
      value: m1.getValue(t),
      value2: m2 ? m2.getValue(t) : undefined,
    }));
  }

  // Grouped
  const groups = new Map<
    string,
    { trades: Trade[]; name: string }
  >();
  trades.forEach((t) => {
    const key = getGroupKey(t, groupBy);
    if (!groups.has(key)) {
      groups.set(key, { trades: [], name: key });
    }
    groups.get(key)!.trades.push(t);
  });

  const agg = (list: Trade[], metric: MetricDef): number => {
    if (metric.aggregate === "count") return list.length;
    if (metric.aggregate === "sum") return list.reduce((s, t) => s + metric.getValue(t), 0);
    if (list.length === 0) return 0;
    return list.reduce((s, t) => s + metric.getValue(t), 0) / list.length;
  };

  return Array.from(groups.entries())
    .map(([key, { trades: list, name }]) => ({
      name,
      x: agg(list, m1),
      y: m2 ? agg(list, m2) : agg(list, m1),
      value: agg(list, m1),
      value2: m2 ? agg(list, m2) : undefined,
      count: list.length,
    }))
    .sort((a, b) => {
      if (groupBy === "day") return String(a.name).localeCompare(String(b.name));
      if (groupBy === "month") {
        const order = (n: string) => {
          const d = new Date(n);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };
        return order(a.name as string) - order(b.name as string);
      }
      return 0;
    });
}

export function formatMetricValue(value: number, format: MetricDef["format"]): string {
  if (!Number.isFinite(value)) return "—";
  switch (format) {
    case "currency":
      return `$${value.toFixed(2)}`;
    case "percentage":
      return `${value.toFixed(2)}%`;
    case "minutes":
      return `${Math.round(value)} min`;
    case "hours":
      return value < 1 ? `${(value * 60).toFixed(0)} min` : `${value.toFixed(2)} hr`;
    default:
      return Number.isFinite(value) ? value.toFixed(2) : "—";
  }
}

/** Bucket definition for bar chart distribution */
export interface BucketDef {
  min: number;
  max: number;
  label: string;
  isPositive: boolean;
}

/** Predefined buckets for metrics (clear ranges that cover the range) */
export function getBucketDefsForMetric(metricId: MetricId): BucketDef[] {
  switch (metricId) {
    case "pnl":
    case "fees":
      return [
        { min: -Infinity, max: -10000, label: "< -$10K", isPositive: false },
        { min: -10000, max: -2500, label: "-$10K to -$2.5K", isPositive: false },
        { min: -2500, max: -500, label: "-$2.5K to -$500", isPositive: false },
        { min: -500, max: 0, label: "-$500 to $0", isPositive: false },
        { min: 0, max: 500, label: "$0 to $500", isPositive: true },
        { min: 500, max: 1000, label: "$500 to $1K", isPositive: true },
        { min: 1000, max: 2500, label: "$1K to $2.5K", isPositive: true },
        { min: 2500, max: 5000, label: "$2.5K to $5K", isPositive: true },
        { min: 5000, max: 10000, label: "$5K to $10K", isPositive: true },
        { min: 10000, max: Infinity, label: "> $10K", isPositive: true },
      ];
    case "pnlPct":
      return [
        { min: -Infinity, max: -10, label: "< -10%", isPositive: false },
        { min: -10, max: -5, label: "-10% to -5%", isPositive: false },
        { min: -5, max: 0, label: "-5% to 0%", isPositive: false },
        { min: 0, max: 5, label: "0% to 5%", isPositive: true },
        { min: 5, max: 10, label: "5% to 10%", isPositive: true },
        { min: 10, max: 25, label: "10% to 25%", isPositive: true },
        { min: 25, max: Infinity, label: "> 25%", isPositive: true },
      ];
    case "duration":
      return [
        { min: 0, max: 30, label: "0-30 min", isPositive: true },
        { min: 30, max: 60, label: "30-60 min", isPositive: true },
        { min: 60, max: 120, label: "1-2 hr", isPositive: true },
        { min: 120, max: 240, label: "2-4 hr", isPositive: true },
        { min: 240, max: 480, label: "4-8 hr", isPositive: true },
        { min: 480, max: 1440, label: "8-24 hr", isPositive: true },
        { min: 1440, max: Infinity, label: "> 1 day", isPositive: true },
      ];
    case "holdTimeHours":
      return [
        { min: 0, max: 0.5, label: "0-30 min", isPositive: true },
        { min: 0.5, max: 1, label: "30-60 min", isPositive: true },
        { min: 1, max: 2, label: "1-2 hr", isPositive: true },
        { min: 2, max: 4, label: "2-4 hr", isPositive: true },
        { min: 4, max: 8, label: "4-8 hr", isPositive: true },
        { min: 8, max: 24, label: "8-24 hr", isPositive: true },
        { min: 24, max: Infinity, label: "> 1 day", isPositive: true },
      ];
    default:
      return [];
  }
}

/** Build bucketed data for bar chart: one bar per bucket with count. Empty buckets kept for clear range. */
export function buildBucketedBarData(
  values: number[],
  metricId: MetricId
): { name: string; count: number; isPositive: boolean }[] {
  const finite = values.filter((v) => Number.isFinite(v));
  const defs = getBucketDefsForMetric(metricId);
  if (defs.length === 0) {
    if (finite.length === 0) return [];
    const min = Math.min(...finite);
    const max = Math.max(...finite);
    const span = max - min || 1;
    const numBuckets = Math.min(10, Math.max(5, Math.ceil(finite.length / 5)));
    const step = span / numBuckets;
    const autoDefs: BucketDef[] = [];
    for (let i = 0; i < numBuckets; i++) {
      const low = min + i * step;
      const high = i === numBuckets - 1 ? max + 0.001 : min + (i + 1) * step;
      autoDefs.push({
        min: low,
        max: high,
        label: `${Number(low.toFixed(1))} - ${Number(high.toFixed(1))}`,
        isPositive: high >= 0,
      });
    }
    const counts = autoDefs.map(() => 0);
    finite.forEach((v) => {
      const i = autoDefs.findIndex((b) => v >= b.min && v < b.max);
      if (i >= 0) counts[i]++;
    });
    return autoDefs.map((b, i) => ({ name: b.label, count: counts[i], isPositive: b.isPositive }));
  }
  const counts = defs.map(() => 0);
  finite.forEach((v) => {
    const i = defs.findIndex((b) => v >= b.min && v < b.max);
    if (i >= 0) counts[i]++;
  });
  return defs.map((b, i) => ({ name: b.label, count: counts[i], isPositive: b.isPositive }));
}
