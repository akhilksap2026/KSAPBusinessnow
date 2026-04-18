import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ── Sentry (P5-T6) — only initialised when VITE_SENTRY_DSN is set ────────────
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN as string,
    environment: import.meta.env.MODE,
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 1.0,
    integrations: [Sentry.browserTracingIntegration()],
  });
}

// ── Global fetch interceptor — injects X-User-Role on all /api requests ───────
const _origFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  try {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
    if (url.includes("/api")) {
      const role = localStorage.getItem("otmnow_role") ?? "consultant";
      const headers = new Headers(init?.headers ?? {});
      if (!headers.has("X-User-Role")) headers.set("X-User-Role", role);
      return _origFetch(input, { ...init, headers });
    }
  } catch { /* ignore */ }
  return _origFetch(input, init);
};

// ── Dev-only auto-login — ?autoLogin=<role> sets localStorage and redirects ───
if (import.meta.env.DEV) {
  const _params = new URLSearchParams(window.location.search);
  const _autoLogin = _params.get("autoLogin");
  if (_autoLogin) {
    const _USER_MAP: Record<string, [string, string]> = {
      admin:              ["rachel.nguyen",   "admin"],
      executive:          ["james.whitfield", "executive"],
      delivery_director:  ["jana.kovac",      "delivery_director"],
      project_manager:    ["alex.okafor",     "project_manager"],
      consultant:         ["derek.tran",      "consultant"],
      resource_manager:   ["maria.santos",    "resource_manager"],
      finance_lead:       ["sandra.liu",      "finance_lead"],
      sales:              ["diana.flores",    "sales"],
      account_manager:    ["yuki.tanaka",     "account_manager"],
      client_stakeholder: ["robert.chen",     "client_stakeholder"],
    };
    const _entry = _USER_MAP[_autoLogin];
    if (_entry) {
      localStorage.setItem("otmnow_user_id", _entry[0]);
      localStorage.setItem("otmnow_role",    _entry[1]);
      // Suppress the "Select your view" context modal for this session
      sessionStorage.setItem(`otmnow_context_shown_${_entry[0]}`, "1");
      // Reload so auth module re-initialises _role from fresh localStorage
      _params.delete("autoLogin");
      const _qs = _params.toString();
      window.location.replace(window.location.pathname + (_qs ? "?" + _qs : ""));
    } else {
      _params.delete("autoLogin");
      const _qs = _params.toString();
      history.replaceState({}, "", window.location.pathname + (_qs ? "?" + _qs : ""));
    }
  }
}

createRoot(document.getElementById("root")!).render(<App />);
