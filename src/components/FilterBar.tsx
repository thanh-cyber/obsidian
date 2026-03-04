import { useState, useEffect } from "react";
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
import { format } from "date-fns";
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

export function FilterBar() {
  const {
    filters,
    updateSide,
    updateStatus,
    toggleSymbol,
    toggleSetup,
    setDateRange,
    setDatePreset,
    clearFilters,
    hasActiveFilters,
  } = useFilters();

  const [symbols, setSymbols] = useState<string[]>([]);
  const [setups, setSetups] = useState<string[]>([]);
  const [symbolSearch, setSymbolSearch] = useState("");

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

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card/30">
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
                      format(range.from, "yyyy-MM-dd"),
                      range.to ? format(range.to, "yyyy-MM-dd") : null
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

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1 rounded-md border-border bg-card/50 px-3 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            Custom Tags
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-44 p-4" align="start">
          <p className="text-xs text-muted-foreground">Coming soon</p>
        </PopoverContent>
      </Popover>

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
  );
}
