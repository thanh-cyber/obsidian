import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Trade } from "@/types/trade";
import { calculatePnL, calculateDuration } from "@/utils/calculations";
import { loadTradeStyleOptions, loadSetupOptions, loadMistakeOptions } from "@/utils/tagOptions";

const validNumber = (msg: string) =>
  z.string().min(1, msg).refine((v) => !Number.isNaN(parseFloat(v)) && Number.isFinite(parseFloat(v)), "Enter a valid number");

const formSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").max(10),
  entryDate: z.string().min(1, "Entry date is required"),
  entryPrice: validNumber("Entry price is required"),
  exitDate: z.string().min(1, "Exit date is required"),
  exitPrice: validNumber("Exit price is required"),
  positionSize: validNumber("Position size is required"),
  tradeStyle: z.string().min(1, "Trade style is required"),
  setups: z.array(z.string()).optional(),
  mistakes: z.array(z.string()).optional(),
  emotionalNotes: z.string().optional(),
  riskPercentage: z.string().optional().refine((v) => !v || (!Number.isNaN(parseFloat(v!)) && Number.isFinite(parseFloat(v!))), "Enter a valid number"),
  stopLoss: z.string().optional().refine((v) => !v || (!Number.isNaN(parseFloat(v!)) && Number.isFinite(parseFloat(v!))), "Enter a valid number"),
  takeProfit: z.string().optional().refine((v) => !v || (!Number.isNaN(parseFloat(v!)) && Number.isFinite(parseFloat(v!))), "Enter a valid number"),
});

interface TradeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (trade: Trade) => void;
  editTrade?: Trade;
}

const defaultTradeStyle = () => loadTradeStyleOptions()[0] ?? "Other";

