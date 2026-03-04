import { useState } from "react";
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeft, TrendingUp, Calendar, Camera, BarChart2, Activity, GitCompare, Clock, DollarSign, Package, Tag, Target, LineChart, PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface SidebarSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
}

const sidebarSections: SidebarSection[] = [
  {
    title: "PERFORMANCE",
    icon: TrendingUp,
    items: ["Overview", "Analytics"],
  },
  {
    title: "TRADE",
    icon: Activity,
    items: ["Hourly", "Weekday", "Month", "Year", "Entry Price", "Cost", "Volume", "Side", "Hold Time"],
  },
  {
    title: "EXIT STATS",
    icon: Target,
    items: ["RFE/MAE", "Rolling Exit"],
  },
  {
    title: "MARKET",
    icon: LineChart,
    items: ["Opening Gap $", "Opening Gap %", "Index Return"],
  },
  {
    title: "OPTIONS",
    icon: PieChart,
    items: ["Spreads", "Call / Put"],
  },
  {
    title: "TICKER",
    icon: BarChart2,
    items: ["Sectors", "Symbols"],
  },
];

interface ReportsSidebarProps {
  activeSection: string;
  activeItem: string;
  onItemClick: (section: string, item: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export const ReportsSidebar = ({ activeSection, activeItem, onItemClick, collapsed = false, onCollapsedChange }: ReportsSidebarProps) => {
  const [expandedSections, setExpandedSections] = useState<string[]>(["PERFORMANCE"]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev =>
      prev.includes(section)
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  return (
    <>
      {collapsed && (
        <Button
          variant="outline"
          size="icon"
          className="fixed left-20 top-6 h-9 w-9 z-50 bg-card border-border shadow-md hover:bg-secondary"
          onClick={() => onCollapsedChange?.(false)}
          title="Open reports menu"
        >
          <PanelLeft className="h-4 w-4" />
        </Button>
      )}
      {!collapsed && (
        <>
        <div
          className="fixed inset-0 bg-black/50 z-40"
          aria-hidden
          onClick={() => onCollapsedChange?.(true)}
        />
        <div className="w-64 bg-card border-r border-border h-screen fixed left-16 top-0 z-50 shadow-xl">
      <ScrollArea className="h-full">
        <div className="p-4 space-y-1">
          {sidebarSections.map((section) => {
            const Icon = section.icon;
            const isExpanded = expandedSections.includes(section.title);
            
            return (
              <div key={section.title} className="space-y-1">
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-between px-3 py-2 h-auto font-medium text-xs",
                    "hover:bg-secondary/80 text-muted-foreground"
                  )}
                  onClick={() => toggleSection(section.title)}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5" />
                    <span>{section.title}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </Button>

                {isExpanded && (
                  <div className="pl-6 space-y-0.5 pb-2">
                    {section.items.map((item) => (
                      <Button
                        key={item}
                        variant="ghost"
                        className={cn(
                          "w-full justify-start px-3 py-1.5 h-auto text-xs font-normal",
                          activeSection === section.title && activeItem === item
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                        )}
                        onClick={() => onItemClick(section.title, item)}
                      >
                        {item}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </ScrollArea>
        <Button
          variant="ghost"
          size="icon"
          className="absolute -right-3 top-6 h-6 w-6 rounded-full border border-border bg-card shadow hover:bg-secondary z-10"
          onClick={() => onCollapsedChange?.(true)}
          title="Close sidebar"
        >
          <PanelLeftClose className="h-3 w-3" />
        </Button>
      </div>
        </>
      )}
    </>
  );
};
