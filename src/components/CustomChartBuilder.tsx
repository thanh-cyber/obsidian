import { useState, useEffect } from "react";
import { Trade } from "@/types/trade";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  METRICS,
  type ChartType,
  type GroupByOption,
  type MetricId,
} from "@/utils/customChartMetrics";
import type { CustomChartConfig } from "@/utils/analyticsChartsStorage";
import { CustomChartRenderer } from "@/components/CustomChartRenderer";
import { Plus, Check, X } from "lucide-react";

const CHART_TYPES: { id: ChartType; label: string }[] = [
  { id: "line", label: "Line" },
  { id: "bar", label: "Bar" },
  { id: "area", label: "Area" },
  { id: "pie", label: "Pie" },
  { id: "scatter", label: "Scatter (X vs Y)" },
];

const GROUP_BY_OPTIONS: { id: GroupByOption; label: string }[] = [
  { id: "none", label: "Per trade (no group)" },
  { id: "strategy", label: "By strategy" },
  { id: "month", label: "By month" },
  { id: "symbol", label: "By symbol" },
  { id: "day", label: "By day" },
];

/** Sentinel for "no second metric" – Radix Select forbids value="" */
const METRIC2_NONE = "__none__";

export function configToMetric2Select(config: CustomChartConfig): MetricId | typeof METRIC2_NONE {
  return config.metric2 ?? METRIC2_NONE;
}

export function formStateToConfig(
  chartType: ChartType,
  groupBy: GroupByOption,
  metric1: MetricId,
  metric2: MetricId | typeof METRIC2_NONE
): CustomChartConfig {
  return {
    chartType,
    groupBy,
    metric1,
    metric2: metric2 !== METRIC2_NONE && metric2 ? metric2 : null,
  };
}

interface CustomChartBuilderProps {
  trades: Trade[];
  /** When provided, form is used to add a new chart to the analytics page */
  onAddToPage?: (config: CustomChartConfig) => void;
  /** When editing, initialConfig and editingId are set; Update/Cancel shown */
  initialConfig?: CustomChartConfig | null;
  editingId?: string | null;
  onUpdate?: (id: string, config: CustomChartConfig) => void;
  onCancelEdit?: () => void;
}

export function CustomChartBuilder({
  trades,
  onAddToPage,
  initialConfig,
  editingId,
  onUpdate,
  onCancelEdit,
}: CustomChartBuilderProps) {
  const [chartType, setChartType] = useState<ChartType>("line");
  const [groupBy, setGroupBy] = useState<GroupByOption>("month");
  const [metric1, setMetric1] = useState<MetricId>("pnl");
  const [metric2, setMetric2] = useState<MetricId | typeof METRIC2_NONE>(METRIC2_NONE);

  useEffect(() => {
    if (initialConfig) {
      setChartType(initialConfig.chartType);
      setGroupBy(initialConfig.groupBy);
      setMetric1(initialConfig.metric1);
      setMetric2(configToMetric2Select(initialConfig));
    }
  }, [initialConfig?.chartType, initialConfig?.groupBy, initialConfig?.metric1, initialConfig?.metric2]);

  const currentConfig = formStateToConfig(chartType, groupBy, metric1, metric2);

  const handleAdd = () => {
    onAddToPage?.(currentConfig);
  };

  const handleUpdate = () => {
    if (editingId) onUpdate?.(editingId, currentConfig);
  };

  const isEditing = !!editingId;

  return (
    <Card className="bg-gradient-card backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle>Build your own chart</CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose chart type, group by, and one or two metrics (e.g. P&L vs hold time).
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Chart type</Label>
            <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHART_TYPES.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Group by</Label>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByOption)}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_BY_OPTIONS.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {chartType === "scatter" ? "X axis" : "Metric 1"}
            </Label>
            <Select value={metric1} onValueChange={(v) => setMetric1(v as MetricId)}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRICS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {chartType === "scatter" ? "Y axis (required)" : "Metric 2 (optional)"}
            </Label>
            <Select
              value={metric2}
              onValueChange={(v) => setMetric2(v as MetricId | typeof METRIC2_NONE)}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue placeholder={chartType === "scatter" ? "Same as X (or pick Y)" : "None"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={METRIC2_NONE}>
                  {chartType === "scatter" ? "Same as X" : "None"}
                </SelectItem>
                {METRICS.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-lg border border-border/50 bg-secondary/20 p-4">
          <CustomChartRenderer trades={trades} config={currentConfig} />
        </div>
        {(onAddToPage || onUpdate) && (
          <div className="flex flex-wrap gap-2 pt-2">
            {isEditing ? (
              <>
                <Button size="sm" onClick={handleUpdate} className="gap-1.5">
                  <Check className="h-3.5 w-3.5" />
                  Update chart
                </Button>
                <Button size="sm" variant="outline" onClick={onCancelEdit} className="gap-1.5">
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleAdd} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Add to Analytics page
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
