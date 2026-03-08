import { useState, useCallback } from "react";
import { Trade } from "@/types/trade";
import { calculateStats } from "@/utils/calculations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CustomChartBuilder } from "@/components/CustomChartBuilder";
import { CustomChartRenderer } from "@/components/CustomChartRenderer";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  loadAnalyticsCharts,
  saveAnalyticsCharts,
  getBuiltinChartTitle,
  type AnalyticsChartItem,
  type BuiltinChartVariant,
  type CustomChartConfig,
} from "@/utils/analyticsChartsStorage";
import { Trash2, Pencil, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

type PnlCurvePoint = { trade: number; total: number; pnl: number };
type StrategyPoint = { strategy: string; pnl: number; trades: number };
type MonthlyPoint = { month: string; pnl: number; trades: number };

interface AnalyticsContentProps {
  trades: Trade[];
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
};

export const AnalyticsContent = ({ trades }: AnalyticsContentProps) => {
  const [chartItems, setChartItems] = useState<AnalyticsChartItem[]>(() =>
    loadAnalyticsCharts()
  );
  const [editingChartId, setEditingChartId] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const persist = useCallback((items: AnalyticsChartItem[]) => {
    setChartItems(items);
    saveAnalyticsCharts(items);
  }, []);

  const handleAddToPage = useCallback(
    (config: CustomChartConfig) => {
      const id = `custom-${Date.now()}`;
      persist([...chartItems, { id, type: "custom", config }]);
    },
    [chartItems, persist]
  );

  const handleUpdateChart = useCallback(
    (id: string, config: CustomChartConfig) => {
      persist(
        chartItems.map((item) =>
          item.id === id && item.type === "custom"
            ? { ...item, config }
            : item
        )
      );
      setEditingChartId(null);
    },
    [chartItems, persist]
  );

  const handleRemove = useCallback(
    (id: string) => {
      persist(chartItems.filter((item) => item.id !== id));
      if (editingChartId === id) setEditingChartId(null);
    },
    [chartItems, persist, editingChartId]
  );

  const handleDragStart = useCallback((index: number) => (e: React.DragEvent) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.setData("application/json", JSON.stringify({ index }));
  }, []);

  const handleDragOver = useCallback((index: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (dropIndex: number) => (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverIndex(null);
      if (draggedIndex === null) return;
      if (draggedIndex === dropIndex) {
        setDraggedIndex(null);
        return;
      }
      const newOrder = [...chartItems];
      const [removed] = newOrder.splice(draggedIndex, 1);
      let insertAt = dropIndex;
      if (draggedIndex < dropIndex) insertAt -= 1;
      newOrder.splice(insertAt, 0, removed);
      persist(newOrder);
      setDraggedIndex(null);
    },
    [chartItems, draggedIndex, persist]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  const stats = calculateStats(trades);
  const pnlCurveData = trades
    .sort((a, b) => new Date(a.exitDate).getTime() - new Date(b.exitDate).getTime())
    .reduce((acc, trade, index) => {
      const prevTotal = index > 0 ? acc[index - 1].total : 0;
      acc.push({
        trade: index + 1,
        total: prevTotal + trade.pnl,
        pnl: trade.pnl,
      });
      return acc;
    }, [] as PnlCurvePoint[]);

  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl < 0).length;
  const breakeven = trades.filter((t) => t.pnl === 0).length;
  const winLossData = [
    { name: "Wins", value: wins, color: "hsl(var(--success))" },
    { name: "Losses", value: losses, color: "hsl(var(--destructive))" },
    { name: "Break Even", value: breakeven, color: "hsl(var(--muted))" },
  ];

  const strategyData = trades.reduce((acc, trade) => {
    const strategy = trade.tradeStyle ?? trade.strategyTag ?? "Other";
    const existing = acc.find((s) => s.strategy === strategy);
    if (existing) {
      existing.pnl += trade.pnl;
      existing.trades += 1;
    } else {
      acc.push({ strategy, pnl: trade.pnl, trades: 1 });
    }
    return acc;
  }, [] as StrategyPoint[]);

  const monthlyData = trades.reduce((acc, trade) => {
    const month = new Date(trade.exitDate).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    const existing = acc.find((m) => m.month === month);
    if (existing) {
      existing.pnl += trade.pnl;
      existing.trades += 1;
    } else {
      acc.push({ month, pnl: trade.pnl, trades: 1 });
    }
    return acc;
  }, [] as MonthlyPoint[]);

  function renderBuiltinChart(variant: BuiltinChartVariant) {
    switch (variant) {
      case "cumulativePnl":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={pnlCurveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="trade"
                stroke="hsl(var(--muted-foreground))"
                label={{ value: "Trade #", position: "insideBottom", offset: -5 }}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                label={{ value: "P&L ($)", angle: -90, position: "insideLeft" }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: "hsl(var(--primary))", r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        );
      case "winLoss":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={winLossData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {winLossData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        );
      case "strategyPerformance":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={strategyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="strategy"
                stroke="hsl(var(--muted-foreground))"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                label={{ value: "P&L ($)", angle: -90, position: "insideLeft" }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="pnl" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "monthlyPnl":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                label={{ value: "P&L ($)", angle: -90, position: "insideLeft" }}
              />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="pnl" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );
      case "tradingInsights":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Total Trades</p>
              <p className="text-2xl font-bold text-primary">{stats.totalTrades}</p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Average Win</p>
              <p className="text-2xl font-bold text-success">
                ${(wins ? trades.filter((t) => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / wins : 0).toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Average Loss</p>
              <p className="text-2xl font-bold text-destructive">
                ${(losses ? trades.filter((t) => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / losses : 0).toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Profit Factor</p>
              <p className="text-2xl font-bold">
                {(
                  Math.abs(trades.filter((t) => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0)) /
                    Math.abs(trades.filter((t) => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0)) || 0
                ).toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Best Strategy</p>
              <p className="text-2xl font-bold text-primary">
                {strategyData.length > 0 ? strategyData.reduce((a, b) => (a.pnl > b.pnl ? a : b)).strategy : "N/A"}
              </p>
            </div>
            <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
              <p className="text-sm text-muted-foreground mb-1">Avg Hold Time</p>
              <p className="text-2xl font-bold">
                {Math.floor(stats.averageDuration / 60)}h {Math.round(stats.averageDuration % 60)}m
              </p>
            </div>
          </div>
        );
      default:
        return null;
    }
  }

  const editingItem = editingChartId
    ? chartItems.find((c) => c.id === editingChartId && c.type === "custom")
    : null;
  const initialConfigForEdit =
    editingItem && editingItem.type === "custom" ? editingItem.config : null;

  return (
    <div className="space-y-8">
      <CustomChartBuilder
        key={editingChartId ?? "add"}
        trades={trades}
        onAddToPage={handleAddToPage}
        initialConfig={initialConfigForEdit ?? null}
        editingId={editingChartId}
        onUpdate={handleUpdateChart}
        onCancelEdit={() => setEditingChartId(null)}
      />

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Charts on this page</h2>
        <p className="text-sm text-muted-foreground">
          Drag charts to reorder, or remove/edit custom charts. Add new ones from the builder above.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {chartItems.map((item, index) => (
            <div
              key={item.id}
              draggable={false}
              onDragOver={handleDragOver(index)}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop(index)}
              className={cn(
                "rounded-lg transition-all duration-150",
                dragOverIndex === index && "ring-2 ring-primary/50 ring-offset-2 ring-offset-background"
              )}
            >
              <Card
                className={cn(
                  "bg-gradient-card backdrop-blur-sm border-border/50 transition-opacity",
                  draggedIndex === index && "opacity-50"
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        draggable
                        onDragStart={handleDragStart(index)}
                        onDragEnd={handleDragEnd}
                        className="cursor-grab active:cursor-grabbing touch-none p-1 rounded hover:bg-secondary/80 text-muted-foreground hover:text-foreground"
                        title="Drag to reorder"
                      >
                        <GripVertical className="h-4 w-4 shrink-0" />
                      </div>
                      <CardTitle className="text-base truncate">
                        {item.type === "builtin"
                          ? getBuiltinChartTitle(item.variant)
                          : item.title ?? "Custom chart"}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.type === "custom" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setEditingChartId(item.id)}
                          title="Edit chart"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemove(item.id)}
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {item.type === "builtin"
                    ? renderBuiltinChart(item.variant)
                    : item.type === "custom" && (
                        <CustomChartRenderer trades={trades} config={item.config} />
                      )}
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
