import { Trade, TradeExecution } from "@/types/trade";
import type { ImportSettings } from "./importSettings";

/**
 * Parses broker trade history CSV format with columns:
 * Account, T/D, S/D, Currency, Type, Side, Symbol, Qty, Price, Exec Time,
 * Comm, SEC, TAF, NSCC, Nasdaq, ECN Remove, ECN Add, Gross Proceeds, Net Proceeds,
 * Clr Broker, Liq, Note
 *
 * Uses Tradervue-style grouping algorithm:
 * - Sorted by execution timestamp (chronological)
 * - Grouped per symbol
 * - New trade when: side reversal, time gap since last flat, or split mode (every flat)
 */
interface ExecutionRow {
  account: string;
  tradeDate: string;
  settlementDate: string;
  currency: string;
  type: string;
  side: string;
  symbol: string;
  qty: number;
  price: number;
  execTime: string;
  netProceeds: number;
  note: string;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQuotes = !inQuotes;
    else if (c === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else current += c;
  }
  result.push(current.trim());
  return result;
}

/** Parse date/time as US Eastern (market time) - broker CSVs typically use Eastern */
function parseDate(dateStr: string, timeStr: string): Date {
  const dateParts = dateStr.trim().split("/");
  if (dateParts.length !== 3) return new Date(0); // invalid
  const [m, d, y] = dateParts.map(Number);
  if (isNaN(m) || isNaN(d) || isNaN(y) || m < 1 || m > 12 || d < 1 || d > 31) {
    return new Date(0);
  }
  const timeParts = (timeStr || "00:00:00").trim().split(":");
  const [h, min, s] = timeParts.map(Number);
  const mm = String(m).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  const hh = String(h || 0).padStart(2, "0");
  const mn = String(min || 0).padStart(2, "0");
  const ss = String(s || 0).padStart(2, "0");
  // US Eastern: EDT (Mar-Nov) = -04:00, EST = -05:00. Approximate: Apr-Oct use EDT
  const offset = m >= 3 && m <= 10 ? "-04:00" : "-05:00";
  const iso = `${y}-${mm}-${dd}T${hh}:${mn}:${ss}${offset}`;
  const d2 = new Date(iso);
  return Number.isFinite(d2.getTime()) ? d2 : new Date(y, m - 1, d, h || 0, min || 0, s || 0);
}

type ColumnMap = {
  account: number;
  tradeDate: number;
  settlementDate: number;
  currency: number;
  type: number;
  side: number;
  symbol: number;
  qty: number;
  price: number;
  execTime: number;
  netProceeds: number;
  note: number;
};

const IBKR_COLUMNS: ColumnMap = {
  account: 0,
  tradeDate: 1,
  settlementDate: 2,
  currency: 3,
  type: 4,
  side: 5,
  symbol: 6,
  qty: 7,
  price: 8,
  execTime: 9,
  netProceeds: 18,
  note: 21,
};

function findColumn(header: string[], names: string[]): number {
  const lower = header.map((h) => h.toLowerCase().replace(/\s+/g, ""));
  for (const name of names) {
    const n = name.toLowerCase().replace(/\s+/g, "");
    const idx = lower.findIndex((h) => h.includes(n) || n.includes(h));
    if (idx >= 0) return idx;
  }
  return -1;
}

function detectColumns(header: string[]): ColumnMap | null {
  const tradeDate = findColumn(header, ["t/d", "tradedate", "trade date", "date"]);
  const side = findColumn(header, ["side", "b/s", "action", "buy/sell"]);
  const symbol = findColumn(header, ["symbol", "underlying", "ticker"]);
  const qty = findColumn(header, ["qty", "quantity", "amount"]);
  const price = findColumn(header, ["price", "trade price", "exec price"]);
  const execTime = findColumn(header, ["exec time", "time", "exectime"]);
  if (tradeDate < 0 || side < 0 || symbol < 0 || qty < 0 || price < 0 || execTime < 0) {
    return null;
  }
  const idx = (names: string[], fallback: number) => {
    const i = findColumn(header, names);
    return i >= 0 ? i : fallback;
  };
  return {
    account: idx(["account"], 0),
    tradeDate,
    settlementDate: idx(["s/d", "settledate"], tradeDate),
    currency: idx(["currency"], 3),
    type: idx(["type"], 4),
    side,
    symbol,
    qty,
    price,
    execTime,
    netProceeds: idx(["net proceeds", "netproceeds"], 18),
    note: idx(["note"], 21),
  };
}

function parseRow(cols: string[], map: ColumnMap): ExecutionRow | null {
  const get = (key: keyof ColumnMap) => cols[map[key]]?.trim() ?? "";
  const getNum = (key: keyof ColumnMap) => parseFloat(cols[map[key]] || "0") || 0;
  const tradeDate = get("tradeDate");
  const side = get("side");
  const symbol = get("symbol");
  if (!tradeDate || !symbol || !side) return null;
  const qty = getNum("qty");
  if (!(qty > 0)) return null;
  return {
    account: get("account"),
    tradeDate,
    settlementDate: get("settlementDate"),
    currency: get("currency"),
    type: get("type"),
    side,
    symbol,
    qty,
    price: getNum("price"),
    execTime: get("execTime"),
    netProceeds: getNum("netProceeds"),
    note: get("note"),
  };
}

