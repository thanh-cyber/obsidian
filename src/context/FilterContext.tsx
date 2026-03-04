import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { Trade } from "@/types/trade";

export interface FilterState {
  side: { long: boolean; short: boolean };
  status: { win: boolean; loss: boolean; be: boolean; open: boolean };
  symbols: Set<string>;
  setups: Set<string>;
  dateRange: { from: string | null; to: string | null };
  datePreset: string | null;
}

const defaultFilters: FilterState = {
  side: { long: false, short: false },
  status: { win: false, loss: false, be: false, open: false },
  symbols: new Set(),
  setups: new Set(),
  dateRange: { from: null, to: null },
  datePreset: null,
};

interface FilterContextValue {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  updateSide: (key: "long" | "short", checked: boolean) => void;
  updateStatus: (key: "win" | "loss" | "be" | "open", checked: boolean) => void;
  toggleSymbol: (symbol: string) => void;
  toggleSetup: (setup: string) => void;
  setDateRange: (from: string | null, to: string | null) => void;
  setDatePreset: (preset: string | null) => void;
  clearFilters: () => void;
  applyFilters: (trades: Trade[]) => Trade[];
  hasActiveFilters: boolean;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export function FilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  const updateSide = useCallback((key: "long" | "short", checked: boolean) => {
    setFilters((prev) => ({
      ...prev,
      side: { ...prev.side, [key]: checked },
    }));
  }, []);

  const updateStatus = useCallback(
    (key: "win" | "loss" | "be" | "open", checked: boolean) => {
      setFilters((prev) => ({
        ...prev,
        status: { ...prev.status, [key]: checked },
      }));
    },
    []
  );

  const toggleSymbol = useCallback((symbol: string) => {
    setFilters((prev) => {
      const next = new Set(prev.symbols);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return { ...prev, symbols: next };
    });
  }, []);

  const toggleSetup = useCallback((setup: string) => {
    setFilters((prev) => {
      const next = new Set(prev.setups);
      if (next.has(setup)) next.delete(setup);
      else next.add(setup);
      return { ...prev, setups: next };
    });
  }, []);

  const setDateRange = useCallback((from: string | null, to: string | null) => {
    setFilters((prev) => ({
      ...prev,
      dateRange: { from, to },
      datePreset: null,
    }));
  }, []);

  const setDatePreset = useCallback((preset: string | null) => {
    setFilters((prev) => ({
      ...prev,
      datePreset: preset,
      dateRange: { from: null, to: null },
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const applyFilters = useCallback(
    (trades: Trade[]): Trade[] => {
      return trades.filter((trade) => {
        const { side, status, symbols, setups, dateRange, datePreset } =
          filters;

        if (side.long || side.short) {
          const isLong = trade.positionSize > 0;
          const isShort = trade.positionSize < 0;
          if (side.long && !side.short && !isLong) return false;
          if (side.short && !side.long && !isShort) return false;
          if (side.long && side.short && !isLong && !isShort) return false;
        }

        if (status.win || status.loss || status.be || status.open) {
          const isBe = Math.abs(trade.pnl) <= 0.01;
          const isWin = trade.pnl > 0.01;
          const isLoss = trade.pnl < -0.01;
          const isOpen = false;
          const match =
            (status.win && isWin) ||
            (status.loss && isLoss) ||
            (status.be && isBe) ||
            (status.open && isOpen);
          if (!match) return false;
        }

        if (symbols.size > 0 && !symbols.has(trade.symbol)) return false;
        if (setups.size > 0 && !setups.has(trade.strategyTag ?? "Other")) return false;

        let from: Date | null = null;
        let to: Date | null = null;
        if (dateRange.from || dateRange.to) {
          from = dateRange.from ? new Date(dateRange.from) : null;
          to = dateRange.to ? new Date(dateRange.to + "T23:59:59") : null;
        } else if (datePreset) {
          const now = new Date();
          const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const pad = (n: number) => String(n).padStart(2, "0");
          switch (datePreset) {
            case "today":
              from = today;
              to = new Date(today.getTime() + 86400000 - 1);
              break;
            case "yesterday": {
              const y = new Date(today);
              y.setDate(y.getDate() - 1);
              from = y;
              to = new Date(y.getTime() + 86400000 - 1);
              break;
            }
            case "last7": {
              from = new Date(today);
              from.setDate(from.getDate() - 7);
              to = new Date(now);
              break;
            }
            case "last30": {
              from = new Date(today);
              from.setDate(from.getDate() - 30);
              to = new Date(now);
              break;
            }
            case "thisMonth":
              from = new Date(now.getFullYear(), now.getMonth(), 1);
              to = new Date(now);
              break;
            case "lastMonth": {
              const m = now.getMonth() - 1;
              const y = m < 0 ? now.getFullYear() - 1 : now.getFullYear();
              from = new Date(y, m < 0 ? 11 : m, 1);
              to = new Date(y, m < 0 ? 11 : m + 1, 0, 23, 59, 59);
              break;
            }
            case "last12Months": {
              from = new Date(now);
              from.setMonth(from.getMonth() - 12);
              to = new Date(now);
              break;
            }
            case "lastYear": {
              const y = now.getFullYear() - 1;
              from = new Date(y, 0, 1);
              to = new Date(y, 11, 31, 23, 59, 59);
              break;
            }
            case "ytd":
              from = new Date(now.getFullYear(), 0, 1);
              to = new Date(now);
              break;
            default:
              break;
          }
        }
        if (from || to) {
          const exitDate = new Date(trade.exitDate);
          if (from && exitDate < from) return false;
          if (to && exitDate > to) return false;
        }

        return true;
      });
    },
    [filters]
  );

  const hasActiveFilters = useMemo(() => {
    const { side, status, symbols, setups, dateRange, datePreset } = filters;
    if (side.long || side.short) return true;
    if (status.win || status.loss || status.be || status.open) return true;
    if (symbols.size > 0) return true;
    if (setups.size > 0) return true;
    if (dateRange.from || dateRange.to || datePreset) return true;
    return false;
  }, [filters]);

  const value = useMemo(
    () => ({
      filters,
      setFilters,
      updateSide,
      updateStatus,
      toggleSymbol,
      toggleSetup,
      setDateRange,
      setDatePreset,
      clearFilters,
      applyFilters,
      hasActiveFilters,
    }),
    [
      filters,
      updateSide,
      updateStatus,
      toggleSymbol,
      toggleSetup,
      setDateRange,
      setDatePreset,
      clearFilters,
      applyFilters,
      hasActiveFilters,
    ]
  );

  return (
    <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
  );
}

export function useFilters() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilters must be used within FilterProvider");
  return ctx;
}
