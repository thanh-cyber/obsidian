import { createContext, useContext, useState, type ReactNode } from "react";

interface ReportsSidebarContextValue {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

const ReportsSidebarContext = createContext<ReportsSidebarContextValue | null>(null);

export function ReportsSidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  return (
    <ReportsSidebarContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </ReportsSidebarContext.Provider>
  );
}

export function useReportsSidebar() {
  return useContext(ReportsSidebarContext);
}
