import { Trade } from "@/types/trade";
import { parseTradeHistoryCSV } from "./csvParser";
import { loadImportSettings } from "./importSettings";

const STORAGE_KEY = "tradelog_trades";

export const loadTrades = (): Trade[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Error loading trades:", error);
    return [];
  }
};

export const saveTrades = (trades: Trade[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  } catch (error) {
    console.error("Error saving trades:", error);
  }
};

export const exportTrades = (trades: Trade[]): void => {
  const dataStr = JSON.stringify(trades, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trades_${new Date().toISOString().split("T")[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
};

export const exportTradesCSV = (trades: Trade[]): void => {
  const headers = [
    "Symbol",
    "Entry Date",
    "Entry Price",
    "Exit Date",
    "Exit Price",
    "Position Size",
    "Strategy",
    "P&L",
    "P&L %",
    "Duration (min)",
    "Notes"
  ];
  
  const escape = (val: string | number) => {
    const s = String(val);
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const rows = trades.map(t => [
    escape(t.symbol),
    t.entryDate ?? "",
    Number.isFinite(Number(t.entryPrice)) ? t.entryPrice : "",
    t.exitDate ?? "",
    Number.isFinite(Number(t.exitPrice)) ? t.exitPrice : "",
    Number.isFinite(Number(t.positionSize)) ? t.positionSize : "",
    escape(t.tradeStyle ?? t.strategyTag ?? ""),
    Number.isFinite(Number(t.pnl)) ? Number(t.pnl).toFixed(2) : "0.00",
    (t.pnlPercentage ?? 0).toFixed(2),
    t.duration ?? 0,
    escape(t.emotionalNotes || "")
  ]);

  const csv = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `trades_${new Date().toISOString().split("T")[0]}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

export const importTrades = (file: File, onSuccess: (trades: Trade[]) => void, onError: (error: string) => void): void => {
  const reader = new FileReader();
  const ext = file.name.toLowerCase().split(".").pop();
  reader.onload = (e) => {
    try {
      const text = e.target?.result as string;

      if (ext === "csv") {
        const settings = loadImportSettings();
        const trades = parseTradeHistoryCSV(text, settings);
        if (trades.length === 0) {
          onError("No valid trades found in CSV. Check column format.");
        } else {
          onSuccess(trades);
        }
      } else {
        const data = JSON.parse(text);
        if (!Array.isArray(data)) {
          onError("Invalid JSON format");
          return;
        }
        // Basic validation: require id, symbol, pnl, exitDate; ensure required fields have safe defaults
        const valid = data
          .filter(
            (t: unknown) =>
              t &&
              typeof t === "object" &&
              "id" in t &&
              "symbol" in t &&
              typeof (t as Trade).pnl === "number" &&
              (t as Trade).exitDate
          )
          .map((t: unknown) => {
            const trade = t as Trade;
            const positionSize = typeof trade.positionSize === "number" && Number.isFinite(trade.positionSize) ? trade.positionSize : 0;
            const entryPrice = typeof trade.entryPrice === "number" && Number.isFinite(trade.entryPrice) ? trade.entryPrice : 0;
            const exitPrice = typeof trade.exitPrice === "number" && Number.isFinite(trade.exitPrice) ? trade.exitPrice : 0;
            const entryDate = typeof trade.entryDate === "string" && trade.entryDate ? trade.entryDate : trade.exitDate;
            const executionsList = Array.isArray(trade.executionsList)
              ? trade.executionsList
                  .filter((e: unknown) => {
                    if (!e || typeof e !== "object") return false;
                    const o = e as Record<string, unknown>;
                    return "dateTime" in o && "qty" in o && "price" in o;
                  })
                  .map((e: unknown) => {
                    const o = e as { dateTime: string; qty: number; price: number };
                    return {
                      ...o,
                      price: Number(o.price) || 0,
                      qty: Number(o.qty) || 0,
                    };
                  })
              : undefined;
            return {
              ...trade,
              positionSize,
              entryPrice,
              exitPrice,
              entryDate,
              executionsList,
              pnlPercentage: typeof trade.pnlPercentage === "number" && Number.isFinite(trade.pnlPercentage) ? trade.pnlPercentage : 0,
              duration: typeof trade.duration === "number" && Number.isFinite(trade.duration) ? trade.duration : 0,
              tradeStyle: trade.tradeStyle ?? trade.strategyTag ?? "Other",
              strategyTag: trade.strategyTag ?? "Other",
            };
          });
        onSuccess(valid as Trade[]);
      }
    } catch {
      onError(ext === "csv" ? "Error parsing CSV" : "Error parsing JSON");
    }
  };
  reader.onerror = () => onError("Error reading file");
  reader.readAsText(file);
};
