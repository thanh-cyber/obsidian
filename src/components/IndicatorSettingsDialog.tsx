import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { INDICATOR_PRESET_BY_KEY, type IndicatorKey } from "@/utils/indicatorPresets";
import {
  getDefaultIndicatorSettings,
  getIndicatorInputDefs,
  PRECISION_OPTIONS,
  type IndicatorSettings,
  type IndicatorInputDef,
  type IndicatorStyleSettings,
  type IndicatorVisibilitySettings,
  type VisibilityRange,
} from "@/utils/indicatorSettingsSchema";

interface IndicatorSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicatorKey: IndicatorKey | null;
  currentSettings: IndicatorSettings | null;
  onSave: (key: IndicatorKey, settings: IndicatorSettings) => void;
}

const VISIBILITY_LABELS: { k: keyof IndicatorVisibilitySettings; label: string }[] = [
  { k: "minutes", label: "Minutes" },
  { k: "hours", label: "Hours" },
  { k: "days", label: "Days" },
  { k: "weeks", label: "Weeks" },
  { k: "months", label: "Months" },
];

export function IndicatorSettingsDialog({
  open,
  onOpenChange,
  indicatorKey,
  currentSettings,
  onSave,
}: IndicatorSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState("inputs");
  const [draft, setDraft] = useState<IndicatorSettings | null>(null);

  const preset = indicatorKey ? INDICATOR_PRESET_BY_KEY[indicatorKey] : null;
  const title = preset?.label ?? indicatorKey ?? "Indicator";
  const inputDefs = indicatorKey ? getIndicatorInputDefs(indicatorKey) : [];

  useEffect(() => {
    if (open && indicatorKey) {
      setDraft(currentSettings ?? getDefaultIndicatorSettings(indicatorKey));
      setActiveTab("inputs");
    }
  }, [open, indicatorKey, currentSettings]);

  const handleSave = () => {
    if (canShowForm && indicatorKey && effectiveDraft) {
      onSave(indicatorKey, effectiveDraft);
      onOpenChange(false);
    }
  };

  const handleDefaults = () => {
    if (indicatorKey) setDraft(getDefaultIndicatorSettings(indicatorKey));
  };

  const updateInput = (key: string, value: number | string) => {
    setDraft((prev) => {
      const base = prev ?? (indicatorKey ? (currentSettings ?? getDefaultIndicatorSettings(indicatorKey!)) : null);
      return base ? { ...base, inputs: { ...base.inputs, [key]: value } } : null;
    });
  };

  const updateStyle = (patch: Partial<IndicatorStyleSettings>) => {
    setDraft((prev) => {
      const base = prev ?? (indicatorKey ? (currentSettings ?? getDefaultIndicatorSettings(indicatorKey!)) : null);
      return base ? { ...base, style: { ...base.style, ...patch } } : null;
    });
  };

  const updateVisibility = (row: keyof IndicatorVisibilitySettings, patch: Partial<VisibilityRange>) => {
    setDraft((prev) => {
      const base = prev ?? (indicatorKey ? (currentSettings ?? getDefaultIndicatorSettings(indicatorKey)) : null);
      if (!base) return null;
      const next = { ...base.visibility, [row]: { ...base.visibility[row], ...patch } };
      return { ...base, visibility: next };
    });
  };

  const effectiveDraft = draft ?? (indicatorKey ? (currentSettings ?? getDefaultIndicatorSettings(indicatorKey)) : null);
  const canShowForm = Boolean(effectiveDraft && indicatorKey);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "border-border bg-[hsl(0,0%,11%)] text-foreground p-0 gap-0 max-w-[380px]",
          "max-h-[85vh] flex flex-col"
        )}
        aria-describedby={undefined}
      >
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-lg font-semibold text-foreground">{title}</DialogTitle>
        </DialogHeader>

        {canShowForm && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 min-h-0 flex-col">
          <TabsList className="w-full justify-start rounded-none border-b border-border bg-transparent px-4 h-10 gap-6">
            <TabsTrigger
              value="inputs"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              Inputs
            </TabsTrigger>
            <TabsTrigger
              value="style"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              Style
            </TabsTrigger>
            <TabsTrigger
              value="visibility"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none"
            >
              Visibility
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            <TabsContent value="inputs" className="mt-0 space-y-4">
              {inputDefs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No input options for this indicator.</p>
              ) : (
                inputDefs.map((def) => (
                  <InputField
                    key={def.key}
                    def={def}
                    value={effectiveDraft.inputs[def.key]}
                    onChange={(v) => updateInput(def.key, v)}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="style" className="mt-0 space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Line color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={effectiveDraft.style.color}
                    onChange={(e) => updateStyle({ color: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border border-border bg-background"
                  />
                  <Input
                    value={effectiveDraft.style.color}
                    onChange={(e) => updateStyle({ color: e.target.value })}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Line width</Label>
                <Slider
                  value={[effectiveDraft.style.lineWidth]}
                  onValueChange={([v]) => updateStyle({ lineWidth: v ?? 2 })}
                  min={1}
                  max={5}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-muted-foreground">Precision</Label>
                <Select
                  value={effectiveDraft.style.precision}
                  onValueChange={(v) => updateStyle({ precision: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRECISION_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="labels-scale"
                    checked={effectiveDraft.style.labelsOnPriceScale}
                    onCheckedChange={(c) => updateStyle({ labelsOnPriceScale: c === true })}
                  />
                  <Label htmlFor="labels-scale" className="font-normal cursor-pointer">
                    Labels on price scale
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="values-status"
                    checked={effectiveDraft.style.valuesInStatusLine}
                    onCheckedChange={(c) => updateStyle({ valuesInStatusLine: c === true })}
                  />
                  <Label htmlFor="values-status" className="font-normal cursor-pointer">
                    Values in status line
                  </Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="visibility" className="mt-0 space-y-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium pb-1">
                Show on timeframes
              </div>
              {VISIBILITY_LABELS.map(({ k, label }) => {
                const row = effectiveDraft.visibility[k];
                if (!row) return null;
                const maxVal =
                  k === "minutes" ? 59 : k === "hours" ? 24 : k === "days" ? 366 : k === "weeks" ? 52 : 12;
                return (
                  <div key={k} className="flex items-center gap-3 flex-wrap">
                    <Checkbox
                      id={`vis-${k}`}
                      checked={row.enabled}
                      onCheckedChange={(c) => updateVisibility(k, { enabled: c === true })}
                    />
                    <Label htmlFor={`vis-${k}`} className="font-normal cursor-pointer w-16">
                      {label}
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={maxVal}
                      value={row.min}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        const clamped = Number.isFinite(v) ? Math.max(0, Math.min(maxVal, v)) : 0;
                        updateVisibility(k, { min: clamped });
                      }}
                      className="w-14 h-8 text-center text-sm"
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <Input
                      type="number"
                      min={row.min}
                      max={maxVal}
                      value={row.max}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        const clamped = Number.isFinite(v)
                          ? Math.max(row.min, Math.min(maxVal, v))
                          : row.max;
                        updateVisibility(k, { max: clamped });
                      }}
                      className="w-14 h-8 text-center text-sm"
                    />
                  </div>
                );
              })}
            </TabsContent>
          </div>
        </Tabs>
        )}

        {canShowForm && (
        <DialogFooter className="flex-row justify-between px-4 py-3 border-t border-border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground gap-1"
            onClick={handleDefaults}
          >
            Defaults
            <ChevronDown className="h-4 w-4" />
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={handleSave}>
              Ok
            </Button>
          </div>
        </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InputField({
  def,
  value,
  onChange,
}: {
  def: IndicatorInputDef;
  value: number | string | undefined;
  onChange: (v: number | string) => void;
}) {
  if (def.type === "number") {
    const raw = typeof value === "number" ? value : typeof value === "string" ? Number(value) : def.default;
    const num = Number.isFinite(raw) ? raw : def.default;
    return (
      <div className="space-y-2">
        <Label className="text-muted-foreground">{def.label}</Label>
        <Input
          type="number"
          min={def.min}
          max={def.max}
          value={num}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange(Number.isFinite(v) ? v : def.default);
          }}
          className="w-full"
        />
      </div>
    );
  }
  const str =
    typeof value === "string" && value.length > 0 ? value : typeof value === "number" ? String(value) : def.default;
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">{def.label}</Label>
      <Select value={str} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {def.options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
