import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trade, StrategyTag } from "@/types/trade";
import { calculatePnL, calculateDuration } from "@/utils/calculations";

const strategies: StrategyTag[] = ["Breakout", "Scalp", "Swing", "Day Trade", "Momentum", "Reversal", "Other"];

const formSchema = z.object({
  symbol: z.string().min(1, "Symbol is required").max(10),
  entryDate: z.string().min(1, "Entry date is required"),
  entryPrice: z.string().min(1, "Entry price is required"),
  exitDate: z.string().min(1, "Exit date is required"),
  exitPrice: z.string().min(1, "Exit price is required"),
  positionSize: z.string().min(1, "Position size is required"),
  strategyTag: z.string().min(1, "Strategy is required"),
  emotionalNotes: z.string().optional(),
  riskPercentage: z.string().optional(),
  stopLoss: z.string().optional(),
  takeProfit: z.string().optional(),
});

interface TradeFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (trade: Trade) => void;
  editTrade?: Trade;
}

export const TradeForm = ({ open, onOpenChange, onSubmit, editTrade }: TradeFormProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: editTrade ? {
      symbol: editTrade.symbol,
      entryDate: editTrade.entryDate,
      entryPrice: editTrade.entryPrice.toString(),
      exitDate: editTrade.exitDate,
      exitPrice: editTrade.exitPrice.toString(),
      positionSize: editTrade.positionSize.toString(),
      strategyTag: editTrade.strategyTag,
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
      strategyTag: "",
      emotionalNotes: "",
      riskPercentage: "",
      stopLoss: "",
      takeProfit: "",
    },
  });

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
      strategyTag: values.strategyTag,
      emotionalNotes: values.emotionalNotes,
      riskPercentage: values.riskPercentage ? parseFloat(values.riskPercentage) : undefined,
      stopLoss: values.stopLoss ? parseFloat(values.stopLoss) : undefined,
      takeProfit: values.takeProfit ? parseFloat(values.takeProfit) : undefined,
      pnl,
      pnlPercentage,
      duration,
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
                name="strategyTag"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Strategy</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-secondary border-border">
                          <SelectValue placeholder="Select strategy" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover border-border">
                        {strategies.map((strategy) => (
                          <SelectItem key={strategy} value={strategy}>
                            {strategy}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
