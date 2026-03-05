import { useState, useRef, useEffect } from "react";
import { Trade } from "@/types/trade";
import { buildFullAppContext } from "@/utils/aiContextBuilder";
import { CHART_TYPES, GROUP_BY_OPTIONS, METRIC_IDS } from "@/utils/aiContextBuilder";
import { addCustomChartToAnalytics } from "@/utils/analyticsChartsStorage";
import type { CustomChartConfig } from "@/utils/analyticsChartsStorage";
import { sendXaiChat, hasXaiApiKey, type ChatMessage } from "@/utils/xai";
import { CustomChartRenderer } from "@/components/CustomChartRenderer";
import { ChartErrorBoundary } from "@/components/ChartErrorBoundary";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Send, AlertCircle, Loader2, BarChart2, Check } from "lucide-react";

interface AIAnalyticDiveChatProps {
  trades: Trade[];
}

const SYSTEM_PROMPT = `You are an expert trading analyst inside a trading journal app. You have FULL ACCESS to everything in the app:

- All overview metrics (P&L, win rate, hold times, fees, risk metrics, etc.)
- Strategy and symbol breakdowns
- Daily P&L by date
- TRADES BY DATE index: for each date, trade count, symbols, and daily P&L (use this to quickly find "what did I trade on [date]?")
- ALL TRADES: the full trade list with symbol, entryDate, exitDate, pnl, pnlPct, durationMin, strategy, positionSize, entryPrice, exitPrice, mfe, mae

You can SEARCH and FILTER this data. When the user asks for something specific, use the context to answer:
- "Trades on [date]" or "what did I trade on March 15?" → use TRADES BY DATE for that date, then list or summarize from ALL TRADES rows with that exitDate (or entryDate).
- "Trades in AAPL" / "my MSFT trades" → filter ALL TRADES by symbol.
- "Losing trades" / "trades over $500" → filter by pnl.
- "Trades last week" → filter by exitDate range.
- Any other search: filter the ALL TRADES table by the criteria they give.

Give specific answers with dates, symbols, P&L, and details from the data.

You can CREATE CHARTS AND GRAPHS using any metric and any form the app supports. You have access to every metric in the app; use them in any combination to build the most useful chart for what the user asked for.

When you suggest a chart, output a single line in this exact format (no other text on that line):
CHART_CONFIG_JSON: {"chartType":"<type>","groupBy":"<group>","metric1":"<id>","metric2":null or "<id>"}
- chartType: line | bar | pie | area | scatter (any form: line for trends, bar for distributions or comparisons, pie for composition, scatter for X vs Y, area for cumulative-style).
- groupBy: none | strategy | month | symbol | day. Use "none" for per-trade data; use strategy/month/symbol/day to aggregate (e.g. P&L by strategy, duration by month).
- metric1, metric2: any of pnl, pnlPct, duration, holdTimeHours, positionSize, entryPrice, exitPrice, fees, win, tradeCount. Use metric2 only for scatter/line/area (X vs Y); use null for single-metric or pie/bar.
- Bar charts AUTO-BIN into buckets: when chartType is "bar", the app automatically bins values into clear ranges (no extra config needed). For pnl/fees: $ ranges (e.g. $0-$500, $500-$1K). For pnlPct: % ranges. For duration/holdTimeHours: time buckets (e.g. 0-30 min, 1-2 hr). For other metrics: auto-generated buckets from the data. Use bar + groupBy "none" + a single metric for distribution histograms with automatic bucketing.
Examples:
- Bar of P&L distribution (per trade): CHART_CONFIG_JSON: {"chartType":"bar","groupBy":"none","metric1":"pnl","metric2":null}
- P&L by strategy (grouped bar): CHART_CONFIG_JSON: {"chartType":"bar","groupBy":"strategy","metric1":"pnl","metric2":null}
- Monthly duration trend: CHART_CONFIG_JSON: {"chartType":"line","groupBy":"month","metric1":"duration","metric2":null}
- Scatter P&L vs duration: CHART_CONFIG_JSON: {"chartType":"scatter","groupBy":"none","metric1":"pnl","metric2":"duration"}
- Win count by symbol (pie): CHART_CONFIG_JSON: {"chartType":"pie","groupBy":"symbol","metric1":"win","metric2":null}
The user will see an "Add to Analytics" button and can push your chart to their Analytics page.`;

