/**
 * Merge Float, Market Cap, Outstanding Shares from an Excel file into trades JSON.
 * Uses same logic as app: UTC date keys, normalizeSymbol, exact match + same ticker near date range.
 * Usage: node scripts/merge-stock-data.mjs <trades.json> <stock-data.xlsx> [output.json]
 */

import XLSX from "xlsx";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

function toDateKeyUTC(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function normalizeSymbol(s) {
  return String(s)
    .trim()
    .toUpperCase()
    .replace(/\./g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalSymbol(s) {
  return normalizeSymbol(s).replace(/[^A-Z0-9-]/g, "");
}

function normHeader(h) {
  return String(h ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

function toNum(val) {
  if (val == null) return undefined;
  if (typeof val === "number" && Number.isFinite(val)) return val;
  let s = String(val).replace(/,/g, "").trim().toUpperCase();
  const mult = s.endsWith("B") ? 1e9 : s.endsWith("M") ? 1e6 : s.endsWith("K") ? 1e3 : 1;
  if (mult !== 1) s = s.slice(0, -1).trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n * mult : undefined;
}

function parseDateToKey(val) {
  if (val == null) return null;
  let date;
  if (typeof val === "number" && Number.isFinite(val)) {
    date = new Date((val - 25569) * 86400 * 1000);
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
  }
  if (!Number.isFinite(date.getTime())) return null;
  return toDateKeyUTC(date);
}

function getTradeExitDateKey(exitDate) {
  const s = String(exitDate).trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (isoMatch) return isoMatch[1] + "-" + isoMatch[2] + "-" + isoMatch[3];
  return toDateKeyUTC(new Date(exitDate));
}

function lookupKey(symbol, dateKey) {
  return `${canonicalSymbol(symbol)}|${dateKey}`;
}

function parseStockDataXlsx(xlsxPath) {
  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  if (!json.length) return [];
  const rawKeys = Object.keys(json[0] ?? {});
  const headers = rawKeys.map(normHeader);
  const idx = (names) => {
    const i = headers.findIndex((h) => names.some((n) => h.includes(n) || n.includes(h)));
    return i >= 0 ? rawKeys[i] ?? null : null;
  };
  const symbolKey = idx(["symbol", "ticker", "tickers"]);
  const dateKey = idx(["date", "trade date", "exit date"]);
  const floatKey = idx(["float", "float (mil", "float shares", "share float"]);
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
  const rows = [];
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
    rows.push({ symbol: sym, dateKey: dKey, float, marketCap, outstandingShares });
  }
  return rows;
}

function mergeStockDataIntoTrades(trades, rows) {
  const exactMap = new Map();
  const bySymbol = new Map();
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

  const tradeDateKeysBySymbol = new Map();
  for (const t of trades) {
    const can = canonicalSymbol(t.symbol);
    const keys = tradeDateKeysBySymbol.get(can) ?? [];
    keys.push(getTradeExitDateKey(t.exitDate));
    tradeDateKeysBySymbol.set(can, keys);
  }

  const bestRowBySymbol = new Map();
  for (const [symbol, dateKeys] of tradeDateKeysBySymbol) {
    const list = bySymbol.get(symbol);
    if (!list?.length) continue;
    const datedRows = list.filter((r) => r.dateKey !== "*");
    const symbolOnlyRows = list.filter((r) => r.dateKey === "*");
    let best;
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
        const bestInRange = best
          ? new Date(best.dateKey).getTime() >= minT && new Date(best.dateKey).getTime() <= maxT
          : false;
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

const tradesPath = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(process.cwd(), "trades.json");
const xlsxPath = process.argv[3]
  ? resolve(process.argv[3])
  : resolve("C:/Users/johnn/stock_data_plotly/Final Output.xlsx");
const outPath = process.argv[4]
  ? resolve(process.argv[4])
  : resolve(process.cwd(), "merged-trades.json");

let trades;
try {
  trades = JSON.parse(readFileSync(tradesPath, "utf8"));
} catch (e) {
  console.error("Could not read trades from:", tradesPath);
  process.exit(1);
}
if (!Array.isArray(trades)) {
  console.error("trades.json must be an array of trade objects.");
  process.exit(1);
}

let rows;
try {
  rows = parseStockDataXlsx(xlsxPath);
} catch (e) {
  console.error("Could not read Excel:", xlsxPath, e.message);
  process.exit(1);
}

const merged = mergeStockDataIntoTrades(trades, rows);
let updated = 0;
for (let i = 0; i < trades.length; i++) {
  const a = trades[i];
  const b = merged[i];
  if (
    (b.float !== undefined && b.float !== a.float) ||
    (b.marketCap !== undefined && b.marketCap !== a.marketCap) ||
    (b.outstandingShares !== undefined && b.outstandingShares !== a.outstandingShares)
  )
    updated++;
}

writeFileSync(outPath, JSON.stringify(merged, null, 2), "utf8");
console.log(`Merged: ${rows.length} rows from Excel → ${updated} trades updated.`);
console.log(`Saved: ${outPath}`);
console.log("Import this file in the app (Settings → Import Trades) to apply.");
