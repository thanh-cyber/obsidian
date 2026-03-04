import { useState } from "react";
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
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TradesTableProps {
  trades: Trade[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onTradeClick?: (trade: Trade) => void;
  className?: string;
}

type SortField = "exitDate" | "symbol" | "positionSize" | "pnl";

export const TradesTable = ({ trades, selectedIds, onSelectionChange, onTradeClick, className }: TradesTableProps) => {
  const [sortField, setSortField] = useState<SortField>("exitDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

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
            <TableHead
              className="px-3 py-3 cursor-pointer hover:text-foreground font-medium text-muted-foreground border-b border-border"
              onClick={() => handleSort("exitDate")}
            >
              Date <SortIcon field="exitDate" />
            </TableHead>
            <TableHead
              className="px-3 py-3 cursor-pointer hover:text-foreground font-medium text-muted-foreground border-b border-border"
              onClick={() => handleSort("symbol")}
            >
              Symbol <SortIcon field="symbol" />
            </TableHead>
            <TableHead
              className="px-3 py-3 cursor-pointer hover:text-foreground font-medium text-muted-foreground border-b border-border"
              onClick={() => handleSort("positionSize")}
            >
              Volume <SortIcon field="positionSize" />
            </TableHead>
            <TableHead className="px-3 py-3 font-medium text-muted-foreground border-b border-border">
              Executions
            </TableHead>
            <TableHead
              className="px-3 py-3 cursor-pointer hover:text-foreground font-medium text-muted-foreground border-b border-border"
              onClick={() => handleSort("pnl")}
            >
              P&L <SortIcon field="pnl" />
            </TableHead>
            <TableHead className="px-3 py-3 font-medium text-muted-foreground border-b border-border">
              Shared
            </TableHead>
            <TableHead className="px-3 py-3 font-medium text-muted-foreground border-b border-border">
              Notes
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedTrades.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={8}
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
                  if (target.closest("[role='checkbox']") || target.closest("button")) return;
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
                <TableCell className="px-3 py-2.5 text-sm text-foreground whitespace-nowrap">
                  {format(new Date(trade.exitDate), "d MMM yyyy")}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-sm font-medium text-foreground">
                  {trade.symbol}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                  {Math.abs(trade.positionSize)}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                  {trade.executions ?? 1}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-sm">
                  {formatPnL(trade.pnl)}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-sm text-muted-foreground">
                  —
                </TableCell>
                <TableCell className="px-3 py-2.5 text-sm text-muted-foreground max-w-[120px] truncate">
                  {trade.emotionalNotes || "—"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
