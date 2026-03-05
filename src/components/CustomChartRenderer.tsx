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
} from "recharts";
import {
  buildChartData,
  buildBucketedBarData,
  METRICS,
  formatMetricValue,
  type DataPoint,
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

  if (!m1Def) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ height: CHART_HEIGHT }}
      >
        Invalid chart config. Re-save the chart or pick a valid X axis metric.
      </div>
    );
  }

  let data = buildChartData(trades, groupBy, metric1, metric2);
  const useTwoMetrics =
    chartType === "scatter" || (chartType !== "pie" && !!metric2);

  /** When two metrics: X axis = metric1 (horizontal), Y axis = metric2 (vertical). Sort by X for line order. */
  const xIsMetric1 = useTwoMetrics && !!m2Def && (chartType === "line" || chartType === "bar" || chartType === "area");
  if (xIsMetric1) {
    data = [...data].sort((a, b) => Number(a.value) - Number(b.value));
  }

  /** Only use dual Y-axis when we're NOT doing X vs Y (i.e. category on X, two series on Y - we no longer do that when two metrics) */
  const useDualYAxis = false;

  const tooltipStyle: React.CSSProperties = {
    backgroundColor: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
  };

  /** Format tooltip value by series name */
  const tooltipFormatter = (value: number, name: string) => {
    if (typeof value !== "number" || !Number.isFinite(value)) return "—";
    if (name === m2Def?.label && m2Def) return formatMetricValue(value, m2Def.format);
    return m1Def ? formatMetricValue(value, m1Def.format) : String(value);
  };

  /** Custom tooltip for X vs Y mode: show both axes */
  const renderXyTooltip = (props: { active?: boolean; payload?: { payload: DataPoint }[] }) => {
    if (!props.active || !props.payload?.length || !m1Def || !m2Def) return null;
    const p = props.payload[0].payload;
    const xVal = typeof p.value === "number" ? p.value : Number(p.value);
    const yVal = typeof p.value2 === "number" ? p.value2 : Number(p.value2);
    return (
      <div style={tooltipStyle} className="rounded-lg border border-border px-3 py-2 text-sm shadow-md">
        {p.name && <div className="font-medium text-foreground mb-1">{p.name}</div>}
        <div className="text-muted-foreground">
          {m1Def.label}: {formatMetricValue(xVal, m1Def.format)}
        </div>
        <div className="text-muted-foreground">
          {m2Def.label}: {formatMetricValue(yVal, m2Def.format)}
        </div>
      </div>
    );
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
            type={xIsMetric1 ? "number" : "category"}
            dataKey={xIsMetric1 ? "value" : "name"}
            stroke={axisStroke}
            angle={!xIsMetric1 && data.length > 6 ? -45 : 0}
            textAnchor={!xIsMetric1 && data.length > 6 ? "end" : "middle"}
            height={data.length > 6 ? 80 : 30}
            tickFormatter={xIsMetric1 && m1Def ? (v: number) => formatMetricValue(v, m1Def.format) : undefined}
            label={xIsMetric1 && m1Def ? { value: m1Def.label, position: "insideBottom", offset: -5 } : undefined}
          />
          <YAxis
            stroke={axisStroke}
            tickFormatter={xIsMetric1 && m2Def ? tickFormatterRight : tickFormatterLeft}
            label={
              xIsMetric1 && m2Def
                ? { value: m2Def.label, angle: -90, position: "insideLeft" }
                : m1Def ? { value: m1Def.label, angle: -90, position: "insideLeft" } : undefined
            }
          />
          <Tooltip
            content={xIsMetric1 ? renderXyTooltip : undefined}
            contentStyle={!xIsMetric1 ? tooltipStyle : undefined}
            formatter={xIsMetric1 ? undefined : tooltipFormatter}
          />
          {xIsMetric1 && m2Def ? (
            <Line
              type="monotone"
              dataKey="value2"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))", r: 3 }}
              name={m2Def.label}
            />
          ) : (
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ fill: "hsl(var(--primary))", r: 3 }}
              name={m1Def?.label}
            />
          )}
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
            type={xIsMetric1 ? "number" : "category"}
            dataKey={xIsMetric1 ? "value" : "name"}
            stroke={axisStroke}
            angle={!xIsMetric1 && data.length > 6 ? -45 : 0}
            textAnchor={!xIsMetric1 && data.length > 6 ? "end" : "middle"}
            height={data.length > 6 ? 80 : 30}
            tickFormatter={xIsMetric1 && m1Def ? (v: number) => formatMetricValue(v, m1Def.format) : undefined}
            label={xIsMetric1 && m1Def ? { value: m1Def.label, position: "insideBottom", offset: -5 } : undefined}
          />
          <YAxis
            stroke={axisStroke}
            tickFormatter={xIsMetric1 && m2Def ? tickFormatterRight : tickFormatterLeft}
            label={
              xIsMetric1 && m2Def
                ? { value: m2Def.label, angle: -90, position: "insideLeft" }
                : m1Def ? { value: m1Def.label, angle: -90, position: "insideLeft" } : undefined
            }
          />
          <Tooltip
            content={xIsMetric1 ? renderXyTooltip : undefined}
            contentStyle={!xIsMetric1 ? tooltipStyle : undefined}
            formatter={xIsMetric1 ? undefined : tooltipFormatter}
          />
          {xIsMetric1 && m2Def ? (
            <Area
              type="monotone"
              dataKey="value2"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.3}
              strokeWidth={2}
              name={m2Def.label}
            />
          ) : (
            <Area
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.3}
              strokeWidth={2}
              name={m1Def?.label}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Bar chart: use clear buckets (range labels) with count per bucket; color by positive/negative
  const barValues = data.map((d) => Number(d.value));
  const bucketData = buildBucketedBarData(barValues, metric1);
  const barChartData = bucketData.length > 0 ? bucketData : data.map((d) => ({ name: String(d.name), count: 1, isPositive: Number(d.value) >= 0 }));

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={barChartData} margin={commonProps.margin}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="name"
          stroke={axisStroke}
          angle={barChartData.length > 6 ? -45 : 0}
          textAnchor={barChartData.length > 6 ? "end" : "middle"}
          height={barChartData.length > 6 ? 80 : 30}
          label={m1Def ? { value: m1Def.label, position: "insideBottom", offset: -5 } : undefined}
        />
        <YAxis
          stroke={axisStroke}
          allowDecimals={false}
          label={{ value: "Trades", angle: -90, position: "insideLeft" }}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value: number) => [value, "Trades"]}
          labelFormatter={(label) => label}
        />
        <Bar dataKey="count" radius={[8, 8, 0, 0]} name="Trades">
          {barChartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.isPositive ? "hsl(var(--success))" : "hsl(var(--destructive))"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