function parseChartConfigFromMessage(content: string): CustomChartConfig | null {
  const match = content.match(/CHART_CONFIG_JSON:\s*(\{[\s\S]*?\})(?=\s|$|CHART_CONFIG_JSON:)/m);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    const chartType = o.chartType as string;
    const groupBy = o.groupBy as string;
    const metric1 = o.metric1 as string;
    const metric2Raw = o.metric2;
    const metric2 = (metric2Raw === null || metric2Raw === undefined || metric2Raw === "null")
      ? null
      : String(metric2Raw);
    if (!CHART_TYPES.includes(chartType as typeof CHART_TYPES[number])) return null;
    if (!GROUP_BY_OPTIONS.includes(groupBy as typeof GROUP_BY_OPTIONS[number])) return null;
    if (!METRIC_IDS.includes(metric1 as typeof METRIC_IDS[number])) return null;
    if (metric2 !== null && !METRIC_IDS.includes(metric2 as typeof METRIC_IDS[number])) return null;
    return {
      chartType: chartType as CustomChartConfig["chartType"],
      groupBy: groupBy as CustomChartConfig["groupBy"],
      metric1: metric1 as CustomChartConfig["metric1"],
      metric2: metric2 as CustomChartConfig["metric2"],
    };
  } catch {
    return null;
  }
}

export function AIAnalyticDiveChat({ trades }: AIAnalyticDiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedChartMessageIndex, setAddedChartMessageIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasKey = hasXaiApiKey();

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading || !hasKey) return;

    setInput("");
    setError(null);
    setAddedChartMessageIndex(null);
    const userMessage: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const contextBlock = buildFullAppContext(trades);
      const apiMessages: ChatMessage[] = [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n=== USER'S APP DATA (current filters apply) ===\n${contextBlock}` },
        ...messages,
        userMessage,
      ];
      const reply = await sendXaiChat(apiMessages);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAddChartToAnalytics = (config: CustomChartConfig, messageIndex: number) => {
    addCustomChartToAnalytics(config);
    setAddedChartMessageIndex(messageIndex);
  };

  if (!hasKey) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 flex flex-col items-center justify-center min-h-[400px] text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
        <h3 className="text-sm font-semibold text-foreground mb-1">xAI API key required</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-4">
          Add <code className="bg-secondary px-1.5 py-0.5 rounded">VITE_XAI_API_KEY</code> to your{" "}
          <code className="bg-secondary px-1.5 py-0.5 rounded">.env.local</code> file and restart the dev server to use AI Analytic Dive.
        </p>
        <p className="text-xs text-muted-foreground">
          Get an API key at{" "}
          <a
            href="https://console.x.ai/team/default/api-keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            xAI Console
          </a>
          . Model: grok-4-1-fast-reasoning.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card flex flex-col min-h-[500px] max-h-[calc(100vh-12rem)]">
      <div className="p-3 border-b border-border">
        <p className="text-xs text-muted-foreground">
          AI has full access to all your metrics, trades, breakdowns, and daily P&L. It can suggest custom charts—add them to the Analytics page with one click.
        </p>
      </div>
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-8">
              Ask for a deep dive, specific advice, or request a custom chart. Try: &ldquo;What stands out in my stats?&rdquo; or &ldquo;Build me a bar chart of P&L distribution.&rdquo;
            </div>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div className="space-y-2 max-w-[85%]">
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-foreground border border-border"
                  )}
                >
                  {msg.role === "assistant"
                    ? msg.content.replace(/\n?CHART_CONFIG_JSON:\s*\{[\s\S]*?\}(?=\s|$)/gm, "").trim()
                    : msg.content}
                </div>
                {msg.role === "assistant" && (() => {
                  const config = parseChartConfigFromMessage(msg.content);
                  if (!config) return null;
                  const isAdded = addedChartMessageIndex === i;
                  return (
                    <div className="space-y-2 w-full min-w-0">
                      <div className="rounded-lg border border-border bg-card overflow-hidden" style={{ minHeight: 200, maxHeight: 320 }}>
                        <ChartErrorBoundary>
                          <CustomChartRenderer trades={trades} config={config} />
                        </ChartErrorBoundary>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => handleAddChartToAnalytics(config, i)}
                        disabled={isAdded}
                      >
                        {isAdded ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            Added to Analytics
                          </>
                        ) : (
                          <>
                            <BarChart2 className="h-3.5 w-3.5" />
                            Add this chart to Analytics page
                          </>
                        )}
                      </Button>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg px-3 py-2 bg-secondary border border-border flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-xs border-t border-border flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}
      <div className="p-4 border-t border-border flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask for analysis or a custom chart..."
          className="flex-1 min-h-[44px] max-h-32 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          rows={2}
          disabled={loading}
        />
        <Button
          type="button"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="shrink-0 self-end"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
