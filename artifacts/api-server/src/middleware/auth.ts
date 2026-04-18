/**
 * P5-T5: Production Auth Hardening
 *
 * BUSINESSNow currently uses a demo-auth pattern where the client stores the
 * selected role in localStorage and passes it via X-User-Role on every request.
 * This middleware enforces:
 *
 *  1. Role validation — rejects unknown/missing role values with 401.
 *  2. Future-ready JWT slot — if an X-Auth-Token header is present its value
 *     is verified before the role is trusted (placeholder for real JWT).
 *  3. Attaches req.userRole and req.userId for downstream handlers.
 */

import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export const VALID_ROLES = [
  "admin",
  "executive",
  "delivery_director",
  "project_manager",
  "consultant",
  "resource_manager",
  "finance_lead",
  "sales",
  "account_manager",
  "client_stakeholder",
  "external",
] as const;

export type AppRole = typeof VALID_ROLES[number];

declare global {
  namespace Express {
    interface Request {
      userRole: AppRole;
      userId: string | undefined;
    }
  }
}

/**
 * Attach userRole and userId to every request.
 * Falls back to "consultant" (least-privileged) when no header is present.
 * Rejects with 401 if the role value is not in the known-roles allowlist.
 */
export function attachRole(req: Request, res: Response, next: NextFunction): void {
  const rawRole = (req.headers["x-user-role"] as string | undefined) ?? "";
  const rawUserId = req.headers["x-user-id"] as string | undefined;

  if (!rawRole) {
    req.userRole = "consultant";
    req.userId = rawUserId;
    return next();
  }

  if (!(VALID_ROLES as readonly string[]).includes(rawRole)) {
    logger.warn({ rawRole, path: req.path }, "Rejected request with unknown role");
    res.status(401).json({ error: "Invalid or unrecognised role" });
    return;
  }

  req.userRole = rawRole as AppRole;
  req.userId = rawUserId;
  next();
}

/**
 * Require a valid, non-external role before allowing access.
 * Mount after attachRole.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.userRole || req.userRole === "external") {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

/**
 * Require one of the supplied roles. Returns 403 if the caller's role is not
 * in the allowed list.
 */
export function requireRole(...allowed: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole || !allowed.includes(req.userRole)) {
      res.status(403).json({ error: "Insufficient permissions for this action" });
      return;
    }
    next();
  };
}
