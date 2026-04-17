import { useState, useEffect } from "react";

const KEY = "sidebarCollapsed";

let _collapsed: boolean = (() => {
  try { return localStorage.getItem(KEY) === "true"; } catch { return false; }
})();

const _listeners = new Set<() => void>();

function notify() { _listeners.forEach(fn => fn()); }

export function getSidebarCollapsed() { return _collapsed; }

export function setSidebarCollapsed(v: boolean) {
  _collapsed = v;
  try { localStorage.setItem(KEY, String(v)); } catch { }
  notify();
}

export function toggleSidebar() { setSidebarCollapsed(!_collapsed); }

export function useSidebarCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(_collapsed);

  useEffect(() => {
    const sync = () => setCollapsed(_collapsed);
    _listeners.add(sync);
    sync();
    return () => { _listeners.delete(sync); };
  }, []);

  return [collapsed, toggleSidebar];
}
