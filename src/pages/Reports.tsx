import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Trade } from "@/types/trade";
import { loadTrades } from "@/utils/storage";
import { useFilters } from "@/context/FilterContext";
import { useReportsSidebar } from "@/context/ReportsSidebarContext";
import { getDailyPnL, getOverviewStats } from "@/utils/calculations";
import { ReportsSidebar } from "@/components/ReportsSidebar";
import { MetricCard } from "@/components/MetricCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatAppDate } from "@/utils/appDateTime";
import { AnalyticsContent } from "@/components/AnalyticsContent";
import { MfeMaeCharts } from "@/components/MfeMaeCharts";
import { AIAnalyticDiveChat } from "@/components/AIAnalyticDiveChat";
import { TradeSectionBucketChart } from "@/components/TradeSectionBucketChart";
import type { TradeSectionDimension } from "@/utils/tradeSectionBuckets";

export const Reports = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeSection, setActiveSection] = useState("PERFORMANCE");
  const [activeItem, setActiveItem] = useState("Overview");
  const [accumulativeMode, setAccumulativeMode] = useState<"gross" | "net">("gross");
  const [searchParams] = useSearchParams();
  const reportsSidebar = useReportsSidebar();
  const sidebarCollapsed = reportsSidebar?.collapsed ?? false;
  const setSidebarCollapsed = reportsSidebar?.setCollapsed ?? (() => {});

  useEffect(() => {
    const loadedTrades = loadTrades();
    setTrades(loadedTrades);
  }, []);

  useEffect(() => {
    const item = searchParams.get("item");
    if (item === "Analytics") {
      setActiveSection("PERFORMANCE");
      setActiveItem("Analytics");
    }
  }, [searchParams]);

  const { applyFilters } = useFilters();
  const filteredTrades = applyFilters(trades);
  const dailyPnL = getDailyPnL(filteredTrades);
  const overview = getOverviewStats(filteredTrades);

  const handleItemClick = (section: string, item: string) => {
    setActiveSection(section);
    setActiveItem(item);
  };

  const TRADE_SECTION_ITEMS: TradeSectionDimension[] = [
    "Hourly", "Weekday", "Month", "Year", "Entry Price", "Cost", "Volume", "Side", "Hold Time",
  ];
  const isTradeSectionDimension = (item: string): item is TradeSectionDimension =>
    TRADE_SECTION_ITEMS.includes(item as TradeSectionDimension);

  const formatFactor = (v: number) =>
    Number.isFinite(v) && v < 1e10 ? v.toFixed(2) : v >= 1e10 ? "∞" : "—";

  const formatHoldTime = (min: number) => {
    if (min < 1) return "< 1 Min";
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    if (h >= 1) return m > 0 ? `${h} Hr ${m} Mins` : `${h} Hr${h !== 1 ? "s" : ""}`;
    return `${Math.round(min)} Mins`;
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <ReportsSidebar 
        activeSection={activeSection}
        activeItem={activeItem}
        onItemClick={handleItemClick}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
      />
      
      <div className="p-6 flex-1 flex flex-col min-h-0 overflow-auto">
        <>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-1">
              {activeSection} / {activeItem}
            </h1>
            <p className="text-sm text-muted-foreground">
              Detailed performance analytics and statistics
            </p>
          </div>

          {activeItem !== "Analytics" && !(activeSection === "AI" && activeItem === "AI Analytic Dive") && !(activeSection === "TRADE" && isTradeSectionDimension(activeItem)) && (
            <div className="flex gap-3">
              <Select defaultValue="line">
                <SelectTrigger className="w-32 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="line">Line</SelectItem>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="candle">Candle</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="trade">
                <SelectTrigger className="w-40 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="trade">By Trade</SelectItem>
                  <SelectItem value="day">By Day</SelectItem>
                  <SelectItem value="week">By Week</SelectItem>
                </SelectContent>
              </Select>

              <Select defaultValue="all">
                <SelectTrigger className="w-40 bg-secondary border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  <SelectItem value="all">Benchmark</SelectItem>
                  <SelectItem value="spy">SPY</SelectItem>
                  <SelectItem value="qqq">QQQ</SelectItem>
                </SelectContent>
              </Select>

              <Button className="bg-primary hover:bg-primary/90">
                Add Trade
              </Button>
            </div>
          )}
        </div>

        {activeItem === "Analytics" ? (
          <AnalyticsContent trades={filteredTrades} />
        ) : activeSection === "EXIT STATS" && activeItem === "MFE/MAE" ? (
          <MfeMaeCharts trades={filteredTrades} />
        ) : activeSection === "AI" && activeItem === "AI Analytic Dive" ? (
          <AIAnalyticDiveChat trades={filteredTrades} />
        ) : activeSection === "TRADE" && isTradeSectionDimension(activeItem) ? (
          <TradeSectionBucketChart trades={filteredTrades} dimension={activeItem as TradeSectionDimension} />
        ) : activeItem === "Overview" ? (
          <>
            {/* Accumulative Return Chart — always at top of Overview */}
            <div className="mb-6 bg-card border border-border rounded-lg p-4 min-h-[16rem] flex flex-col shrink-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    Accumulative Return {accumulativeMode === "gross" ? "Gross" : "Net"}
                  </span>
                  <span className="text-2xl font-bold text-foreground">
                    ${(accumulativeMode === "gross" ? overview.accReturnGross : overview.accReturnNet).toFixed(2)}
                  </span>
                </div>
                <div className="flex rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setAccumulativeMode("gross")}
                    className={`px-3 py-1.5 text-xs font-medium ${accumulativeMode === "gross" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}
                  >
                    Gross
                  </button>
                  <button
                    type="button"
                    onClick={() => setAccumulativeMode("net")}
                    className={`px-3 py-1.5 text-xs font-medium ${accumulativeMode === "net" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"}`}
                  >
                    Net
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-[12rem]">
                {overview.cumulativeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={overview.cumulativeData.map((d) => ({
                        ...d,
                        display: accumulativeMode === "gross" ? d.gross : d.net,
                        dateLabel: formatAppDate(new Date(d.date + "T12:00:00")),
                      }))}
                      margin={{ top: 4, right: 8, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                      <XAxis
                        dataKey="dateLabel"
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        stroke="hsl(var(--muted-foreground))"
                        tickFormatter={(v) => `$${v}`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.dateLabel}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, accumulativeMode === "gross" ? "Gross" : "Net"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="display"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={false}
                        name={accumulativeMode === "gross" ? "Gross" : "Net"}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No trade data — add trades to see accumulative return
                  </div>
                )}
              </div>
            </div>

            {/* Return $ */}
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Return $</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              <MetricCard title="Return on Winners" value={overview.returnOnWinners} data={filteredTrades.filter((t) => t.pnl > 0).map((t) => t.pnl)} trend="up" />
              <MetricCard title="Return on Losers" value={overview.returnOnLosers} data={filteredTrades.filter((t) => t.pnl < 0).map((t) => t.pnl)} trend="down" />
              <MetricCard title="Return $ on Long" value={overview.returnOnLong} trend={overview.returnOnLong >= 0 ? "up" : "down"} />
              <MetricCard title="Return $ on Short" value={overview.returnOnShort} trend={overview.returnOnShort >= 0 ? "up" : "down"} />
              <MetricCard title="Biggest Profit $" value={overview.biggestProfit} trend="up" />
              <MetricCard title="Biggest Loss $" value={overview.biggestLoss} trend="down" />
              <MetricCard title="Profit/Loss Ratio" value={formatFactor(overview.profitLossRatio) + ":1"} format="number" trend="neutral" />
              <MetricCard title="Tot. Com. Short" value={overview.totComShort} trend="neutral" />
              <MetricCard title="Tot. Com. BE" value={overview.totComBE} trend="neutral" />
              <MetricCard title="Tot. Com. Long" value={overview.totComLong} trend="neutral" />
              <MetricCard title="Tot. Com." value={overview.totCom} trend="neutral" />
              <MetricCard title="Profit Factor" value={formatFactor(overview.profitFactor)} format="number" trend="neutral" />
              <MetricCard title="Trade $ Expectancy" value={overview.tradeExpectancy} trend={overview.tradeExpectancy >= 0 ? "up" : "down"} />
              <MetricCard title="Account Balance" value={overview.accountBalance} data={overview.cumulativeData.map((d) => d.gross)} trend={overview.accountBalance >= 0 ? "up" : "down"} />
              <MetricCard title="Acc. Return Net $" value={overview.accReturnNet} data={overview.cumulativeData.map((d) => d.net)} trend={overview.accReturnNet >= 0 ? "up" : "down"} />
              <MetricCard title="Acc. Return Gross $" value={overview.accReturnGross} data={overview.cumulativeData.map((d) => d.gross)} trend={overview.accReturnGross >= 0 ? "up" : "down"} />
              <MetricCard title="Daily Return $" value={overview.dailyReturnDollar} trend={overview.dailyReturnDollar >= 0 ? "up" : "down"} />
            </div>

            {/* Performance */}
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Performance</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              <MetricCard title="PnL Std Dev" value={overview.pnlStdDev} format="number" trend="neutral" />
              <MetricCard title="PnL Std Dev (W)" value={overview.pnlStdDevW} format="number" trend="neutral" />
              <MetricCard title="PnL Std Dev (L)" value={overview.pnlStdDevL} format="number" trend="neutral" />
              <MetricCard title="SQN" value={formatFactor(overview.sqn)} format="number" trend="neutral" />
            </div>

            {/* Return % */}
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Return %</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              <MetricCard title="Win %" value={overview.winPct} format="percentage" trend="up" />
              <MetricCard title="Loss %" value={overview.lossPct} format="percentage" trend="down" />
              <MetricCard title="BE %" value={overview.breakEvenPct} format="percentage" trend="neutral" />
              <MetricCard title="Open %" value={overview.openPct} format="percentage" trend="neutral" />
              <MetricCard title="Acc. Return %" value={overview.accReturnPct != null ? overview.accReturnPct : "—"} format={overview.accReturnPct != null ? "percentage" : "number"} trend="up" />
              <MetricCard title="Biggest % Profit" value={overview.biggestPctProfit} format="percentage" trend="up" />
              <MetricCard title="Biggest % Loser" value={overview.biggestPctLoser} format="percentage" trend="down" />
              <MetricCard title="Return per Share" value={overview.returnPerShare} format="currency" trend="neutral" />
            </div>

            {/* Kelly Criterion */}
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Kelly Criterion</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              <MetricCard title="Kelly Criterion" value={overview.kellyCriterion} format="percentage" trend="neutral" />
            </div>

            {/* Avg Return */}
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Avg Return</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              <MetricCard title="Avg Return $" value={overview.avgReturn} trend={overview.avgReturn >= 0 ? "up" : "down"} />
              <MetricCard title="Return/Size" value={overview.returnPerSize} format="currency" trend="neutral" />
              <MetricCard title="Avg $ on Winners" value={overview.avgOnWinners} trend="up" />
              <MetricCard title="Avg $ on Losers" value={overview.avgOnLosers} trend="down" />
              <MetricCard title="Avg $ Position Mae" value={overview.avgPositionMae} trend="down" />
              <MetricCard title="Avg $ Position Mfe" value={overview.avgPositionMfe} trend="up" />
              <MetricCard title="Avg Daily P&L" value={overview.avgDailyPnl} trend={overview.avgDailyPnl >= 0 ? "up" : "down"} />
              <MetricCard title="Avg Return %" value={overview.avgReturnPct} format="percentage" trend={overview.avgReturnPct >= 0 ? "up" : "down"} />
              <MetricCard title="Avg % Return" value={overview.avgReturnPct} format="percentage" trend={overview.avgReturnPct >= 0 ? "up" : "down"} />
              <MetricCard title="Avg % on Shorts" value={overview.avgPctOnShort} format="percentage" trend="up" />
              <MetricCard title="Avg % on Long" value={overview.avgPctOnLong} format="percentage" trend="up" />
              <MetricCard title="Avg % on Winners" value={overview.avgPctOnWinners} format="percentage" trend="up" />
              <MetricCard title="Avg % on Losers" value={overview.avgPctOnLosers} format="percentage" trend="down" />
            </div>

            {/* Trades */}
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Trades</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              <MetricCard title="Total Trades" value={overview.totalTrades} format="number" trend="neutral" />
              <MetricCard title="Total Winner" value={overview.totalWinner} format="number" trend="up" />
              <MetricCard title="Total Open Trades" value={overview.totalOpenTrades} format="number" trend="neutral" />
              <MetricCard title="Tot. Closed Trades" value={overview.totClosedTrades} format="number" trend="neutral" />
              <MetricCard title="Total Losers" value={overview.totalLosers} format="number" trend="down" />
              <MetricCard title="Total BE" value={overview.totalBE} format="number" trend="neutral" />
              <MetricCard title="Max Consec. Loss" value={overview.maxConsecLoss} format="number" trend="down" />
              <MetricCard title="Max Consec. Win" value={overview.maxConsecWin} format="number" trend="up" />
            </div>

            {/* Trades Size */}
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Trades Size</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              <MetricCard title="Total Shares" value={overview.totalShares} format="number" trend="neutral" />
            </div>

            {/* Hold Time */}
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Hold Time</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
              <MetricCard title="Avg Win Hold Time" value={formatHoldTime(overview.avgWinHoldTime)} format="number" trend="neutral" />
              <MetricCard title="Avg Loss Hold Time" value={formatHoldTime(overview.avgLossHoldTime)} format="number" trend="neutral" />
              <MetricCard title="Avg BE Hold Time" value={formatHoldTime(overview.avgBEHoldTime)} format="number" trend="neutral" />
              <MetricCard title="Avg Hold Time" value={formatHoldTime(overview.avgHoldTime)} format="number" trend="neutral" />
            </div>

            {/* Commission */}
            <h2 className="text-sm font-semibold text-muted-foreground mb-2">Commission</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <MetricCard title="Total Commissions" value={overview.totalCommissions} trend="neutral" />
              <MetricCard title="Total Fees" value={overview.totalFees} trend="neutral" />
              <MetricCard title="Total swap" value={overview.totalSwap} trend="neutral" />
              <MetricCard title="Avg Commissions" value={overview.avgCommissions} trend="neutral" />
              <MetricCard title="Avg Fees" value={overview.avgFees} trend="neutral" />
              <MetricCard title="Commission" value={overview.totalCommissions} trend="neutral" />
              <MetricCard title="Tot. Com. Win" value={overview.totComWin} trend="neutral" />
              <MetricCard title="Tot. Com. Loss" value={overview.totComLoss} trend="neutral" />
            </div>
          </>
        ) : (
          <div className="text-muted-foreground text-sm">Select a report above.</div>
        )}
        </>
      </div>
    </div>
  );
};
