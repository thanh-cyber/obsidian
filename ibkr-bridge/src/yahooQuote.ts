/**
 * Fetch float, market cap, and outstanding shares for a symbol from Yahoo Finance
 * via quoteSummary (defaultKeyStatistics + summaryDetail).
 */

import YahooFinance from "yahoo-finance2";

export interface YahooQuoteResult {
  float?: number;
  marketCap?: number;
  outstandingShares?: number;
}

/**
 * Get current float, market cap, and shares outstanding for a symbol.
 * Uses current/latest data from Yahoo (not historical by date).
 * Returns empty object on error (e.g. symbol not found, delisted, or Yahoo rate limit).
 */
export async function getYahooQuoteForSymbol(symbol: string): Promise<YahooQuoteResult> {
  const trimmed = (symbol || "").trim().toUpperCase();
  if (!trimmed) {
    return {};
  }

  try {
    const yahooFinance = new YahooFinance();
    const result = await yahooFinance.quoteSummary(trimmed, {
      modules: ["defaultKeyStatistics", "summaryDetail"],
    });

    const out: YahooQuoteResult = {};
    const stats = result.defaultKeyStatistics;
    const summary = result.summaryDetail;

    if (stats?.floatShares != null && Number.isFinite(stats.floatShares)) {
      out.float = stats.floatShares;
    }
    if (stats?.sharesOutstanding != null && Number.isFinite(stats.sharesOutstanding)) {
      out.outstandingShares = stats.sharesOutstanding;
    }
    if (summary?.marketCap != null && Number.isFinite(summary.marketCap)) {
      out.marketCap = summary.marketCap;
    }

    return out;
  } catch {
    return {};
  }
}
