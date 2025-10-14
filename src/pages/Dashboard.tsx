import { useState, useEffect } from "react";
import { Trade } from "@/types/trade";
import { StatCard } from "@/components/StatCard";
import { TradeForm } from "@/components/TradeForm";
import { TradeList } from "@/components/TradeList";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Activity, Clock, DollarSign, Target, Plus } from "lucide-react";
import { calculateStats } from "@/utils/calculations";
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

  const stats = calculateStats(trades);

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

  const handleDeleteTrade = (id: string) => {
    setTrades(trades.filter(t => t.id !== id));
    toast.success("Trade deleted");
  };

  const recentTrades = trades.slice(0, 5);

  return (
    <div className="min-h-screen bg-background p-6">
      <Navigation />
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              Trade Journal
            </h1>
            <p className="text-muted-foreground mt-1">Track, analyze, and improve your trading performance</p>
          </div>
          <Button 
            onClick={() => {
              setEditingTrade(undefined);
              setIsFormOpen(true);
            }}
            className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20"
          >
            <Plus className="mr-2 h-4 w-4" />
            Log Trade
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* Recent Trades */}
        <div className="bg-gradient-card backdrop-blur-sm border border-border/50 rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">All Trades</h2>
          </div>
          <TradeList 
            trades={trades}
            onEdit={handleEditTrade}
            onDelete={handleDeleteTrade}
          />
        </div>

        {/* Trade Form Modal */}
        <TradeForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          onSubmit={handleAddTrade}
          editTrade={editingTrade}
        />
      </div>
    </div>
  );
};
