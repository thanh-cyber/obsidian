import type { ChartType, GroupByOption, MetricId } from "./customChartMetrics";

export type BuiltinChartVariant =
  | "cumulativePnl"
  | "winLoss"
  | "strategyPerformance"
  | "monthlyPnl"
  | "tradingInsights";

export interface CustomChartConfig {
  chartType: ChartType;
  groupBy: GroupByOption;
  metric1: MetricId;
  metric2: MetricId | null;
}

export type AnalyticsChartItem =
  | { id: string; type: "builtin"; variant: BuiltinChartVariant }
  | { id: string; type: "custom"; config: CustomChartConfig; title?: string };

const STORAGE_KEY = "obsidian-analytics-charts";

const DEFAULT_BUILTIN_ORDER: BuiltinChartVariant[] = [
  "cumulativePnl",
  "winLoss",
  "strategyPerformance",
  "monthlyPnl",
  "tradingInsights",
];

function defaultChartItems(): AnalyticsChartItem[] {
  return DEFAULT_BUILTIN_ORDER.map((variant, i) => ({
    id: `builtin-${variant}`,
    type: "builtin" as const,
    variant,
  }));
}

export function loadAnalyticsCharts(): AnalyticsChartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultChartItems();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return defaultChartItems();
    const items = parsed as AnalyticsChartItem[];
    // Migrate: add Trading Insights if missing (e.g. from before it was movable)
    const hasInsights = items.some(
      (i) => i.type === "builtin" && i.variant === "tradingInsights"
    );
    if (!hasInsights) {
      return [
        ...items,
        { id: "builtin-tradingInsights", type: "builtin", variant: "tradingInsights" },
      ];
    }
    return items;
  } catch {
    return defaultChartItems();
  }
}

export function saveAnalyticsCharts(items: AnalyticsChartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

/** Add a custom chart (e.g. from AI suggestion). Persists to localStorage so it appears on Analytics page. */
export function addCustomChartToAnalytics(
  config: CustomChartConfig,
  title?: string
): string {
  const items = loadAnalyticsCharts();
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  items.push({ id, type: "custom", config, title });
  saveAnalyticsCharts(items);
  return id;
}

export function getBuiltinChartTitle(variant: BuiltinChartVariant): string {
  switch (variant) {
    case "cumulativePnl":
      return "Cumulative P&L";
    case "winLoss":
      return "Win/Loss Distribution";
    case "strategyPerformance":
      return "Strategy Performance";
    case "monthlyPnl":
      return "Monthly P&L";
    case "tradingInsights":
      return "Trading Insights";
    default:
      return variant;
  }
}