function generateId(): string {
  return `csv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Signed qty: B/BC add to position (+), S/SS reduce (-) */
function getSignedQty(row: ExecutionRow): number {
  if (row.side === "B" || row.side === "BC") return row.qty;
  return -row.qty;
}

function finalizeTrade(
  execs: ExecutionRow[],
  symbol: string,
  trades: Trade[]
): void {
  if (execs.length === 0) return;
  const first = execs[0];
  const last = execs[execs.length - 1];
  const entryDate = parseDate(first.tradeDate, first.execTime);
  const exitDate = parseDate(last.tradeDate, last.execTime);
  if (!Number.isFinite(entryDate.getTime()) || !Number.isFinite(exitDate.getTime())) return;
  const pnl = execs.reduce((s, e) => s + e.netProceeds, 0);
  const duration = Math.round((exitDate.getTime() - entryDate.getTime()) / 60000);

  // Entry sides: B (long) or SS (short). Exit: S (long) or BC (short).
  const entryExecs = execs.filter((e) => e.side === "B" || e.side === "SS");
  const exitExecs = execs.filter((e) => e.side === "S" || e.side === "BC");
  const entryQty = entryExecs.reduce((s, e) => s + e.qty, 0);
  const exitQty = exitExecs.reduce((s, e) => s + e.qty, 0);
  const entryPrice = entryQty > 0 ? entryExecs.reduce((s, e) => s + e.price * e.qty, 0) / entryQty : 0;
  const exitPrice = exitQty > 0 ? exitExecs.reduce((s, e) => s + e.price * e.qty, 0) / exitQty : 0;

  // Position: long if net B-S positive, short if net SS-BC
  let cumQty = 0;
  let maxLong = 0;
  let maxShort = 0;
  for (const e of execs) {
    cumQty += getSignedQty(e);
    if (cumQty > 0) maxLong = Math.max(maxLong, cumQty);
    if (cumQty < 0) maxShort = Math.max(maxShort, Math.abs(cumQty));
  }
  const isShort = maxShort > maxLong;
  const positionSize = isShort ? -Math.max(maxShort, maxLong) : Math.max(maxLong, maxShort);
  const costBasis = Math.abs(entryPrice * positionSize) || 1;
  const pnlPercentage = (pnl / costBasis) * 100;
  const strategyTag = first.type === "3" ? "Swing" : "Day Trade";
  const note = execs.find((e) => e.note)?.note || "";

  // Build executionsList with each fill
  let execCumQty = 0;
  const executionsList: TradeExecution[] = execs.map((e) => {
    const signedQty = getSignedQty(e);
    execCumQty += signedQty;
    const dt = parseDate(e.tradeDate, e.execTime);
    return {
      dateTime: dt.toISOString(),
      qty: signedQty,
      price: e.price,
      position: execCumQty,
      fees: 0,
    };
  });

  trades.push({
    id: generateId(),
    symbol,
    entryDate: entryDate.toISOString(),
    entryPrice,
    exitDate: exitDate.toISOString(),
    exitPrice,
    positionSize,
    tradeStyle: strategyTag,
    strategyTag,
    emotionalNotes: note || undefined,
    pnl,
    pnlPercentage,
    duration,
    executions: execs.length,
    executionsList,
  });
}

function processSymbol(
  execs: ExecutionRow[],
  settings: ImportSettings,
  trades: Trade[]
): void {
  const getDt = (r: ExecutionRow) => parseDate(r.tradeDate, r.execTime).getTime();
  const sorted = [...execs].sort((a, b) => getDt(a) - getDt(b));

  let currentTrade: ExecutionRow[] = [];
  let currentNetQty = 0;
  let currentSide: "long" | "short" | null = null;
  let lastCloseTime: Date | null = null;

  for (const row of sorted) {
    const signedQty = getSignedQty(row);
    const newNet = currentNetQty + signedQty;
    const rowTime = parseDate(row.tradeDate, row.execTime);

    // New trade: first exec, or whenever flat and opening again (no time threshold)
    const startNew =
      currentTrade.length === 0 || (currentNetQty === 0 && newNet !== 0);

    if (startNew && currentTrade.length > 0) {
      finalizeTrade(currentTrade, row.symbol, trades);
      currentTrade = [];
      lastCloseTime = null;
    }

    currentTrade.push(row);
    currentNetQty = newNet;
    currentSide = currentNetQty > 0 ? "long" : currentNetQty < 0 ? "short" : null;
    if (currentNetQty === 0) lastCloseTime = rowTime;
  }

  // Only finalize closed trades (position went flat at some point)
  if (currentTrade.length > 0 && currentNetQty === 0) {
    finalizeTrade(currentTrade, sorted[0].symbol, trades);
  }
}

export function parseTradeHistoryCSV(
  csvText: string,
  settings?: ImportSettings
): Trade[] {
  const opts = settings ?? {
    mergeMode: "split_when_possible" as const,
    timeThresholdSec: 300,
  };

  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = parseCSVLine(lines[0]);
  const map = detectColumns(header) ?? IBKR_COLUMNS;
  const minCols = Math.max(map.tradeDate, map.side, map.symbol, map.qty, map.price, map.execTime) + 1;
  if (header.length < minCols) return [];

  const rows: ExecutionRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row = parseRow(cols, map);
    if (row) rows.push(row);
  }

  const groups = new Map<string, ExecutionRow[]>();
  for (const row of rows) {
    const key = row.symbol;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  }

  const trades: Trade[] = [];
  for (const execs of groups.values()) {
    processSymbol(execs, opts, trades);
  }

  return trades.sort(
    (a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime()
  );
}
