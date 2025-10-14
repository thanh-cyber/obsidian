import { Trade } from "@/types/trade";

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
  
  const rows = trades.map(t => [
    t.symbol,
    t.entryDate,
    t.entryPrice,
    t.exitDate,
    t.exitPrice,
    t.positionSize,
    t.strategyTag,
    t.pnl.toFixed(2),
    t.pnlPercentage.toFixed(2),
    t.duration,
    t.emotionalNotes || ""
  ]);

  const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
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
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target?.result as string);
      if (Array.isArray(data)) {
        onSuccess(data);
      } else {
        onError("Invalid file format");
      }
    } catch (error) {
      onError("Error parsing file");
    }
  };
  reader.onerror = () => onError("Error reading file");
  reader.readAsText(file);
};
