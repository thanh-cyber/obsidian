import { useRef, useState, useEffect, useCallback } from "react";
import { Trade } from "@/types/trade";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAppDate } from "@/utils/appDateTime";
import { buildTradeColumnDefs, DEFAULT_TRADE_COLUMN_IDS, type TradeColumnId } from "@/utils/tradesTableColumns";

interface TradesTableProps {
  trades: Trade[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onTradeClick?: (trade: Trade) => void;
  onTradeUpdate?: (trade: Trade) => void;
  tradeStyleOptions?: string[];
  setupOptions?: string[];
  mistakeOptions?: string[];
  className?: string;
  visibleColumns: TradeColumnId[];
  onVisibleColumnsChange?: (next: TradeColumnId[]) => void;
}

type SortField = "exitDate" | "symbol" | "positionSize" | "pnl";

function NoteCell({ trade, onSave }: { trade: Trade; onSave: (notes: string) => void }) {
  const [value, setValue] = useState(trade.emotionalNotes ?? "");
  const notesRef = useRef(trade.emotionalNotes ?? "");
  notesRef.current = trade.emotionalNotes ?? "";
  useEffect(() => {
    setValue(trade.emotionalNotes ?? "");
  }, [trade.emotionalNotes]);

  const handleBlur = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed !== notesRef.current) {
      onSave(trimmed || "");
    }
  }, [value, onSave]);

  return (
    <div data-no-row-click className="min-w-[120px]">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        placeholder="—"
        className="h-8 text-sm border-border bg-background"
      />
    </div>
  );
}

