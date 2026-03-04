import { useState, useEffect } from "react";
import { Trade } from "@/types/trade";
import { StatCard } from "@/components/StatCard";
import { TradeForm } from "@/components/TradeForm";
import { PnLCalendarView } from "@/components/PnLCalendarView";
import { TrendingUp, TrendingDown, Activity, Clock, DollarSign, Target } from "lucide-react";
import { calculateStats, getDailyPnL, getDailyTradeCount } from "@/utils/calculations";
import { useFilters } from "@/context/FilterContext";
import { loadTrades, saveTrades } from "@/utils/storage";
import { toast } from "sonner";

export const Dashboard = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | undefined>();

  useEffect(() => {
    const loadedTrades = loadTrades();
    setTrades(loadedTrades);
  }, []);

  useEffect(() => {
    saveTrades(trades);
  }, [trades]);

  const { applyFilters } = useFilters();
  const filteredTrades = applyFilters(trades);
  const stats = calculateStats(filteredTrades);
  const dailyPnL = getDailyPnL(filteredTrades);
  const dailyTradeCount = getDailyTradeCount(filteredTrades);

  const handleAddTrade = (trade: Trade) => {
    if (editingTrade) {
      setTrades(trades.map(t => t.id === trade.id ? trade : t));
      toast.success("Trade updated successfully");
    } else {
      setTrades([trade, ...trades]);
      toast.success("Trade logged successfully");
    }
    setEditingTrade(undefined);
  };

  const handleEditTrade = (trade: Trade) => {
    setEditingTrade(trade);
    setIsFormOpen(true);
  };

  return (
    <>
      <div className="h-full flex flex-col overflow-hidden">
        <div className="p-6 flex-1 flex flex-col min-h-0 overflow-auto">
          <div className="flex flex-col flex-1 min-h-0 gap-6">
            {/* Header */}
            <div className="flex-shrink-0">
              <h1 className="text-4xl font-bold text-primary">
                Obsidian
              </h1>
              <p className="text-muted-foreground mt-1">Track, analyze, and improve your trading performance</p>
            </div>

            {/* Stats Grid */}
            <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard
                title="Total Trades"
                value={String(stats.totalTrades)}
                icon={Activity}
                trend="neutral"
                subtitle="all trades"
              />
              <StatCard
                title="Total P&L"
                value={`$${stats.totalPnl.toFixed(2)}`}
                icon={DollarSign}
                trend={stats.totalPnl >= 0 ? "up" : "down"}
                subtitle={`${stats.totalTrades} trades`}
              />
              <StatCard
                title="Win Rate"
                value={`${stats.winRate.toFixed(1)}%`}
                icon={Target}
                trend={stats.winRate >= 50 ? "up" : "down"}
                subtitle={`${Math.round(stats.totalTrades * (stats.winRate / 100))} wins`}
              />
              <StatCard
                title="Avg P&L"
                value={`$${stats.averagePnl.toFixed(2)}`}
                icon={Activity}
                trend={stats.averagePnl >= 0 ? "up" : "down"}
                subtitle="per trade"
              />
              <StatCard
                title="Avg Duration"
                value={`${Math.floor(stats.averageDuration / 60)}h ${Math.round(stats.averageDuration % 60)}m`}
                icon={Clock}
                trend="neutral"
                subtitle="hold time"
              />
            </div>

            {/* Additional Stats */}
            <div className="flex-shrink-0 grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard
                title="Best Trade"
                value={`$${stats.bestTrade.toFixed(2)}`}
                icon={TrendingUp}
                trend="up"
              />
              <StatCard
                title="Worst Trade"
                value={`$${stats.worstTrade.toFixed(2)}`}
                icon={TrendingDown}
                trend="down"
              />
              <StatCard
                title="Max Drawdown"
                value={`$${stats.maxDrawdown.toFixed(2)}`}
                icon={Activity}
                trend="neutral"
              />
            </div>

            {/* Calendar — expands to fill remaining space */}
            <div className="flex-1 min-h-0 flex flex-col bg-gradient-card backdrop-blur-sm border border-border/50 rounded-lg p-6">
              <div className="flex-shrink-0 mb-4">
                <h2 className="text-2xl font-bold">Calendar</h2>
                <p className="text-sm text-muted-foreground">Daily P&L view — green days are profitable, red days are losses</p>
              </div>
              <PnLCalendarView
                dailyPnL={dailyPnL}
                dailyTradeCount={dailyTradeCount}
                defaultView="month"
                className="flex-1 min-h-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Trade Form Modal */}
      <TradeForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSubmit={handleAddTrade}
        editTrade={editingTrade}
      />
    </>
  );
};
