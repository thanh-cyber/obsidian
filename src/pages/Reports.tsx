import { useState, useEffect } from "react";
import { Trade } from "@/types/trade";
import { loadTrades } from "@/utils/storage";
import { calculateStats } from "@/utils/calculations";
import { ReportsSidebar } from "@/components/ReportsSidebar";
import { MetricCard } from "@/components/MetricCard";
import { Navigation } from "@/components/Navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export const Reports = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [activeSection, setActiveSection] = useState("PERFORMANCE");
  const [activeItem, setActiveItem] = useState("Overview");

  useEffect(() => {
    const loadedTrades = loadTrades();
    setTrades(loadedTrades);
  }, []);

  const stats = calculateStats(trades);

  // Calculate cumulative P&L data for charts
  const pnlData = trades
    .sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime())
    .reduce((acc, trade, index) => {
      const prevTotal = index > 0 ? acc[index - 1] : 0;
      acc.push(prevTotal + trade.pnl);
      return acc;
    }, [] as number[]);

  // Calculate return percentages
  const totalReturn = stats.totalPnl;
  const avgReturn = stats.averagePnl;
  const winRate = stats.winRate;
  const lossRate = 100 - winRate;

  // Calculate additional metrics
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
  const returnOnLong = trades.filter(t => t.positionSize > 0).reduce((sum, t) => sum + t.pnl, 0);
  const returnOnShort = trades.filter(t => t.positionSize < 0).reduce((sum, t) => sum + t.pnl, 0);

  const handleItemClick = (section: string, item: string) => {
    setActiveSection(section);
    setActiveItem(item);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <ReportsSidebar 
        activeSection={activeSection}
        activeItem={activeItem}
        onItemClick={handleItemClick}
      />
      
      <div className="ml-64 p-6">
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
        </div>

        {/* Main Chart Placeholder */}
        <div className="mb-6 bg-card border border-border rounded-lg p-4 h-64 flex items-center justify-center">
          <div className="text-center space-y-2">
            <p className="text-3xl font-bold text-primary">
              ${totalReturn.toFixed(2)}
            </p>
            <p className="text-sm text-muted-foreground">Accumulative Return Gross $</p>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <MetricCard
            title="Return $"
            value={totalReturn}
            data={pnlData}
            trend={totalReturn >= 0 ? "up" : "down"}
          />
          <MetricCard
            title="Acc. Return Net $"
            value={totalReturn * 0.95} // Simulating after fees
            data={pnlData.map(v => v * 0.95)}
            trend={totalReturn >= 0 ? "up" : "down"}
          />
          <MetricCard
            title="Acc. Return Gross $"
            value={totalReturn}
            data={pnlData}
            trend={totalReturn >= 0 ? "up" : "down"}
          />
          <MetricCard
            title="Daily Return $"
            value={avgReturn}
            trend={avgReturn >= 0 ? "up" : "down"}
          />
          
          <MetricCard
            title="Return on Winners"
            value={avgWin}
            data={wins.map(t => t.pnl)}
            trend="up"
          />
          <MetricCard
            title="Return on Losers"
            value={avgLoss}
            data={losses.map(t => t.pnl)}
            trend="down"
          />
          <MetricCard
            title="Return $ on Long"
            value={returnOnLong}
            trend={returnOnLong >= 0 ? "up" : "down"}
          />
          <MetricCard
            title="Return $ on Short"
            value={returnOnShort}
            trend={returnOnShort >= 0 ? "up" : "down"}
          />

          <MetricCard
            title="Biggest Profit $"
            value={stats.bestTrade}
            trend="up"
          />
          <MetricCard
            title="Biggest Loss $"
            value={stats.worstTrade}
            trend="down"
          />
          <MetricCard
            title="Profit/Loss Ratio"
            value={profitFactor.toFixed(2)}
            format="number"
            trend="neutral"
          />
          <MetricCard
            title="Trade $ Expectancy"
            value={avgReturn}
            trend={avgReturn >= 0 ? "up" : "down"}
          />

          <MetricCard
            title="Profit Factor"
            value={profitFactor.toFixed(2)}
            format="number"
            trend="neutral"
          />
          
          <MetricCard
            title="Win %"
            value={winRate}
            format="percentage"
            trend="up"
          />
          <MetricCard
            title="Loss %"
            value={lossRate}
            format="percentage"
            trend="down"
          />
          <MetricCard
            title="BE %"
            value={0.53}
            format="percentage"
            trend="neutral"
          />

          <MetricCard
            title="Acc. Return %"
            value={67304.03}
            format="percentage"
            trend="up"
          />
          <MetricCard
            title="Biggest % Profit"
            value={100}
            format="percentage"
            trend="up"
          />
          <MetricCard
            title="Biggest % Loser"
            value={-100}
            format="percentage"
            trend="down"
          />
          <MetricCard
            title="Return per Share"
            value={0}
            format="currency"
            trend="neutral"
          />

          <MetricCard
            title="Avg Return"
            value={avgReturn}
            trend={avgReturn >= 0 ? "up" : "down"}
          />
          <MetricCard
            title="Return/Size"
            value={0}
            format="currency"
            trend="neutral"
          />
          <MetricCard
            title="Avg $ on Winners"
            value={avgWin}
            trend="up"
          />
          <MetricCard
            title="Avg $ on Losers"
            value={avgLoss}
            trend="down"
          />

          <MetricCard
            title="Avg Daily P&L"
            value={avgReturn}
            trend={avgReturn >= 0 ? "up" : "down"}
          />
          <MetricCard
            title="Avg $ Position Mfe"
            value={69.72}
            format="currency"
            trend="neutral"
          />
          <MetricCard
            title="Avg $ Position Mae"
            value={-106.85}
            format="currency"
            trend="neutral"
          />

          <MetricCard
            title="Avg Return %"
            value={4.23}
            format="percentage"
            trend="up"
          />
          <MetricCard
            title="Avg % on Winners"
            value={9.45}
            format="percentage"
            trend="up"
          />
          <MetricCard
            title="Avg % on Losers"
            value={-15.31}
            format="percentage"
            trend="down"
          />
          <MetricCard
            title="Avg % on Long"
            value={2.36}
            format="percentage"
            trend="up"
          />

          <MetricCard
            title="Avg % on Shorts"
            value={4.86}
            format="percentage"
            trend="up"
          />
        </div>
      </div>
    </div>
  );
};
