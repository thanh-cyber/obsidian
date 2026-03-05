import { Trade } from "@/types/trade";

export type TradeSectionDimension =
  | "Hourly"
  | "Weekday"
  | "Month"
  | "Year"
  | "Entry Price"
  | "Cost"
  | "Volume"
  | "Side"
  | "Hold Time";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Numeric bucket edges for Entry Price, Cost, Volume (same style as reference) */
const NUMERIC_BUCKETS: [number, number][] = [
  [0, 5],
  [5, 9.99],
  [10, 19.99],
  [20, 49.99],
  [50, 99.99],
  [100, 499.99],
  [500, 999.99],
  [1000, 1999.99],
  [2000, 2999.99],
  [3000, 3999.99],
  [4000, 5999.99],
  [6000, 9999.99],
  [10000, Infinity],
];

/** Duration (minutes) buckets for Hold Time */
const DURATION_BUCKETS = [
  [0, 30],
  [30, 60],
  [60, 120],
  [120, 240],
  [240, 480],
  [480, 1440],
  [1440, Infinity],
];
const DURATION_LABELS = ["0-30 min", "30-60 min", "1-2 hr", "2-4 hr", "4-8 hr", "8-24 hr", "> 1 day"];

function getBucketKey(trade: Trade, dimension: TradeSectionDimension): string {
  const exit = new Date(trade.exitDate);
  const pnl = Number(trade.pnl) || 0;
  const positionSize = Number(trade.positionSize) || 0;
  const entryPrice = Number(trade.entryPrice) || 0;
  const duration = Number(trade.duration) || 0;
  const cost = Math.abs(positionSize * entryPrice) || 0;
  const shares = Math.abs(positionSize) || 0;

  switch (dimension) {
    case "Hourly":
      return String(exit.getHours());
    case "Weekday":
      return String(exit.getDay());
    case "Month":
      return `${exit.getFullYear()}-${String(exit.getMonth() + 1).padStart(2, "0")}`;
    case "Year":
      return String(exit.getFullYear());
    case "Entry Price": {
      const p = entryPrice;
      const idx = NUMERIC_BUCKETS.findIndex(([lo, hi]) => p >= lo && (hi === Infinity ? true : p <= hi));
      return idx >= 0 ? String(idx) : String(NUMERIC_BUCKETS.length - 1);
    }
    case "Cost": {
      const idx = NUMERIC_BUCKETS.findIndex(([lo, hi]) => cost >= lo && (hi === Infinity ? true : cost <= hi));
      return idx >= 0 ? String(idx) : String(NUMERIC_BUCKETS.length - 1);
    }
    case "Volume": {
      const idx = NUMERIC_BUCKETS.findIndex(([lo, hi]) => shares >= lo && (hi === Infinity ? true : shares <= hi));
      return idx >= 0 ? String(idx) : String(NUMERIC_BUCKETS.length - 1);
    }
    case "Side":
      return positionSize > 0 ? "Long" : "Short";
    case "Hold Time": {
      const idx = DURATION_BUCKETS.findIndex(([lo, hi]) => duration >= lo && (hi === Infinity ? true : duration < hi));
      return idx >= 0 ? String(idx) : String(DURATION_BUCKETS.length - 1);
    }
    default:
      return "?";
  }
}

export function getBucketLabel(key: string, dimension: TradeSectionDimension): string {
  switch (dimension) {
    case "Hourly":
      return key === "0" ? "12am" : Number(key) < 12 ? `${key}am` : Number(key) === 12 ? "12pm" : `${Number(key) - 12}pm`;
    case "Weekday":
      return WEEKDAY_LABELS[Number(key)] ?? key;
    case "Month": {
      const [y, m] = key.split("-");
      return m ? `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}` : key;
    }
    case "Year":
      return key;
    case "Entry Price":
    case "Cost":
    case "Volume": {
      const idx = parseInt(key, 10);
      if (isNaN(idx) || idx < 0 || idx >= NUMERIC_BUCKETS.length) return key;
      const [lo, hi] = NUMERIC_BUCKETS[idx];
      return hi === Infinity ? `${lo} and Over` : `${lo} - ${hi.toFixed(hi >= 1000 ? 0 : 2)}`;
    }
    case "Side":
      return key;
    case "Hold Time": {
      const idx = parseInt(key, 10);
      return DURATION_LABELS[idx] ?? key;
    }
    default:
      return key;
  }
}

export interface BucketRow {
  name: string;
  key: string;
  pnl: number;
  trades: number;
  shares: number;
  mistakes: number;
  profitFactor: number;
  winPct: number;
  winCount: number;
  lossCount: number;
}

function getSortOrder(dimension: TradeSectionDimension): (a: BucketRow, b: BucketRow) => number {
  switch (dimension) {
    case "Hourly":
      return (a, b) => Number(a.key) - Number(b.key);
    case "Weekday":
      return (a, b) => Number(a.key) - Number(b.key);
    case "Month":
    case "Year":
      return (a, b) => a.key.localeCompare(b.key);
    case "Entry Price":
    case "Cost":
    case "Volume":
    case "Hold Time":
      return (a, b) => Number(a.key) - Number(b.key);
    case "Side":
      return (a, b) => (a.key === "Long" ? -1 : 1) - (b.key === "Long" ? -1 : 1);
    default:
      return () => 0;
  }
}

export function buildTradeSectionBucketData(
  trades: Trade[],
  dimension: TradeSectionDimension
): BucketRow[] {
  const map = new Map<
    string,
    { pnl: number; trades: number; shares: number; mistakes: number; winSum: number; lossSum: number; winCount: number; lossCount: number }
  >();

  trades.forEach((t) => {
    const key = getBucketKey(t, dimension);
    const cur = map.get(key) ?? {
      pnl: 0,
      trades: 0,
      shares: 0,
      mistakes: 0,
      winSum: 0,
      lossSum: 0,
      winCount: 0,
      lossCount: 0,
    };
    const pnl = Number(t.pnl) || 0;
    cur.pnl += pnl;
    cur.trades += 1;
    cur.shares += Math.abs(Number(t.positionSize) || 0);
    if (pnl < 0) {
      cur.mistakes += 1;
      cur.lossCount += 1;
      cur.lossSum += Math.abs(pnl);
    } else if (pnl > 0) {
      cur.winCount += 1;
      cur.winSum += pnl;
    }
    map.set(key, cur);
  });

  const rows: BucketRow[] = [];
  map.forEach((v, key) => {
    const winCount = v.winCount;
    const lossCount = v.lossCount;
    const winPct = v.trades > 0 ? (100 * winCount) / v.trades : 0;
    const profitFactor = v.lossSum > 0 ? v.winSum / v.lossSum : v.winSum > 0 ? 999 : 0;
    rows.push({
      name: getBucketLabel(key, dimension),
      key,
      pnl: v.pnl,
      trades: v.trades,
      shares: Math.round(v.shares * 100) / 100,
      mistakes: v.mistakes,
      profitFactor: Number.isFinite(profitFactor) ? profitFactor : 0,
      winPct,
      winCount,
      lossCount,
    });
  });

  rows.sort(getSortOrder(dimension));
  return rows;
}
