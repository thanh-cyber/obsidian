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
    getValue: (t) => t.pnl,
    aggregate: "sum",
  },
  {
    id: "pnlPct",
    label: "P&L (%)",
    format: "percentage",
    getValue: (t) => t.pnlPercentage ?? 0,
    aggregate: "avg",
  },
  {
    id: "duration",
    label: "Duration (min)",
    format: "minutes",
    getValue: (t) => t.duration ?? 0,
    aggregate: "avg",
  },
  {
    id: "holdTimeHours",
    label: "Hold time (hours)",
    format: "hours",
    getValue: (t) => (t.duration ?? 0) / 60,
    aggregate: "avg",
  },
  {
    id: "positionSize",
    label: "Position size",
    format: "number",
    getValue: (t) => Math.abs(t.positionSize),
    aggregate: "avg",
  },
  {
    id: "entryPrice",
    label: "Entry price",
    format: "number",
    getValue: (t) => t.entryPrice,
    aggregate: "avg",
  },
  {
    id: "exitPrice",
    label: "Exit price",
    format: "number",
    getValue: (t) => t.exitPrice,
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
      return trade.strategyTag ?? "Other";
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
  const m1 = METRICS.find((m) => m.id === metric1Id)!;
  const m2 = metric2Id ? METRICS.find((m) => m.id === metric2Id) : null;

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
