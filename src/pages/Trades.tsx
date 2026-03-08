import { useRef, useState, useEffect } from "react";
import { Trade } from "@/types/trade";
import { loadTrades, saveTrades, importTrades } from "@/utils/storage";
import { loadTradeStyleOptions, loadSetupOptions, loadMistakeOptions } from "@/utils/tagOptions";
import { useFilters } from "@/context/FilterContext";
import { connectIbkrBridge, getIbkrAutoSyncEnabled, getIbkrBridgeUrl, mergeTradesById } from "@/utils/ibkrBridge";
import { enrichTradesWithYahooQuote } from "@/utils/yahooQuote";
import { TradesTable } from "@/components/TradesTable";
import { TradeDetailModal } from "@/components/TradeDetailModal";
import { TradesMetricsStrip } from "@/components/TradesMetricsStrip";
import { getOverviewStats } from "@/utils/calculations";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Upload, Trash2, Settings, GripVertical, Check } from "lucide-react";
import { toast } from "sonner";
import {
  ALL_TRADE_COLUMN_LABELS,
  DEFAULT_TRADE_COLUMN_IDS,
  labelToId,
  loadTradesTableColumns,
  saveTradesTableColumns,
  type TradeColumnId,
} from "@/utils/tradesTableColumns";

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
  const [columnsDialogOpen, setColumnsDialogOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<TradeColumnId[]>(() => loadTradesTableColumns());
  const [columnsSearch, setColumnsSearch] = useState("");
  const [columnsDraft, setColumnsDraft] = useState<TradeColumnId[]>(visibleColumns);
  const draggingColumnIdRef = useRef<TradeColumnId | null>(null);

  const arrayMove = <T,>(arr: T[], from: number, to: number) => {
    if (from === to) return arr;
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

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
    if (tagFilter !== "all" && (trade.tradeStyle ?? trade.strategyTag ?? "Other") !== tagFilter) return false;
    const size = Number(trade.positionSize);
    if (sideFilter === "long" && (!Number.isFinite(size) || size <= 0)) return false;
    if (sideFilter === "short" && (!Number.isFinite(size) || size >= 0)) return false;
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

  const openColumnsDialog = () => {
    setColumnsDraft(visibleColumns);
    setColumnsSearch("");
    setColumnsDialogOpen(true);
  };

  const toggleDraftColumn = (id: TradeColumnId) => {
    setColumnsDraft((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const removeDraftColumn = (id: TradeColumnId) => {
    setColumnsDraft((prev) => prev.filter((x) => x !== id));
  };

  const reorderDraftColumn = (fromId: TradeColumnId, toId: TradeColumnId) => {
    setColumnsDraft((prev) => {
      const from = prev.indexOf(fromId);
      const to = prev.indexOf(toId);
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  };

  const saveDraftColumns = () => {
    const next = columnsDraft.length ? columnsDraft : DEFAULT_TRADE_COLUMN_IDS;
    setVisibleColumns(next);
    saveTradesTableColumns(next);
    setColumnsDialogOpen(false);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    importTrades(
      file,
      async (imported) => {
        const baseUrl = getIbkrBridgeUrl();
        if (baseUrl?.trim()) toast.info("Syncing float, market cap & outstanding shares from Yahoo…");
        try {
          const enriched = await enrichTradesWithYahooQuote(imported, baseUrl ?? "");
          const symbolsFetched = new Set(
            enriched
              .map((t, i) => {
                const a = imported[i];
                if (
                  (t.float != null && a.float == null) ||
                  (t.marketCap != null && a.marketCap == null) ||
                  (t.outstandingShares != null && a.outstandingShares == null)
                )
                  return t.symbol;
                return null;
              })
              .filter((s): s is string => s != null)
          ).size;
          saveTrades(enriched);
          setTrades(enriched);
          setSelectedIds(new Set());
          if (symbolsFetched > 0) {
            toast.success(`Imported ${imported.length} trades; filled stock data for ${symbolsFetched} symbols.`);
          } else {
            toast.success(`Imported ${imported.length} trades`);
          }
        } catch {
          saveTrades(imported);
          setTrades(imported);
          setSelectedIds(new Set());
          toast.warning(`Imported ${imported.length} trades. Yahoo sync failed (is the bridge running?).`);
        }
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
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              onClick={openColumnsDialog}
              title="Customize columns"
            >
              <Settings className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleImport}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Upload className="h-4 w-4 mr-2" />
              Import Trades
            </Button>
          </div>
        </div>

        {/* Metrics strip + Trades Table */}
        {viewMode === "table" && (
          <>
            <TradesMetricsStrip
              overview={getOverviewStats(filteredTrades)}
              pnlType={pnlType}
              tradePnls={[...filteredTrades]
                .sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime())
                .map((t) => t.pnl)}
            />
            <TradesTable
            trades={filteredTrades}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            visibleColumns={visibleColumns}
            onVisibleColumnsChange={(next) => {
              setVisibleColumns(next);
              saveTradesTableColumns(next);
            }}
            onTradeClick={(trade) => {
              setSelectedTrade(trade);
              setDetailOpen(true);
            }}
            onTradeUpdate={(updated) => {
              const next = trades.map((t) => (t.id === updated.id ? updated : t));
              setTrades(next);
              saveTrades(next);
              if (selectedTrade?.id === updated.id) setSelectedTrade(updated);
            }}
            tradeStyleOptions={loadTradeStyleOptions()}
            setupOptions={loadSetupOptions()}
            mistakeOptions={loadMistakeOptions()}
            className="border border-border rounded-lg overflow-hidden bg-card"
          />
          </>
        )}

        <Dialog open={columnsDialogOpen} onOpenChange={setColumnsDialogOpen}>
          <DialogContent className="max-w-4xl p-0 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="border-b md:border-b-0 md:border-r border-border">
                <DialogHeader className="p-4 pb-3">
                  <DialogTitle>Customize Columns</DialogTitle>
                </DialogHeader>
                <div className="px-4 pb-3">
                  <Input
                    placeholder="Search for a column name"
                    value={columnsSearch}
                    onChange={(e) => setColumnsSearch(e.target.value)}
                  />
                </div>
                <ScrollArea className="h-[420px]">
                  <div className="px-2 pb-3">
                    {ALL_TRADE_COLUMN_LABELS.filter((label) =>
                      label.toLowerCase().includes(columnsSearch.trim().toLowerCase())
                    ).map((label) => {
                      const id = labelToId(label);
                      const checked = columnsDraft.includes(id);
                      return (
                        <button
                          key={id}
                          type="button"
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/40 border-t border-border/50"
                          onClick={() => toggleDraftColumn(id)}
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded-sm border border-border flex items-center justify-center",
                              checked ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                            )}
                            aria-hidden
                          >
                            {checked ? <Check className="h-3 w-3" /> : null}
                          </div>
                          <span className="text-sm text-foreground">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>

              <div>
                <div className="p-4 pb-3 flex items-center justify-between gap-2 border-b border-border">
                  <div className="font-medium text-foreground">Selected Columns</div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8"
                    onClick={() => setColumnsDraft([])}
                  >
                    Clear Selected
                  </Button>
                </div>
                <ScrollArea className="h-[420px]">
                  <div className="px-2 pb-3">
                    {columnsDraft.length === 0 ? (
                      <div className="p-4 text-sm text-muted-foreground">No columns selected.</div>
                    ) : (
                      columnsDraft.map((id) => {
                        const label =
                          ALL_TRADE_COLUMN_LABELS.find((l) => labelToId(l) === id) ?? id;
                        return (
                          <div
                            key={id}
                            className="w-full flex items-center justify-between gap-3 px-4 py-2.5 border-t border-border/50"
                            onDragOver={(e) => {
                              e.preventDefault();
                              const dragging = draggingColumnIdRef.current;
                              if (!dragging || dragging === id) return;
                              reorderDraftColumn(dragging, id);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              draggingColumnIdRef.current = null;
                            }}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                className="h-8 w-8 inline-flex items-center justify-center text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
                                draggable
                                onDragStart={(e) => {
                                  draggingColumnIdRef.current = id;
                                  e.dataTransfer.effectAllowed = "move";
                                  e.dataTransfer.setData("text/plain", id);
                                }}
                                onDragEnd={() => {
                                  draggingColumnIdRef.current = null;
                                }}
                                title="Drag to reorder"
                              >
                                <GripVertical className="h-4 w-4" />
                              </button>
                              <span className="text-sm text-foreground truncate">{label}</span>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => removeDraftColumn(id)}
                              title="Remove"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>

                <div className="p-4 flex items-center justify-between gap-2 border-t border-border">
                  <Button type="button" variant="outline" onClick={() => setColumnsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={saveDraftColumns}>
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <TradeDetailModal
          trade={selectedTrade}
          trades={filteredTrades}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onTradeUpdate={(updated) => {
            const next = trades.map((t) => (t.id === updated.id ? updated : t));
            setSelectedTrade(updated);
            setTrades(next);
            saveTrades(next);
          }}
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
