import { Trade, TradeStats } from "@/types/trade";

export const calculatePnL = (
  entryPrice: number,
  exitPrice: number,
  positionSize: number
): { pnl: number; pnlPercentage: number } => {
  const pnl = (exitPrice - entryPrice) * positionSize;
  const pnlPercentage = ((exitPrice - entryPrice) / entryPrice) * 100;
  return { pnl, pnlPercentage };
};

export const calculateDuration = (entryDate: string, exitDate: string): number => {
  const entry = new Date(entryDate).getTime();
  const exit = new Date(exitDate).getTime();
  return Math.round((exit - entry) / (1000 * 60)); // minutes
};

export const calculateStats = (trades: Trade[]): TradeStats => {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      totalPnl: 0,
      winRate: 0,
      averagePnl: 0,
      averageDuration: 0,
      bestTrade: 0,
      worstTrade: 0,
      maxDrawdown: 0,
    };
  }

  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const wins = trades.filter(t => t.pnl > 0).length;
  const winRate = (wins / trades.length) * 100;
  const averagePnl = totalPnl / trades.length;
  const averageDuration = trades.reduce((sum, t) => sum + t.duration, 0) / trades.length;
  const bestTrade = Math.max(...trades.map(t => t.pnl));
  const worstTrade = Math.min(...trades.map(t => t.pnl));

  // Simple max drawdown calculation
  let peak = 0;
  let maxDrawdown = 0;
  let runningTotal = 0;

  trades.forEach(trade => {
    runningTotal += trade.pnl;
    if (runningTotal > peak) {
      peak = runningTotal;
    }
    const drawdown = peak - runningTotal;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });

  return {
    totalTrades: trades.length,
    totalPnl,
    winRate,
    averagePnl,
    averageDuration,
    bestTrade,
    worstTrade,
    maxDrawdown,
  };
};
