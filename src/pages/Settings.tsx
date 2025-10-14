import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, Upload, Trash2, FileJson, FileSpreadsheet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { loadTrades, saveTrades, exportTrades, exportTradesCSV, importTrades } from "@/utils/storage";
import { Trade } from "@/types/trade";
import { toast } from "sonner";
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

export const Settings = () => {
  const navigate = useNavigate();
  const [trades, setTrades] = useState<Trade[]>([]);

  useEffect(() => {
    setTrades(loadTrades());
  }, []);

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

  return (
    <div className="min-h-screen bg-background p-6">
      <Navigation />
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
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
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

            {/* Import Section */}
            <div className="space-y-3">
              <Label htmlFor="import" className="text-base font-semibold">
                Import Trades
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="import"
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="bg-secondary border-border"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Import trades from a previously exported JSON file. This will replace all current data.
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
  );
};
