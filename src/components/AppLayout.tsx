import { Outlet, useLocation } from "react-router-dom";
import { Navigation } from "@/components/Navigation";
import { FilterBar } from "@/components/FilterBar";
import { ReportsSidebarProvider } from "@/context/ReportsSidebarContext";

function AppLayoutInner() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <Navigation />
      <div className="flex-1 flex flex-col min-h-0 pl-16">
        <FilterBar />
        <main className="flex-1 min-h-0 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function AppLayout() {
  return (
    <ReportsSidebarProvider>
      <AppLayoutInner />
    </ReportsSidebarProvider>
  );
}
