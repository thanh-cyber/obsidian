/**
 * Fetch SPY/SPX opening gap $ and % for a date from the bridge (Yahoo Finance).
 * Bridge must be running (e.g. ibkr-bridge with GET /api/yahoo-gap?date=YYYY-MM-DD).
 */

import { getAppDateKey } from "@/utils/appDateTime";
import type { Trade } from "@/types/trade";

export interface SymbolGap {
  gapDollars: number | null;
  gapPercent: number | null;
}

export interface YahooGapResponse {
  ok: boolean;
  error?: string;
  spy?: SymbolGap;
  spx?: SymbolGap;
}

export async function fetchYahooGapForDate(
  baseUrl: string,
  dateStr: string
): Promise<YahooGapResponse> {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/yahoo-gap?date=${encodeURIComponent(dateStr)}`;
  let res: Response;
  try {
    res = await fetch(url, { method: "GET" });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
  let data: YahooGapResponse;
  try {
    data = (await res.json()) as YahooGapResponse;
  } catch {
    return { ok: false, error: res.ok ? "Invalid response" : `HTTP ${res.status}` };
  }
  if (!res.ok) {
    return { ok: false, error: data.error ?? `HTTP ${res.status}` };
  }
  return data;
}

/**
 * Enrich trades with SPY/SPX gap data by exit date (ET).
 * Fetches gap for each unique exit date and merges into trades.
 * Returns new trade array (does not mutate). Missing gap leaves fields undefined.
 */
export async function enrichTradesWithGapData(
  trades: Trade[],
  baseUrl: string,
  onProgress?: (done: number, total: number, date: string) => void
): Promise<Trade[]> {
  const exitDates = new Set<string>();
  trades.forEach((t) => exitDates.add(getAppDateKey(new Date(t.exitDate))));
  const dates = Array.from(exitDates);
  const gapByDate = new Map<
    string,
    { spy: SymbolGap; spx: SymbolGap }
  >();

  for (let i = 0; i < dates.length; i++) {
    const dateStr = dates[i];
    onProgress?.(i, dates.length, dateStr);
    const result = await fetchYahooGapForDate(baseUrl, dateStr);
    if (result.ok && result.spy != null && result.spx != null) {
      gapByDate.set(dateStr, { spy: result.spy, spx: result.spx });
    }
  }
  onProgress?.(dates.length, dates.length, "");

  return trades.map((t) => {
    const key = getAppDateKey(new Date(t.exitDate));
    const gap = gapByDate.get(key);
    if (!gap) return t;
    return {
      ...t,
      spyOpeningGapDollars: gap.spy.gapDollars ?? undefined,
      spyOpeningGapPercent: gap.spy.gapPercent ?? undefined,
      spxOpeningGapDollars: gap.spx.gapDollars ?? undefined,
      spxOpeningGapPercent: gap.spx.gapPercent ?? undefined,
    };
  });
}
