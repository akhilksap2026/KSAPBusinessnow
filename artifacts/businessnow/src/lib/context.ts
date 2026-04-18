import { useState, useEffect } from "react";

const CONTEXT_KEY = "otmnow_context_user_id";
const CONTEXT_NAME_KEY = "otmnow_context_user_name";
const CONTEXT_ROLE_KEY = "otmnow_context_user_role";
const CONTEXT_RESOURCE_KEY = "otmnow_context_resource_id";

export interface ActiveContext {
  userId: number;
  name: string;
  role: string;
  resourceId: number | null;
}

function readContext(): ActiveContext | null {
  try {
    const id = localStorage.getItem(CONTEXT_KEY);
    if (!id) return null;
    return {
      userId: parseInt(id, 10),
      name: localStorage.getItem(CONTEXT_NAME_KEY) ?? "",
      role: localStorage.getItem(CONTEXT_ROLE_KEY) ?? "",
      resourceId: localStorage.getItem(CONTEXT_RESOURCE_KEY)
        ? parseInt(localStorage.getItem(CONTEXT_RESOURCE_KEY)!, 10)
        : null,
    };
  } catch {
    return null;
  }
}

let _context: ActiveContext | null = readContext();
const _listeners = new Set<() => void>();

function notifyAll() {
  _listeners.forEach(fn => fn());
}

export function setActiveContext(ctx: ActiveContext | null) {
  _context = ctx;
  try {
    if (ctx) {
      localStorage.setItem(CONTEXT_KEY, String(ctx.userId));
      localStorage.setItem(CONTEXT_NAME_KEY, ctx.name);
      localStorage.setItem(CONTEXT_ROLE_KEY, ctx.role);
      if (ctx.resourceId != null) {
        localStorage.setItem(CONTEXT_RESOURCE_KEY, String(ctx.resourceId));
      } else {
        localStorage.removeItem(CONTEXT_RESOURCE_KEY);
      }
    } else {
      localStorage.removeItem(CONTEXT_KEY);
      localStorage.removeItem(CONTEXT_NAME_KEY);
      localStorage.removeItem(CONTEXT_ROLE_KEY);
      localStorage.removeItem(CONTEXT_RESOURCE_KEY);
    }
  } catch { }
  notifyAll();
}

export function getActiveContext(): ActiveContext | null {
  return _context;
}

export function useActiveContext() {
  const [ctx, setCtx] = useState<ActiveContext | null>(() => _context);

  useEffect(() => {
    const sync = () => setCtx(_context);
    _listeners.add(sync);
    sync();
    return () => { _listeners.delete(sync); };
  }, []);

  return { context: ctx, setContext: setActiveContext };
}
