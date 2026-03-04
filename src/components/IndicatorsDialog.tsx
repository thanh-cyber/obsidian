import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { INDICATOR_PRESETS, INDICATOR_PRESET_BY_KEY, type IndicatorKey } from "@/utils/indicatorPresets";

interface IndicatorsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selected: IndicatorKey[];
  onSelectionChange: (selected: IndicatorKey[]) => void;
}

export function IndicatorsDialog({
  open,
  onOpenChange,
  selected,
  onSelectionChange,
}: IndicatorsDialogProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return INDICATOR_PRESETS;
    return INDICATOR_PRESETS.filter((p) =>
      p.label.toLowerCase().includes(q)
    );
  }, [search]);

  const toggle = (key: IndicatorKey) => {
    const preset = INDICATOR_PRESET_BY_KEY[key];
    if (!preset) return;
    const isOn = selected.includes(key);
    if (isOn) {
      onSelectionChange(selected.filter((k) => k !== key));
      return;
    }
    if (preset.pane === "oscillator") {
      const withoutOtherOsc = selected.filter(
        (k) => INDICATOR_PRESET_BY_KEY[k]?.pane !== "oscillator"
      );
      onSelectionChange([...withoutOtherOsc, key]);
    } else {
      onSelectionChange([...selected, key]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 border-border bg-[hsl(0,0%,11%)] text-foreground p-0 w-[320px] max-w-[95vw] max-h-[85vh] flex flex-col"
        aria-describedby={undefined}
      >
        <div className="border-b border-border px-4 pt-4 pb-3 pr-12">
          <DialogTitle className="text-base font-semibold text-foreground">
            Indicators
          </DialogTitle>
        </div>

        <div className="flex items-center border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
          <Input
            type="search"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground text-sm"
            autoFocus
          />
        </div>

        <div className="px-3 pt-2 pb-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            Script name
          </div>
        </div>

        <ul className="flex-1 overflow-y-auto overscroll-contain min-h-0 py-1 list-none">
          {filtered.length === 0 ? (
            <li className="px-4 py-6 text-sm text-muted-foreground text-center">
              No indicators match &quot;{search}&quot;
            </li>
          ) : (
            filtered.map((preset) => {
              const isSelected = selected.includes(preset.key);
              return (
                <li key={preset.key}>
                  <button
                    type="button"
                    onClick={() => toggle(preset.key)}
                    className={cn(
                      "w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm text-foreground",
                      "hover:bg-white/5 focus:bg-white/5 focus:outline-none",
                      isSelected && "bg-primary/15 text-foreground"
                    )}
                  >
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <span className="w-4 shrink-0" />
                    )}
                    <span className="truncate">{preset.label}</span>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
