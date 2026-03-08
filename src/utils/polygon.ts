/**
 * Fetch intraday OHLC bars from Polygon.io for a ticker and time range.
 * Used by Trade Detail chart to display real price data during a trade.
 */

import type { TimeframeKey } from "./chartData";

type PolygonBar = { t: number; o: number; h: number; l: number; c: number; v: number };

/** Polygon API params: { multiplier, timespan } */
const TIMEFRAME_TO_POLYGON = {
  "1m": { multiplier: 1, timespan: "minute" as const },
  "5m": { multiplier: 5, timespan: "minute" as const },
  "15m": { multiplier: 15, timespan: "minute" as const },
  "1h": { multiplier: 1, timespan: "hour" as const },
  "1d": { multiplier: 1, timespan: "day" as const },
} satisfies Record<TimeframeKey, { multiplier: number; timespan: "minute" | "hour" | "day" }>;

/** Chart format: [time (ms), open, high, low, close, volume] */
export type ChartBar = [number, number, number, number, number, number];

interface PolygonResponse {
  status: string;
  results?: PolygonBar[];
  resultsCount?: number;
}

export async function fetchPolygonBars(
  symbol: string,
  fromMs: number,
  toMs: number,
  timeframe: TimeframeKey,
  apiKey: string
): Promise<ChartBar[]> {
  const { multiplier, timespan } = TIMEFRAME_TO_POLYGON[timeframe];
  const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol.toUpperCase())}/range/${multiplier}/${timespan}/${fromMs}/${toMs}?adjusted=false&sort=asc&limit=50000`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Polygon API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json: PolygonResponse = await res.json();
  if (json.status !== "OK" || !json.results?.length) {
    return [];
  }

  return json.results
    .filter(
      (bar) =>
        Number.isFinite(bar.t) &&
        Number.isFinite(bar.o) &&
        Number.isFinite(bar.h) &&
        Number.isFinite(bar.l) &&
        Number.isFinite(bar.c)
    )
    .map((bar) => [bar.t, bar.o, bar.h, bar.l, bar.c, bar.v ?? 0] as ChartBar);
}
