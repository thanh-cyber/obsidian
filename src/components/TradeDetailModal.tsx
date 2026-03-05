import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { Trade } from "@/types/trade";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { TradeXChart } from "@/components/TradeXChart";
import { ChartErrorBoundary } from "@/components/ChartErrorBoundary";
import { TIMEFRAME_MS, type TimeframeKey } from "@/utils/chartData";
import { fetchPolygonBars } from "@/utils/polygon";
import { getFullSessionRangeMs } from "@/utils/sessionRange";
import { getTradeMfeMae } from "@/utils/calculations";
import { type IndicatorKey } from "@/utils/indicatorPresets";
import { getDefaultIndicatorSettings, type IndicatorSettings } from "@/utils/indicatorSettingsSchema";
import { IndicatorsDialog } from "@/components/IndicatorsDialog";
import { IndicatorStrip } from "@/components/IndicatorStrip";
import { IndicatorSettingsDialog } from "@/components/IndicatorSettingsDialog";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Share2,
  Pencil,
  Trash2,
  HelpCircle,
  SlidersHorizontal,
} from "lucide-react";
import { formatAppDateTime, formatAppDateTimeLong, formatAppDateTimeISO } from "@/utils/appDateTime";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { loadTrades, saveTrades } from "@/utils/storage";
import { toast } from "sonner";

interface TradeDetailModalProps {
  trade: Trade | null;
  trades: Trade[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTradeUpdate?: (updated: Trade) => void;
}

export function TradeDetailModal({
  trade,
  trades,
  open,
  onOpenChange,
  onTradeUpdate,
}: TradeDetailModalProps) {
  const [notes, setNotes] = useState(trade?.emotionalNotes ?? "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [timeframe, setTimeframe] = useState<TimeframeKey>("5m");
  const [showAllFills, setShowAllFills] = useState(true); // true = all executions, false = entry/exit only
  const [selectedIndicators, setSelectedIndicators] = useState<IndicatorKey[]>([]);
  const [indicatorVisibility, setIndicatorVisibility] = useState<Record<string, boolean>>({});
  const [indicatorSettings, setIndicatorSettings] = useState<Record<string, IndicatorSettings>>({});
  const [settingsDialogKey, setSettingsDialogKey] = useState<IndicatorKey | null>(null);
  const [indicatorsDialogOpen, setIndicatorsDialogOpen] = useState(false);
  const [chartData, setChartData] = useState<Array<[number, number, number, number, number, number]>>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 800, height: 400 });

  const handleIndicatorSelectionChange = useCallback((next: IndicatorKey[]) => {
    setSelectedIndicators(next);
    const nextSet = new Set(next);
    setIndicatorVisibility((prev) => {
      const out: Record<string, boolean> = {};
      next.forEach((k) => {
        out[k] = prev[k] === undefined ? true : prev[k];
      });
      return out;
    });
    setIndicatorSettings((prev) => {
      const out: Record<string, IndicatorSettings> = {};
      next.forEach((k) => {
        out[k] = prev[k] ?? getDefaultIndicatorSettings(k);
      });
      return out;
    });
    if (settingsDialogKey !== null && !nextSet.has(settingsDialogKey)) {
      setSettingsDialogKey(null);
    }
  }, [settingsDialogKey]);

  const visibleIndicators = useMemo(
    () => selectedIndicators.filter((k) => indicatorVisibility[k] !== false),
    [selectedIndicators, indicatorVisibility]
  );

  const handleToggleVisibility = useCallback((key: IndicatorKey) => {
    setIndicatorVisibility((prev) => ({ ...prev, [key]: prev[key] === false }));
  }, []);

