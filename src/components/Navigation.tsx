import { Button } from "@/components/ui/button";
import { BarChart3, Settings as SettingsIcon, LayoutDashboard } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/analytics", icon: BarChart3, label: "Analytics" },
    { path: "/settings", icon: SettingsIcon, label: "Settings" },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:top-6 md:right-6 md:left-auto md:translate-x-0">
      <div className="bg-card/80 backdrop-blur-md border border-border/50 rounded-full p-2 shadow-lg flex gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Button
              key={item.path}
              variant={isActive ? "default" : "ghost"}
              size="icon"
              onClick={() => navigate(item.path)}
              className={`rounded-full transition-all ${
                isActive 
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                  : "hover:bg-secondary"
              }`}
              title={item.label}
            >
              <Icon className="h-5 w-5" />
            </Button>
          );
        })}
      </div>
    </nav>
  );
};
