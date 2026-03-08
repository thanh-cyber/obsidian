/**
 * Fetch float, market cap, and outstanding shares from Yahoo Finance via the bridge.
 * The browser cannot call Yahoo directly (CORS); the bridge runs in Node and can.
 */

import type { Trade } from "@/types/trade";

export interface YahooQuoteData {
  float?: number;
  marketCap?: number;
  outstandingShares?: number;
}

const DELAY_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch quote data from the bridge. Bridge must be running (e.g. cd ibkr-bridge && npm run dev).
 */
async function fetchYahooQuoteViaBridge(baseUrl: string, symbol: string): Promise<YahooQuoteData> {
  const trimmedUrl = baseUrl.trim().replace(/\/+$/, "");
  if (!trimmedUrl) throw new Error("Bridge URL is required");
  const url = `${trimmedUrl}/api/yahoo-quote?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { method: "GET" });
  let data: { ok?: boolean; error?: string } & YahooQuoteData;
  try {
    data = (await res.json()) as typeof data;
  } catch {
    throw new Error(res.ok ? "Invalid response from bridge" : `HTTP ${res.status}`);
  }
  if (!res.ok || !data.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return {
    float: data.float,
    marketCap: data.marketCap,
    outstandingShares: data.outstandingShares,
  };
}

/**
 * Returns true if the trade is missing at least one of float, marketCap, outstandingShares.
 */
function tradeNeedsQuoteData(t: Trade): boolean {
  return (
    t.float == null ||
    t.marketCap == null ||
    t.outstandingShares == null
  );
}

/**
 * Enrich trades with float, market cap, and outstanding shares from Yahoo Finance via the bridge.
 * Requires baseUrl (bridge must be running). Only fetches for symbols missing at least one of those fields.
 * One request per unique symbol with a short delay to avoid rate limits.
 * Returns a new trade array (does not mutate). On fetch error for a symbol, that symbol's trades are left unchanged.
 */
export async function enrichTradesWithYahooQuote(
  trades: Trade[],
  baseUrl: string,
  onProgress?: (done: number, total: number, symbol: string) => void
): Promise<Trade[]> {
  if (!baseUrl?.trim()) return trades;
  const symbolsNeedingData = new Set<string>();
  for (const t of trades) {
    if (tradeNeedsQuoteData(t) && t.symbol?.trim()) {
      symbolsNeedingData.add(t.symbol.trim().toUpperCase());
    }
  }
  const symbolList = Array.from(symbolsNeedingData);
  if (symbolList.length === 0) {
    onProgress?.(0, 0, "");
    return trades;
  }

  const quoteBySymbol = new Map<string, YahooQuoteData>();
  for (let i = 0; i < symbolList.length; i++) {
    const symbol = symbolList[i];
    onProgress?.(i, symbolList.length, symbol);
    try {
      const data = await fetchYahooQuoteViaBridge(baseUrl, symbol);
      if (
        data.float != null ||
        data.marketCap != null ||
        data.outstandingShares != null
      ) {
        quoteBySymbol.set(symbol, data);
      }
    } catch {
      // Leave trades for this symbol unchanged
    }
    if (i < symbolList.length - 1) {
      await delay(DELAY_MS);
    }
  }
  onProgress?.(symbolList.length, symbolList.length, "");

  const norm = (s: string) => s.trim().toUpperCase();
  return trades.map((t) => {
    const data = quoteBySymbol.get(norm(t.symbol ?? ""));
    if (!data) return t;
    return {
      ...t,
      float: t.float ?? data.float,
      marketCap: t.marketCap ?? data.marketCap,
      outstandingShares: t.outstandingShares ?? data.outstandingShares,
    };
  });
}
