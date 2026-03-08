/**
 * Read app-exported trades CSV + Excel (Final Output), fill float/mcap/outstanding for SHORT trades, output JSON.
 * Usage: node scripts/merge-csv-with-excel.mjs <trades.csv> <stock-data.xlsx> [output.json]
 */

import XLSX from "xlsx";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { randomBytes } from "crypto";

function toDateKeyUTC(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  const d = date.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function normalizeSymbol(s) {
  return String(s).trim().toUpperCase().replace(/\./g, "-").replace(/\s+/g, " ").trim();
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

function parseAppCSV(csvPath) {
  const text = readFileSync(csvPath, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0];
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const parts = line.split(",").map((p) => p.replace(/^"|"$/g, "").replace(/""/g, '"').trim());
    if (parts.length < 11) continue;
    const symbol = parts[0];
    const entryDate = parts[1];
    const entryPrice = parseFloat(parts[2]);
    const exitDate = parts[3];
    const exitPrice = parseFloat(parts[4]);
    const positionSize = parseInt(parts[5], 10);
    const strategyTag = parts[6] || "Other";
    const pnl = parseFloat(parts[7]);
    const pnlPercentage = parseFloat(parts[8]);
    const duration = parseInt(parts[9], 10) || 0;
    const emotionalNotes = parts[10] || "";
    if (!symbol || !exitDate || Number.isNaN(entryPrice) || Number.isNaN(exitPrice) || Number.isNaN(positionSize)) continue;
    const entry = new Date(entryDate);
    const exit = new Date(exitDate);
    const durationMin = Number.isFinite(duration) ? duration : Math.round((exit - entry) / 60000);
    rows.push({
      id: "csv_" + Date.now() + "_" + randomBytes(4).toString("hex"),
      symbol,
      entryDate,
      entryPrice,
      exitDate,
      exitPrice,
      positionSize,
      strategyTag,
      pnl: Number.isFinite(pnl) ? pnl : 0,
      pnlPercentage: Number.isFinite(pnlPercentage) ? pnlPercentage : 0,
      duration: durationMin,
      emotionalNotes,
    });
  }
  return rows;
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
    if (float === undefined && marketCap === undefined && outstandingShares === undefined) continue;
    rows.push({ symbol: sym, dateKey: dKey, float, marketCap, outstandingShares });
  }
  return rows;
}

function mergeExcelIntoShortTrades(trades, rows) {
  const exactMap = new Map();
  const bySymbol = new Map();
  for (const r of rows) {
    exactMap.set(lookupKey(r.symbol, r.dateKey), r);
    const can = canonicalSymbol(r.symbol);
    const list = bySymbol.get(can) ?? [];
    list.push(r);
    bySymbol.set(can, list);
  }
  for (const list of bySymbol.values()) list.sort((a, b) => a.dateKey.localeCompare(b.dateKey));

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
    } else continue;
    bestRowBySymbol.set(symbol, best);
  }

  return trades.map((t) => {
    const isShort = t.positionSize < 0;
    if (!isShort) return t;
    const dateKey = getTradeExitDateKey(t.exitDate);
    let row = exactMap.get(lookupKey(t.symbol, dateKey));
    if (!row) row = bestRowBySymbol.get(canonicalSymbol(t.symbol));
    if (!row) return t;
    return {
      ...t,
      float: row.float !== undefined ? row.float : t.float,
      marketCap: row.marketCap !== undefined ? row.marketCap : t.marketCap,
      outstandingShares: row.outstandingShares !== undefined ? row.outstandingShares : t.outstandingShares,
    };
  });
}

const csvPath = resolve(process.argv[2] || "");
const xlsxPath = resolve(process.argv[3] || "C:/Users/johnn/stock_data_plotly/Final Output.xlsx");
const outPath = resolve(process.argv[4] || process.argv[2]?.replace(/\.csv$/i, "_merged.json") || "merged-trades.json");

if (!process.argv[2]) {
  console.error("Usage: node scripts/merge-csv-with-excel.mjs <trades.csv> [stock-data.xlsx] [output.json]");
  process.exit(1);
}

let trades;
try {
  trades = parseAppCSV(csvPath);
} catch (e) {
  console.error("Could not read CSV:", csvPath, e.message);
  process.exit(1);
}
if (!trades.length) {
  console.error("No trades parsed from CSV.");
  process.exit(1);
}

let rows;
try {
  rows = parseStockDataXlsx(xlsxPath);
} catch (e) {
  console.error("Could not read Excel:", xlsxPath, e.message);
  process.exit(1);
}

const merged = mergeExcelIntoShortTrades(trades, rows);
const shortCount = trades.filter((t) => t.positionSize < 0).length;
let filled = 0;
for (let i = 0; i < trades.length; i++) {
  if (trades[i].positionSize >= 0) continue;
  const b = merged[i];
  if (b.float !== undefined || b.marketCap !== undefined || b.outstandingShares !== undefined) filled++;
}

writeFileSync(outPath, JSON.stringify(merged, null, 2), "utf8");
console.log(`Parsed ${trades.length} trades from CSV (${shortCount} short).`);
console.log(`Excel: ${rows.length} rows. Filled float/mcap/outstanding for ${filled} short trades.`);
console.log(`Saved: ${outPath}`);
console.log("Import this JSON in the app (Settings → Import Trades).");