export const TradeForm = ({ open, onOpenChange, onSubmit, editTrade }: TradeFormProps) => {
  const tradeStyleOptions = loadTradeStyleOptions();
  const setupOptions = loadSetupOptions();
  const mistakeOptions = loadMistakeOptions();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: editTrade ? {
      symbol: editTrade.symbol,
      entryDate: editTrade.entryDate,
      entryPrice: Number.isFinite(Number(editTrade.entryPrice)) ? Number(editTrade.entryPrice).toString() : "",
      exitDate: editTrade.exitDate,
      exitPrice: Number.isFinite(Number(editTrade.exitPrice)) ? Number(editTrade.exitPrice).toString() : "",
      positionSize: Number.isFinite(Number(editTrade.positionSize)) ? Number(editTrade.positionSize).toString() : "",
      tradeStyle: editTrade.tradeStyle ?? editTrade.strategyTag ?? defaultTradeStyle(),
      setups: editTrade.setups ?? [],
      mistakes: editTrade.mistakes?.length ? editTrade.mistakes : (editTrade.mistake ? [editTrade.mistake] : []),
      emotionalNotes: editTrade.emotionalNotes || "",
      riskPercentage: editTrade.riskPercentage?.toString() || "",
      stopLoss: editTrade.stopLoss?.toString() || "",
      takeProfit: editTrade.takeProfit?.toString() || "",
    } : {
      symbol: "",
      entryDate: "",
      entryPrice: "",
      exitDate: "",
      exitPrice: "",
      positionSize: "",
      tradeStyle: defaultTradeStyle(),
      setups: [],
      mistakes: [],
      emotionalNotes: "",
      riskPercentage: "",
      stopLoss: "",
      takeProfit: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (editTrade) {
        const ep = Number(editTrade.entryPrice);
        const xp = Number(editTrade.exitPrice);
        const ps = Number(editTrade.positionSize);
        form.reset({
          symbol: editTrade.symbol,
          entryDate: editTrade.entryDate,
          entryPrice: Number.isFinite(ep) ? ep.toString() : "",
          exitDate: editTrade.exitDate,
          exitPrice: Number.isFinite(xp) ? xp.toString() : "",
          positionSize: Number.isFinite(ps) ? ps.toString() : "",
          tradeStyle: editTrade.tradeStyle ?? editTrade.strategyTag ?? defaultTradeStyle(),
          setups: editTrade.setups ?? [],
          mistakes: editTrade.mistakes?.length ? editTrade.mistakes : (editTrade.mistake ? [editTrade.mistake] : []),
          emotionalNotes: editTrade.emotionalNotes || "",
          riskPercentage: editTrade.riskPercentage?.toString() || "",
          stopLoss: editTrade.stopLoss?.toString() || "",
          takeProfit: editTrade.takeProfit?.toString() || "",
        });
      } else {
        form.reset({
          symbol: "",
          entryDate: "",
          entryPrice: "",
          exitDate: "",
          exitPrice: "",
          positionSize: "",
          tradeStyle: defaultTradeStyle(),
          setups: [],
          mistakes: [],
          emotionalNotes: "",
          riskPercentage: "",
          stopLoss: "",
          takeProfit: "",
        });
      }
    }
  }, [open, editTrade?.id, editTrade?.entryDate, editTrade?.exitDate]);

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    const entryPrice = parseFloat(values.entryPrice);
    const exitPrice = parseFloat(values.exitPrice);
    const positionSize = parseFloat(values.positionSize);
    
    const { pnl, pnlPercentage } = calculatePnL(entryPrice, exitPrice, positionSize);
    const duration = calculateDuration(values.entryDate, values.exitDate);

    const trade: Trade = {
      id: editTrade?.id || Date.now().toString(),
      symbol: values.symbol.toUpperCase(),
      entryDate: values.entryDate,
      entryPrice,
      exitDate: values.exitDate,
      exitPrice,
      positionSize,
      tradeStyle: values.tradeStyle,
      setups: values.setups?.length ? values.setups : undefined,
      mistakes: values.mistakes?.length ? values.mistakes : undefined,
      strategyTag: values.setups?.[0],
      mistake: values.mistakes?.[0],
      emotionalNotes: values.emotionalNotes || undefined,
      riskPercentage: values.riskPercentage ? parseFloat(values.riskPercentage) : undefined,
      stopLoss: values.stopLoss ? parseFloat(values.stopLoss) : undefined,
      takeProfit: values.takeProfit ? parseFloat(values.takeProfit) : undefined,
      pnl,
      pnlPercentage,
      duration,
      // Preserve execution details so "All fills" and Executions table show all fills
      ...(editTrade?.executions != null && { executions: editTrade.executions }),
      ...(editTrade?.executionsList != null && editTrade.executionsList.length > 0 && { executionsList: editTrade.executionsList }),
    };

    onSubmit(trade);
    form.reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">{editTrade ? "Edit Trade" : "Log New Trade"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="symbol"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Symbol</FormLabel>
                    <FormControl>
                      <Input placeholder="AAPL" {...field} className="bg-secondary border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tradeStyle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trade Style</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-secondary border-border">
                          <SelectValue placeholder="Select trade style" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border">
                        {tradeStyleOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="setups"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Setups (optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-start font-normal bg-secondary border-border">
                            {field.value?.length ? field.value.join(", ") : "Select setups…"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="start">
                        <div className="max-h-48 overflow-auto space-y-1">
                          {setupOptions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Add setups in Settings</p>
                          ) : (
                            setupOptions.map((opt) => (
                              <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
                                <Checkbox
                                  checked={field.value?.includes(opt) ?? false}
                                  onCheckedChange={(checked) => {
                                    const next = checked
                                      ? [...(field.value ?? []), opt]
                                      : (field.value ?? []).filter((x) => x !== opt);
                                    field.onChange(next);
                                  }}
                                />
                                {opt}
                              </label>
                            ))
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="mistakes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mistakes (optional)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-start font-normal bg-secondary border-border">
                            {field.value?.length ? field.value.join(", ") : "Select mistakes…"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="start">
                        <div className="max-h-48 overflow-auto space-y-1">
                          {mistakeOptions.map((opt) => (
                            <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm">
                              <Checkbox
                                checked={field.value?.includes(opt) ?? false}
                                onCheckedChange={(checked) => {
                                  const next = checked
                                    ? [...(field.value ?? []), opt]
                                    : (field.value ?? []).filter((x) => x !== opt);
                                  field.onChange(next);
                                }}
                              />
                              {opt}
                            </label>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="entryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Date/Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} className="bg-secondary border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="entryPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entry Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="100.00" {...field} className="bg-secondary border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="exitDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exit Date/Time</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} className="bg-secondary border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="exitPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Exit Price</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="105.00" {...field} className="bg-secondary border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="positionSize"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Position Size</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" placeholder="100" {...field} className="bg-secondary border-border" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="stopLoss"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stop Loss (optional)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="95.00" {...field} className="bg-secondary border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="takeProfit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Take Profit (optional)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="110.00" {...field} className="bg-secondary border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="riskPercentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk % (optional)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.1" placeholder="2.0" {...field} className="bg-secondary border-border" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="emotionalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="How did you feel? What went well? What could improve?" 
                      className="resize-none bg-secondary border-border" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-primary hover:bg-primary/90">
                {editTrade ? "Update Trade" : "Log Trade"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
