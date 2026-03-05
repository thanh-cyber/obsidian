import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FilterProvider } from "@/context/FilterContext";
import { AppLayout } from "@/components/AppLayout";
import { Dashboard } from "./pages/Dashboard";
import { Reports } from "./pages/Reports";
import { Trades } from "./pages/Trades";
import { Journal } from "./pages/Journal";
// import { Replay } from "./pages/Replay"; // Commented out for now; re-enable when needed
import { Settings } from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <FilterProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/analytics" element={<Navigate to="/reports?item=Analytics" replace />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/trades" element={<Trades />} />
              <Route path="/journal" element={<Journal />} />
              {/* <Route path="/replay" element={<Replay />} /> Replay commented out for now */}
              <Route path="/settings" element={<Settings />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </FilterProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
