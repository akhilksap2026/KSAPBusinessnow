import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

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

createRoot(document.getElementById("root")!).render(<App />);
