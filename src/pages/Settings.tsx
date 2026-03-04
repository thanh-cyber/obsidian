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
import { Trade } from "@/types/trade";
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

    importTrades(
      file,
      (importedTrades) => {
        setTrades(importedTrades);
        saveTrades(importedTrades);
        toast.success(`Imported ${importedTrades.length} trades successfully`);
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

            {/* Import Section */}
            <div className="space-y-3">
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
                Import from JSON (replace) or CSV (broker export). Merge mode applies to CSV imports.
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
