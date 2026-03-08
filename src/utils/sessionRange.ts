export type SessionRangeMs = { fromMs: number; toMs: number };

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days of context before entry and after exit (Tradervue-style zoom-out) */
const PAD_DAYS_BEFORE = 5;
const PAD_DAYS_AFTER = 5;
/** Maximum total range (Polygon allows 50000 bars; 60 days at 15m ≈ 5760 bars) */
const MAX_RANGE_DAYS = 60;

/**
 * Full session range around a trade with generous padding for context.
 * Always fetches at least several days before/after so the chart can zoom out like Tradervue.
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

  const padBeforeMs = PAD_DAYS_BEFORE * MS_PER_DAY;
  const padAfterMs = PAD_DAYS_AFTER * MS_PER_DAY;
  let fromMs = entry - padBeforeMs;
  let toMs = exit + padAfterMs;

  const maxRangeMs = MAX_RANGE_DAYS * MS_PER_DAY;
  if (toMs - fromMs > maxRangeMs) {
    const mid = (entry + exit) / 2;
    fromMs = mid - maxRangeMs / 2;
    toMs = mid + maxRangeMs / 2;
  }

  return { fromMs, toMs };
}

