/**
 * Fetch SPY and SPX (^GSPC) opening gap $ and % for a given date using Yahoo Finance.
 * Gap = today's open - previous trading day's close.
 */

import YahooFinance from "yahoo-finance2";

const SPY_SYMBOL = "SPY";
const SPX_SYMBOL = "^GSPC";

export interface SymbolGap {
  gapDollars: number | null;
  gapPercent: number | null;
}

export interface YahooGapResult {
  spy: SymbolGap;
  spx: SymbolGap;
}

function toDateOnly(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function getGapForSymbol(symbol: string, tradeDateStr: string): Promise<SymbolGap> {
  const tradeDate = new Date(tradeDateStr + "T12:00:00Z");
  const from = new Date(tradeDate);
  from.setUTCDate(from.getUTCDate() - 10);
  const period1 = toDateOnly(from);
  const period2 = tradeDateStr;

  const yahooFinance = new YahooFinance();
  const history = await yahooFinance.historical(symbol, {
    period1,
    period2,
    interval: "1d",
    events: "history",
  });

  if (!history || history.length < 2) {
    return { gapDollars: null, gapPercent: null };
  }

  const sorted = [...history].sort((a, b) => a.date.getTime() - b.date.getTime());
  const tradeDateOnly = tradeDateStr;
  const dayIndex = sorted.findIndex((row) => toDateOnly(row.date) === tradeDateOnly);
  if (dayIndex <= 0) {
    return { gapDollars: null, gapPercent: null };
  }

  const prevClose = sorted[dayIndex - 1].close;
  const todayOpen = sorted[dayIndex].open;
  if (!Number.isFinite(prevClose) || !Number.isFinite(todayOpen) || prevClose === 0) {
    return { gapDollars: null, gapPercent: null };
  }

  const gapDollars = todayOpen - prevClose;
  const gapPercent = (gapDollars / prevClose) * 100;
  return { gapDollars, gapPercent };
}

export async function getYahooGapForDate(dateStr: string): Promise<YahooGapResult> {
  const [spy, spx] = await Promise.all([
    getGapForSymbol(SPY_SYMBOL, dateStr),
    getGapForSymbol(SPX_SYMBOL, dateStr),
  ]);
  return { spy, spx };
}
