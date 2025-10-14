import { Button } from "@/components/ui/button";
import { BarChart3, Settings as SettingsIcon, LayoutDashboard, FileText } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

export const Navigation = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    { path: "/analytics", icon: BarChart3, label: "Analytics" },
    { path: "/reports", icon: FileText, label: "Reports" },
    { path: "/settings", icon: SettingsIcon, label: "Settings" },
  ];

  return (
    <nav className="fixed left-0 top-0 h-screen w-16 bg-card/95 backdrop-blur-md border-r border-border z-50 flex flex-col items-center py-6 gap-4">
      <div className="mb-4">
        <div className="h-10 w-10 bg-gradient-to-br from-primary to-purple-500 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">TJ</span>
        </div>
      </div>
      
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location.pathname === item.path;
        return (
          <Button
            key={item.path}
            variant={isActive ? "default" : "ghost"}
            size="icon"
            onClick={() => navigate(item.path)}
            className={`w-10 h-10 transition-all ${
              isActive 
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                : "hover:bg-secondary text-muted-foreground hover:text-foreground"
            }`}
            title={item.label}
          >
            <Icon className="h-5 w-5" />
          </Button>
        );
      })}
    </nav>
  );
};
