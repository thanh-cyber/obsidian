import { MetricCard } from "@/components/MetricCard";
import { cn } from "@/lib/utils";
import type { OverviewStats } from "@/utils/calculations";

interface TradesMetricsStripProps {
  overview: OverviewStats;
  pnlType: "gross" | "net";
  /** Ordered trade PnLs (e.g. by exit date) for Avg Return $ sparkline */
  tradePnls?: number[];
}

function DonutRing({ value, valueColor }: { value: number; valueColor: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const r = 20;
  const circ = 2 * Math.PI * r;
  const stroke = (pct / 100) * circ;
  return (
    <div className="relative inline-flex items-center justify-center shrink-0">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted/30"
        />
        <circle
          cx="24"
          cy="24"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeDasharray={`${stroke} ${circ}`}
          strokeLinecap="round"
          className={valueColor}
        />
      </svg>
    </div>
  );
}

export function TradesMetricsStrip({ overview, pnlType, tradePnls = [] }: TradesMetricsStripProps) {
  const accReturn = pnlType === "net" ? overview.accReturnNet : overview.accReturnGross;
  const cumulativeData =
    pnlType === "net"
      ? overview.cumulativeData.map((d) => d.net)
      : overview.cumulativeData.map((d) => d.gross);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-4">
      <MetricCard
        title="Acc. Return $"
        value={accReturn}
        data={cumulativeData.length > 0 ? cumulativeData : undefined}
        trend={accReturn >= 0 ? "up" : "down"}
        format="currency"
      />
      <div className="rounded-lg border border-border/50 bg-card p-4 flex flex-col">
        <div className="text-xs text-muted-foreground font-medium mb-1">Win %</div>
        <div className="flex items-center gap-3 flex-1">
          <span
            className={cn(
              "text-lg font-bold",
              overview.winPct >= 50 ? "text-emerald-500" : "text-foreground"
            )}
          >
            {overview.winPct.toFixed(2)}%
          </span>
          <DonutRing value={overview.winPct} valueColor="text-emerald-500" />
        </div>
      </div>
      <div className="rounded-lg border border-border/50 bg-card p-4 flex flex-col">
        <div className="text-xs text-muted-foreground font-medium mb-1">Loss %</div>
        <div className="flex items-center gap-3 flex-1">
          <span
            className={cn(
              "text-lg font-bold",
              overview.lossPct > 50 ? "text-red-500" : "text-foreground"
            )}
          >
            {overview.lossPct.toFixed(2)}%
          </span>
          <DonutRing value={overview.lossPct} valueColor="text-red-500" />
        </div>
      </div>
      <MetricCard
        title="Daily Return"
        value={overview.dailyReturnDollar}
        trend={overview.dailyReturnDollar >= 0 ? "up" : "down"}
        format="currency"
      />
      <MetricCard
        title="Avg Return $"
        value={overview.avgReturn}
        data={tradePnls.length > 0 ? tradePnls : undefined}
        trend={overview.avgReturn >= 0 ? "up" : "down"}
        format="currency"
      />
    </div>
  );
}