export const TradesTable = ({
  trades,
  selectedIds,
  onSelectionChange,
  onTradeClick,
  onTradeUpdate,
  tradeStyleOptions = [],
  setupOptions = [],
  mistakeOptions = [],
  className,
  visibleColumns,
  onVisibleColumnsChange,
}: TradesTableProps) => {
  const [sortField, setSortField] = useState<SortField>("exitDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const draggingHeaderIdRef = useRef<TradeColumnId | null>(null);
  const justDraggedRef = useRef(false);

  const columnDefs = buildTradeColumnDefs();
  const defById = new Map(columnDefs.map((d) => [d.id, d]));
  const resolved = visibleColumns.map((id) => defById.get(id)).filter(Boolean) as typeof columnDefs;
  const activeDefs = resolved.length > 0 ? resolved : columnDefs.filter((d) => DEFAULT_TRADE_COLUMN_IDS.includes(d.id));

  const sortedTrades = [...trades].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    const dir = sortDirection === "asc" ? 1 : -1;
    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * dir;
    }
    return ((aVal as number) - (bVal as number)) * dir;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === trades.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(trades.map((t) => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const formatPnL = (pnl: number) => {
    if (!Number.isFinite(pnl)) return <span className="text-muted-foreground">—</span>;
    if (pnl > 0)
      return <span className="text-emerald-500 font-medium">${pnl.toFixed(2)}</span>;
    if (pnl < 0)
      return <span className="text-red-500 font-medium">${pnl.toFixed(2)}</span>;
    return <span className="text-muted-foreground">$0.00</span>;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === "asc" ? (
      <ChevronUp className="h-4 w-4 ml-0.5 inline" />
    ) : (
      <ChevronDown className="h-4 w-4 ml-0.5 inline" />
    );
  };

  const arrayMove = <T,>(arr: T[], from: number, to: number) => {
    if (from === to) return arr;
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  const reorderVisibleColumns = (fromId: TradeColumnId, toId: TradeColumnId) => {
    if (!onVisibleColumnsChange) return;
    const from = visibleColumns.indexOf(fromId);
    const to = visibleColumns.indexOf(toId);
    if (from < 0 || to < 0) return;
    onVisibleColumnsChange(arrayMove(visibleColumns, from, to));
  };

  return (
    <div className={cn("overflow-hidden", className)}>
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/50 hover:bg-secondary/50 border-border">
            <TableHead className="w-10 px-3 py-3 border-b border-border">
              <Checkbox
                checked={selectedIds.size === trades.length && trades.length > 0}
                onCheckedChange={toggleSelectAll}
                className="border-muted-foreground/50"
              />
            </TableHead>
            {activeDefs.map((col) => {
              const sortable =
                col.label === "Close Date"
                  ? "exitDate"
                  : col.label === "Symbol"
                    ? "symbol"
                    : col.label === "Size"
                      ? "positionSize"
                      : col.label === "Return $"
                        ? "pnl"
                        : null;
              return (
                <TableHead
                  key={col.id}
                  className={cn(
                    "px-3 py-3 font-medium text-muted-foreground border-b border-border",
                    sortable && "cursor-pointer hover:text-foreground",
                    onVisibleColumnsChange && "cursor-grab active:cursor-grabbing select-none"
                  )}
                  draggable={Boolean(onVisibleColumnsChange)}
                  onDragStart={(e) => {
                    if (!onVisibleColumnsChange) return;
                    draggingHeaderIdRef.current = col.id;
                    justDraggedRef.current = false;
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", col.id);
                  }}
                  onDragOver={(e) => {
                    if (!onVisibleColumnsChange) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (!onVisibleColumnsChange) return;
                    e.preventDefault();
                    const fromId = (draggingHeaderIdRef.current ?? e.dataTransfer.getData("text/plain")) as TradeColumnId;
                    const toId = col.id;
                    if (fromId && toId && fromId !== toId) {
                      reorderVisibleColumns(fromId, toId);
                    }
                    draggingHeaderIdRef.current = null;
                    justDraggedRef.current = true;
                    window.setTimeout(() => {
                      justDraggedRef.current = false;
                    }, 0);
                  }}
                  onDragEnd={() => {
                    draggingHeaderIdRef.current = null;
                  }}
                  onClick={
                    sortable
                      ? () => {
                          if (justDraggedRef.current) return;
                          handleSort(sortable);
                        }
                      : undefined
                  }
                >
                  {col.label} {sortable ? <SortIcon field={sortable} /> : null}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTrades.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={1 + Math.max(1, activeDefs.length)}
                className="text-center text-muted-foreground py-12"
              >
                No trades found
              </TableCell>
            </TableRow>
          ) : (
            sortedTrades.map((trade, idx) => (
              <TableRow
                key={trade.id}
                className={cn(
                  "border-b border-border transition-colors hover:bg-secondary/30",
                  idx % 2 === 0 ? "bg-card" : "bg-secondary/20",
                  onTradeClick && "cursor-pointer"
                )}
                onClick={(e) => {
                  const target = e.target as HTMLElement;
                  if (
                    target.closest("[role='checkbox']") ||
                    target.closest("button") ||
                    target.closest("input") ||
                    target.closest("textarea") ||
                    target.closest("[data-no-row-click]")
                  )
                    return;
                  onTradeClick?.(trade);
                }}
              >
                <TableCell className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={selectedIds.has(trade.id)}
                    onCheckedChange={() => toggleSelect(trade.id)}
                    className="border-muted-foreground/50"
                  />
                </TableCell>
                {activeDefs.map((col) => {
                  const isTradeStyle = col.label === "Trade Style";
                  const isSetups = col.label === "Setups";
                  const isMistakes = col.label === "Mistakes";
                  const isNote = col.label === "Note";
                  const editable = onTradeUpdate && (isTradeStyle || isSetups || isMistakes || isNote);

                  const currentSetups = trade.setups ?? [];
                  const currentMistakes = trade.mistakes?.length ? trade.mistakes : (trade.mistake ? [trade.mistake] : []);

                  let cellContent: React.ReactNode;
                  if (col.label === "Return $") {
                    cellContent = formatPnL(trade.pnl);
                  } else if (editable && isTradeStyle && tradeStyleOptions.length > 0) {
                    const tradeStyleVal = trade.tradeStyle ?? trade.strategyTag ?? tradeStyleOptions[0];
                    const value = tradeStyleOptions.includes(tradeStyleVal ?? "") ? tradeStyleVal! : tradeStyleOptions[0];
                    cellContent = (
                      <div data-no-row-click className="min-w-[100px]">
                        <Select
                          value={value}
                          onValueChange={(v) => onTradeUpdate({ ...trade, tradeStyle: v })}
                        >
                          <SelectTrigger className="h-8 text-sm border-border bg-background">
                            <SelectValue placeholder="—" />
                          </SelectTrigger>
                          <SelectContent>
                            {tradeStyleOptions.map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  } else if (editable && isSetups) {
                    cellContent = (
                      <div data-no-row-click className="min-w-[100px]">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 w-full justify-start text-sm font-normal text-muted-foreground border-border bg-background">
                              {currentSetups.length ? currentSetups.join(", ") : "—"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="start">
                            <div className="max-h-48 overflow-auto space-y-1">
                              {setupOptions.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Add setups in Settings</p>
                              ) : (
                                setupOptions.map((opt) => (
                                  <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
                                    <Checkbox
                                      checked={currentSetups.includes(opt)}
                                      onCheckedChange={(checked) => {
                                        const next = checked
                                          ? [...currentSetups, opt]
                                          : currentSetups.filter((x) => x !== opt);
                                        onTradeUpdate({
                                          ...trade,
                                          setups: next,
                                          strategyTag: next[0] ?? trade.strategyTag ?? "Other",
                                        });
                                      }}
                                    />
                                    {opt}
                                  </label>
                                ))
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    );
                  } else if (editable && isMistakes) {
                    cellContent = (
                      <div data-no-row-click className="min-w-[90px]">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 w-full justify-start text-sm font-normal text-muted-foreground border-border bg-background">
                              {currentMistakes.length ? currentMistakes.join(", ") : "—"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-56 p-2" align="start">
                            <div className="max-h-48 overflow-auto space-y-1">
                              {mistakeOptions.map((opt) => (
                                <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
                                  <Checkbox
                                    checked={currentMistakes.includes(opt)}
                                    onCheckedChange={(checked) => {
                                      const next = checked
                                        ? [...currentMistakes, opt]
                                        : currentMistakes.filter((x) => x !== opt);
                                      onTradeUpdate({
                                        ...trade,
                                        mistakes: next,
                                        mistake: next[0] ?? trade.mistake,
                                      });
                                    }}
                                  />
                                  {opt}
                                </label>
                              ))}
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    );
                  } else if (editable && isNote) {
                    cellContent = (
                      <NoteCell
                        trade={trade}
                        onSave={(notes) => onTradeUpdate({ ...trade, emotionalNotes: notes })}
                      />
                    );
                  } else {
                    cellContent = col.render(trade);
                  }

                  return (
                    <TableCell
                      key={`${trade.id}-${col.id}`}
                      className={cn(
                        "px-3 py-2.5 text-sm",
                        !isNote && "whitespace-nowrap",
                        col.label === "Symbol" ? "font-medium text-foreground" : "text-muted-foreground",
                        col.label === "Return $" && "text-foreground"
                      )}
                    >
                      {cellContent}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
