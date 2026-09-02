import { z } from "zod";

/**
 * Shared `tenantId` input field for tools that support a multi-tenant
 * override. Spread this into a tool's own schema explicitly rather than
 * injecting it globally: a tool whose handler doesn't read tenantId would
 * otherwise silently accept and ignore it, which is worse than not
 * exposing it at all — a caller asking for one client's org and silently
 * getting whichever tenant is active is the exact failure mode multi-tenant
 * support exists to prevent.
 */
export const tenantIdSchema = {
  tenantId: z
    .string()
    .optional()
    .describe(
      "Optional tenant/organisation ID override. If omitted, uses the active tenant. Use list-tenants to see available options.",
    ),
};
