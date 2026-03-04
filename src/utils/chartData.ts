/** Timeframe options in ms (bar interval) */
export const TIMEFRAME_MS = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
  '1d': 86_400_000,
} as const;

export type TimeframeKey = keyof typeof TIMEFRAME_MS;

/**
 * Generate synthetic OHLC bars for a trade to display entry/exit on chart.
 * Produces TraderVue-style candlesticks with proper bodies and wicks.
 */
export function generateTradeChartData(
  entryTime: number,
  exitTime: number,
  entryPrice: number,
  exitPrice: number,
  barIntervalMs: number = TIMEFRAME_MS['5m']
): Array<[number, number, number, number, number, number]> {
  if (!Number.isFinite(entryTime) || !Number.isFinite(exitTime)) return [];
  const barInterval = Math.max(barIntervalMs, 60_000);
  const padBars = 3;
  const startTime = entryTime - padBars * barInterval;
  const endTime = exitTime + padBars * barInterval;
  const bars: Array<[number, number, number, number, number, number]> = [];
  const wickPct = 0.002; // Small wicks (~0.2% of price)
  const midPrice = (entryPrice + exitPrice) / 2;

  let time = startTime;
  let prevClose = entryPrice;

  while (time <= endTime) {
    const open = prevClose;
    let close: number;

    if (time < entryTime) {
      close = entryPrice;
    } else if (time > exitTime) {
      close = exitPrice;
    } else {
      const t = (time - entryTime) / (exitTime - entryTime);
      close = entryPrice + t * (exitPrice - entryPrice);
    }

    const priceRange = Math.abs(exitPrice - entryPrice) || midPrice * 0.01;
    const bodySize = Math.abs(close - open);
    const minBody = midPrice * 0.0015;
    const wickSize = Math.max(midPrice * wickPct, priceRange * 0.1);
    const high = Math.max(open, close) + (bodySize < minBody ? wickSize : wickSize * 0.5);
    const low = Math.min(open, close) - (bodySize < minBody ? wickSize : wickSize * 0.5);
    const volume = Math.round(500 + Math.abs(close - open) * 1000);

    bars.push([time, open, high, low, close, volume]);
    prevClose = close;
    time += barInterval;
  }

  return bars;
}
