export interface Trade {
  id: string;
  symbol: string;
  entryDate: string;
  entryPrice: number;
  exitDate: string;
  exitPrice: number;
  positionSize: number;
  strategyTag: string;
  emotionalNotes?: string;
  riskPercentage?: number;
  stopLoss?: number;
  takeProfit?: number;
  pnl: number;
  pnlPercentage: number;
  duration: number; // in minutes
}

export type StrategyTag = 
  | "Breakout"
  | "Scalp"
  | "Swing"
  | "Day Trade"
  | "Momentum"
  | "Reversal"
  | "Other";

export interface TradeStats {
  totalTrades: number;
  totalPnl: number;
  winRate: number;
  averagePnl: number;
  averageDuration: number;
  bestTrade: number;
  worstTrade: number;
  maxDrawdown: number;
}