  const handleRemoveIndicator = useCallback((key: IndicatorKey) => {
    setSelectedIndicators((prev) => prev.filter((k) => k !== key));
    setIndicatorVisibility((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setIndicatorSettings((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    if (settingsDialogKey === key) setSettingsDialogKey(null);
  }, [settingsDialogKey]);

  const handleSaveIndicatorSettings = useCallback((key: IndicatorKey, settings: IndicatorSettings) => {
    setIndicatorSettings((prev) => ({ ...prev, [key]: settings }));
    setSettingsDialogKey(null);
  }, []);

  useEffect(() => {
    setNotes(trade?.emotionalNotes ?? "");
    setIsEditingNotes(false);
  }, [trade?.id, trade?.emotionalNotes]);

  // Clear indicator settings dialog when the trade detail sheet is closed
  useEffect(() => {
    if (!open) setSettingsDialogKey(null);
  }, [open]);

  // Fetch real chart data from Polygon.io when trade or timeframe changes
  const tradeId = trade?.id ?? null;
  const tradeSymbol = trade?.symbol ?? null;
  const tradeEntryDate = trade?.entryDate ?? null;
  const tradeExitDate = trade?.exitDate ?? null;
  useEffect(() => {
    if (!tradeId || !tradeSymbol || !tradeEntryDate || !tradeExitDate) {
      setChartData([]);
      setChartError(null);
      setChartLoading(false);
      return;
    }
    const entryTime = new Date(tradeEntryDate).getTime();
    const exitTime = new Date(tradeExitDate).getTime();
    if (!Number.isFinite(entryTime) || !Number.isFinite(exitTime)) {
      setChartData([]);
      setChartError("Invalid entry or exit date");
      setChartLoading(false);
      return;
    }
    const { fromMs, toMs } = getFullSessionRangeMs(entryTime, exitTime);

    const apiKey = import.meta.env.VITE_POLYGON_API_KEY;
    if (!apiKey) {
      setChartData([]);
      setChartError("VITE_POLYGON_API_KEY not set");
      setChartLoading(false);
      return;
    }

    let cancelled = false;
    setChartLoading(true);
    setChartError(null);

    fetchPolygonBars(tradeSymbol, fromMs, toMs, timeframe, apiKey)
      .then((bars) => {
        if (cancelled) return;
        if (bars.length > 0) {
          setChartData(bars);
          setChartError(null);
        } else {
          setChartData([]);
          setChartError(`No chart data for ${tradeSymbol} in this time range`);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setChartData([]);
        setChartError(err instanceof Error ? err.message : `Could not load chart data for ${tradeSymbol}`);
      })
      .finally(() => {
        if (!cancelled) setChartLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tradeId, tradeSymbol, tradeEntryDate, tradeExitDate, timeframe]);

  // Size chart to container so it isn't clipped (right/bottom)
  useEffect(() => {
    const el = chartWrapperRef.current;
    if (!el || !open) return;
    const update = () =>
      setChartSize({
        width: el.offsetWidth || 800,
        height: el.offsetHeight || 400,
      });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, chartData.length]);

  const currentIndex = useMemo(() => {
    if (!trade) return -1;
    return trades.findIndex((t) => t.id === trade.id);
  }, [trade, trades]);

  const prevTrade = currentIndex > 0 ? trades[currentIndex - 1] : null;
  const nextTrade = currentIndex >= 0 && currentIndex < trades.length - 1 ? trades[currentIndex + 1] : null;

  const handlePrev = useCallback(() => {
    if (prevTrade && onTradeUpdate) {
      onTradeUpdate(prevTrade);
    }
  }, [prevTrade, onTradeUpdate]);

  const handleNext = useCallback(() => {
    if (nextTrade && onTradeUpdate) {
      onTradeUpdate(nextTrade);
    }
  }, [nextTrade, onTradeUpdate]);

  const entryTime = tradeEntryDate ? new Date(tradeEntryDate).getTime() : 0;
  const exitTime = tradeExitDate ? new Date(tradeExitDate).getTime() : 0;
  const entryValid = Number.isFinite(entryTime);
  const exitValid = Number.isFinite(exitTime);
  const entryPrice = trade?.entryPrice;
  const exitPrice = trade?.exitPrice;
  const entryMarker = useMemo(
    () => (entryPrice != null && entryValid ? { time: entryTime, price: entryPrice } : undefined),
    [entryPrice, entryTime, entryValid]
  );
  const exitMarker = useMemo(
    () => (exitPrice != null && exitValid ? { time: exitTime, price: exitPrice } : undefined),
    [exitPrice, exitTime, exitValid]
  );

  const handleSaveNotes = useCallback(() => {
    if (!trade) return;
    const updated = { ...trade, emotionalNotes: notes };
    const all = loadTrades();
    const idx = all.findIndex((t) => t.id === trade.id);
    if (idx >= 0) {
      all[idx] = updated;
      saveTrades(all);
      onTradeUpdate?.(updated);
      setIsEditingNotes(false);
      toast.success("Notes saved");
    }
  }, [trade, notes, onTradeUpdate]);

  const handleShare = useCallback(() => {
    if (!trade) return;
    const text = `${trade.symbol} | Entry: ${formatAppDateTime(new Date(trade.entryDate))} @ $${trade.entryPrice.toFixed(2)} | Exit: ${formatAppDateTime(new Date(trade.exitDate))} @ $${trade.exitPrice.toFixed(2)} | P&L: $${trade.pnl.toFixed(2)}`;
    navigator.clipboard?.writeText(text).then(
      () => toast.success("Copied to clipboard"),
      () => toast.error("Failed to copy")
    );
  }, [trade]);

  const executionMarkers = useMemo(() => {
    if (!trade?.executionsList?.length) return undefined;
    // Use raw execution time (no bar snapping) so markers appear at exact moment & don't overlap
    return trade.executionsList.map((e) => ({
      time: new Date(e.dateTime).getTime(),
      side: (e.qty > 0 ? "buy" : "sell") as "buy" | "sell",
      label: e.qty > 0 ? "BUY" : "SELL",
      price: e.price,
    }));
  }, [trade?.executionsList]);

  if (!trade) return null;

  const formatPnL = (val: number) => {
    if (val > 0) return <span className="text-emerald-500">${val.toFixed(2)}</span>;
    if (val < 0) return <span className="text-red-500">${val.toFixed(2)}</span>;
    return <span className="text-muted-foreground">$0.00</span>;
  };

  const execRows = trade.executionsList?.length
    ? trade.executionsList.map((e) => ({
        dateTime: e.dateTime,
        symbol: trade.symbol,
        qty: e.qty,
        price: e.price,
        position: e.position,
        fees: e.fees ?? 0,
      }))
    : [
        {
          dateTime: trade.entryDate,
          symbol: trade.symbol,
          qty: trade.positionSize > 0 ? trade.positionSize : -Math.abs(trade.positionSize),
          price: trade.entryPrice,
          position: trade.positionSize,
          fees: 0,
        },
        {
          dateTime: trade.exitDate,
          symbol: trade.symbol,
          qty: trade.positionSize > 0 ? -trade.positionSize : Math.abs(trade.positionSize),
          price: trade.exitPrice,
          position: 0,
          fees: 0,
        },
      ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl overflow-hidden flex flex-col p-0 gap-0 border-l border-border bg-[hsl(0,0%,8%)] text-foreground"
      >
        <SheetHeader className="px-6 pt-6 pb-2 pr-12 flex-shrink-0 border-b border-border">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => onOpenChange(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <SheetTitle className="text-lg font-semibold text-foreground">
                {trade.symbol} {formatAppDateTimeLong(new Date(trade.entryDate))}
              </SheetTitle>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground"
                onClick={handlePrev}
                disabled={!prevTrade}
              >
                <ChevronLeft className="h-4 w-4 mr-0.5" /> Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-muted-foreground"
                onClick={handleNext}
                disabled={!nextTrade}
              >
                Next <ChevronRight className="h-4 w-4 ml-0.5" />
              </Button>
              <Button variant="outline" size="sm" className="h-9 ml-2" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-1" /> Share
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
          {/* Stats + Notes row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Stats</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="text-muted-foreground">Shares Traded</div>
                <div className="text-foreground font-medium">{Math.abs(trade.positionSize)}</div>
                <div className="text-muted-foreground">Commissions / Fees</div>
                <div className="text-foreground">$0.00</div>
                <div className="text-muted-foreground">Closed Gross P&L</div>
                <div>{formatPnL(trade.pnl)}</div>
                <div className="text-muted-foreground">Closed Net P&L</div>
                <div>{formatPnL(trade.pnl)}</div>
                <div className="text-muted-foreground">Best Exit P&L</div>
                <div className="text-muted-foreground italic">Not yet calculated</div>
                <div className="text-muted-foreground">Position MFE</div>
                <div>{formatPnL(getTradeMfeMae(trade).mfe)}</div>
                <div className="text-muted-foreground">Position MAE</div>
                <div>{formatPnL(getTradeMfeMae(trade).mae)}</div>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <h3 className="text-sm font-medium text-foreground mb-3">Notes</h3>
              {isEditingNotes ? (
                <div className="space-y-2">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes..."
                    className="min-h-[120px] resize-none bg-background"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => setIsEditingNotes(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveNotes}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "min-h-[80px] rounded border border-transparent p-2 text-sm text-muted-foreground",
                    "hover:border-border cursor-text"
                  )}
                  onClick={() => setIsEditingNotes(true)}
                >
                  {notes || "Click here to add notes..."}
                </div>
              )}
            </div>
          </div>

          {/* Chart */}
          <div className="rounded-lg border border-border bg-secondary/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">Chart</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2.5 text-xs font-medium"
                  onClick={() => setIndicatorsDialogOpen(true)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                  Indicators{selectedIndicators.length ? ` (${selectedIndicators.length})` : ""}
                </Button>
                <IndicatorsDialog
                  open={indicatorsDialogOpen}
                  onOpenChange={setIndicatorsDialogOpen}
                  selected={selectedIndicators}
                  onSelectionChange={handleIndicatorSelectionChange}
                />
                <Button
                  variant={showAllFills ? "ghost" : "secondary"}
                  size="sm"
                  className={cn(
                    "h-8 px-2.5 text-xs font-medium",
                    !showAllFills && "bg-primary/20 text-primary border border-primary/40"
                  )}
                  onClick={() => setShowAllFills(false)}
                >
                  Entry/Exit
                </Button>
                <Button
                  variant={showAllFills ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 px-2.5 text-xs font-medium",
                    showAllFills && "bg-primary/20 text-primary border border-primary/40"
                  )}
                  onClick={() => setShowAllFills(true)}
                >
                  All fills
                </Button>
                {(Object.keys(TIMEFRAME_MS) as TimeframeKey[]).map((tf) => (
                  <Button
                    key={tf}
                    variant={timeframe === tf ? "secondary" : "ghost"}
                    size="sm"
                    disabled={chartLoading}
                    className={cn(
                      "h-8 px-2.5 text-xs font-medium",
                      timeframe === tf && "bg-primary/20 text-primary border border-primary/40"
                    )}
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </Button>
                ))}
              </div>
            </div>
            <div className="h-[400px] w-full min-w-0 overflow-hidden rounded bg-[#141414] relative p-3">
              <div
                ref={chartWrapperRef}
                className="h-full w-full min-h-0 min-w-0 relative"
              >
                {chartLoading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#141414] text-sm text-muted-foreground">
                    Loading chart…
                  </div>
                ) : chartError ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#141414] text-sm text-destructive px-4 text-center">
                    {chartError}
                  </div>
                ) : chartData.length > 0 && entryValid && exitValid ? (
                  <ChartErrorBoundary>
                    <div className="absolute inset-0">
                      <TradeXChart
                        data={chartData}
                        symbol={trade.symbol}
                        width={chartSize.width}
                        height={chartSize.height}
                        indicators={visibleIndicators}
                        indicatorSettings={indicatorSettings}
                        timeframeBarMs={TIMEFRAME_MS[timeframe]}
                        markers={showAllFills && executionMarkers?.length ? executionMarkers : undefined}
                        entry={!showAllFills || !executionMarkers?.length ? entryMarker : undefined}
                        exit={!showAllFills || !executionMarkers?.length ? exitMarker : undefined}
                      />
                      <IndicatorStrip
                        indicators={selectedIndicators}
                        visibility={indicatorVisibility}
                        onToggleVisibility={handleToggleVisibility}
                        onOpenSettings={setSettingsDialogKey}
                        onRemove={handleRemoveIndicator}
                      />
                    </div>
                    <IndicatorSettingsDialog
                      open={settingsDialogKey !== null}
                      onOpenChange={(open) => !open && setSettingsDialogKey(null)}
                      indicatorKey={settingsDialogKey}
                      currentSettings={settingsDialogKey ? indicatorSettings[settingsDialogKey] ?? null : null}
                      onSave={handleSaveIndicatorSettings}
                    />
                  </ChartErrorBoundary>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                    No chart data
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Executions */}
          <div className="rounded-lg border border-border bg-secondary/30 overflow-hidden">
            <h3 className="text-sm font-medium text-foreground p-4 pb-2">Executions</h3>
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50 border-border">
                  <TableHead className="text-muted-foreground font-medium">Date/Time</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Symbol</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Qty</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Price</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Position</TableHead>
                  <TableHead className="text-muted-foreground font-medium">Commissions/Fees</TableHead>
                  <TableHead className="text-muted-foreground font-medium w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {execRows.map((row, i) => (
                  <TableRow key={`exec-${i}`} className="border-border">
                    <TableCell className="text-sm">
                      {Number.isFinite(new Date(row.dateTime).getTime())
                        ? formatAppDateTimeISO(new Date(row.dateTime))
                        : row.dateTime}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{row.symbol}</TableCell>
                    <TableCell className="text-sm">{row.qty}</TableCell>
                    <TableCell className="text-sm">${row.price.toFixed(3)}</TableCell>
                    <TableCell className="text-sm">{row.position}</TableCell>
                    <TableCell className="text-sm">${row.fees.toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 opacity-50">
                        <Pencil className="h-4 w-4" />
                        <Trash2 className="h-4 w-4" />
                        <HelpCircle className="h-4 w-4" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
