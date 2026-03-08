import * as XLSX from "xlsx";
import type { Trade } from "@/types/trade";

/** Format date as YYYY-MM-DD using UTC so Excel serial and trade dates match regardless of timezone */
function toDateKeyUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export interface StockDataRow {
  symbol: string;
  dateKey: string;
  float?: number;
  marketCap?: number;
  outstandingShares?: number;
}

/** Normalize header for matching: lowercase, trim, collapse spaces */
function normHeader(h: string): string {
  return String(h ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Parse a value as number; supports M/B/K suffixes (e.g. "142.7M" -> 142700000). Returns undefined if not a number. */
function toNum(val: unknown): number | undefined {
  if (val == null) return undefined;
  if (typeof val === "number" && Number.isFinite(val)) return val;
  let s = String(val).replace(/,/g, "").trim().toUpperCase();
  const mult = s.endsWith("B") ? 1e9 : s.endsWith("M") ? 1e6 : s.endsWith("K") ? 1e3 : 1;
  if (mult !== 1) s = s.slice(0, -1).trim();
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return undefined;
  return n * mult;
}

/**
 * Parse date from Excel (serial number or string) to YYYY-MM-DD.
 * Handles DD/MM/YYYY (e.g. 05/12/2023 = 5 Dec 2023) so Excel dates match trade dates.
 */
function parseDateToKey(val: unknown): string | null {
  if (val == null) return null;
  let date: Date;
  if (typeof val === "number" && Number.isFinite(val)) {
    const serial = val as number;
    date = new Date((serial - 25569) * 86400 * 1000);
    if (!Number.isFinite(date.getTime())) return null;
  } else {
    const s = String(val).trim();
    const dmy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
    if (dmy) {
      const day = parseInt(dmy[1], 10);
      const month = parseInt(dmy[2], 10);
      const year = parseInt(dmy[3], 10);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        date = new Date(Date.UTC(year, month - 1, day));
        if (Number.isFinite(date.getTime())) return toDateKeyUTC(date);
      }
    }
    date = new Date(s);
    if (!Number.isFinite(date.getTime())) return null;
  }
  return toDateKeyUTC(date);
}

/**
 * Parse an Excel file (.xlsx) for stock data: Float, Market Cap, Outstanding Shares.
 * Expects columns for symbol/ticker, date, and optional float, market cap, outstanding.
 * Returns rows keyed by symbol + date (YYYY-MM-DD in app timezone) for merging into trades.
 */
export function parseStockDataXlsx(file: File): Promise<StockDataRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data || !(data instanceof ArrayBuffer)) {
          reject(new Error("Failed to read file"));
          return;
        }
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error("Workbook has no sheets"));
          return;
        }
        const sheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        if (!json.length) {
          resolve([]);
          return;
        }
        const headers = Object.keys(json[0] ?? {}).map(normHeader);
        const rawKeys = Object.keys(json[0] ?? {});

        const idx = (names: string[]) => {
          const i = headers.findIndex((h) => names.some((n) => h.includes(n) || n.includes(h)));
          return i >= 0 ? rawKeys[i] ?? null : null;
        };
        const symbolKey = idx(["symbol", "ticker", "tickers"]);
        const dateKey = idx(["date", "trade date", "exit date"]);
        const floatKey = idx([
          "float",
          "float (mil",
          "float shares",
          "share float",
        ]);
        const marketCapKey = idx([
          "total day mcap",
          "market cap (mil",
          "market cap",
          "marketcap",
          "mkt cap",
          "mcap",
          "cap",
        ]);
        const outstandingKey = idx([
          "outstanding",
          "outstanding shares (mil",
          "outstanding shares",
          "shares outstanding",
          "shares out",
        ]);

        const rows: StockDataRow[] = [];
        for (const row of json) {
          const rawSym = symbolKey ? String(row[symbolKey] ?? "").trim() : "";
          const sym = rawSym ? normalizeSymbol(rawSym) : "";
          if (!sym) continue;
          const parsedDate = dateKey ? parseDateToKey(row[dateKey]) : null;
          const dKey = parsedDate ?? "*";
          const float = floatKey ? toNum(row[floatKey]) : undefined;
          const marketCap = marketCapKey ? toNum(row[marketCapKey]) : undefined;
          const outstandingShares = outstandingKey ? toNum(row[outstandingKey]) : undefined;
          if (float === undefined && marketCap === undefined && outstandingShares === undefined)
            continue;
          rows.push({
            symbol: sym,
            dateKey: dKey,
            float,
            marketCap,
            outstandingShares,
          });
        }
        resolve(rows);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Parse error"));
      }
    };
    reader.onerror = () => reject(new Error("File read error"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Normalize symbol for display/keys: trim, uppercase, dot → dash, collapse spaces.
 */
function normalizeSymbol(s: string): string {
  return String(s)
    .trim()
    .toUpperCase()
    .replace(/\./g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Canonical symbol for matching: only A–Z, 0–9, hyphen. So "SHOT", "SHOT ", "SOXL*" all match.
 */
function canonicalSymbol(s: string): string {
  return normalizeSymbol(s).replace(/[^A-Z0-9-]/g, "");
}

/** Build lookup key for symbol + dateKey (exported for debug when 0 matches) */
export function buildStockDataLookupKey(symbol: string, dateKey: string): string {
  return `${normalizeSymbol(symbol)}|${dateKey}`;
}

function lookupKey(symbol: string, dateKey: string): string {
  return buildStockDataLookupKey(symbol, dateKey);
}

/**
 * Get YYYY-MM-DD for a trade's exit date (exported for debug).
 * ISO-style (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss) is parsed as-is. Otherwise use UTC date parts.
 */
export function getTradeExitDateKey(exitDate: string): string {
  const s = String(exitDate).trim();
  const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoDateMatch) return isoDateMatch[1] + "-" + isoDateMatch[2] + "-" + isoDateMatch[3];
  return toDateKeyUTC(new Date(exitDate));
}

/** Return the lookup key for a trade (for debug when 0 matches). */
export function getTradeStockDataKey(t: Trade): string {
  return buildStockDataLookupKey(t.symbol, getTradeExitDateKey(t.exitDate));
}

/**
 * Merge parsed stock data into trades by matching symbol and exit date (as date key).
 * If no exact (symbol, date) match, uses the same ticker's Excel row whose date is nearest
 * to the trade's date range for that symbol—so one row per ticker can fill all trades with
 * that ticker when the Excel date is near the period you traded it.
 * Does not mutate the original array; returns new trade objects.
 */
export function mergeStockDataIntoTrades(
  trades: Trade[],
  rows: StockDataRow[]
): Trade[] {
  const exactMap = new Map<string, StockDataRow>();
  const bySymbol = new Map<string, StockDataRow[]>();
  for (const r of rows) {
    exactMap.set(lookupKey(r.symbol, r.dateKey), r);
    const can = canonicalSymbol(r.symbol);
    const list = bySymbol.get(can) ?? [];
    list.push(r);
    bySymbol.set(can, list);
  }
  for (const list of bySymbol.values()) {
    list.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }

  const tradeDateKeysBySymbol = new Map<string, string[]>();
  for (const t of trades) {
    const can = canonicalSymbol(t.symbol);
    const keys = tradeDateKeysBySymbol.get(can) ?? [];
    keys.push(getTradeExitDateKey(t.exitDate));
    tradeDateKeysBySymbol.set(can, keys);
  }

  const bestRowBySymbol = new Map<string, StockDataRow>();
  for (const [symbol, dateKeys] of tradeDateKeysBySymbol) {
    const list = bySymbol.get(symbol);
    if (!list?.length) continue;
    const datedRows = list.filter((r) => r.dateKey !== "*");
    const symbolOnlyRows = list.filter((r) => r.dateKey === "*");
    let best: StockDataRow;
    if (datedRows.length > 0) {
      const realDates = dateKeys.filter((d) => d !== "*");
      const minD = realDates.reduce((a, b) => (a <= b ? a : b), "9999-99-99");
      const maxD = realDates.reduce((a, b) => (a >= b ? a : b), "0000-00-00");
      const minT = new Date(minD).getTime();
      const maxT = new Date(maxD).getTime();
      const midT = (minT + maxT) / 2;
      best = datedRows.reduce((best, r) => {
        const rT = new Date(r.dateKey).getTime();
        const inRange = rT >= minT && rT <= maxT;
        const bestInRange = best ? new Date(best.dateKey).getTime() >= minT && new Date(best.dateKey).getTime() <= maxT : false;
        if (inRange && !bestInRange) return r;
        if (!inRange && bestInRange) return best;
        const bestDist = best ? Math.abs(new Date(best.dateKey).getTime() - midT) : Infinity;
        const rDist = Math.abs(rT - midT);
        return rDist < bestDist ? r : best;
      }, datedRows[0]);
    } else if (symbolOnlyRows.length > 0) {
      best = symbolOnlyRows[0];
    } else {
      continue;
    }
    bestRowBySymbol.set(symbol, best);
  }

  return trades.map((t) => {
    const dateKey = getTradeExitDateKey(t.exitDate);
    let row = exactMap.get(lookupKey(t.symbol, dateKey));
    if (!row) row = bestRowBySymbol.get(canonicalSymbol(t.symbol));
    if (!row) return t;
    return {
      ...t,
      float: row.float !== undefined ? row.float : t.float,
      marketCap: row.marketCap !== undefined ? row.marketCap : t.marketCap,
      outstandingShares:
        row.outstandingShares !== undefined ? row.outstandingShares : t.outstandingShares,
    };
  });
}
