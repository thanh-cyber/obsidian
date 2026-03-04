import { Eye, EyeOff, Settings, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { INDICATOR_PRESET_BY_KEY, type IndicatorKey } from "@/utils/indicatorPresets";

interface IndicatorStripProps {
  indicators: IndicatorKey[];
  visibility: Record<string, boolean>;
  onToggleVisibility: (key: IndicatorKey) => void;
  onOpenSettings: (key: IndicatorKey) => void;
  onRemove: (key: IndicatorKey) => void;
  className?: string;
}

export function IndicatorStrip({
  indicators,
  visibility,
  onToggleVisibility,
  onOpenSettings,
  onRemove,
  className,
}: IndicatorStripProps) {
  if (indicators.length === 0) return null;

  return (
    <div
      className={cn(
        "absolute left-2 top-2 z-10 flex flex-col gap-1 rounded-md border border-border bg-[hsl(0,0%,11%)]/95 px-2 py-1.5 shadow-lg backdrop-blur-sm",
        className
      )}
    >
      {indicators.map((key) => {
        const preset = INDICATOR_PRESET_BY_KEY[key];
        const label = preset?.label ?? key;
        const visible = visibility[key] !== false;

        return (
          <div
            key={key}
            className="flex items-center gap-1.5 rounded py-0.5 pr-0.5 text-xs text-foreground"
          >
            <button
              type="button"
              onClick={() => onToggleVisibility(key)}
              className={cn(
                "rounded p-1 transition-colors hover:bg-white/10",
                !visible && "opacity-50"
              )}
              title={visible ? "Hide" : "Show"}
              aria-label={visible ? "Hide indicator" : "Show indicator"}
            >
              {visible ? (
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </button>
            <span className={cn("min-w-0 flex-1 truncate", !visible && "text-muted-foreground")}>
              {label}
            </span>
            <button
              type="button"
              onClick={() => onOpenSettings(key)}
              className="rounded p-1 transition-colors hover:bg-white/10"
              title="Settings"
              aria-label="Indicator settings"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => onRemove(key)}
              className="rounded p-1 transition-colors hover:bg-destructive/20 hover:text-destructive"
              title="Remove"
              aria-label="Remove indicator"
            >
              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
