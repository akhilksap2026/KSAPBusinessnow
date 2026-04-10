import { useState, useEffect, useCallback } from "react";
import { GlobalRail } from "./global-rail";
import { ContextSidebar } from "./context-sidebar";
import { TopBar } from "./top-bar";
import { CommandPalette } from "@/components/command-palette";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [commandOpen, setCommandOpen] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setCommandOpen(prev => !prev);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="min-h-[100dvh] flex bg-muted/30">
      <GlobalRail />
      <ContextSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onSearchOpen={() => setCommandOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}
