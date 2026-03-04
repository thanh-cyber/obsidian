import type { Trade, TradeExecution } from './types.js';

export interface NormalizedFill {
  account: string;
  symbol: string;
  time: Date;
  /** signed quantity: +buy (BOT), -sell (SLD) */
  qty: number;
  price: number;
  execId: string;
  fees: number; // commission/fees for this fill (may arrive later)
}

type Key = string; // `${account}::${symbol}`

interface InProgressTrade {
  account: string;
  symbol: string;
  fills: NormalizedFill[];
  /** cumulative position after last fill */
  position: number;
  /** max abs long position reached */
  maxLong: number;
  /** max abs short position reached (stored as positive magnitude) */
  maxShort: number;
  /** map execId -> fees (for late commission reports) */
  feesByExecId: Map<string, number>;
}

export class TradeBuilder {
  private byKey = new Map<Key, InProgressTrade>();
  private completed: Trade[] = [];
  private completedById = new Map<string, Trade>();
  private execIdToCompletedTradeId = new Map<string, string>();

  constructor(private readonly strategyTag: string = 'Day Trade') {}

  /** Completed trades cached since startup (used for snapshot). */
  getCompleted(): Trade[] {
    return [...this.completed];
  }

  /**
   * Apply a fill. Returns a completed Trade when this symbol/account goes flat.
   */
  ingestFill(fill: NormalizedFill): Trade | null {
    const key = this.key(fill.account, fill.symbol);
    const t = this.byKey.get(key) ?? this.newInProgress(fill.account, fill.symbol);

    // Dedupe by execId within this in-progress trade window.
    if (t.fills.some((f) => f.execId === fill.execId)) {
      // If we already had it, we still may need to update fees.
      if (fill.fees !== 0) t.feesByExecId.set(fill.execId, fill.fees);
      this.byKey.set(key, t);
      return null;
    }

    t.fills.push(fill);
    t.position += fill.qty;
    if (t.position > 0) t.maxLong = Math.max(t.maxLong, t.position);
    if (t.position < 0) t.maxShort = Math.max(t.maxShort, Math.abs(t.position));
    if (fill.fees !== 0) t.feesByExecId.set(fill.execId, fill.fees);

    // Sort fills by time then execId for stable output.
    t.fills.sort((a, b) => {
      const dt = a.time.getTime() - b.time.getTime();
      if (dt !== 0) return dt;
      return a.execId.localeCompare(b.execId);
    });

    if (t.position !== 0) {
      this.byKey.set(key, t);
      return null;
    }

    const trade = this.finalize(t);
    this.byKey.delete(key);
    return this.upsertCompleted(trade);
  }

  /**
   * Apply fees for an execution. If the execution is already in an in-progress trade,
   * this updates it; otherwise it's ignored (trade likely already finalized).
   */
  applyFee(account: string, symbol: string, execId: string, fee: number): void {
    const key = this.key(account, symbol);
    const t = this.byKey.get(key);
    if (!t) return;
    t.feesByExecId.set(execId, fee);
  }

  /**
   * Apply a fee by execId, even if the trade is already completed.
   * Returns an updated completed Trade when applicable.
   */
  applyFeeByExecId(execId: string, fee: number): Trade | null {
    // First: in-progress trades (we don't know key here, so scan small set).
    for (const t of this.byKey.values()) {
      if (t.fills.some((f) => f.execId === execId)) {
        t.feesByExecId.set(execId, fee);
        return null;
      }
    }

    const tradeId = this.execIdToCompletedTradeId.get(execId);
    if (!tradeId) return null;

    const existing = this.completedById.get(tradeId);
    if (!existing?.executionsList?.length) return null;

    const nextExecs = existing.executionsList.map((e) =>
      e.execId === execId ? { ...e, fees: fee } : e
    );
    const feesTotal = nextExecs.reduce((s, e) => s + (e.fees ?? 0), 0);
    const cashFlow = nextExecs.reduce((s, e) => s + (-e.qty * e.price), 0);
    const pnl = cashFlow - feesTotal;
    const costBasis = Math.abs(existing.entryPrice * existing.positionSize) || 1;
    const pnlPercentage = (pnl / costBasis) * 100;

    const updated: Trade = {
      ...existing,
      executionsList: nextExecs,
      pnl,
      pnlPercentage,
    };

    this.completedById.set(tradeId, updated);
    const idx = this.completed.findIndex((t) => t.id === tradeId);
    if (idx >= 0) this.completed[idx] = updated;
    return updated;
  }

