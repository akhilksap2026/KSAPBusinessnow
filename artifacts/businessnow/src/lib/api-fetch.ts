/**
 * Thin fetch wrapper that automatically injects the X-User-Role header
 * from the current user's role stored in localStorage, satisfying the
 * field-level security middleware on the API server.
 */

function getUserRole(): string {
  try { return localStorage.getItem("otmnow_role") ?? "consultant"; } catch { return "consultant"; }
}

export function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const role = getUserRole();
  return fetch(url, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      "X-User-Role": role,
    },
  });
}
