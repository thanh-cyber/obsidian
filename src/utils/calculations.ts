import { Trade, TradeStats } from "@/types/trade";
import { getAppDateKey } from "@/utils/appDateTime";

/** MFE = max favorable excursion ($), MAE = max adverse excursion ($). Uses execution list when available. */
export function getTradeMfeMae(trade: Trade): { mfe: number; mae: number; fromExecutions: boolean } {
  const list = trade.executionsList;
  if (list?.length) {
    return getTradeMfeMaeFromExecutions(list);
  }
  // No execution list: use trade-level entry/exit/pnl so imported trades still show MFE/MAE
  const entry = Number(trade.entryPrice);
  const exit = Number(trade.exitPrice);
  const size = Number(trade.positionSize);
  const pnl = Number(trade.pnl);
  if (Number.isFinite(entry) && Number.isFinite(exit) && Number.isFinite(size)) {
    return {
      mfe: pnl > 0 ? pnl : 0,
      mae: pnl < 0 ? pnl : 0,
      fromExecutions: false,
    };
  }
  return { mfe: NaN, mae: NaN, fromExecutions: false };
}

function getTradeMfeMaeFromExecutions(
  list: { dateTime: string; qty: number; price: number }[]
): { mfe: number; mae: number; fromExecutions: boolean } {
  const sorted = [...list].sort(
    (a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()
  );
  let position = 0;
  let cost = 0;
  let maxUnrealized = -Infinity;
  let minUnrealized = Infinity;
  for (const e of sorted) {
    const qty = Number(e.qty) || 0;
    const price = Number(e.price) || 0;
    position += qty;
    cost += price * qty;
    if (position !== 0) {
      const avgEntry = cost / position;
      const unrealized = (price - avgEntry) * position;
      if (unrealized > maxUnrealized) maxUnrealized = unrealized;
      if (unrealized < minUnrealized) minUnrealized = unrealized;
    }
  }

  // With only 2 fills (entry + exit) we sample unrealized only at entry (= 0). Use entry vs exit PnL as MFE/MAE.
  const noPathData = !Number.isFinite(maxUnrealized) || !Number.isFinite(minUnrealized);
  if (noPathData && sorted.length >= 2) {
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const entryPrice = Number(first.price) || 0;
    const exitPrice = Number(last.price) || 0;
    const posAfterFirst = Number(first.qty) || 0;
    const pnl = (exitPrice - entryPrice) * posAfterFirst; // long: (exit-entry)*qty; short: qty negative so (exit-entry)*neg = (entry-exit)*|qty|
    return {
      mfe: pnl > 0 ? pnl : 0,
      mae: pnl < 0 ? pnl : 0,
      fromExecutions: true,
    };
  }

  return {
    mfe: Number.isFinite(maxUnrealized) && maxUnrealized > 0 ? maxUnrealized : 0,
    mae: Number.isFinite(minUnrealized) && minUnrealized < 0 ? minUnrealized : 0,
    fromExecutions: true,
  };
}

/** Chart bar format: [timeMs, open, high, low, close, volume] */
export type ChartBar = [number, number, number, number, number, number];

/**
 * Build running P&L series for a trade. Uses bar data when provided for a smooth curve;
 * otherwise uses execution points only. Each point is { timeMs, pnl } (unrealized or final P&L).
 */
export function getTradeRunningPnlSeries(
  trade: Trade,
  chartBars?: ChartBar[]
): { timeMs: number; pnl: number }[] {
  const list = trade.executionsList;
  const entryTime = new Date(trade.entryDate).getTime();
  const exitTime = new Date(trade.exitDate).getTime();
  const finalPnl = Number(trade.pnl) || 0;

  const sortedExecs = list?.length
    ? [...list].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
    : [];

  function getPositionAndCostAt(timeMs: number): { position: number; cost: number } {
    let position = 0;
    let cost = 0;
    for (const e of sortedExecs) {
      const t = new Date(e.dateTime).getTime();
      if (t > timeMs) break;
      const qty = Number(e.qty) || 0;
      const price = Number(e.price) || 0;
      position += qty;
      cost += price * qty;
    }
    return { position, cost };
  }

  if (chartBars?.length) {
    const points: { timeMs: number; pnl: number }[] = [{ timeMs: entryTime, pnl: 0 }];
    for (const bar of chartBars) {
      const timeMs = bar[0];
      const close = bar[4];
      const { position, cost } = getPositionAndCostAt(timeMs);
      if (position === 0) {
        if (timeMs >= exitTime) points.push({ timeMs, pnl: finalPnl });
        continue;
      }
      const avgEntry = cost / position;
      const unrealized = (close - avgEntry) * position;
      points.push({ timeMs, pnl: unrealized });
    }
    if (points.length === 1 || points[points.length - 1].timeMs < exitTime) {
      points.push({ timeMs: exitTime, pnl: finalPnl });
    }
    return points.sort((a, b) => a.timeMs - b.timeMs);
  }

  const points: { timeMs: number; pnl: number }[] = [{ timeMs: entryTime, pnl: 0 }];
  if (sortedExecs.length > 0) {
    let position = 0;
    let cost = 0;
    for (const e of sortedExecs) {
      const timeMs = new Date(e.dateTime).getTime();
      const qty = Number(e.qty) || 0;
      const price = Number(e.price) || 0;
      position += qty;
      cost += price * qty;
      if (position !== 0) {
        const avgEntry = cost / position;
        const unrealized = (price - avgEntry) * position;
        points.push({ timeMs, pnl: unrealized });
      } else {
        points.push({ timeMs, pnl: finalPnl });
      }
    }
    if (points[points.length - 1].timeMs < exitTime) {
      points.push({ timeMs: exitTime, pnl: finalPnl });
    }
  } else {
    points.push({ timeMs: exitTime, pnl: finalPnl });
  }
  return points;
}

export const calculatePnL = (
  entryPrice: number,
  exitPrice: number,
  positionSize: number
): { pnl: number; pnlPercentage: number } => {
  const pnl = (exitPrice - entryPrice) * positionSize;
  const pnlPercentage = entryPrice !== 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;
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

  const totalPnl = trades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
  const wins = trades.filter((t) => (Number(t.pnl) || 0) > 0).length;
  const winRate = (wins / trades.length) * 100;
  const averagePnl = totalPnl / trades.length;
  const averageDuration = trades.reduce((sum, t) => sum + (Number(t.duration) || 0), 0) / trades.length;
  const pnlValues = trades.map((t) => Number(t.pnl) || 0).filter((v) => Number.isFinite(v));
  const bestTrade = pnlValues.length > 0 ? Math.max(...pnlValues) : 0;
  const worstTrade = pnlValues.length > 0 ? Math.min(...pnlValues) : 0;

  // Max drawdown requires chronological order (by exit date)
  const sortedByDate = [...trades].sort(
    (a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
  );
  let peak = 0;
  let maxDrawdown = 0;
  let runningTotal = 0;

  sortedByDate.forEach((trade) => {
    runningTotal += Number(trade.pnl) || 0;
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

/**
 * Aggregate P&L by date (exit date). Returns a map of "YYYY-MM-DD" -> daily P&L.
 */
export const getDailyPnL = (trades: Trade[]): Map<string, number> => {
  const dailyPnL = new Map<string, number>();

  trades.forEach((trade) => {
    const dateKey = getAppDateKey(new Date(trade.exitDate));
    const current = dailyPnL.get(dateKey) ?? 0;
    dailyPnL.set(dateKey, current + trade.pnl);
  });

  return dailyPnL;
};

/**
 * Trade count by date (exit date). Returns a map of "YYYY-MM-DD" -> number of trades.
 */
export const getDailyTradeCount = (trades: Trade[]): Map<string, number> => {
  const dailyCount = new Map<string, number>();
  trades.forEach((trade) => {
    const dateKey = getAppDateKey(new Date(trade.exitDate));
    dailyCount.set(dateKey, (dailyCount.get(dateKey) ?? 0) + 1);
  });
  return dailyCount;
};

export interface DailyDayStats {
  returnDollar: number;
  commissions: number;
  returnNet: number;
  trades: number;
  mfe: number;
  mae: number;
  winPct: number;
  profitFactor: number;
}

/**
 * Per-day stats (exit date in ET). Use for journal day list.
 */
export function getDailyStats(trades: Trade[]): Map<string, DailyDayStats> {
  const byDate = new Map<string, Trade[]>();
  trades.forEach((trade) => {
    const dateKey = getAppDateKey(new Date(trade.exitDate));
    const list = byDate.get(dateKey) ?? [];
    list.push(trade);
    byDate.set(dateKey, list);
  });
  const result = new Map<string, DailyDayStats>();
  byDate.forEach((dayTrades, dateKey) => {
    const returnDollar = dayTrades.reduce((s, t) => s + t.pnl, 0);
    const commissions = dayTrades.reduce((s, t) => s + getTradeFee(t), 0);
    const wins = dayTrades.filter((t) => t.pnl > 0).length;
    const winPct = dayTrades.length > 0 ? (wins / dayTrades.length) * 100 : 0;
    const grossWins = dayTrades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
    const grossLosses = dayTrades.filter((t) => t.pnl < 0).reduce((s, t) => s + -t.pnl, 0);
    const profitFactor = grossLosses > 0 ? grossWins / grossLosses : grossWins > 0 ? Number.MAX_SAFE_INTEGER : 0;
    let mfe = 0;
    let mae = 0;
    dayTrades.forEach((t) => {
      const { mfe: tmfe, mae: tmae } = getTradeMfeMae(t);
      if (Number.isFinite(tmfe)) mfe += tmfe;
      if (Number.isFinite(tmae)) mae += tmae;
    });
    result.set(dateKey, {
      returnDollar,
      commissions,
      returnNet: returnDollar - commissions,
      trades: dayTrades.length,
      mfe,
      mae,
      winPct,
      profitFactor,
    });
  });
  return result;
}

/** Per-trade fee from executionsList. Returns 0 if no executions. */
function getTradeFee(trade: Trade): number {
  if (trade.executionsList?.length) {
    return trade.executionsList.reduce((s, e) => s + (e.fees ?? 0), 0);
  }
  return 0;
}

/** Total fees from all trades (executionsList fees when available) */
function getTotalFees(trades: Trade[]): number {
  return trades.reduce((sum, t) => sum + getTradeFee(t), 0);
}

export interface OverviewStats {
  returnDollar: number;
  accReturnGross: number;
  accReturnNet: number;
  dailyReturnDollar: number;
  returnOnWinners: number;
  returnOnLosers: number;
  returnOnLong: number;
  returnOnShort: number;
  biggestProfit: number;
  biggestLoss: number;
  profitLossRatio: number;
  tradeExpectancy: number;
  profitFactor: number;
  /** Account balance = gross (closed-trade P&L) */
  accountBalance: number;
  totComShort: number;
  totComBE: number;
  totComLong: number;
  totCom: number;
  winPct: number;
  lossPct: number;
  breakEvenPct: number;
  openPct: number;
  accReturnPct: number | null;
  biggestPctProfit: number;
  biggestPctLoser: number;
  returnPerShare: number;
  pnlStdDev: number;
  pnlStdDevW: number;
  pnlStdDevL: number;
  sqn: number;
  avgReturn: number;
  returnPerSize: number;
  avgOnWinners: number;
  avgOnLosers: number;
  avgDailyPnl: number;
  avgReturnPct: number;
  avgPctOnWinners: number;
  avgPctOnLosers: number;
  avgPctOnLong: number;
  avgPctOnShort: number;
  avgPositionMfe: number;
  avgPositionMae: number;
  totalTrades: number;
  totalWinner: number;
  totalOpenTrades: number;
  totClosedTrades: number;
  totalLosers: number;
  totalBE: number;
  maxConsecLoss: number;
  maxConsecWin: number;
  totalShares: number;
  avgWinHoldTime: number;
  avgLossHoldTime: number;
  avgBEHoldTime: number;
  avgHoldTime: number;
  totalCommissions: number;
  totalFees: number;
  totalSwap: number;
  avgCommissions: number;
  avgFees: number;
  totComWin: number;
  totComLoss: number;
  /** Kelly Criterion as percentage (0–100). */
  kellyCriterion: number;
  /** Cumulative P&L by exit date (chronological) for chart: { date, gross, net } */
  cumulativeData: { date: string; gross: number; net: number }[];
}

/**
 * Compute all Performance Overview metrics from trades. Uses real calculations only.
 * accReturnPct is null when total notional (for scaling) would be zero.
 */
export const getOverviewStats = (trades: Trade[]): OverviewStats => {
  if (trades.length === 0) {
    return {
      returnDollar: 0,
      accReturnGross: 0,
      accReturnNet: 0,
      dailyReturnDollar: 0,
      returnOnWinners: 0,
      returnOnLosers: 0,
      returnOnLong: 0,
      returnOnShort: 0,
      biggestProfit: 0,
      biggestLoss: 0,
      profitLossRatio: 0,
      tradeExpectancy: 0,
      profitFactor: 0,
      accountBalance: 0,
      totComShort: 0,
      totComBE: 0,
      totComLong: 0,
      totCom: 0,
      winPct: 0,
      lossPct: 0,
      breakEvenPct: 0,
      openPct: 0,
      accReturnPct: null,
      biggestPctProfit: 0,
      biggestPctLoser: 0,
      returnPerShare: 0,
      pnlStdDev: 0,
      pnlStdDevW: 0,
      pnlStdDevL: 0,
      sqn: 0,
      avgReturn: 0,
      returnPerSize: 0,
      avgOnWinners: 0,
      avgOnLosers: 0,
      avgDailyPnl: 0,
      avgReturnPct: 0,
      avgPctOnWinners: 0,
      avgPctOnLosers: 0,
      avgPctOnLong: 0,
      avgPctOnShort: 0,
      avgPositionMfe: 0,
      avgPositionMae: 0,
      totalTrades: 0,
      totalWinner: 0,
      totalOpenTrades: 0,
      totClosedTrades: 0,
      totalLosers: 0,
      totalBE: 0,
      maxConsecLoss: 0,
      maxConsecWin: 0,
      totalShares: 0,
      avgWinHoldTime: 0,
      avgLossHoldTime: 0,
      avgBEHoldTime: 0,
      avgHoldTime: 0,
      totalCommissions: 0,
      totalFees: 0,
      totalSwap: 0,
      avgCommissions: 0,
      avgFees: 0,
      totComWin: 0,
      totComLoss: 0,
      kellyCriterion: 0,
      cumulativeData: [],
    };
  }

  const dailyPnL = getDailyPnL(trades);
  const stats = calculateStats(trades);
  const totalFees = getTotalFees(trades);
  const gross = stats.totalPnl;
  const net = gross - totalFees;

  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl < 0);
  const returnOnWinners = wins.reduce((s, t) => s + t.pnl, 0);
  const returnOnLosers = losses.reduce((s, t) => s + t.pnl, 0);
  const avgWin = wins.length > 0 ? returnOnWinners / wins.length : 0;
  const avgLoss = losses.length > 0 ? returnOnLosers / losses.length : 0;

  const profitFactor =
    returnOnLosers !== 0 ? Math.abs(returnOnWinners / returnOnLosers) : (returnOnWinners > 0 ? Number.MAX_SAFE_INTEGER : 0);
  const profitLossRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : (avgWin > 0 ? Number.MAX_SAFE_INTEGER : 0);

  const returnOnLong = trades.filter((t) => t.positionSize > 0).reduce((s, t) => s + t.pnl, 0);
  const returnOnShort = trades.filter((t) => t.positionSize < 0).reduce((s, t) => s + t.pnl, 0);

  const dailyValues = Array.from(dailyPnL.values());
  const avgDailyPnl = dailyValues.length > 0 ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length : 0;
  const sortedDates = Array.from(dailyPnL.keys()).sort();
  const lastDate = sortedDates[sortedDates.length - 1];
  const dailyReturnDollar = lastDate != null ? dailyPnL.get(lastDate) ?? 0 : 0;

  const breakEvenTrades = trades.filter((t) => t.pnl >= -0.01 && t.pnl <= 0.01);
  const breakEvenPct = trades.length > 0 ? (breakEvenTrades.length / trades.length) * 100 : 0;
  const winPct = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const lossPct = trades.length > 0 ? (losses.length / trades.length) * 100 : 0;

  const totalShares = trades.reduce((s, t) => s + Math.abs(Number(t.positionSize) || 0), 0);
  const returnPerShare = totalShares > 0 ? gross / totalShares : 0;

  const totalNotional = trades.reduce(
    (s, t) => s + Math.abs((Number(t.entryPrice) || 0) * (Number(t.positionSize) || 0)),
    0
  );
  const returnPerSize = totalNotional > 0 ? gross / totalNotional : 0;

  const pnlPcts = trades.map((t) => t.pnlPercentage ?? 0);
  const avgReturnPct = pnlPcts.length > 0 ? pnlPcts.reduce((a, b) => a + b, 0) / pnlPcts.length : 0;
  const avgPctOnWinners =
    wins.length > 0 ? wins.reduce((s, t) => s + (t.pnlPercentage ?? 0), 0) / wins.length : 0;
  const avgPctOnLosers =
    losses.length > 0 ? losses.reduce((s, t) => s + (t.pnlPercentage ?? 0), 0) / losses.length : 0;
  const longTrades = trades.filter((t) => (Number(t.positionSize) || 0) > 0);
  const shortTrades = trades.filter((t) => (Number(t.positionSize) || 0) < 0);
  const avgPctOnLong = longTrades.length > 0 ? longTrades.reduce((s, t) => s + (t.pnlPercentage ?? 0), 0) / longTrades.length : 0;
  const avgPctOnShort = shortTrades.length > 0 ? shortTrades.reduce((s, t) => s + (t.pnlPercentage ?? 0), 0) / shortTrades.length : 0;

  const biggestPctProfit = pnlPcts.length > 0 ? Math.max(...pnlPcts) : 0;
  const biggestPctLoser = pnlPcts.length > 0 ? Math.min(...pnlPcts) : 0;

  const accReturnPct = totalNotional > 0 ? (gross / totalNotional) * 100 : null;

  // Kelly Criterion: W - (1-W)/R where W = win rate (decimal), R = avg win / |avg loss|
  const W = trades.length > 0 ? wins.length / trades.length : 0;
  const R = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : avgWin > 0 ? Infinity : 0;
  const kellyFraction = R > 0 && R < 1e10 ? W - (1 - W) / R : 0;
  const kellyCriterion = Math.max(0, Math.min(1, kellyFraction)) * 100;

  const sortedByExit = [...trades].sort(
    (a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
  );

  // PnL Std Dev (all, winners, losers)
  const pnlValues = trades.map((t) => t.pnl);
  const meanPnl = pnlValues.length > 0 ? pnlValues.reduce((a, b) => a + b, 0) / pnlValues.length : 0;
  const pnlStdDev =
    pnlValues.length > 1
      ? Math.sqrt(pnlValues.reduce((s, v) => s + (v - meanPnl) ** 2, 0) / (pnlValues.length - 1))
      : 0;
  const winPnls = wins.map((t) => t.pnl);
  const meanWinPnl = winPnls.length > 0 ? winPnls.reduce((a, b) => a + b, 0) / winPnls.length : 0;
  const pnlStdDevW =
    winPnls.length > 1
      ? Math.sqrt(winPnls.reduce((s, v) => s + (v - meanWinPnl) ** 2, 0) / (winPnls.length - 1))
      : 0;
  const lossPnls = losses.map((t) => t.pnl);
  const meanLossPnl = lossPnls.length > 0 ? lossPnls.reduce((a, b) => a + b, 0) / lossPnls.length : 0;
  const pnlStdDevL =
    lossPnls.length > 1
      ? Math.sqrt(lossPnls.reduce((s, v) => s + (v - meanLossPnl) ** 2, 0) / (lossPnls.length - 1))
      : 0;
  // SQN = (mean / stdDev) * sqrt(n) — System Quality Number
  const sqn = pnlStdDev > 0 && trades.length > 0 ? (meanPnl / pnlStdDev) * Math.sqrt(trades.length) : 0;

  // Max consecutive wins/losses
  let maxConsecWin = 0;
  let maxConsecLoss = 0;
  let currWin = 0;
  let currLoss = 0;
  sortedByExit.forEach((t) => {
    if (t.pnl > 0) {
      currWin++;
      currLoss = 0;
      if (currWin > maxConsecWin) maxConsecWin = currWin;
    } else if (t.pnl < 0) {
      currLoss++;
      currWin = 0;
      if (currLoss > maxConsecLoss) maxConsecLoss = currLoss;
    } else {
      currWin = 0;
      currLoss = 0;
    }
  });

  // Hold times (minutes)
  const avgHoldTime = trades.length > 0 ? trades.reduce((s, t) => s + t.duration, 0) / trades.length : 0;
  const avgWinHoldTime =
    wins.length > 0 ? wins.reduce((s, t) => s + t.duration, 0) / wins.length : 0;
  const avgLossHoldTime =
    losses.length > 0 ? losses.reduce((s, t) => s + t.duration, 0) / losses.length : 0;
  const avgBEHoldTime =
    breakEvenTrades.length > 0
      ? breakEvenTrades.reduce((s, t) => s + t.duration, 0) / breakEvenTrades.length
      : 0;

  // Commission/fees by category
  const totCom = getTotalFees(trades);
  const totComWin = wins.reduce((s, t) => s + getTradeFee(t), 0);
  const totComLoss = losses.reduce((s, t) => s + getTradeFee(t), 0);
  const totComBE = breakEvenTrades.reduce((s, t) => s + getTradeFee(t), 0);
  const totComLong = longTrades.reduce((s, t) => s + getTradeFee(t), 0);
  const totComShort = shortTrades.reduce((s, t) => s + getTradeFee(t), 0);
  let runGross = 0;
  let runNet = 0;
  const cumulativeData: { date: string; gross: number; net: number }[] = [];
  sortedByExit.forEach((t) => {
    runGross += t.pnl;
    const fee = t.executionsList?.reduce((s, e) => s + (e.fees ?? 0), 0) ?? 0;
    runNet += t.pnl - fee;
    const d = new Date(t.exitDate);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    cumulativeData.push({ date: dateStr, gross: runGross, net: runNet });
  });

  return {
    returnDollar: gross,
    accReturnGross: gross,
    accReturnNet: net,
    dailyReturnDollar,
    returnOnWinners,
    returnOnLosers,
    returnOnLong,
    returnOnShort,
    biggestProfit: stats.bestTrade,
    biggestLoss: stats.worstTrade,
    profitLossRatio,
    tradeExpectancy: stats.averagePnl,
    profitFactor,
    accountBalance: gross,
    totComShort,
    totComBE,
    totComLong,
    totCom,
    winPct,
    lossPct,
    breakEvenPct,
    openPct: 0,
    accReturnPct,
    biggestPctProfit,
    biggestPctLoser,
    returnPerShare,
    pnlStdDev,
    pnlStdDevW,
    pnlStdDevL,
    sqn,
    avgReturn: stats.averagePnl,
    returnPerSize,
    avgOnWinners: avgWin,
    avgOnLosers: avgLoss,
    avgDailyPnl,
    avgReturnPct,
    avgPctOnWinners,
    avgPctOnLosers,
    avgPctOnLong,
    avgPctOnShort,
    avgPositionMfe: 0,
    avgPositionMae: 0,
    totalTrades: trades.length,
    totalWinner: wins.length,
    totalOpenTrades: 0,
    totClosedTrades: trades.length,
    totalLosers: losses.length,
    totalBE: breakEvenTrades.length,
    maxConsecLoss,
    maxConsecWin,
    totalShares,
    avgWinHoldTime,
    avgLossHoldTime,
    avgBEHoldTime,
    avgHoldTime,
    totalCommissions: totCom,
    totalFees: totCom,
    totalSwap: 0,
    avgCommissions: trades.length > 0 ? totCom / trades.length : 0,
    avgFees: trades.length > 0 ? totCom / trades.length : 0,
    totComWin,
    totComLoss,
    kellyCriterion,
    cumulativeData,
  };
};
