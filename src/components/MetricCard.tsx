import { Card, CardContent } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer } from "recharts";

interface MetricCardProps {
  title: string;
  value: string | number;
  data?: number[];
  trend?: "up" | "down" | "neutral";
  format?: "currency" | "percentage" | "number";
}

export const MetricCard = ({ title, value, data, trend = "neutral", format = "currency" }: MetricCardProps) => {
  const chartData = data ?? [];
  const formattedData = chartData.length > 0 ? chartData.map((v, i) => ({ index: i, value: v })) : [];

  const lineColor = 
    trend === "up" ? "hsl(var(--success))" :
    trend === "down" ? "hsl(var(--destructive))" :
    "hsl(var(--primary))";

  const formatValue = (val: string | number) => {
    if (format === "currency") {
      return typeof val === "number" ? `$${val.toFixed(2)}` : val;
    }
    if (format === "percentage") {
      return typeof val === "number" ? `${val.toFixed(2)}%` : val;
    }
    return val;
  };

  return (
    <Card className="bg-card border-border/50 hover:border-primary/30 transition-all duration-300">
      <CardContent className="p-4 space-y-2">
        <div className="text-xs text-muted-foreground font-medium">
          {title}
        </div>
        <div className={cn(
          "text-lg font-bold",
          trend === "up" && "text-success",
          trend === "down" && "text-destructive",
          trend === "neutral" && "text-foreground"
        )}>
          {formatValue(value)}
        </div>
        {formattedData.length > 0 && (
        <div className="h-10 -mx-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formattedData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        )}
      </CardContent>
    </Card>
  );
};

const cn = (...classes: (string | boolean | undefined)[]) => {
  return classes.filter(Boolean).join(" ");
};
