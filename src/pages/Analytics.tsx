import { useState, useEffect } from "react";
import { Trade } from "@/types/trade";
import { loadTrades } from "@/utils/storage";
import { calculateStats } from "@/utils/calculations";
import { Navigation } from "@/components/Navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export const Analytics = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const loadedTrades = loadTrades();
    setTrades(loadedTrades);
  }, []);

  const stats = calculateStats(trades);

  // P&L Curve Data
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
    }, [] as any[]);

  // Win/Loss Pie Data
  const wins = trades.filter(t => t.pnl > 0).length;
  const losses = trades.filter(t => t.pnl < 0).length;
  const breakeven = trades.filter(t => t.pnl === 0).length;

  const winLossData = [
    { name: "Wins", value: wins, color: "hsl(var(--success))" },
    { name: "Losses", value: losses, color: "hsl(var(--destructive))" },
    { name: "Break Even", value: breakeven, color: "hsl(var(--muted))" },
  ];

  // Strategy Performance Data
  const strategyData = trades.reduce((acc, trade) => {
    const existing = acc.find(s => s.strategy === trade.strategyTag);
    if (existing) {
      existing.pnl += trade.pnl;
      existing.trades += 1;
    } else {
      acc.push({
        strategy: trade.strategyTag,
        pnl: trade.pnl,
        trades: 1,
      });
    }
    return acc;
  }, [] as any[]);

  // Monthly Performance Data
  const monthlyData = trades.reduce((acc, trade) => {
    const month = new Date(trade.exitDate).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const existing = acc.find(m => m.month === month);
    if (existing) {
      existing.pnl += trade.pnl;
      existing.trades += 1;
    } else {
      acc.push({
        month,
        pnl: trade.pnl,
        trades: 1,
      });
    }
    return acc;
  }, [] as any[]);

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-background pl-16 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              Analytics
            </h1>
            <p className="text-muted-foreground mt-1">Deep dive into your trading performance</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* P&L Curve */}
          <Card className="bg-gradient-card backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Cumulative P&L</CardTitle>
            </CardHeader>
            <CardContent>
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
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Win/Loss Pie */}
          <Card className="bg-gradient-card backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Win/Loss Distribution</CardTitle>
            </CardHeader>
            <CardContent>
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
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Strategy Performance */}
          <Card className="bg-gradient-card backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Strategy Performance</CardTitle>
            </CardHeader>
            <CardContent>
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
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar dataKey="pnl" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Monthly Performance */}
          <Card className="bg-gradient-card backdrop-blur-sm border-border/50">
            <CardHeader>
              <CardTitle>Monthly P&L</CardTitle>
            </CardHeader>
            <CardContent>
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
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Bar 
                    dataKey="pnl" 
                    fill="hsl(var(--primary))" 
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Key Insights */}
        <Card className="bg-gradient-card backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Trading Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Total Trades</p>
                <p className="text-2xl font-bold text-primary">{stats.totalTrades}</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Average Win</p>
                <p className="text-2xl font-bold text-success">
                  ${trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / wins || 0}
                </p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Average Loss</p>
                <p className="text-2xl font-bold text-destructive">
                  ${trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / losses || 0}
                </p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Profit Factor</p>
                <p className="text-2xl font-bold">
                  {(Math.abs(trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0)) / 
                    Math.abs(trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0)) || 0).toFixed(2)}
                </p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Best Strategy</p>
                <p className="text-2xl font-bold text-primary">
                  {strategyData.length > 0 ? strategyData.reduce((a, b) => a.pnl > b.pnl ? a : b).strategy : "N/A"}
                </p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Avg Hold Time</p>
                <p className="text-2xl font-bold">
                  {Math.floor(stats.averageDuration / 60)}h {Math.round(stats.averageDuration % 60)}m
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
};
