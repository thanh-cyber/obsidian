import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, Upload, Trash2, FileJson, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loadTrades, saveTrades, exportTrades, exportTradesCSV, importTrades } from "@/utils/storage";
import { loadImportSettings, saveImportSettings, type ImportSettings, type ImportMergeMode } from "@/utils/importSettings";
import {
  getIbkrAutoSyncEnabled,
  getIbkrBridgeUrl,
  setIbkrAutoSyncEnabled,
  setIbkrBridgeUrl,
  testIbkrBridge,
} from "@/utils/ibkrBridge";
import { enrichTradesWithGapData } from "@/utils/yahooGap";
import { enrichTradesWithYahooQuote } from "@/utils/yahooQuote";
import {
  parseStockDataXlsx,
  mergeStockDataIntoTrades,
  buildStockDataLookupKey,
  getTradeStockDataKey,
} from "@/utils/stockDataImport";
import { Trade } from "@/types/trade";
import {
  loadCustomSetups,
  saveCustomSetups,
  loadMistakeOptions,
  saveMistakeOptions,
} from "@/utils/tagOptions";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

export const Settings = () => {
  const navigate = useNavigate();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [importSettings, setImportSettings] = useState<ImportSettings>(() => loadImportSettings());
  const [ibkrBridgeUrl, setIbkrBridgeUrlState] = useState<string>(() => getIbkrBridgeUrl());
  const [ibkrAutoSync, setIbkrAutoSyncState] = useState<boolean>(() => getIbkrAutoSyncEnabled());
  const [ibkrTestStatus, setIbkrTestStatus] = useState<string>("");
  const [ibkrTesting, setIbkrTesting] = useState(false);
  const [gapLoading, setGapLoading] = useState(false);
  const [gapStatus, setGapStatus] = useState<string>("");
  const [stockDataLoading, setStockDataLoading] = useState(false);
  const [yahooQuoteLoading, setYahooQuoteLoading] = useState(false);
  const [yahooQuoteStatus, setYahooQuoteStatus] = useState<string>("");
  const [customSetups, setCustomSetups] = useState<string[]>(() => loadCustomSetups());
  const [customMistakes, setCustomMistakes] = useState<string[]>(() => loadMistakeOptions());
  const [newSetupName, setNewSetupName] = useState("");
  const [newMistakeName, setNewMistakeName] = useState("");

  useEffect(() => {
    setTrades(loadTrades());
  }, []);

  const updateImportSettings = (updates: Partial<ImportSettings>) => {
    const next = { ...importSettings, ...updates };
    setImportSettings(next);
    saveImportSettings(next);
  };

  const handleExportJSON = () => {
    exportTrades(trades);
    toast.success("Trades exported as JSON");
  };

  const handleExportCSV = () => {
    exportTradesCSV(trades);
    toast.success("Trades exported as CSV");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    importTrades(
      file,
      async (importedTrades) => {
        const baseUrl = getIbkrBridgeUrl();
        if (baseUrl?.trim()) toast.info("Syncing float, market cap & outstanding shares from Yahoo…");
        try {
          const enriched = await enrichTradesWithYahooQuote(importedTrades, baseUrl ?? "");
          const symbolsFetched = new Set(
            enriched
              .map((t, i) => {
                const a = importedTrades[i];
                if (
                  (t.float != null && a.float == null) ||
                  (t.marketCap != null && a.marketCap == null) ||
                  (t.outstandingShares != null && a.outstandingShares == null)
                )
                  return t.symbol;
                return null;
              })
              .filter((s): s is string => s != null)
          ).size;
          setTrades(enriched);
          saveTrades(enriched);
          if (symbolsFetched > 0) {
            toast.success(`Imported ${importedTrades.length} trades; filled stock data for ${symbolsFetched} symbols.`);
          } else {
            toast.success(`Imported ${importedTrades.length} trades successfully`);
          }
        } catch {
          setTrades(importedTrades);
          saveTrades(importedTrades);
            toast.warning(`Imported ${importedTrades.length} trades. Yahoo sync failed (is the bridge running?).`);
        }
      },
      (error) => {
        toast.error(error);
      }
    );
  };

  const handleClearData = () => {
    setTrades([]);
    saveTrades([]);
    toast.success("All data cleared");
  };

  const handleTestIbkr = async () => {
    try {
      setIbkrTesting(true);
      setIbkrTestStatus("");
      const res = await testIbkrBridge(ibkrBridgeUrl);
      if (!res.ok) {
        setIbkrTestStatus("Not reachable");
        toast.error("IBKR bridge not reachable");
        return;
      }
      const state = res.status?.state ? String(res.status.state) : "ok";
      setIbkrTestStatus(state);
      toast.success(`IBKR bridge reachable (${state})`);
    } catch (e: unknown) {
      setIbkrTestStatus("Error");
      toast.error(e instanceof Error ? e.message : "IBKR bridge test failed");
    } finally {
      setIbkrTesting(false);
    }
  };

  const handleFetchGapData = async () => {
    if (trades.length === 0) {
      toast.error("No trades to enrich");
      return;
    }
    setGapLoading(true);
    setGapStatus("");
    try {
      const enriched = await enrichTradesWithGapData(
        trades,
        ibkrBridgeUrl,
        (done, total, date) => setGapStatus(total ? `${done}/${total} ${date || ""}` : "")
      );
      saveTrades(enriched);
      setTrades(enriched);
      toast.success("SPY/SPX gap data fetched and saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch gap data");
    } finally {
      setGapLoading(false);
      setGapStatus("");
    }
  };

  const handleFetchMissingStockData = async () => {
    if (trades.length === 0) {
      toast.error("No trades to enrich");
      return;
    }
    setYahooQuoteLoading(true);
    setYahooQuoteStatus("");
    try {
      const before = trades;
      const enriched = await enrichTradesWithYahooQuote(
        before,
        ibkrBridgeUrl?.trim() ?? "",
        (done, total, symbol) => setYahooQuoteStatus(total ? `${done}/${total} ${symbol || ""}` : "")
      );
      const symbolsFetched = new Set(
        enriched
          .map((t, i) => {
            const a = before[i];
            if (
              (t.float != null && a.float == null) ||
              (t.marketCap != null && a.marketCap == null) ||
              (t.outstandingShares != null && a.outstandingShares == null)
            )
              return t.symbol;
            return null;
          })
          .filter((s): s is string => s != null)
      ).size;
      saveTrades(enriched);
      setTrades(enriched);
      if (symbolsFetched > 0) {
        toast.success(`Filled float / market cap / outstanding for ${symbolsFetched} symbol(s).`);
      } else {
        toast.info("No missing data found—all tickers already have float, market cap, and outstanding shares.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to fetch from Yahoo (is the bridge running?)");
    } finally {
      setYahooQuoteLoading(false);
      setYahooQuoteStatus("");
    }
  };

  const handleClearThreeDigitOutstanding = () => {
    let cleared = 0;
    const updated = trades.map((t) => {
      const o = t.outstandingShares;
      const absSize = t.positionSize != null ? Math.abs(Number(t.positionSize)) : NaN;
      const displayedWouldBeThreeDigit =
        (typeof o === "number" && o >= 100 && o <= 999) ||
        (Number.isFinite(absSize) && absSize >= 100 && absSize <= 999);
      if (!displayedWouldBeThreeDigit) return t;
      cleared++;
      if (typeof o === "number" && o >= 100 && o <= 999) {
        const { outstandingShares: _, ...rest } = t;
        return { ...rest, outstandingSharesHidden: true };
      }
      return { ...t, outstandingSharesHidden: true };
    });
    saveTrades(updated);
    setTrades(updated);
    toast.success(`Cleared outstanding shares for ${cleared} trades (3-digit values hidden).`);
  };

  const handleImportStockData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const current = loadTrades();
    if (current.length === 0) {
      toast.error("No trades to merge. Import trades first.");
      e.target.value = "";
      return;
    }
    setStockDataLoading(true);
    parseStockDataXlsx(file)
      .then((rows) => {
        const merged = mergeStockDataIntoTrades(current, rows);
        let updated = 0;
        for (let i = 0; i < current.length; i++) {
          const a = current[i];
          const b = merged[i];
          if (
            (b.float !== undefined && b.float !== a.float) ||
            (b.marketCap !== undefined && b.marketCap !== a.marketCap) ||
            (b.outstandingShares !== undefined && b.outstandingShares !== a.outstandingShares)
          )
            updated++;
        }
        saveTrades(merged);
        setTrades(merged);
        if (updated === 0 && rows.length > 0 && current.length > 0) {
          const excelSamples = rows.slice(0, 5).map((r) => buildStockDataLookupKey(r.symbol, r.dateKey));
          const tradeSamples = current.slice(0, 5).map(getTradeStockDataKey);
          console.warn(
            "Stock data: 0 matches. Sample Excel keys (symbol|date):",
            excelSamples,
            "Sample trade keys:",
            tradeSamples
          );
          toast.warning(
            `Imported ${rows.length} rows but 0 trades matched. Open browser console (F12) to see sample keys and compare symbol + date format.`
          );
        } else {
          toast.success(
            `Stock data imported: ${rows.length} rows, ${updated} trades updated with float/market cap/outstanding.`
          );
        }
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to parse Excel file");
      })
      .finally(() => {
        setStockDataLoading(false);
        e.target.value = "";
      });
  };

  return (
    <>
      <div className="min-h-full bg-background p-6">
        <div className="max-w-4xl mx-auto space-y-8">
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
            <h1 className="text-4xl font-bold text-primary">
              Settings
            </h1>
            <p className="text-muted-foreground mt-1">Manage your data and preferences</p>
          </div>
        </div>

        {/* Data Management */}
        <Card className="bg-gradient-card backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Export, import, or clear your trading data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Export Section */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Export Trades</Label>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleExportJSON}
                  variant="secondary"
                  className="flex-1 min-w-[200px]"
                >
                  <FileJson className="mr-2 h-4 w-4" />
                  Export as JSON
                </Button>
                <Button
                  onClick={handleExportCSV}
                  variant="secondary"
                  className="flex-1 min-w-[200px]"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Export as CSV
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Download all your trades for backup or analysis in external tools
              </p>
            </div>

            {/* Setups & Mistakes */}
            <div className="space-y-4 pt-4 border-t border-border">
              <Label className="text-base font-semibold">Setups &amp; Mistakes</Label>
              <p className="text-sm text-muted-foreground">
                Add your own Setups (e.g. chart patterns, rules) and Mistakes. Setups start empty—add options here to use in the Setups column. Trade Style (Swing, Day Trade, etc.) is a separate column with a fixed list.
              </p>
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Custom Setups</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="New setup name"
                      value={newSetupName}
                      onChange={(e) => setNewSetupName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const t = newSetupName.trim();
                          if (t && !customSetups.includes(t)) {
                            const next = [...customSetups, t];
                            setCustomSetups(next);
                            saveCustomSetups(next);
                            setNewSetupName("");
                            toast.success(`Added setup "${t}"`);
                          }
                        }
                      }}
                      className="bg-secondary border-border"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const t = newSetupName.trim();
                        if (t && !customSetups.includes(t)) {
                          const next = [...customSetups, t];
                          setCustomSetups(next);
                          saveCustomSetups(next);
                          setNewSetupName("");
                          toast.success(`Added setup "${t}"`);
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                    {customSetups.length === 0 ? (
                      <li>No custom setups yet</li>
                    ) : (
                      customSetups.map((name) => (
                        <li key={name} className="flex items-center justify-between gap-2 py-0.5">
                          <span>{name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              const next = customSetups.filter((x) => x !== name);
                              setCustomSetups(next);
                              saveCustomSetups(next);
                              toast.success(`Removed "${name}"`);
                            }}
                          >
                            Remove
                          </Button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
                <div className="space-y-2">
                  <Label>Mistakes</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="New mistake option"
                      value={newMistakeName}
                      onChange={(e) => setNewMistakeName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const t = newMistakeName.trim();
                          if (t && !customMistakes.includes(t)) {
                            const next = [...customMistakes, t];
                            setCustomMistakes(next);
                            saveMistakeOptions(next);
                            setNewMistakeName("");
                            toast.success(`Added mistake "${t}"`);
                          }
                        }
                      }}
                      className="bg-secondary border-border"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const t = newMistakeName.trim();
                        if (t && !customMistakes.includes(t)) {
                          const next = [...customMistakes, t];
                          setCustomMistakes(next);
                          saveMistakeOptions(next);
                          setNewMistakeName("");
                          toast.success(`Added mistake "${t}"`);
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1 mt-2">
                    {customMistakes.length === 0 ? (
                      <li>No mistakes defined yet</li>
                    ) : (
                      customMistakes.map((name) => (
                        <li key={name} className="flex items-center justify-between gap-2 py-0.5">
                          <span>{name}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              const next = customMistakes.filter((x) => x !== name);
                              setCustomMistakes(next);
                              saveMistakeOptions(next);
                              toast.success(`Removed "${name}"`);
                            }}
                          >
                            Remove
                          </Button>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>

            {/* Import Settings (CSV grouping) */}
            <div className="space-y-3 pt-4 border-t border-border">
              <Label className="text-base font-semibold">CSV Import Settings</Label>
              <p className="text-sm text-muted-foreground">
                Tradervue-style grouping. New trade when: side reversal, time gap, or split on flat.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="merge-mode">Merge mode</Label>
                  <Select
                    value={importSettings.mergeMode}
                    onValueChange={(v: ImportMergeMode) => updateImportSettings({ mergeMode: v })}
                  >
                    <SelectTrigger id="merge-mode" className="bg-secondary border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="split_when_possible">Split when possible</SelectItem>
                      <SelectItem value="normal">Normal (merge across brief flat periods)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Split: new trade every time position goes flat. Normal: merge if within time limit.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time-threshold">Time threshold (seconds)</Label>
                  <Input
                    id="time-threshold"
                    type="number"
                    min={60}
                    max={3600}
                    step={60}
                    value={importSettings.timeThresholdSec}
                    onChange={(e) =>
                      updateImportSettings({
                        timeThresholdSec: Math.max(60, parseInt(e.target.value) || 300),
                      })
                    }
                    className="bg-secondary border-border"
                  />
                  <p className="text-xs text-muted-foreground">
                    Start new trade if time since last flat exceeds this (normal mode).
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Brokers Sync */}
            <div className="space-y-3 pt-4 border-t border-border">
              <Label className="text-base font-semibold">Interactive Brokers (IBKR) Sync</Label>
              <p className="text-sm text-muted-foreground">
                Connects to a local IBKR bridge (TWS / IB Gateway API) to import completed trades automatically.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ibkr-bridge-url">Bridge URL</Label>
                  <Input
                    id="ibkr-bridge-url"
                    value={ibkrBridgeUrl}
                    onChange={(e) => {
                      const v = e.target.value;
                      setIbkrBridgeUrlState(v);
                      setIbkrBridgeUrl(v);
                    }}
                    placeholder="http://localhost:4010"
                    className="bg-secondary border-border"
                  />
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleTestIbkr}
                      disabled={ibkrTesting}
                    >
                      {ibkrTesting ? "Testing…" : "Test connection"}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {ibkrTestStatus ? `Status: ${ibkrTestStatus}` : ""}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ibkr-auto-sync">Auto-sync trades</Label>
                  <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-3 py-2">
                    <div className="space-y-0.5">
                      <div className="text-sm font-medium">Enable</div>
                      <div className="text-xs text-muted-foreground">
                        When enabled, the Trades page will merge new completed trades automatically.
                      </div>
                    </div>
                    <Switch
                      id="ibkr-auto-sync"
                      checked={ibkrAutoSync}
                      onCheckedChange={(v) => {
                        setIbkrAutoSyncState(v);
                        setIbkrAutoSyncEnabled(v);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SPY / SPX gap data (Yahoo Finance via bridge) */}
            <div className="space-y-3 pt-4 border-t border-border">
              <Label className="text-base font-semibold">SPY / SPX opening gap data</Label>
              <p className="text-sm text-muted-foreground">
                Fetch opening gap $ and % for each trade date from Yahoo Finance. Uses the same bridge URL above; the bridge must be running (e.g. <code className="text-xs bg-muted px-1 rounded">npm run dev</code> in <code className="text-xs bg-muted px-1 rounded">ibkr-bridge</code>). Then you can filter by SPY/SPX gap in Custom Tags.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleFetchGapData}
                  disabled={gapLoading || trades.length === 0}
                >
                  {gapLoading ? "Fetching…" : "Fetch gap data for all trades"}
                </Button>
                {gapStatus && <span className="text-xs text-muted-foreground">{gapStatus}</span>}
              </div>
            </div>

            {/* Fetch from Yahoo (float, mcap, outstanding) */}
            <div className="space-y-3 pt-4 border-t border-border">
              <Label className="text-base font-semibold">Fetch from Yahoo Finance</Label>
              <p className="text-sm text-muted-foreground">
                Fill float, market cap, and outstanding shares for tickers that don’t have them. Requires the bridge: set <strong>Bridge URL</strong> above (e.g. <code className="text-xs bg-muted px-1 rounded">http://localhost:4010</code>) and run <code className="text-xs bg-muted px-1 rounded">cd ibkr-bridge &amp;&amp; npm run dev</code> in a terminal.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleFetchMissingStockData}
                  disabled={yahooQuoteLoading || trades.length === 0 || !ibkrBridgeUrl?.trim()}
                >
                  {yahooQuoteLoading ? "Fetching…" : "Fetch missing from Yahoo"}
                </Button>
                {yahooQuoteStatus && (
                  <span className="text-xs text-muted-foreground">{yahooQuoteStatus}</span>
                )}
              </div>
            </div>

            {/* Import stock data from Excel */}
            <div className="space-y-3 pt-4 border-t border-border">
              <Label htmlFor="stock-data-import" className="text-base font-semibold">
                Import stock data from Excel (Float, Market Cap, Outstanding)
              </Label>
              <p className="text-sm text-muted-foreground">
                Choose your Excel file (e.g. Final Output.xlsx). Trades are matched by symbol and exit date.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Input
                  id="stock-data-import"
                  type="file"
                  accept=".xlsx"
                  onChange={handleImportStockData}
                  disabled={stockDataLoading || trades.length === 0}
                  className="bg-secondary border-border"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearThreeDigitOutstanding}
                  disabled={trades.length === 0}
                >
                  Clear 3-digit outstanding shares
                </Button>
                {stockDataLoading && (
                  <span className="text-xs text-muted-foreground">Processing…</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Clear 3-digit outstanding shares: removes values between 100–999 (often position size mistaken for shares).
              </p>
            </div>

            {/* Import Section */}
            <div className="space-y-3 pt-4 border-t border-border">
              <Label htmlFor="import" className="text-base font-semibold">
                Import Trades
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="import"
                  type="file"
                  accept=".json,.csv"
                  onChange={handleImport}
                  className="bg-secondary border-border"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Import from JSON (replace) or CSV (broker export). Merge mode applies to CSV imports. If the bridge is running, import will also sync float, market cap, and outstanding shares from Yahoo for tickers that don't have that data.
              </p>
            </div>

            {/* Clear Data Section */}
            <div className="space-y-3 pt-4 border-t border-border">
              <Label className="text-base font-semibold text-destructive">Danger Zone</Label>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full sm:w-auto">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Clear All Data
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-card border-border">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all your trades
                      and reset all statistics. Make sure to export your data first if you want to keep a backup.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearData} className="bg-destructive hover:bg-destructive/90">
                      Delete Everything
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <p className="text-sm text-muted-foreground">
                Permanently delete all trades and reset the application
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Summary */}
        <Card className="bg-gradient-card backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>Current Data</CardTitle>
            <CardDescription>Overview of your stored information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Total Trades</p>
                <p className="text-3xl font-bold text-primary">{trades.length}</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Data Size</p>
                <p className="text-3xl font-bold">
                  {(new Blob([JSON.stringify(trades)]).size / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg border border-border/50">
                <p className="text-sm text-muted-foreground mb-1">Storage Used</p>
                <p className="text-3xl font-bold">Local</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* App Information */}
        <Card className="bg-gradient-card backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Storage</span>
              <span className="font-medium">Local Browser Storage</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Data Privacy</span>
              <span className="font-medium">All data stays on your device</span>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
};
