export type IbkrBridgeStatus =
  | { state: 'starting' }
  | { state: 'connecting'; host: string; port: number; clientId: number }
  | { state: 'connected'; host: string; port: number; clientId: number }
  | { state: 'disconnected'; reason?: string }
  | { state: 'error'; message: string };

export type BridgeMessage =
  | { type: 'status'; status: IbkrBridgeStatus; at: string }
  | { type: 'snapshot'; trades: Trade[]; at: string }
  | { type: 'trade'; trade: Trade; at: string };

export interface TradeExecution {
  dateTime: string; // ISO
  qty: number; // signed: +buy, -sell
  price: number;
  position: number; // cumulative position after this fill
  fees?: number;
  /** IBKR execution identifier (unique) */
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
  duration: number; // minutes
  executions?: number;
  executionsList?: TradeExecution[];
  /** Provenance for dedupe/debug */
  source?: 'ibkr';
  /** Account the executions came from */
  account?: string;
}

