import { useRef, useState, useEffect } from "react";
import { Trade } from "@/types/trade";
import { loadTrades, saveTrades, importTrades } from "@/utils/storage";
import { useFilters } from "@/context/FilterContext";
import { connectIbkrBridge, getIbkrAutoSyncEnabled, mergeTradesById } from "@/utils/ibkrBridge";
import { TradesTable } from "@/components/TradesTable";
import { TradeDetailModal } from "@/components/TradeDetailModal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Filter, ChevronDown, Calendar, Info, Check, Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Trades = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [symbolFilter, setSymbolFilter] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [sideFilter, setSideFilter] = useState<string>("all");
  const [durationFilter, setDurationFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [viewMode, setViewMode] = useState("table");
  const [pnlType, setPnlType] = useState("gross");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    const loadedTrades = loadTrades();
    setTrades(loadedTrades);
  }, []);

  // Optional: auto-sync completed trades from a local IBKR bridge service.
  useEffect(() => {
    if (!getIbkrAutoSyncEnabled()) return;

    const conn = connectIbkrBridge({
      onSnapshot: (incoming) => {
        setTrades((prev) => {
          const merged = mergeTradesById(prev, incoming);
          saveTrades(merged);
          return merged;
        });
      },
      onTrade: (trade) => {
        setTrades((prev) => {
          const merged = mergeTradesById(prev, [trade]);
          saveTrades(merged);
          return merged;
        });
      },
      onError: () => {
        // Silent in this view; Settings has explicit "Test Connection" UX.
      },
    });

    return () => conn.close();
  }, []);

  const { applyFilters } = useFilters();
  const globallyFiltered = applyFilters(trades);

  const filteredTrades = globallyFiltered.filter((trade) => {
    if (symbolFilter && !trade.symbol.toLowerCase().includes(symbolFilter.toLowerCase()))
      return false;
    if (tagFilter !== "all" && (trade.strategyTag ?? "Other") !== tagFilter) return false;
    if (sideFilter === "long" && trade.positionSize <= 0) return false;
    if (sideFilter === "short" && trade.positionSize >= 0) return false;
    if (durationFilter !== "all") {
      const mins = trade.duration;
      if (mins == null) return false;
      if (durationFilter === "day" && mins > 1440) return false;
      if (durationFilter === "swing" && mins <= 1440) return false;
    }
    const exitDate = new Date(trade.exitDate);
    if (fromDate && exitDate < new Date(fromDate)) return false;
    if (toDate && exitDate > new Date(toDate + "T23:59:59")) return false;
    return true;
  });

  // Clear selected trade and close modal if the viewed trade is deleted
  useEffect(() => {
    if (selectedTrade && !filteredTrades.some((t) => t.id === selectedTrade.id)) {
      setSelectedTrade(null);
      setDetailOpen(false);
    }
  }, [selectedTrade, filteredTrades]);

  const uniqueTags = Array.from(new Set(trades.map((t) => t.strategyTag ?? "Other")));

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importTrades(
      file,
      (imported) => {
        // Replace all trades on import (CSV always has new IDs; JSON may have matches)
        saveTrades(imported);
        setTrades(imported);
        setSelectedIds(new Set());
        toast.success(`Imported ${imported.length} trades`);
      },
      (err) => toast.error(err)
    );
    e.target.value = "";
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) {
      toast.error("No trades selected");
      return;
    }
    const next = trades.filter((t) => !selectedIds.has(t.id));
    saveTrades(next);
    setTrades(next);
    setSelectedIds(new Set());
    toast.success(`Deleted ${selectedIds.size} trade${selectedIds.size === 1 ? "" : "s"}`);
  };

  return (
    <div className="min-h-full bg-background">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv"
        className="hidden"
        onChange={onFileChange}
      />
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Trades</h1>
          <Button
            onClick={handleImport}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import Trades
          </Button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <Input
            placeholder="Symbol"
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            className="w-32 h-9 bg-secondary border-border text-sm"
          />
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-28 h-9 bg-secondary border-border text-sm">
              <SelectValue placeholder="Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Select</SelectItem>
              {uniqueTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sideFilter} onValueChange={setSideFilter}>
            <SelectTrigger className="w-24 h-9 bg-secondary border-border text-sm">
              <SelectValue placeholder="Side" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="long">Long</SelectItem>
              <SelectItem value="short">Short</SelectItem>
            </SelectContent>
          </Select>
          <Select value={durationFilter} onValueChange={setDurationFilter}>
            <SelectTrigger className="w-24 h-9 bg-secondary border-border text-sm">
              <SelectValue placeholder="Duration" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="swing">Swing</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              placeholder="From"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-32 h-9 bg-secondary border-border text-sm"
            />
            <span className="text-muted-foreground text-sm">-</span>
            <Input
              type="date"
              placeholder="To"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-32 h-9 bg-secondary border-border text-sm"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-border bg-secondary hover:bg-secondary/80"
          >
            Custom Filters <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-border bg-secondary hover:bg-secondary/80"
          >
            <Filter className="h-4 w-4 mr-1" /> Advanced
          </Button>
          <div className="flex-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleDeleteSelected}
            title="Delete selected trades"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90 shrink-0"
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>

        {/* Sub-header with view tabs */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-foreground">Trades</h2>
          <div className="flex items-center gap-2">
            <Tabs value={viewMode} onValueChange={setViewMode}>
              <TabsList className="h-9 bg-secondary border border-border p-0.5">
                <TabsTrigger value="table" className="h-8 px-3 text-sm data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  Table
                </TabsTrigger>
                <TabsTrigger value="charts-large" className="h-8 px-3 text-sm">
                  Charts (large)
                </TabsTrigger>
                <TabsTrigger value="charts-small" className="h-8 px-3 text-sm">
                  Charts (small)
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={pnlType} onValueChange={setPnlType}>
              <TabsList className="h-9 bg-secondary border border-border p-0.5 ml-2">
                <TabsTrigger value="gross" className="h-8 px-3 text-sm">
                  Gross
                </TabsTrigger>
                <TabsTrigger value="net" className="h-8 px-3 text-sm">
                  Net
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <Info className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Trades Table */}
        {viewMode === "table" && (
          <TradesTable
            trades={filteredTrades}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onTradeClick={(trade) => {
              setSelectedTrade(trade);
              setDetailOpen(true);
            }}
            className="border border-border rounded-lg overflow-hidden bg-card"
          />
        )}

        <TradeDetailModal
          trade={selectedTrade}
          trades={filteredTrades}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onTradeUpdate={(t) => setSelectedTrade(t)}
        />

        {viewMode !== "table" && (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
            Charts view coming soon
          </div>
        )}
      </div>
    </div>
  );
};