  private key(account: string, symbol: string): Key {
    return `${account}::${symbol}`;
  }

  private newInProgress(account: string, symbol: string): InProgressTrade {
    return {
      account,
      symbol,
      fills: [],
      position: 0,
      maxLong: 0,
      maxShort: 0,
      feesByExecId: new Map(),
    };
  }

  private finalize(t: InProgressTrade): Trade {
    const fills = t.fills;
    if (fills.length === 0) {
      throw new Error('Invariant: finalize called with zero fills');
    }

    const first = fills[0];
    const last = fills[fills.length - 1];

    const isShort = t.maxShort > t.maxLong;
    const positionSizeMag = Math.max(t.maxLong, t.maxShort);
    const positionSize = isShort ? -positionSizeMag : positionSizeMag;

    const entryFills = fills.filter((f) => (isShort ? f.qty < 0 : f.qty > 0));
    const exitFills = fills.filter((f) => (isShort ? f.qty > 0 : f.qty < 0));

    const wavg = (xs: NormalizedFill[]) => {
      const denom = xs.reduce((s, f) => s + Math.abs(f.qty), 0);
      if (denom <= 0) return 0;
      return xs.reduce((s, f) => s + f.price * Math.abs(f.qty), 0) / denom;
    };

    const entryPrice = wavg(entryFills);
    const exitPrice = wavg(exitFills);

    let cumPos = 0;
    const executionsList: TradeExecution[] = fills.map((f) => {
      cumPos += f.qty;
      const fees = t.feesByExecId.get(f.execId) ?? f.fees ?? 0;
      return {
        dateTime: f.time.toISOString(),
        qty: f.qty,
        price: f.price,
        position: cumPos,
        fees,
        execId: f.execId,
      };
    });

    const feesTotal = executionsList.reduce((s, e) => s + (e.fees ?? 0), 0);
    const cashFlow = executionsList.reduce((s, e) => s + (-e.qty * e.price), 0);
    const pnl = cashFlow - feesTotal;

    const entryMs = first.time.getTime();
    const exitMs = last.time.getTime();
    const duration = Math.round((exitMs - entryMs) / 60000);

    const costBasis = Math.abs(entryPrice * positionSize) || 1;
    const pnlPercentage = (pnl / costBasis) * 100;

    const id = [
      'ibkr',
      t.account,
      t.symbol,
      String(entryMs),
      String(exitMs),
      String(positionSize),
      String(fills.length),
      first.execId,
    ].join('_');

    return {
      id,
      symbol: t.symbol,
      entryDate: first.time.toISOString(),
      entryPrice,
      exitDate: last.time.toISOString(),
      exitPrice,
      positionSize,
      strategyTag: this.strategyTag,
      pnl,
      pnlPercentage,
      duration: Number.isFinite(duration) ? duration : 0,
      executions: fills.length,
      executionsList,
      source: 'ibkr',
      account: t.account,
    };
  }

  private upsertCompleted(trade: Trade): Trade | null {
    const existing = this.completedById.get(trade.id);
    if (existing) {
      // Replace existing (e.g. reconnect replay or fee updates captured in new finalize).
      this.completedById.set(trade.id, trade);
      const idx = this.completed.findIndex((t) => t.id === trade.id);
      if (idx >= 0) this.completed[idx] = trade;
      // Refresh execId index
      for (const e of trade.executionsList ?? []) {
        if (e.execId) this.execIdToCompletedTradeId.set(e.execId, trade.id);
      }
      return trade;
    }

    this.completedById.set(trade.id, trade);
    this.completed.push(trade);
    for (const e of trade.executionsList ?? []) {
      if (e.execId) this.execIdToCompletedTradeId.set(e.execId, trade.id);
    }
    return trade;
  }
}

