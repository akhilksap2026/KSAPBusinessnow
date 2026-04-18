import { useState, useEffect, useCallback } from "react";
import { GlobalRail } from "./global-rail";
import { ContextSidebar } from "./context-sidebar";
import { TopBar } from "./top-bar";
import { CommandPalette } from "@/components/command-palette";
import { ContextSelector } from "@/components/auth/ContextSelector";
import { useAuthRole } from "@/lib/auth";
import { useActiveContext } from "@/lib/context";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const { user } = useAuthRole();
  const { context } = useActiveContext();

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

  useEffect(() => {
    if (!user) return;
    const shownKey = `otmnow_context_shown_${user.id}`;
    if (sessionStorage.getItem(shownKey)) return;
    if (new URLSearchParams(window.location.search).get("skipContext") === "1") {
      sessionStorage.setItem(shownKey, "1");
      return;
    }
    const email = encodeURIComponent(`${user.id}@businessnow.com`);
    fetch(`/api/me/context?email=${email}`)
      .then(r => r.ok ? r.json() : null)
      .then((data) => {
        if (data && data.directReports && data.directReports.length > 0) {
          setContextOpen(true);
        }
        sessionStorage.setItem(shownKey, "1");
      })
      .catch(() => { });
  }, [user]);

  return (
    <div className="min-h-[100dvh] flex bg-muted/30">
      <GlobalRail />
      <ContextSidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar
          onSearchOpen={() => setCommandOpen(true)}
          onContextOpen={() => setContextOpen(true)}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      {user && (
        <ContextSelector
          open={contextOpen}
          onClose={() => setContextOpen(false)}
          demoUser={user}
        />
      )}
    </div>
  );
}
