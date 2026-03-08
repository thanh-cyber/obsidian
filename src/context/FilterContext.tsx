import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { Trade } from "@/types/trade";
import { getAppDateKey, getAppDateParts, getTodayAppDateKey, getPreviousAppDateKey } from "@/utils/appDateTime";
import { getTradeMfeMae } from "@/utils/calculations";

export interface CustomTagFilters {
  years: string[];
  months: string[];
  days: string[];
  hours: string[];
  holdTimeMin: number | null;
  holdTimeMax: number | null;
  entryPriceMin: number | null;
  entryPriceMax: number | null;
  volumeMin: number | null;
  volumeMax: number | null;
  changePercentMin: number | null;
  changePercentMax: number | null;
  positionMaeMin: number | null;
  positionMaeMax: number | null;
  positionMfeMin: number | null;
  positionMfeMax: number | null;
  bestExitPnlMin: number | null;
  bestExitPnlMax: number | null;
  bestExitPctMin: number | null;
  bestExitPctMax: number | null;
  spyGapDollarsMin: number | null;
  spyGapDollarsMax: number | null;
  spyGapPercentMin: number | null;
  spyGapPercentMax: number | null;
  spxGapDollarsMin: number | null;
  spxGapDollarsMax: number | null;
  spxGapPercentMin: number | null;
  spxGapPercentMax: number | null;
}

const defaultCustomTagFilters: CustomTagFilters = {
  years: [],
  months: [],
  days: [],
  hours: [],
  holdTimeMin: null,
  holdTimeMax: null,
  entryPriceMin: null,
  entryPriceMax: null,
  volumeMin: null,
  volumeMax: null,
  changePercentMin: null,
  changePercentMax: null,
  positionMaeMin: null,
  positionMaeMax: null,
  positionMfeMin: null,
  positionMfeMax: null,
  bestExitPnlMin: null,
  bestExitPnlMax: null,
  bestExitPctMin: null,
  bestExitPctMax: null,
  spyGapDollarsMin: null,
  spyGapDollarsMax: null,
  spyGapPercentMin: null,
  spyGapPercentMax: null,
  spxGapDollarsMin: null,
  spxGapDollarsMax: null,
  spxGapPercentMin: null,
  spxGapPercentMax: null,
};

export interface FilterState {
  side: { long: boolean; short: boolean };
  status: { win: boolean; loss: boolean; be: boolean; open: boolean };
  symbols: Set<string>;
  setups: Set<string>;
  dateRange: { from: string | null; to: string | null };
  datePreset: string | null;
  customTags: CustomTagFilters;
}

