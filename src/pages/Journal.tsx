import { useState, useEffect, useRef } from "react";
import { Trade } from "@/types/trade";
import { loadTrades } from "@/utils/storage";
import { useFilters } from "@/context/FilterContext";
import { getDailyStats, type DailyDayStats } from "@/utils/calculations";
import { formatAppDateKey } from "@/utils/appDateTime";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bold, Italic, Strikethrough, Heading1, List, ListOrdered, Code, Undo2, Redo2, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

const JOURNAL_STORAGE_PREFIX = "journal_";

function loadJournalContent(dateKey: string): string {
  try {
    return localStorage.getItem(JOURNAL_STORAGE_PREFIX + dateKey) ?? "";
  } catch {
    return "";
  }
}

function saveJournalContent(dateKey: string, html: string) {
  try {
    if (html) localStorage.setItem(JOURNAL_STORAGE_PREFIX + dateKey, html);
    else localStorage.removeItem(JOURNAL_STORAGE_PREFIX + dateKey);
  } catch {
    /* ignore */
  }
}

function formatNet(value: number): string {
  const n = value;
  if (n >= 0) return `$${n.toFixed(2)}`;
  return `-$${Math.abs(n).toFixed(2)}`;
}

function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatFactor(value: number): string {
  return Number.isFinite(value) && value < 1e10 ? value.toFixed(2) : value >= 1e10 ? "∞" : "—";
}

export const Journal = () => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const { applyFilters } = useFilters();
  const filteredTrades = applyFilters(trades);
  const dailyStats = getDailyStats(filteredTrades);
  const dateKeys = Array.from(dailyStats.keys()).sort((a, b) => b.localeCompare(a));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const selectedDateKeyRef = useRef<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTrades(loadTrades());
  }, []);

  useEffect(() => {
    if (dateKeys.length > 0 && selectedDateKey === null) {
      setSelectedDateKey(dateKeys[0]);
    }
  }, [dateKeys, selectedDateKey]);

  // When selected day changes: save previous day's content, load new day's content
  useEffect(() => {
    const prevKey = selectedDateKeyRef.current;
    if (prevKey && editorRef.current) {
      saveJournalContent(prevKey, editorRef.current.innerHTML);
    }
    selectedDateKeyRef.current = selectedDateKey;
    if (selectedDateKey && editorRef.current) {
      editorRef.current.innerHTML = loadJournalContent(selectedDateKey);
    }
  }, [selectedDateKey]);

  const handleEditorBlur = () => {
    if (selectedDateKey && editorRef.current) {
      saveJournalContent(selectedDateKey, editorRef.current.innerHTML);
    }
  };

  const execCommand = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value ?? undefined);
    editorRef.current?.focus();
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      execCommand("insertImage", dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const selectedStats: DailyDayStats | null = selectedDateKey ? dailyStats.get(selectedDateKey) ?? null : null;

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {/* Left: day list with metrics */}
      <div className="w-[320px] shrink-0 border-r border-border flex flex-col bg-muted/30">
        <div className="p-3 border-b border-border">
          <h2 className="font-semibold text-foreground">Journal</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Select a day to view metrics and write notes</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {dateKeys.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No trading days in the current filter.</p>
            ) : (
              dateKeys.map((dateKey) => {
                const s = dailyStats.get(dateKey)!;
                const isSelected = selectedDateKey === dateKey;
                return (
                  <button
                    key={dateKey}
                    type="button"
                    onClick={() => setSelectedDateKey(dateKey)}
                    className={`w-full text-left rounded-lg p-3 transition-colors border ${
                      isSelected ? "bg-primary/15 border-primary/50" : "border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-medium text-foreground">{formatAppDateKey(dateKey)}</div>
                    <div className={`text-sm font-semibold mt-1 ${s.returnNet >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {formatNet(s.returnNet)}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-2 text-xs text-muted-foreground">
                      <span>Return $</span>
                      <span className="text-foreground">{formatNet(s.returnDollar)}</span>
                      <span>MFE</span>
                      <span className="text-foreground">{s.mfe.toFixed(2)}</span>
                      <span>Commissions</span>
                      <span className="text-foreground">${s.commissions.toFixed(2)}</span>
                      <span>MAE</span>
                      <span className="text-foreground">{s.mae.toFixed(2)}</span>
                      <span>Return $ Net</span>
                      <span className="text-foreground">{formatNet(s.returnNet)}</span>
                      <span>Win %</span>
                      <span className="text-foreground">{formatPct(s.winPct)}</span>
                      <span>Trades</span>
                      <span className="text-foreground">{s.trades}</span>
                      <span>Profit Factor</span>
                      <span className="text-foreground">{formatFactor(s.profitFactor)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Right: editor */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedDateKey ? (
          <>
            <div className="p-4 border-b border-border">
              <h1 className="text-xl font-semibold text-foreground">{formatAppDateKey(selectedDateKey)}</h1>
              {selectedStats && (
                <p className="text-sm text-muted-foreground mt-1">
                  Net {formatNet(selectedStats.returnNet)} · {selectedStats.trades} trades · Win {formatPct(selectedStats.winPct)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 p-2 border-b border-border bg-muted/20">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("bold")} title="Bold">
                <Bold className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("italic")} title="Italic">
                <Italic className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("strikeThrough")} title="Strikethrough">
                <Strikethrough className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("formatBlock", "h2")} title="Heading">
                <Heading1 className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("insertUnorderedList")} title="Bullet list">
                <List className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("insertOrderedList")} title="Numbered list">
                <ListOrdered className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("formatBlock", "pre")} title="Code block">
                <Code className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("undo")} title="Undo">
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => execCommand("redo")} title="Redo">
                <Redo2 className="h-4 w-4" />
              </Button>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => imageInputRef.current?.click()}
                title="Add image"
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div
                ref={editorRef}
                contentEditable
                className="min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring prose prose-sm dark:prose-invert max-w-none empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
                data-placeholder="Type your notes here..."
                onBlur={handleEditorBlur}
                suppressContentEditableWarning
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <p>Select a day from the list to write your journal entry.</p>
          </div>
        )}
      </div>
    </div>
  );
};
