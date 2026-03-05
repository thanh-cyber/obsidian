import { Trade } from "@/types/trade";
import { getOverviewStats, getTradeMfeMae, getDailyPnL } from "@/utils/calculations";
import type { OverviewStats } from "@/utils/calculations";
import { METRICS } from "@/utils/customChartMetrics";
import type { ChartType, GroupByOption, MetricId } from "@/utils/customChartMetrics";

/** Cap on trades sent to avoid token limits; model can still search/filter within this set. */
const MAX_TRADES_IN_CONTEXT = 8000;
const MAX_DAILY_DAYS = 365;
const MAX_SYMBOLS = 100;

function fmt(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return String(v);
}

/** Build a complete data dump for the AI: all metrics, breakdowns, recent trades, daily PnL, and chart options. */
export function buildFullAppContext(trades: Trade[]): string {
  const sections: string[] = [];

  if (!trades.length) {
    return "The user has no trades in the current (filtered) view. All metrics are empty. You can still suggest charts they might use once they have data.";
  }

  const stats = getOverviewStats(trades) as OverviewStats;

  sections.push("=== OVERVIEW METRICS (all app metrics) ===");
  const overviewLines = [
    "Return $: totalPnl, accReturnGross, accReturnNet, returnOnWinners, returnOnLosers, returnOnLong, returnOnShort",
    `accReturnGross=${fmt(stats.accReturnGross)} accReturnNet=${fmt(stats.accReturnNet)} returnOnWinners=${fmt(stats.returnOnWinners)} returnOnLosers=${fmt(stats.returnOnLosers)} returnOnLong=${fmt(stats.returnOnLong)} returnOnShort=${fmt(stats.returnOnShort)}`,
    "Biggest: biggestProfit, biggestLoss, biggestPctProfit, biggestPctLoser",
    `biggestProfit=${fmt(stats.biggestProfit)} biggestLoss=${fmt(stats.biggestLoss)} biggestPctProfit=${fmt(stats.biggestPctProfit)}% biggestPctLoser=${fmt(stats.biggestPctLoser)}%`,
    "Ratios: profitLossRatio, profitFactor, tradeExpectancy, returnPerShare, returnPerSize",
    `profitLossRatio=${fmt(stats.profitLossRatio)} profitFactor=${fmt(stats.profitFactor)} tradeExpectancy=${fmt(stats.tradeExpectancy)} returnPerShare=${fmt(stats.returnPerShare)} returnPerSize=${fmt(stats.returnPerSize)}`,
    "Win/Loss/BE: winPct, lossPct, breakEvenPct, totalWinner, totalLosers, totalBE",
    `winPct=${fmt(stats.winPct)}% lossPct=${fmt(stats.lossPct)}% breakEvenPct=${fmt(stats.breakEvenPct)}% totalWinner=${stats.totalWinner} totalLosers=${stats.totalLosers} totalBE=${stats.totalBE}`,
    "Avg: avgReturn, avgOnWinners, avgOnLosers, avgReturnPct, avgPctOnWinners, avgPctOnLosers, avgPctOnLong, avgPctOnShort",
    `avgReturn=${fmt(stats.avgReturn)} avgOnWinners=${fmt(stats.avgOnWinners)} avgOnLosers=${fmt(stats.avgOnLosers)} avgReturnPct=${fmt(stats.avgReturnPct)}%`,
    "Hold time (minutes): avgHoldTime, avgWinHoldTime, avgLossHoldTime, avgBEHoldTime",
    `avgHoldTime=${fmt(stats.avgHoldTime)} avgWinHoldTime=${fmt(stats.avgWinHoldTime)} avgLossHoldTime=${fmt(stats.avgLossHoldTime)} avgBEHoldTime=${fmt(stats.avgBEHoldTime)}`,
    "Fees/Commission: totalFees, totalCommissions, totCom, totComWin, totComLoss, totComLong, totComShort, totComBE, avgFees",
    `totalFees=${fmt(stats.totalFees)} totCom=${fmt(stats.totCom)} totComWin=${fmt(stats.totComWin)} totComLoss=${fmt(stats.totComLoss)}`,
    "Risk/Quality: pnlStdDev, pnlStdDevW, pnlStdDevL, sqn, kellyCriterion",
    `pnlStdDev=${fmt(stats.pnlStdDev)} sqn=${fmt(stats.sqn)} kellyCriterion=${fmt(stats.kellyCriterion)}%`,
    "Counts: totalTrades, totalShares, maxConsecWin, maxConsecLoss",
    `totalTrades=${stats.totalTrades} totalShares=${fmt(stats.totalShares)} maxConsecWin=${stats.maxConsecWin} maxConsecLoss=${stats.maxConsecLoss}`,
    "Acc return %: accReturnPct",
    `accReturnPct=${stats.accReturnPct != null ? fmt(stats.accReturnPct) + "%" : "—"}`,
  ];
  const mfeMaeList = trades.map((t) => getTradeMfeMae(t));
  const avgMfe = mfeMaeList.length > 0 ? mfeMaeList.reduce((s, x) => s + x.mfe, 0) / mfeMaeList.length : 0;
  const avgMae = mfeMaeList.length > 0 ? mfeMaeList.reduce((s, x) => s + x.mae, 0) / mfeMaeList.length : 0;
  overviewLines.push("Avg position MFE/MAE ($) [from trades]: avgPositionMfe, avgPositionMae");
  overviewLines.push(`avgPositionMfe=${fmt(avgMfe)} avgPositionMae=${fmt(avgMae)}`);
  sections.push(overviewLines.join("\n"));

  const strategyMap = new Map<string, { count: number; pnl: number }>();
  trades.forEach((t) => {
    const key = t.strategyTag ?? "Other";
    const cur = strategyMap.get(key) ?? { count: 0, pnl: 0 };
    cur.count += 1;
    cur.pnl += Number(t.pnl) || 0;
    strategyMap.set(key, cur);
  });
  sections.push("\n=== STRATEGY BREAKDOWN ===");
  const strategyLines = Array.from(strategyMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, v]) => `  ${name}: trades=${v.count} pnl=$${v.pnl.toFixed(2)}`);
  sections.push(strategyLines.join("\n"));

  const symbolMap = new Map<string, { count: number; pnl: number }>();
  trades.forEach((t) => {
    const key = t.symbol ?? "?";
    const cur = symbolMap.get(key) ?? { count: 0, pnl: 0 };
    cur.count += 1;
    cur.pnl += Number(t.pnl) || 0;
    symbolMap.set(key, cur);
  });
  sections.push("\n=== SYMBOL BREAKDOWN (top by trade count) ===");
  const symbolLines = Array.from(symbolMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, MAX_SYMBOLS)
    .map(([sym, v]) => `  ${sym}: trades=${v.count} pnl=$${v.pnl.toFixed(2)}`);
  sections.push(symbolLines.join("\n"));

  const dailyPnL = getDailyPnL(trades);
  const sortedDates = Array.from(dailyPnL.keys()).sort();
  const recentDates = sortedDates.slice(-MAX_DAILY_DAYS);
  sections.push("\n=== DAILY P&L (by exit date) ===");
  const dailyLines = recentDates.map((d) => `  ${d}: $${(dailyPnL.get(d) ?? 0).toFixed(2)}`);
  sections.push(dailyLines.length ? dailyLines.join("\n") : "  (none)");

  const sortedTrades = [...trades].sort(
    (a, b) => new Date(b.exitDate).getTime() - new Date(a.exitDate).getTime()
  );
  const tradesToSend = sortedTrades.slice(0, MAX_TRADES_IN_CONTEXT);
  const truncated = sortedTrades.length > MAX_TRADES_IN_CONTEXT;

  const byDate = new Map<string, { count: number; symbols: string[]; pnl: number }>();
  tradesToSend.forEach((t) => {
    const d = t.exitDate.slice(0, 10);
    const cur = byDate.get(d) ?? { count: 0, symbols: [], pnl: 0 };
    cur.count += 1;
    if (!cur.symbols.includes(t.symbol)) cur.symbols.push(t.symbol);
    cur.pnl += Number(t.pnl) || 0;
    byDate.set(d, cur);
  });
  sections.push("\n=== TRADES BY DATE (index: exit date → count, symbols, daily P&L; use this to find dates then look up rows in ALL TRADES) ===");
  const byDateLines = Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => `  ${date}: ${v.count} trade(s), symbols=${v.symbols.join(", ")}, PnL=$${v.pnl.toFixed(2)}`);
  sections.push(byDateLines.join("\n"));

  sections.push("\n=== ALL TRADES (full list for search/filter; user can ask e.g. 'trades on 2024-03-15', 'trades in AAPL', 'losing trades last week') ===");
  if (truncated) {
    sections.push(`(Showing most recent ${MAX_TRADES_IN_CONTEXT} of ${sortedTrades.length} trades; ask for a specific date range if needed.)`);
  }
  sections.push("Columns: symbol, entryDate, exitDate, pnl, pnlPct, durationMin, strategy, positionSize, entryPrice, exitPrice, mfe, mae");
  const tradeRows = tradesToSend.map((t) => {
    const { mfe, mae } = getTradeMfeMae(t);
    return [
      t.symbol,
      t.entryDate.slice(0, 10),
      t.exitDate.slice(0, 10),
      (Number(t.pnl) || 0).toFixed(2),
      (Number(t.pnlPercentage) ?? 0).toFixed(2),
      Math.round(Number(t.duration) || 0),
      t.strategyTag ?? "Other",
      Number(t.positionSize) || 0,
      (Number(t.entryPrice) || 0).toFixed(2),
      (Number(t.exitPrice) || 0).toFixed(2),
      mfe.toFixed(2),
      mae.toFixed(2),
    ].join("\t");
  });
  sections.push("symbol\tentryDate\texitDate\tpnl\tpnlPct\tdurationMin\tstrategy\tpositionSize\tentryPrice\texitPrice\tmfe\tmae");
  sections.push(tradeRows.join("\n"));

  sections.push("\n=== CUMULATIVE P&L (by exit date, last 60 points) ===");
  const cumData = stats.cumulativeData ?? [];
  const cumTail = cumData.slice(-60);
  sections.push(cumTail.map((d) => `  ${d.date}: gross=$${d.gross.toFixed(2)} net=$${d.net.toFixed(2)}`).join("\n") || "  (none)");

  sections.push("\n=== CHART OPTIONS (you can suggest any chart; see instructions) ===");
  sections.push("chartTypes: line | bar | pie | area | scatter (use any type for any metric)");
  sections.push("groupBy: none | strategy | month | symbol | day (none=per-trade; strategy/month/symbol/day=aggregate by that dimension)");
  sections.push("metricIds: " + METRICS.map((m) => m.id).join(", "));
  sections.push("metric labels: " + METRICS.map((m) => `${m.id}=${m.label}`).join("; "));
  sections.push("You can combine ANY chartType + ANY groupBy + metric1 (+ optional metric2 for scatter/line/area). Examples: bar of pnl by strategy, line of duration by month, pie of tradeCount by symbol.");
  sections.push("BAR CHARTS AUTO-BIN: bar charts automatically bin data into ranges. For pnl/fees use $ buckets; pnlPct use % buckets; duration/holdTimeHours use time buckets; other metrics get auto buckets from min-max. Use bar + groupBy none + one metric for distribution histograms with clear buckets (e.g. bar of pnl shows trade count per $ range).");

  return sections.join("\n");
}

export const CHART_TYPES: ChartType[] = ["line", "bar", "pie", "area", "scatter"];
export const GROUP_BY_OPTIONS: GroupByOption[] = ["none", "strategy", "month", "symbol", "day"];
export const METRIC_IDS: MetricId[] = METRICS.map((m) => m.id);
