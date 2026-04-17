/**
 * Field-level security middleware for BUSINESSNow API.
 * Strips sensitive fields from API responses based on the caller's role.
 */

export type AppRole =
  | "admin" | "executive" | "delivery_director" | "project_manager"
  | "consultant" | "resource_manager" | "finance_lead" | "sales"
  | "account_manager" | "client_stakeholder" | "external";

// ─── Allowed-role maps per sensitive field group ──────────────────────────────

const ALLOWED: Record<string, AppRole[]> = {
  costRate_resources:      ["delivery_director", "finance_lead", "admin"],
  buyRate_rate_cards:      ["delivery_director", "finance_lead", "admin"],
  prospect_confidential:   ["account_manager", "delivery_director", "admin"],
  sellRate_timesheets:     ["delivery_director", "project_manager", "finance_lead", "admin"],
  costRate_timesheets:     ["delivery_director", "finance_lead", "admin"],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively strip fields from an object or array of objects. */
export function stripFields<T>(data: T, fields: string[]): T {
  if (!data || !fields.length) return data;
  if (Array.isArray(data)) {
    return data.map(item => stripFields(item, fields)) as unknown as T;
  }
  if (typeof data === "object") {
    const obj = { ...(data as object) } as Record<string, unknown>;
    for (const f of fields) delete obj[f];
    return obj as unknown as T;
  }
  return data;
}

/** Read the role from the X-User-Role request header (falls back to "consultant"). */
export function getRoleFromHeader(req: { headers: Record<string, string | string[] | undefined> }): AppRole {
  const raw = req.headers["x-user-role"];
  const role = (Array.isArray(raw) ? raw[0] : raw) ?? "consultant";
  return role as AppRole;
}

/** Returns true if the given role is in the allowed list. */
export function isAllowed(role: AppRole, key: keyof typeof ALLOWED): boolean {
  return ALLOWED[key]?.includes(role) ?? false;
}

// ─── Per-entity strip helpers ─────────────────────────────────────────────────

/** Strip costRate from resource records if caller is not authorized. */
export function stripResourceFields<T>(data: T, role: AppRole): T {
  if (isAllowed(role, "costRate_resources")) return data;
  return stripFields(data, ["costRate", "cost_rate"]);
}

/** Strip buyRate from rate-card records if caller is not authorized. */
export function stripRateCardFields<T>(data: T, role: AppRole): T {
  if (isAllowed(role, "buyRate_rate_cards")) return data;
  return stripFields(data, ["buyRate", "buy_rate", "costRate", "cost_rate"]);
}

/** Strip confidential prospect fields if caller is not authorized. */
export function stripProspectFields<T>(data: T, role: AppRole): T {
  if (isAllowed(role, "prospect_confidential")) return data;
  return stripFields(data, [
    "primaryContactName", "primary_contact_name",
    "primaryContactEmail", "primary_contact_email",
    "linkedinUrl", "linkedin_url",
    "sentiment",
    "touchPoints", "touch_points",
  ]);
}

/** Strip sellRate/costRate from timesheet records if caller is not authorized. */
export function stripTimesheetFields<T>(data: T, role: AppRole): T {
  const fields: string[] = [];
  if (!isAllowed(role, "sellRate_timesheets")) fields.push("sellRate", "sell_rate");
  if (!isAllowed(role, "costRate_timesheets")) fields.push("costRate", "cost_rate");
  if (!fields.length) return data;
  return stripFields(data, fields);
}