const defaultFilters: FilterState = {
  side: { long: false, short: false },
  status: { win: false, loss: false, be: false, open: false },
  symbols: new Set(),
  setups: new Set(),
  dateRange: { from: null, to: null },
  datePreset: null,
  customTags: defaultCustomTagFilters,
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
  setCustomTagFilters: (fn: (prev: CustomTagFilters) => CustomTagFilters) => void;
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

  const setCustomTagFilters = useCallback((fn: (prev: CustomTagFilters) => CustomTagFilters) => {
    setFilters((prev) => ({ ...prev, customTags: fn(prev.customTags) }));
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
          const pos = Number(trade.positionSize);
          if (!Number.isFinite(pos)) return false;
          const isLong = pos > 0;
          const isShort = pos < 0;
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
        if (setups.size > 0 && !setups.has(trade.tradeStyle ?? trade.strategyTag ?? "Other")) return false;

        const exitKey = getAppDateKey(new Date(trade.exitDate));

        if (dateRange.from || dateRange.to) {
          if (dateRange.from && exitKey < dateRange.from) return false;
          if (dateRange.to && exitKey > dateRange.to) return false;
        } else if (datePreset) {
          const todayKey = getTodayAppDateKey();
          let fromKey: string | null = null;
          let toKey: string | null = null;
          switch (datePreset) {
            case "today":
              fromKey = todayKey;
              toKey = todayKey;
              break;
            case "yesterday": {
              const yKey = getPreviousAppDateKey(todayKey);
              fromKey = yKey;
              toKey = yKey;
              break;
            }
            case "last7": {
              let d = todayKey;
              for (let i = 0; i < 6; i++) d = getPreviousAppDateKey(d);
              fromKey = d;
              toKey = todayKey;
              break;
            }
            case "last30": {
              let d = todayKey;
              for (let i = 0; i < 29; i++) d = getPreviousAppDateKey(d);
              fromKey = d;
              toKey = todayKey;
              break;
            }
            case "thisMonth":
              fromKey = todayKey.slice(0, 7) + "-01";
              toKey = todayKey;
              break;
            case "lastMonth": {
              const firstThisMonth = todayKey.slice(0, 7) + "-01";
              const lastLastMonth = getPreviousAppDateKey(firstThisMonth);
              fromKey = lastLastMonth.slice(0, 7) + "-01";
              toKey = lastLastMonth;
              break;
            }
            case "last12Months": {
              const y = Number(todayKey.slice(0, 4)) - 1;
              const rest = todayKey.slice(5);
              fromKey = `${y}-${rest}`;
              toKey = todayKey;
              break;
            }
            case "lastYear": {
              const y = Number(todayKey.slice(0, 4)) - 1;
              fromKey = `${y}-01-01`;
              toKey = `${y}-12-31`;
              break;
            }
            case "ytd":
              fromKey = todayKey.slice(0, 4) + "-01-01";
              toKey = todayKey;
              break;
            default:
              break;
          }
          if (fromKey != null && exitKey < fromKey) return false;
          if (toKey != null && exitKey > toKey) return false;
        }

        const ct = filters.customTags;
        const parts = getAppDateParts(new Date(trade.exitDate));
        if (ct.years.length > 0 && !ct.years.includes(parts.year)) return false;
        if (ct.months.length > 0 && !ct.months.includes(parts.month)) return false;
        if (ct.days.length > 0 && !ct.days.includes(parts.day)) return false;
        if (ct.hours.length > 0 && !ct.hours.includes(parts.hour)) return false;
        const duration = Number(trade.duration) || 0;
        if (ct.holdTimeMin != null && duration < ct.holdTimeMin) return false;
        if (ct.holdTimeMax != null && duration > ct.holdTimeMax) return false;
        const entryPrice = Number(trade.entryPrice) || 0;
        if (ct.entryPriceMin != null && entryPrice < ct.entryPriceMin) return false;
        if (ct.entryPriceMax != null && entryPrice > ct.entryPriceMax) return false;
        const vol = Math.abs(Number(trade.positionSize) || 0);
        if (ct.volumeMin != null && vol < ct.volumeMin) return false;
        if (ct.volumeMax != null && vol > ct.volumeMax) return false;
        const pct = Number(trade.pnlPercentage) || 0;
        if (ct.changePercentMin != null && pct < ct.changePercentMin) return false;
        if (ct.changePercentMax != null && pct > ct.changePercentMax) return false;
        const pnl = Number(trade.pnl) || 0;
        if (ct.bestExitPnlMin != null && pnl < ct.bestExitPnlMin) return false;
        if (ct.bestExitPnlMax != null && pnl > ct.bestExitPnlMax) return false;
        if (ct.bestExitPctMin != null && pct < ct.bestExitPctMin) return false;
        if (ct.bestExitPctMax != null && pct > ct.bestExitPctMax) return false;
        const { mfe, mae, fromExecutions } = getTradeMfeMae(trade);
        if (ct.positionMaeMin != null || ct.positionMaeMax != null || ct.positionMfeMin != null || ct.positionMfeMax != null) {
          if (!fromExecutions || !Number.isFinite(mfe) || !Number.isFinite(mae)) return false;
        }
        if (ct.positionMaeMin != null && mae < ct.positionMaeMin) return false;
        if (ct.positionMaeMax != null && mae > ct.positionMaeMax) return false;
        if (ct.positionMfeMin != null && mfe < ct.positionMfeMin) return false;
        if (ct.positionMfeMax != null && mfe > ct.positionMfeMax) return false;

        const spyGap$ = trade.spyOpeningGapDollars;
        const spyGapPct = trade.spyOpeningGapPercent;
        const spxGap$ = trade.spxOpeningGapDollars;
        const spxGapPct = trade.spxOpeningGapPercent;
        if (ct.spyGapDollarsMin != null && (spyGap$ == null || spyGap$ < ct.spyGapDollarsMin)) return false;
        if (ct.spyGapDollarsMax != null && (spyGap$ == null || spyGap$ > ct.spyGapDollarsMax)) return false;
        if (ct.spyGapPercentMin != null && (spyGapPct == null || spyGapPct < ct.spyGapPercentMin)) return false;
        if (ct.spyGapPercentMax != null && (spyGapPct == null || spyGapPct > ct.spyGapPercentMax)) return false;
        if (ct.spxGapDollarsMin != null && (spxGap$ == null || spxGap$ < ct.spxGapDollarsMin)) return false;
        if (ct.spxGapDollarsMax != null && (spxGap$ == null || spxGap$ > ct.spxGapDollarsMax)) return false;
        if (ct.spxGapPercentMin != null && (spxGapPct == null || spxGapPct < ct.spxGapPercentMin)) return false;
        if (ct.spxGapPercentMax != null && (spxGapPct == null || spxGapPct > ct.spxGapPercentMax)) return false;

        return true;
      });
    },
    [filters]
  );

  const hasActiveFilters = useMemo(() => {
    const { side, status, symbols, setups, dateRange, datePreset, customTags: ct } = filters;
    if (side.long || side.short) return true;
    if (status.win || status.loss || status.be || status.open) return true;
    if (symbols.size > 0) return true;
    if (setups.size > 0) return true;
    if (dateRange.from || dateRange.to || datePreset) return true;
    if (ct.years.length > 0 || ct.months.length > 0 || ct.days.length > 0 || ct.hours.length > 0) return true;
    if (ct.holdTimeMin != null || ct.holdTimeMax != null || ct.entryPriceMin != null || ct.entryPriceMax != null) return true;
    if (ct.volumeMin != null || ct.volumeMax != null) return true;
    if (ct.changePercentMin != null || ct.changePercentMax != null) return true;
    if (ct.positionMaeMin != null || ct.positionMaeMax != null || ct.positionMfeMin != null || ct.positionMfeMax != null) return true;
    if (ct.bestExitPnlMin != null || ct.bestExitPnlMax != null || ct.bestExitPctMin != null || ct.bestExitPctMax != null) return true;
    if (ct.spyGapDollarsMin != null || ct.spyGapDollarsMax != null || ct.spyGapPercentMin != null || ct.spyGapPercentMax != null) return true;
    if (ct.spxGapDollarsMin != null || ct.spxGapDollarsMax != null || ct.spxGapPercentMin != null || ct.spxGapPercentMax != null) return true;
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
      setCustomTagFilters,
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
      setCustomTagFilters,
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
