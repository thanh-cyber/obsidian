import { useState } from "react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  addMonths,
  subMonths,
  startOfDay,
} from "date-fns";
import { Fragment } from "react";
import {
  getAppDateKey,
  formatAppDate,
  formatAppDayNum,
  formatAppMonthYear,
} from "@/utils/appDateTime";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DAYS = ["SUN", "MON", "TUE", "WED", "THR", "FRI", "SAT"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface PnLCalendarViewProps {
  dailyPnL: Map<string, number>;
  /** Daily trade count by "YYYY-MM-DD". If not provided, day cells omit trade count. */
  dailyTradeCount?: Map<string, number>;
  onDayClick?: (date: string, pnl: number) => void;
  /** Default view when mounted: "month" (single month) or "year" (all 12 months). */
  defaultView?: "month" | "year";
  /** Optional class to let parent control size (e.g. flex-1 min-h-0 to fill space). */
  className?: string;
}

export const PnLCalendarView = ({
  dailyPnL,
  dailyTradeCount,
  onDayClick,
  defaultView = "month",
  className,
}: PnLCalendarViewProps) => {
  const now = startOfDay(new Date());
  const [viewMode, setViewMode] = useState<"month" | "year">(defaultView);
  const [focusedDate, setFocusedDate] = useState(now);
  const [year, setYear] = useState(now.getFullYear());

  const getDayKey = (date: Date) => getAppDateKey(date);
  const getDayPnL = (date: Date): number | null => {
    const key = getDayKey(date);
    return dailyPnL.has(key) ? dailyPnL.get(key)! : null;
  };
  const getDayTradeCount = (date: Date): number => {
    const key = getDayKey(date);
    return dailyTradeCount?.get(key) ?? 0;
  };

  const goToToday = () => {
    setFocusedDate(now);
    setYear(now.getFullYear());
  };

  const goPrevMonth = () => setFocusedDate((d) => subMonths(d, 1));
  const goNextMonth = () => setFocusedDate((d) => addMonths(d, 1));

  const getDayStyle = (pnl: number | null, tradeCount: number) => {
    if (tradeCount === 0 && pnl === null) {
      return "bg-muted/30 text-muted-foreground";
    }
    if (pnl !== null && pnl > 0) {
      return "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/30 cursor-pointer";
    }
    if (pnl !== null && pnl < 0) {
      return "bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30 cursor-pointer";
    }
    return "bg-muted/50 text-muted-foreground";
  };

  // ——— Month view: single month with week totals ———
  const monthViewMonthStart = startOfMonth(focusedDate);
  const monthViewMonthEnd = endOfMonth(monthViewMonthStart);
  const monthViewCalStart = startOfWeek(monthViewMonthStart, { weekStartsOn: 0 });
  const monthViewCalEnd = endOfWeek(monthViewMonthEnd, { weekStartsOn: 0 });
  const monthViewDays = eachDayOfInterval({ start: monthViewCalStart, end: monthViewCalEnd });

  // Group days into weeks (7 per week) for week totals
  const weeks: Date[][] = [];
  for (let i = 0; i < monthViewDays.length; i += 7) {
    weeks.push(monthViewDays.slice(i, i + 7));
  }

  const monthTotalPnL = monthViewDays
    .filter((d) => isSameMonth(d, monthViewMonthStart))
    .reduce((sum, d) => sum + (getDayPnL(d) ?? 0), 0);
  const monthTotalTrades = monthViewDays
    .filter((d) => isSameMonth(d, monthViewMonthStart))
    .reduce((sum, d) => sum + getDayTradeCount(d), 0);

  const renderMonthView = () => (
    <div className="flex flex-col flex-1 min-h-0 space-y-3">
      <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goPrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Select
            value={String(focusedDate.getMonth())}
            onValueChange={(v) => setFocusedDate(new Date(focusedDate.getFullYear(), Number(v), 1))}
          >
            <SelectTrigger className="w-28 h-8 text-xs bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(focusedDate.getFullYear())}
            onValueChange={(v) => setFocusedDate(new Date(Number(v), focusedDate.getMonth(), 1))}
          >
            <SelectTrigger className="w-20 h-8 text-xs bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {[focusedDate.getFullYear() - 2, focusedDate.getFullYear() - 1, focusedDate.getFullYear(), focusedDate.getFullYear() + 1].map(
                (y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
        <div
          className={cn(
            "text-sm font-semibold",
            monthTotalPnL >= 0 ? "text-emerald-500" : "text-red-500"
          )}
        >
          {monthTotalPnL >= 0 ? "" : "-"}${Math.abs(monthTotalPnL).toFixed(2)}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col rounded-lg border border-border bg-card overflow-hidden">
        <div
          className="flex-1 min-h-0 grid grid-cols-[repeat(7,1fr)_auto] gap-px bg-border"
          style={{ gridTemplateRows: `auto repeat(${weeks.length}, 1fr)` }}
        >
          {DAYS.map((day) => (
            <div
              key={day}
              className="bg-muted/50 py-2 text-center text-[0.65rem] font-medium text-muted-foreground uppercase"
            >
              {day}
            </div>
          ))}
          <div className="bg-muted/50 py-2 text-center text-[0.65rem] font-medium text-muted-foreground w-24" />

          {weeks.map((weekDays, weekIdx) => (
            <Fragment key={weekIdx}>
              {weekDays.map((date) => {
                const pnl = getDayPnL(date);
                const tradeCount = getDayTradeCount(date);
                const inMonth = isSameMonth(date, monthViewMonthStart);
                const dateKey = getDayKey(date);

                return (
                  <div
                    key={dateKey}
                    className={cn(
                      "min-h-0 flex flex-col p-2 text-xs transition-colors",
                      getDayStyle(pnl, tradeCount),
                      !inMonth && "opacity-50"
                    )}
                    onClick={() => onDayClick?.(dateKey, pnl ?? 0)}
                    title={
                      pnl !== null
                        ? `${formatAppDate(date)}: $${pnl.toFixed(2)}${tradeCount ? ` · ${tradeCount} trades` : ""}`
                        : formatAppDate(date)
                    }
                  >
                    <span className="font-medium">{formatAppDayNum(date)}</span>
                    {pnl !== null && (
                      <span className={cn("text-[0.65rem]", pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                        {pnl >= 0 ? "" : "-"}${Math.abs(pnl).toFixed(2)}
                      </span>
                    )}
                    {tradeCount > 0 && (
                      <span className="text-[0.6rem] text-muted-foreground">
                        {tradeCount} Trade{tradeCount !== 1 ? "s" : ""}
                      </span>
                    )}
                    {inMonth && pnl === null && tradeCount === 0 && (
                      <span className="text-[0.6rem] text-muted-foreground">$0 / 0 Trades</span>
                    )}
                  </div>
                );
              })}
              <div className="bg-muted/30 min-h-0 flex flex-col items-center justify-center p-1.5 text-[0.65rem] text-muted-foreground text-center">
                {(() => {
                  const weekPnL = weekDays.reduce((s, d) => s + (getDayPnL(d) ?? 0), 0);
                  const weekTrades = weekDays.reduce((s, d) => s + getDayTradeCount(d), 0);
                  return (
                    <>
                      <span className={cn("font-medium", weekPnL >= 0 ? "text-emerald-600" : "text-red-600")}>
                        {weekPnL >= 0 ? "" : "-"}${Math.abs(weekPnL).toFixed(2)}
                      </span>
                      <span>{weekTrades} Trades</span>
                    </>
                  );
                })()}
              </div>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );

  // ——— Year view: 12-month grid (existing behavior) ———
  const renderMonthCell = (monthIndex: number) => {
    const monthStart = startOfMonth(new Date(year, monthIndex));
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    const isCurrentMonth = (d: Date) => d.getMonth() === monthIndex;

    return (
      <div
        key={monthIndex}
        className="rounded-lg border border-border bg-card p-3"
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {formatAppMonthYear(monthStart)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setFocusedDate(monthStart);
              setViewMode("month");
            }}
          >
            Open
          </Button>
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {DAYS.map((day) => (
            <div
              key={day}
              className="py-1 text-center text-[0.65rem] font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
          {days.map((date) => {
            const pnl = getDayPnL(date);
            const inMonth = isCurrentMonth(date);
            const dateKey = getDayKey(date);

            return (
              <div
                key={dateKey}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded text-xs transition-colors sm:h-8 sm:w-8",
                  getDayStyle(pnl, getDayTradeCount(date)),
                  !inMonth && "opacity-40"
                )}
                onClick={() => onDayClick?.(dateKey, pnl ?? 0)}
                title={
                  pnl !== null
                    ? `${formatAppDate(date)}: $${pnl.toFixed(2)}`
                    : formatAppDate(date)
                }
              >
                {formatAppDayNum(date)}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderYearView = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-1">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-1">
          {[year - 2, year - 1, year].map((y) => (
            <Button
              key={y}
              variant={y === year ? "secondary" : "ghost"}
              size="sm"
              className={cn("h-8 px-3 text-sm", y === year && "bg-primary/10 text-primary")}
              onClick={() => setYear(y)}
            >
              {y}
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setYear((y) => y + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 12 }, (_, i) => renderMonthCell(i))}
      </div>
    </div>
  );

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div className="flex-shrink-0 flex items-center gap-2 mb-3">
        <span className="text-sm text-muted-foreground">View:</span>
        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setViewMode("month")}
            className={cn(
              "px-3 py-1.5 text-xs font-medium",
              viewMode === "month" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            )}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => {
              setYear(focusedDate.getFullYear());
              setViewMode("year");
            }}
            className={cn(
              "px-3 py-1.5 text-xs font-medium",
              viewMode === "year" ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
            )}
          >
            Year
          </button>
        </div>
      </div>

      <div
        className={cn(
          "flex-1 min-h-0 flex flex-col",
          viewMode === "year" ? "overflow-auto" : "overflow-hidden"
        )}
      >
        {viewMode === "month" ? renderMonthView() : renderYearView()}
      </div>
    </div>
  );
};
