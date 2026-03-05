import { useState, useEffect, useMemo } from "react";
import { Filter, ChevronDown } from "lucide-react";
import { useFilters } from "@/context/FilterContext";
import { loadTrades } from "@/utils/storage";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getAppDateKey, getAppDateParts } from "@/utils/appDateTime";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

const DATE_PRESETS = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7", label: "Last 7 days" },
  { id: "last30", label: "Last 30 days" },
  { id: "thisMonth", label: "This Month" },
  { id: "lastMonth", label: "Last Month" },
  { id: "last12Months", label: "Last 12 Months" },
  { id: "lastYear", label: "Last Year" },
  { id: "ytd", label: "YTD (Year To Date)" },
];

const pillClass =
  "h-8 gap-1 rounded-md border-border bg-card/50 px-3 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground";

export function FilterBar() {
  const {
    filters,
    updateSide,
    updateStatus,
    toggleSymbol,
    toggleSetup,
    setDateRange,
    setDatePreset,
    setCustomTagFilters,
    clearFilters,
    hasActiveFilters,
  } = useFilters();

  const [symbols, setSymbols] = useState<string[]>([]);
  const [setups, setSetups] = useState<string[]>([]);
  const [symbolSearch, setSymbolSearch] = useState("");
  const [showCustomTagsRow, setShowCustomTagsRow] = useState(false);

  useEffect(() => {
    const trades = loadTrades();
    const s = Array.from(new Set(trades.map((t) => t.symbol).filter(Boolean)));
    s.sort();
    setSymbols(s);
    const st = Array.from(new Set(trades.map((t) => t.strategyTag ?? "Other")));
    st.sort();
    setSetups(st);
  }, []);

  const filteredSymbols = symbolSearch
    ? symbols.filter((s) =>
        s.toLowerCase().includes(symbolSearch.toLowerCase())
      )
    : symbols;

  const dateRangeObj: DateRange | undefined =
    filters.dateRange.from && filters.dateRange.to
      ? {
          from: new Date(filters.dateRange.from),
          to: new Date(filters.dateRange.to),
        }
      : undefined;

  const sideActive = filters.side.long || filters.side.short;
  const statusActive =
    filters.status.win ||
    filters.status.loss ||
    filters.status.be ||
    filters.status.open;
  const symbolActive = filters.symbols.size > 0;
  const setupActive = filters.setups.size > 0;
  const dateActive = !!(
    filters.dateRange.from ||
    filters.dateRange.to ||
    filters.datePreset
  );

  const ct = filters.customTags;
  const customTagActive =
    ct.years.length > 0 ||
    ct.months.length > 0 ||
    ct.days.length > 0 ||
    ct.hours.length > 0 ||
    ct.holdTimeMin != null ||
    ct.holdTimeMax != null ||
    ct.entryPriceMin != null ||
    ct.entryPriceMax != null ||
    ct.volumeMin != null ||
    ct.volumeMax != null ||
    ct.changePercentMin != null ||
    ct.changePercentMax != null ||
    ct.positionMaeMin != null ||
    ct.positionMaeMax != null ||
    ct.positionMfeMin != null ||
    ct.positionMfeMax != null ||
    ct.bestExitPnlMin != null ||
    ct.bestExitPnlMax != null ||
    ct.bestExitPctMin != null ||
    ct.bestExitPctMax != null ||
    ct.spyGapDollarsMin != null ||
    ct.spyGapDollarsMax != null ||
    ct.spyGapPercentMin != null ||
    ct.spyGapPercentMax != null ||
    ct.spxGapDollarsMin != null ||
    ct.spxGapDollarsMax != null ||
    ct.spxGapPercentMin != null ||
    ct.spxGapPercentMax != null;

  const trades = useMemo(() => loadTrades(), []);
  const datePartsFromTrades = useMemo(() => {
    const all = loadTrades();
    const years = new Set<string>();
    const months = new Set<string>();
    const days = new Set<string>();
    const hours = new Set<string>();
    all.forEach((t) => {
      const p = getAppDateParts(new Date(t.exitDate));
      years.add(p.year);
      months.add(p.month);
      days.add(p.day);
      hours.add(p.hour);
    });
    return {
      years: Array.from(years).sort(),
      months: Array.from(months).sort((a, b) => Number(a) - Number(b)),
      days: Array.from(days).sort((a, b) => Number(a) - Number(b)),
      hours: Array.from(hours).sort((a, b) => Number(a) - Number(b)),
    };
  }, [showCustomTagsRow]);

  const toggleCustomTagArray = (
    key: "years" | "months" | "days" | "hours",
    value: string
  ) => {
    setCustomTagFilters((prev) => {
      const arr = prev[key];
      const next = arr.includes(value)
        ? arr.filter((x) => x !== value)
        : [...arr, value];
      return { ...prev, [key]: next };
    });
  };

  const setRange = (
    minKey: keyof typeof ct,
    maxKey: keyof typeof ct,
    minVal: number | null,
    maxVal: number | null
  ) => {
    const safe = (v: number | null) => (v != null && Number.isFinite(v) ? v : null);
    setCustomTagFilters((prev) => ({
      ...prev,
      [minKey]: safe(minVal),
      [maxKey]: safe(maxVal),
    }));
  };

  const clearCustomTagFilters = () => {
    setCustomTagFilters((prev) => ({
      ...prev,
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
    }));
  };

  return (
    <div className="flex flex-col gap-2 px-4 py-2 border-b border-border bg-card/30">
      <div className="flex items-center gap-2 flex-wrap">
      <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1 rounded-md border-border bg-card/50 px-3 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
              symbolActive && "border-primary/50 text-primary"
            )}
          >
            Symbol
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <Input
            placeholder="Search"
            value={symbolSearch}
            onChange={(e) => setSymbolSearch(e.target.value)}
            className="mb-2 h-8 text-xs"
          />
          <ScrollArea className="h-[200px]">
            <div className="space-y-1 pr-2">
              {filteredSymbols.map((s) => (
                <label
                  key={s}
                  className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent text-sm"
                >
                  <Checkbox
                    checked={filters.symbols.has(s)}
                    onCheckedChange={() => toggleSymbol(s)}
                  />
                  <span>{s}</span>
                </label>
              ))}
              {filteredSymbols.length === 0 && (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  No symbols found
                </p>
              )}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1 rounded-md border-border bg-card/50 px-3 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
              setupActive && "border-primary/50 text-primary"
            )}
          >
            Setup
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2" align="start">
          <div className="space-y-1">
            {setups.map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent text-sm"
              >
                <Checkbox
                  checked={filters.setups.has(s)}
                  onCheckedChange={() => toggleSetup(s)}
                />
                <span>{s}</span>
              </label>
            ))}
            {setups.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No setups
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1 rounded-md border-border bg-card/50 px-3 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
              sideActive && "border-primary/50 text-primary"
            )}
          >
            Side
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-2" align="start">
          <div className="space-y-1">
            <label className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent text-sm">
              <Checkbox
                checked={filters.side.long}
                onCheckedChange={(c) => updateSide("long", !!c)}
              />
              <span>Long</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent text-sm">
              <Checkbox
                checked={filters.side.short}
                onCheckedChange={(c) => updateSide("short", !!c)}
              />
              <span>Short</span>
            </label>
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 rounded-md border-border bg-card/50 px-3 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Mistake
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-4" align="start">
          <p className="text-xs text-muted-foreground">Coming soon</p>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1 rounded-md border-border bg-card/50 px-3 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
              statusActive && "border-primary/50 text-primary"
            )}
          >
            Status
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-2" align="start">
          <div className="space-y-1">
            {(["win", "loss", "be", "open"] as const).map((key) => (
              <label
                key={key}
                className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent text-sm"
              >
                <Checkbox
                  checked={filters.status[key]}
                  onCheckedChange={(c) => updateStatus(key, !!c)}
                />
                <span className="uppercase">{key}</span>
              </label>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 rounded-md border-border bg-card/50 px-3 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Portfolio
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-4" align="start">
          <p className="text-xs text-muted-foreground">Coming soon</p>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1 rounded-md border-border bg-card/50 px-3 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground",
              dateActive && "border-primary/50 text-primary"
            )}
          >
            Date
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex">
            <div className="p-3 border-r border-border">
              <Calendar
                mode="range"
                selected={dateRangeObj}
                onSelect={(range) => {
                  if (range?.from) {
                    setDateRange(
                      getAppDateKey(range.from),
                      range.to ? getAppDateKey(range.to) : null
                    );
                  } else {
                    setDateRange(null, null);
                  }
                }}
                numberOfMonths={1}
              />
            </div>
            <div className="p-3 min-w-[160px]">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Presets
              </p>
              <div className="space-y-1">
                {DATE_PRESETS.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent text-sm"
                  >
                    <Checkbox
                      checked={filters.datePreset === p.id}
                      onCheckedChange={(c) =>
                        setDatePreset(c ? p.id : null)
                      }
                    />
                    <span>{p.label}</span>
                  </label>
                ))}
              </div>
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => {
                  setDateRange(null, null);
                  setDatePreset(null);
                }}
              >
                Apply Date(s)
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <Button
        variant="outline"
        size="sm"
        className={cn(pillClass, customTagActive && "border-primary/50 text-primary")}
        onClick={() => setShowCustomTagsRow((v) => !v)}
      >
        Custom Tags
        <ChevronDown
          className={cn("h-3.5 w-3.5 transition-transform", showCustomTagsRow && "rotate-180")}
        />
      </Button>

      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
      >
        More...
      </Button>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground ml-auto"
          onClick={clearFilters}
        >
          Clear Filters
        </Button>
      )}
      </div>

      {showCustomTagsRow && (
        <div className="flex items-center gap-2 flex-wrap">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, ct.years.length > 0 && "border-primary/50 text-primary")}>
                Year <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="space-y-1 max-h-[200px] overflow-auto">
                {datePartsFromTrades.years.map((y) => (
                  <label key={y} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent text-sm">
                    <Checkbox checked={ct.years.includes(y)} onCheckedChange={() => toggleCustomTagArray("years", y)} />
                    <span>{y}</span>
                  </label>
                ))}
                {datePartsFromTrades.years.length === 0 && <p className="text-xs text-muted-foreground py-2">No data</p>}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, ct.months.length > 0 && "border-primary/50 text-primary")}>
                Month <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="space-y-1 max-h-[200px] overflow-auto">
                {datePartsFromTrades.months.map((m) => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent text-sm">
                    <Checkbox checked={ct.months.includes(m)} onCheckedChange={() => toggleCustomTagArray("months", m)} />
                    <span>{m}</span>
                  </label>
                ))}
                {datePartsFromTrades.months.length === 0 && <p className="text-xs text-muted-foreground py-2">No data</p>}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, ct.days.length > 0 && "border-primary/50 text-primary")}>
                Day <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="space-y-1 max-h-[200px] overflow-auto">
                {datePartsFromTrades.days.map((d) => (
                  <label key={d} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent text-sm">
                    <Checkbox checked={ct.days.includes(d)} onCheckedChange={() => toggleCustomTagArray("days", d)} />
                    <span>{d}</span>
                  </label>
                ))}
                {datePartsFromTrades.days.length === 0 && <p className="text-xs text-muted-foreground py-2">No data</p>}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, ct.hours.length > 0 && "border-primary/50 text-primary")}>
                Hour <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start">
              <div className="space-y-1 max-h-[200px] overflow-auto">
                {datePartsFromTrades.hours.map((h) => (
                  <label key={h} className="flex items-center gap-2 cursor-pointer rounded px-2 py-1.5 hover:bg-accent text-sm">
                    <Checkbox checked={ct.hours.includes(h)} onCheckedChange={() => toggleCustomTagArray("hours", h)} />
                    <span>{h}:00</span>
                  </label>
                ))}
                {datePartsFromTrades.hours.length === 0 && <p className="text-xs text-muted-foreground py-2">No data</p>}
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, (ct.holdTimeMin != null || ct.holdTimeMax != null) && "border-primary/50 text-primary")}>
                Hold Time <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <p className="text-xs font-medium mb-2">Duration (min)</p>
              <div className="flex gap-2 items-center">
                <Input type="number" placeholder="Min" className="h-8 text-xs" value={ct.holdTimeMin ?? ""} onChange={(e) => setRange("holdTimeMin", "holdTimeMax", e.target.value === "" ? null : Number(e.target.value), ct.holdTimeMax)} />
                <Input type="number" placeholder="Max" className="h-8 text-xs" value={ct.holdTimeMax ?? ""} onChange={(e) => setRange("holdTimeMin", "holdTimeMax", ct.holdTimeMin, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, (ct.entryPriceMin != null || ct.entryPriceMax != null) && "border-primary/50 text-primary")}>
                Entry Price <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <p className="text-xs font-medium mb-2">$</p>
              <div className="flex gap-2 items-center">
                <Input type="number" step="0.01" placeholder="Min" className="h-8 text-xs" value={ct.entryPriceMin ?? ""} onChange={(e) => setRange("entryPriceMin", "entryPriceMax", e.target.value === "" ? null : Number(e.target.value), ct.entryPriceMax)} />
                <Input type="number" step="0.01" placeholder="Max" className="h-8 text-xs" value={ct.entryPriceMax ?? ""} onChange={(e) => setRange("entryPriceMin", "entryPriceMax", ct.entryPriceMin, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, (ct.volumeMin != null || ct.volumeMax != null) && "border-primary/50 text-primary")}>
                Volume <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <p className="text-xs font-medium mb-2">Shares</p>
              <div className="flex gap-2 items-center">
                <Input type="number" placeholder="Min" className="h-8 text-xs" value={ct.volumeMin ?? ""} onChange={(e) => setRange("volumeMin", "volumeMax", e.target.value === "" ? null : Number(e.target.value), ct.volumeMax)} />
                <Input type="number" placeholder="Max" className="h-8 text-xs" value={ct.volumeMax ?? ""} onChange={(e) => setRange("volumeMin", "volumeMax", ct.volumeMin, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, (ct.changePercentMin != null || ct.changePercentMax != null) && "border-primary/50 text-primary")}>
                Change % <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <p className="text-xs font-medium mb-2">Return %</p>
              <div className="flex gap-2 items-center">
                <Input type="number" step="0.01" placeholder="Min %" className="h-8 text-xs" value={ct.changePercentMin ?? ""} onChange={(e) => setRange("changePercentMin", "changePercentMax", e.target.value === "" ? null : Number(e.target.value), ct.changePercentMax)} />
                <Input type="number" step="0.01" placeholder="Max %" className="h-8 text-xs" value={ct.changePercentMax ?? ""} onChange={(e) => setRange("changePercentMin", "changePercentMax", ct.changePercentMin, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, (ct.spyGapDollarsMin != null || ct.spyGapDollarsMax != null) && "border-primary/50 text-primary")}>
                SPY Opening Gap $ <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <p className="text-xs font-medium mb-2">SPY gap $</p>
              <div className="flex gap-2 items-center">
                <Input type="number" step="0.01" placeholder="Min $" className="h-8 text-xs" value={ct.spyGapDollarsMin ?? ""} onChange={(e) => setRange("spyGapDollarsMin", "spyGapDollarsMax", e.target.value === "" ? null : Number(e.target.value), ct.spyGapDollarsMax)} />
                <Input type="number" step="0.01" placeholder="Max $" className="h-8 text-xs" value={ct.spyGapDollarsMax ?? ""} onChange={(e) => setRange("spyGapDollarsMin", "spyGapDollarsMax", ct.spyGapDollarsMin, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, (ct.spxGapDollarsMin != null || ct.spxGapDollarsMax != null) && "border-primary/50 text-primary")}>
                SPX Opening Gap $ <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <p className="text-xs font-medium mb-2">SPX gap $</p>
              <div className="flex gap-2 items-center">
                <Input type="number" step="0.01" placeholder="Min $" className="h-8 text-xs" value={ct.spxGapDollarsMin ?? ""} onChange={(e) => setRange("spxGapDollarsMin", "spxGapDollarsMax", e.target.value === "" ? null : Number(e.target.value), ct.spxGapDollarsMax)} />
                <Input type="number" step="0.01" placeholder="Max $" className="h-8 text-xs" value={ct.spxGapDollarsMax ?? ""} onChange={(e) => setRange("spxGapDollarsMin", "spxGapDollarsMax", ct.spxGapDollarsMin, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, (ct.spyGapPercentMin != null || ct.spyGapPercentMax != null) && "border-primary/50 text-primary")}>
                SPY Opening Gap % <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <p className="text-xs font-medium mb-2">SPY gap %</p>
              <div className="flex gap-2 items-center">
                <Input type="number" step="0.01" placeholder="Min %" className="h-8 text-xs" value={ct.spyGapPercentMin ?? ""} onChange={(e) => setRange("spyGapPercentMin", "spyGapPercentMax", e.target.value === "" ? null : Number(e.target.value), ct.spyGapPercentMax)} />
                <Input type="number" step="0.01" placeholder="Max %" className="h-8 text-xs" value={ct.spyGapPercentMax ?? ""} onChange={(e) => setRange("spyGapPercentMin", "spyGapPercentMax", ct.spyGapPercentMin, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, (ct.spxGapPercentMin != null || ct.spxGapPercentMax != null) && "border-primary/50 text-primary")}>
                SPX Opening Gap % <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <p className="text-xs font-medium mb-2">SPX gap %</p>
              <div className="flex gap-2 items-center">
                <Input type="number" step="0.01" placeholder="Min %" className="h-8 text-xs" value={ct.spxGapPercentMin ?? ""} onChange={(e) => setRange("spxGapPercentMin", "spxGapPercentMax", e.target.value === "" ? null : Number(e.target.value), ct.spxGapPercentMax)} />
                <Input type="number" step="0.01" placeholder="Max %" className="h-8 text-xs" value={ct.spxGapPercentMax ?? ""} onChange={(e) => setRange("spxGapPercentMin", "spxGapPercentMax", ct.spxGapPercentMin, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, (ct.positionMaeMin != null || ct.positionMaeMax != null) && "border-primary/50 text-primary")}>
                Position MAE <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <p className="text-xs font-medium mb-2">MAE $ (max adverse)</p>
              <div className="flex gap-2 items-center">
                <Input type="number" step="0.01" placeholder="Min $" className="h-8 text-xs" value={ct.positionMaeMin ?? ""} onChange={(e) => setRange("positionMaeMin", "positionMaeMax", e.target.value === "" ? null : Number(e.target.value), ct.positionMaeMax)} />
                <Input type="number" step="0.01" placeholder="Max $" className="h-8 text-xs" value={ct.positionMaeMax ?? ""} onChange={(e) => setRange("positionMaeMin", "positionMaeMax", ct.positionMaeMin, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, (ct.positionMfeMin != null || ct.positionMfeMax != null) && "border-primary/50 text-primary")}>
                Position MFE <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <p className="text-xs font-medium mb-2">MFE $ (max favorable)</p>
              <div className="flex gap-2 items-center">
                <Input type="number" step="0.01" placeholder="Min $" className="h-8 text-xs" value={ct.positionMfeMin ?? ""} onChange={(e) => setRange("positionMfeMin", "positionMfeMax", e.target.value === "" ? null : Number(e.target.value), ct.positionMfeMax)} />
                <Input type="number" step="0.01" placeholder="Max $" className="h-8 text-xs" value={ct.positionMfeMax ?? ""} onChange={(e) => setRange("positionMfeMin", "positionMfeMax", ct.positionMfeMin, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, (ct.bestExitPnlMin != null || ct.bestExitPnlMax != null) && "border-primary/50 text-primary")}>
                Best Exit PnL <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <p className="text-xs font-medium mb-2">P&L $</p>
              <div className="flex gap-2 items-center">
                <Input type="number" step="0.01" placeholder="Min $" className="h-8 text-xs" value={ct.bestExitPnlMin ?? ""} onChange={(e) => setRange("bestExitPnlMin", "bestExitPnlMax", e.target.value === "" ? null : Number(e.target.value), ct.bestExitPnlMax)} />
                <Input type="number" step="0.01" placeholder="Max $" className="h-8 text-xs" value={ct.bestExitPnlMax ?? ""} onChange={(e) => setRange("bestExitPnlMin", "bestExitPnlMax", ct.bestExitPnlMin, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </PopoverContent>
          </Popover>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn(pillClass, (ct.bestExitPctMin != null || ct.bestExitPctMax != null) && "border-primary/50 text-primary")}>
                Best Exit % <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-3" align="start">
              <p className="text-xs font-medium mb-2">Return %</p>
              <div className="flex gap-2 items-center">
                <Input type="number" step="0.01" placeholder="Min %" className="h-8 text-xs" value={ct.bestExitPctMin ?? ""} onChange={(e) => setRange("bestExitPctMin", "bestExitPctMax", e.target.value === "" ? null : Number(e.target.value), ct.bestExitPctMax)} />
                <Input type="number" step="0.01" placeholder="Max %" className="h-8 text-xs" value={ct.bestExitPctMax ?? ""} onChange={(e) => setRange("bestExitPctMin", "bestExitPctMax", ct.bestExitPctMin, e.target.value === "" ? null : Number(e.target.value))} />
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            className={cn(pillClass, "border-dashed")}
            onClick={clearCustomTagFilters}
          >
            Custom Filters
          </Button>
        </div>
      )}
    </div>
  );
}
