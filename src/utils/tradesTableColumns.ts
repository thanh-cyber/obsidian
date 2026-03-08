import { Trade } from "@/types/trade";
import { formatAppDate, formatAppDateTime } from "@/utils/appDateTime";
import { getTradeMfeMae } from "@/utils/calculations";

export type TradeColumnId = string;

export interface TradeColumnDef {
  id: TradeColumnId;
  label: string;
  render: (trade: Trade) => React.ReactNode;
}

const STORAGE_KEY = "trades_table_columns_v1";

// Keep this list in the same order as the “available columns” UI.
export const ALL_TRADE_COLUMN_LABELS: string[] = [
  "Status",
  "Float",
  "Market Cap",
  "Open Date",
  "Symbol",
  "Entry",
  "Exit",
  "Size",
  "Return $",
  "Return %",
  "Side",
  "Trade Style",
  "Setups",
  "Mistakes",
  "Avg Buy",
  "Avg Entry",
  "Avg Exit",
  "Avg Sell",
  "Best Exit $",
  "Best Exit %",
  "Call/Put",
  "Close Date",
  "Close Time",
  "Commissions",
  "Cost",
  "Executions",
  "Expectancy",
  "Expire",
  "Fees",
  "Gross R-Multiple",
  "Hold Time",
  "Last Order",
  "Net Return %",
  "Note",
  "Open Time",
  "Outstanding Shares",
  "Portfolio",
  "Position",
  "Position Mae",
  "Position Mfe",
  "Price Mae",
  "Price Mfe",
  "Privacy",
  "Profit Aim",
  "Return Net",
  "Return/Share",
  "Risk",
  "Sector",
  "Spread",
  "Stops",
];

export const DEFAULT_TRADE_COLUMN_IDS: TradeColumnId[] = [
  labelToId("Status"),
  labelToId("Open Date"),
  labelToId("Symbol"),
  labelToId("Entry"),
  labelToId("Exit"),
  labelToId("Size"),
  labelToId("Return $"),
  labelToId("Return %"),
  labelToId("Side"),
  labelToId("Trade Style"),
  labelToId("Setups"),
  labelToId("Mistakes"),
  labelToId("Note"),
];

export function labelToId(label: string): TradeColumnId {
  return label
    .trim()
    .toLowerCase()
    .replaceAll("%", "pct")
    .replaceAll("$", "usd")
    .replaceAll("/", "-")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
}

function fmtMoney(v: number) {
  if (!Number.isFinite(v)) return "—";
  const s = Math.abs(v).toFixed(2);
  return v >= 0 ? `$${s}` : `-$${s}`;
}

function fmtPct(v: number) {
  if (!Number.isFinite(v)) return "—";
  return `${v.toFixed(2)}%`;
}

function sumFees(trade: Trade): number {
  if (!trade.executionsList?.length) return 0;
  return trade.executionsList.reduce((s, e) => s + (e.fees ?? 0), 0);
}

function statusFromPnl(pnl: number): string {
  if (pnl > 0) return "Win";
  if (pnl < 0) return "Loss";
  return "BE";
}

function sideFromSize(positionSize: number | null | undefined): string {
  const n = Number(positionSize);
  if (Number.isFinite(n) && n > 0) return "Long";
  if (Number.isFinite(n) && n < 0) return "Short";
  return "—";
}

function holdTime(trade: Trade): string {
  const min = trade.duration;
  if (!Number.isFinite(min)) return "—";
  if (min < 1) return "< 1 Min";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h >= 1) return m > 0 ? `${h} Hr ${m} Mins` : `${h} Hr${h !== 1 ? "s" : ""}`;
  return `${Math.round(min)} Mins`;
}

function safeText(v: unknown): string {
  if (typeof v === "string" && v.trim()) return v;
  return "—";
}

