import { useState } from "react";
import { Trade } from "@/types/trade";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Edit, Trash2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatAppDateTime } from "@/utils/appDateTime";

interface TradeListProps {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
}

export const TradeList = ({ trades, onEdit, onDelete }: TradeListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState<keyof Trade>("entryDate");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const filteredTrades = trades
    .filter(trade => 
      trade.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (trade.strategyTag ?? "").toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      const direction = sortDirection === "asc" ? 1 : -1;
      
      if (typeof aValue === "string" && typeof bValue === "string") {
        return aValue.localeCompare(bValue) * direction;
      }
      return ((aValue as number) - (bValue as number)) * direction;
    });

  const handleSort = (field: keyof Trade) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const formatDate = (dateStr: string) => {
    return formatAppDateTime(new Date(dateStr));
  };

  const formatPnL = (pnl: number) => {
    const isPositive = pnl >= 0;
    return (
      <span className={isPositive ? "text-success font-semibold" : "text-destructive font-semibold"}>
        {isPositive ? "+" : ""}${pnl.toFixed(2)}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by symbol or strategy..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-secondary border-border"
        />
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50 hover:bg-secondary/70">
              <TableHead onClick={() => handleSort("symbol")} className="cursor-pointer font-semibold">
                Symbol
              </TableHead>
              <TableHead onClick={() => handleSort("entryDate")} className="cursor-pointer font-semibold">
                Entry
              </TableHead>
              <TableHead onClick={() => handleSort("exitDate")} className="cursor-pointer font-semibold">
                Exit
              </TableHead>
              <TableHead onClick={() => handleSort("pnl")} className="cursor-pointer font-semibold">
                P&L
              </TableHead>
              <TableHead>Strategy</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTrades.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No trades found
                </TableCell>
              </TableRow>
            ) : (
              filteredTrades.map((trade) => (
                <TableRow key={trade.id} className="hover:bg-secondary/30">
                  <TableCell className="font-medium text-primary">{trade.symbol}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(trade.entryDate)}
                    <br />
                    <span className="text-xs">${trade.entryPrice.toFixed(2)}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(trade.exitDate)}
                    <br />
                    <span className="text-xs">${trade.exitPrice.toFixed(2)}</span>
                  </TableCell>
                  <TableCell>
                    {formatPnL(trade.pnl)}
                    <br />
                    <span className={`text-xs ${trade.pnlPercentage >= 0 ? "text-success" : "text-destructive"}`}>
                      ({trade.pnlPercentage >= 0 ? "+" : ""}{trade.pnlPercentage.toFixed(2)}%)
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-secondary/50">
                      {trade.strategyTag}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {trade.duration < 60 ? `${trade.duration}m` : `${Math.floor(trade.duration / 60)}h ${trade.duration % 60}m`}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(trade)}
                        className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onDelete(trade.id)}
                        className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
