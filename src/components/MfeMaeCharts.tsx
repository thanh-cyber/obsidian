import { Trade } from "@/types/trade";
import { getTradeMfeMae } from "@/utils/calculations";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CHART_HEIGHT = 340;

interface MfeMaeChartsProps {
  trades: Trade[];
}

function formatDollar(v: number): string {
  if (!Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function MfeMaeCharts({ trades }: MfeMaeChartsProps) {
  const points = trades.map((t) => {
    const grossReturn = Number(t.pnl) || 0;
    const { mfe, mae } = getTradeMfeMae(t);
    return {
      grossReturn,
      mfe,
      mae,
      name: t.symbol || t.id,
    };
  });

  const mfeData = points.map((p) => ({ x: p.grossReturn, y: p.mfe, name: p.name }));
  const maeData = points.map((p) => ({ x: p.grossReturn, y: p.mae, name: p.name }));

  const tooltipStyle: React.CSSProperties = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
  };

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm rounded-lg border border-border bg-card p-8"
        style={{ minHeight: CHART_HEIGHT }}
      >
        No trade data. Add trades to see MFE/MAE charts.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Position MFE */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Position MFE</h3>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <ScatterChart margin={{ top: 12, right: 16, bottom: 24, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              dataKey="x"
              name="Gross Return Per Trade"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => formatDollar(v)}
              label={{
                value: "Gross Return Per Trade",
                position: "insideBottom",
                offset: -8,
                style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Position MFE Per Trade"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => formatDollar(v)}
              label={{
                value: "Your Position MFE Per Trade",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
              }}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [formatDollar(value), ""]}
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload;
                return p?.name ? `Trade: ${p.name}` : "Gross Return / MFE";
              }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div style={tooltipStyle} className="rounded-lg border px-3 py-2 text-sm shadow-md">
                    {p.name && <div className="font-medium text-foreground mb-1">{p.name}</div>}
                    <div className="text-muted-foreground">Gross Return: {formatDollar(p.x)}</div>
                    <div className="text-muted-foreground">Position MFE: {formatDollar(p.y)}</div>
                  </div>
                );
              }}
            />
            <Scatter data={mfeData} fill="hsl(var(--success))" fillOpacity={0.85} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Position MAE */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Position MAE</h3>
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <ScatterChart margin={{ top: 12, right: 16, bottom: 24, left: 16 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              type="number"
              dataKey="x"
              name="Gross Return Per Trade"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => formatDollar(v)}
              label={{
                value: "Gross Return Per Trade",
                position: "insideBottom",
                offset: -8,
                style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Position MAE Per Trade"
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 10 }}
              tickFormatter={(v) => formatDollar(v)}
              label={{
                value: "Your Position MAE Per Trade",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "hsl(var(--muted-foreground))" },
              }}
              domain={["auto", "auto"]}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(value: number) => [formatDollar(value), ""]}
              labelFormatter={(_, payload) => {
                const p = payload?.[0]?.payload;
                return p?.name ? `Trade: ${p.name}` : "Gross Return / MAE";
              }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div style={tooltipStyle} className="rounded-lg border px-3 py-2 text-sm shadow-md">
                    {p.name && <div className="font-medium text-foreground mb-1">{p.name}</div>}
                    <div className="text-muted-foreground">Gross Return: {formatDollar(p.x)}</div>
                    <div className="text-muted-foreground">Position MAE: {formatDollar(p.y)}</div>
                  </div>
                );
              }}
            />
            <Scatter data={maeData} fill="hsl(var(--destructive))" fillOpacity={0.85} />
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
