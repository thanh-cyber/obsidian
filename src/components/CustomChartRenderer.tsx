import { Trade } from "@/types/trade";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  buildChartData,
  METRICS,
  formatMetricValue,
  type MetricId,
} from "@/utils/customChartMetrics";
import type { CustomChartConfig } from "@/utils/analyticsChartsStorage";

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

const CHART_HEIGHT = 300;

interface CustomChartRendererProps {
  trades: Trade[];
  config: CustomChartConfig;
}

export function CustomChartRenderer({ trades, config }: CustomChartRendererProps) {
  const { chartType, groupBy, metric1, metric2 } = config;
  const m1Def = METRICS.find((m) => m.id === metric1);
  const m2Def = metric2 ? METRICS.find((m) => m.id === metric2) : null;

  const data = buildChartData(trades, groupBy, metric1, metric2);
  const useTwoMetrics =
    chartType === "scatter" || (chartType !== "pie" && !!metric2);

  /** When two metrics use different units, use a second Y-axis so scale is meaningful */
  const useDualYAxis =
    useTwoMetrics &&
    !!m2Def &&
    !!m1Def &&
    m1Def.format !== m2Def.format;

  /** Format tooltip value by series name so P&L shows as $ and Duration as min */
  const tooltipFormatter = (value: number, name: string) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    if (name === m2Def?.label && m2Def) return formatMetricValue(value, m2Def.format);
    return m1Def ? formatMetricValue(value, m1Def.format) : String(value);
  };

  const tooltipStyle = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
  };

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ height: CHART_HEIGHT }}
      >
        No data. Add trades or adjust filters.
      </div>
    );
  }

  if (chartType === "pie") {
    const pieData = data.map((d, i) => ({
      name: d.name,
      value: Number(d.value),
      color: PIE_COLORS[i % PIE_COLORS.length],
    }));
    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) =>
              `${name}: ${m1Def ? formatMetricValue(value, m1Def.format) : value}`
            }
            outerRadius={100}
            dataKey="value"
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number) =>
              m1Def ? formatMetricValue(value, m1Def.format) : value
            }
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "scatter") {
    const scatterData = data.map((d) => ({
      ...d,
      x: Number(d.x),
      y: Number(d.y),
    }));
    const yAxisLabel = m2Def?.label ?? m1Def?.label ?? "Y";
    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            dataKey="x"
            name={m1Def?.label}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) =>
              m1Def ? formatMetricValue(v, m1Def.format) : String(v)
            }
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yAxisLabel}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) =>
              m2Def
                ? formatMetricValue(v, m2Def.format)
                : m1Def
                  ? formatMetricValue(v, m1Def.format)
                  : String(v)
            }
          />
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => tooltipFormatter(value, name)}
            labelFormatter={(_, payload) => {
              const p = payload?.[0]?.payload;
              return p?.name ?? p?.symbol ?? "";
            }}
          />
          <Scatter
            name={yAxisLabel}
            data={scatterData}
            fill="hsl(var(--primary))"
            fillOpacity={0.7}
          />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  const commonProps = {
    data,
    margin: { top: 20, right: useDualYAxis ? 50 : 20, bottom: 60, left: 20 },
  };
  const axisStroke = "hsl(var(--muted-foreground))";
  const tickFormatterLeft = (v: number) =>
    m1Def ? formatMetricValue(v, m1Def.format) : String(v);
  const tickFormatterRight = (v: number) =>
    m2Def ? formatMetricValue(v, m2Def.format) : String(v);

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            stroke={axisStroke}
            angle={data.length > 6 ? -45 : 0}
            textAnchor={data.length > 6 ? "end" : "middle"}
            height={data.length > 6 ? 80 : 30}
          />
          <YAxis
            yAxisId="left"
            stroke={axisStroke}
            tickFormatter={tickFormatterLeft}
            label={m1Def ? { value: m1Def.label, angle: -90, position: "insideLeft" } : undefined}
          />
          {useDualYAxis && m2Def && (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={axisStroke}
              tickFormatter={tickFormatterRight}
              label={{ value: m2Def.label, angle: 90, position: "insideRight" }}
            />
          )}
          <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))", r: 3 }}
            name={m1Def?.label}
          />
          {useTwoMetrics && m2Def && (
            <Line
              type="monotone"
              dataKey="value2"
              yAxisId={useDualYAxis ? "right" : undefined}
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--destructive))", r: 3 }}
              name={m2Def.label}
            />
          )}
          {useTwoMetrics && m2Def && <Legend />}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <AreaChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="name"
            stroke={axisStroke}
            angle={data.length > 6 ? -45 : 0}
            textAnchor={data.length > 6 ? "end" : "middle"}
            height={data.length > 6 ? 80 : 30}
          />
          <YAxis
            yAxisId="left"
            stroke={axisStroke}
            tickFormatter={tickFormatterLeft}
            label={m1Def ? { value: m1Def.label, angle: -90, position: "insideLeft" } : undefined}
          />
          {useDualYAxis && m2Def && (
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke={axisStroke}
              tickFormatter={tickFormatterRight}
              label={{ value: m2Def.label, angle: 90, position: "insideRight" }}
            />
          )}
          <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.3}
            strokeWidth={2}
            name={m1Def?.label}
          />
          {useTwoMetrics && m2Def && (
            <Area
              type="monotone"
              dataKey="value2"
              yAxisId={useDualYAxis ? "right" : undefined}
              stroke="hsl(var(--destructive))"
              fill="hsl(var(--destructive))"
              fillOpacity={0.2}
              strokeWidth={2}
              name={m2Def.label}
            />
          )}
          {useTwoMetrics && m2Def && <Legend />}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          stroke={axisStroke}
          angle={data.length > 6 ? -45 : 0}
          textAnchor={data.length > 6 ? "end" : "middle"}
          height={data.length > 6 ? 80 : 30}
        />
        <YAxis
          yAxisId="left"
          stroke={axisStroke}
          tickFormatter={tickFormatterLeft}
          label={m1Def ? { value: m1Def.label, angle: -90, position: "insideLeft" } : undefined}
        />
        {useDualYAxis && m2Def && (
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke={axisStroke}
            tickFormatter={tickFormatterRight}
            label={{ value: m2Def.label, angle: 90, position: "insideRight" }}
          />
        )}
        <Tooltip contentStyle={tooltipStyle} formatter={tooltipFormatter} />
        <Bar
          dataKey="value"
          fill="hsl(var(--primary))"
          radius={[8, 8, 0, 0]}
          name={m1Def?.label}
        />
        {useTwoMetrics && m2Def && (
          <Bar
            dataKey="value2"
            yAxisId={useDualYAxis ? "right" : undefined}
            fill="hsl(var(--destructive))"
            radius={[8, 8, 0, 0]}
            name={m2Def.label}
          />
        )}
        {useTwoMetrics && m2Def && <Legend />}
      </BarChart>
    </ResponsiveContainer>
  );
}