export function buildTradeColumnDefs(): TradeColumnDef[] {
  const byLabel = new Map<string, TradeColumnDef>();

  // Supported / derived columns
  byLabel.set("Status", {
    id: labelToId("Status"),
    label: "Status",
    render: (t) => statusFromPnl(t.pnl),
  });
  byLabel.set("Float", {
    id: labelToId("Float"),
    label: "Float",
    render: (t) =>
      t.float != null && Number.isFinite(t.float)
        ? t.float.toLocaleString(undefined, { maximumFractionDigits: 0 })
        : "—",
  });
  byLabel.set("Market Cap", {
    id: labelToId("Market Cap"),
    label: "Market Cap",
    render: (t) =>
      t.marketCap != null && Number.isFinite(t.marketCap)
        ? t.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })
        : "—",
  });
  byLabel.set("Open Date", {
    id: labelToId("Open Date"),
    label: "Open Date",
    render: (t) => formatAppDate(new Date(t.entryDate)),
  });
  byLabel.set("Symbol", {
    id: labelToId("Symbol"),
    label: "Symbol",
    render: (t) => t.symbol,
  });
  byLabel.set("Entry", {
    id: labelToId("Entry"),
    label: "Entry",
    render: (t) => (Number.isFinite(Number(t.entryPrice)) ? `$${Number(t.entryPrice).toFixed(2)}` : "—"),
  });
  byLabel.set("Exit", {
    id: labelToId("Exit"),
    label: "Exit",
    render: (t) => (Number.isFinite(Number(t.exitPrice)) ? `$${Number(t.exitPrice).toFixed(2)}` : "—"),
  });
  byLabel.set("Size", {
    id: labelToId("Size"),
    label: "Size",
    render: (t) => {
      const n = Number(t.positionSize);
      return Number.isFinite(n) ? Math.abs(n).toString() : "—";
    },
  });
  byLabel.set("Return $", {
    id: labelToId("Return $"),
    label: "Return $",
    render: (t) => fmtMoney(t.pnl),
  });
  byLabel.set("Return %", {
    id: labelToId("Return %"),
    label: "Return %",
    render: (t) => fmtPct(t.pnlPercentage),
  });
  byLabel.set("Side", {
    id: labelToId("Side"),
    label: "Side",
    render: (t) => sideFromSize(t.positionSize ?? undefined),
  });
  byLabel.set("Trade Style", {
    id: labelToId("Trade Style"),
    label: "Trade Style",
    render: (t) => safeText(t.tradeStyle ?? t.strategyTag),
  });
  byLabel.set("Setups", {
    id: labelToId("Setups"),
    label: "Setups",
    render: (t) => (t.setups?.length ? t.setups.join(", ") : "—"),
  });
  byLabel.set("Mistakes", {
    id: labelToId("Mistakes"),
    label: "Mistakes",
    render: (t) => {
      const arr = t.mistakes?.length ? t.mistakes : (t.mistake ? [t.mistake] : []);
      return arr.length ? arr.join(", ") : "—";
    },
  });
  byLabel.set("Close Date", {
    id: labelToId("Close Date"),
    label: "Close Date",
    render: (t) => formatAppDate(new Date(t.exitDate)),
  });
  byLabel.set("Close Time", {
    id: labelToId("Close Time"),
    label: "Close Time",
    render: (t) => formatAppDateTime(new Date(t.exitDate)),
  });
  byLabel.set("Open Time", {
    id: labelToId("Open Time"),
    label: "Open Time",
    render: (t) => formatAppDateTime(new Date(t.entryDate)),
  });
  byLabel.set("Executions", {
    id: labelToId("Executions"),
    label: "Executions",
    render: (t) => (t.executionsList?.length ?? t.executions ?? 1).toString(),
  });
  byLabel.set("Fees", {
    id: labelToId("Fees"),
    label: "Fees",
    render: (t) => fmtMoney(sumFees(t)),
  });
  byLabel.set("Commissions", {
    id: labelToId("Commissions"),
    label: "Commissions",
    render: (t) => fmtMoney(sumFees(t)),
  });
  byLabel.set("Cost", {
    id: labelToId("Cost"),
    label: "Cost",
    render: (t) => {
      const entry = Number(t.entryPrice);
      const size = Number(t.positionSize);
      if (!Number.isFinite(entry) || !Number.isFinite(size)) return "—";
      return fmtMoney(Math.abs(entry * size));
    },
  });
  byLabel.set("Hold Time", {
    id: labelToId("Hold Time"),
    label: "Hold Time",
    render: (t) => holdTime(t),
  });
  byLabel.set("Note", {
    id: labelToId("Note"),
    label: "Note",
    render: (t) => safeText(t.emotionalNotes),
  });
  byLabel.set("Outstanding Shares", {
    id: labelToId("Outstanding Shares"),
    label: "Outstanding Shares",
    render: (t) => {
      const rawOut = t.outstandingShares;
      const nOut = rawOut != null && rawOut !== "" ? Number(rawOut) : NaN;
      const hasValidOut = Number.isFinite(nOut) && (nOut < 100 || nOut > 999);
      if (t.outstandingSharesHidden && !hasValidOut) return "—";
      if (Number.isFinite(nOut)) {
        if (nOut >= 100 && nOut <= 999) return "—";
        return nOut.toLocaleString(undefined, { maximumFractionDigits: 0 });
      }
      const absSize =
        t.positionSize != null && t.positionSize !== ""
          ? Math.abs(Number(t.positionSize))
          : NaN;
      if (Number.isFinite(absSize) && absSize >= 100 && absSize <= 999) return "—";
      if (Number.isFinite(absSize)) return String(Math.round(absSize));
      return "—";
    },
  });
  byLabel.set("Portfolio", {
    id: labelToId("Portfolio"),
    label: "Portfolio",
    render: (t) => safeText(t.account),
  });
  byLabel.set("Risk", {
    id: labelToId("Risk"),
    label: "Risk",
    render: (t) => (t.riskPercentage != null ? fmtPct(t.riskPercentage) : "—"),
  });
  byLabel.set("Stops", {
    id: labelToId("Stops"),
    label: "Stops",
    render: (t) => (t.stopLoss != null ? `$${t.stopLoss.toFixed(2)}` : "—"),
  });
  byLabel.set("Profit Aim", {
    id: labelToId("Profit Aim"),
    label: "Profit Aim",
    render: (t) => (t.takeProfit != null ? `$${t.takeProfit.toFixed(2)}` : "—"),
  });
  byLabel.set("Return Net", {
    id: labelToId("Return Net"),
    label: "Return Net",
    render: (t) => fmtMoney(t.pnl - sumFees(t)),
  });
  byLabel.set("Return/Share", {
    id: labelToId("Return/Share"),
    label: "Return/Share",
    render: (t) => {
      const size = Number(t.positionSize);
      if (!Number.isFinite(size) || size === 0) return "—";
      return fmtMoney(t.pnl / Math.abs(size));
    },
  });
  byLabel.set("Position Mfe", {
    id: labelToId("Position Mfe"),
    label: "Position Mfe",
    render: (t) => {
      const { mfe } = getTradeMfeMae(t);
      return fmtMoney(mfe);
    },
  });
  byLabel.set("Position Mae", {
    id: labelToId("Position Mae"),
    label: "Position Mae",
    render: (t) => {
      const { mae } = getTradeMfeMae(t);
      return fmtMoney(mae);
    },
  });
  byLabel.set("Position", {
    id: labelToId("Position"),
    label: "Position",
    render: (t) => safeText(sideFromSize(t.positionSize ?? undefined)),
  });

  // Fill in unsupported columns as placeholders so they can be selected.
  const defs: TradeColumnDef[] = [];
  for (const label of ALL_TRADE_COLUMN_LABELS) {
    const def = byLabel.get(label);
    if (def) defs.push(def);
    else
      defs.push({
        id: labelToId(label),
        label,
        render: () => "—",
      });
  }
  return defs;
}

export function loadTradesTableColumns(): TradeColumnId[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TRADE_COLUMN_IDS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TRADE_COLUMN_IDS;
    const ids = parsed.filter((x) => typeof x === "string") as string[];
    return ids.length ? ids : DEFAULT_TRADE_COLUMN_IDS;
  } catch {
    return DEFAULT_TRADE_COLUMN_IDS;
  }
}

export function saveTradesTableColumns(ids: TradeColumnId[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

