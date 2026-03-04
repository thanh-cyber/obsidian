export type SessionRangeMs = { fromMs: number; toMs: number };

/**
 * Heuristic "full session" range around a trade.
 *
 * We intentionally use a wide, timezone-agnostic padding so the chart includes
 * premarket/regular/afterhours without needing exchange calendars.
 */
export function getFullSessionRangeMs(entryTimeMs: number, exitTimeMs: number): SessionRangeMs {
  const entry = Number(entryTimeMs);
  const exit = Number(exitTimeMs);
  if (!Number.isFinite(entry) || !Number.isFinite(exit)) {
    return { fromMs: 0, toMs: 0 };
  }
  if (entry >= exit) {
    return { fromMs: exit, toMs: entry };
  }

  const padMs = 12 * 60 * 60 * 1000; // 12h before entry, 12h after exit (covers extended hours)
  let fromMs = entry - padMs;
  let toMs = exit + padMs;

  // Polygon limit is high, but keep requests bounded for safety.
  const maxRangeMs = 30 * 24 * 60 * 60 * 1000; // 30 days
  if (toMs - fromMs > maxRangeMs) {
    const mid = (entry + exit) / 2;
    fromMs = mid - maxRangeMs / 2;
    toMs = mid + maxRangeMs / 2;
  }

  return { fromMs, toMs };
}

