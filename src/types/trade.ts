/** Individual execution (fill) within a trade */
export interface TradeExecution {
  dateTime: string;  // ISO string
  qty: number;       // signed: +buy, -sell
  price: number;
  position: number;  // cumulative position after this fill
  fees?: number;
  /** Optional broker execution identifier for dedupe/debug */
  execId?: string;
}

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
  /** Number of fills/executions that comprise this trade (from CSV import) */
  executions?: number;
  /** Individual executions when available (from CSV import) */
  executionsList?: TradeExecution[];
  /** Optional provenance (e.g. auto-imported from broker) */
  source?: "csv" | "manual" | "ibkr";
  /** Optional broker account id */
  account?: string;
  /** SPY opening gap $ (prior close → open) on trade date; from Yahoo Finance */
  spyOpeningGapDollars?: number;
  /** SPY opening gap % on trade date */
  spyOpeningGapPercent?: number;
  /** SPX (^GSPC) opening gap $ on trade date */
  spxOpeningGapDollars?: number;
  /** SPX opening gap % on trade date */
  spxOpeningGapPercent?: number;
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
