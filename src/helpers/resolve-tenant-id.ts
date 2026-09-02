export interface ConnectedTenant {
  tenantId: string;
  tenantName?: string;
  tenantType?: string;
}

/**
 * Resolve which tenant a call should target: the override when one is given
 * (validated against the connected tenants), otherwise the active tenant.
 * Safe for reads, where operating on "whichever tenant is currently active"
 * is the documented Xero norm.
 */
export function resolveTenantId(
  tenants: ConnectedTenant[],
  activeTenantId: string,
  overrideTenantId?: string,
): string {
  if (overrideTenantId) {
    const tenant = tenants.find((t) => t.tenantId === overrideTenantId);
    if (!tenant) {
      throw new Error(
        `Tenant ID "${overrideTenantId}" not found in connected tenants.`,
      );
    }
    return overrideTenantId;
  }
  return activeTenantId;
}

/**
 * Resolve which tenant a WRITE should target. Unlike resolveTenantId, this
 * refuses to fall back to "whichever tenant is active" once more than one
 * tenant is connected: a write with no explicit tenant is exactly how a
 * change lands on the wrong client's Xero organisation. With only one
 * tenant connected there is nothing to disambiguate, so it behaves like
 * resolveTenantId.
 */
export function resolveTenantIdForWrite(
  tenants: ConnectedTenant[],
  activeTenantId: string,
  overrideTenantId?: string,
): string {
  if (overrideTenantId) {
    return resolveTenantId(tenants, activeTenantId, overrideTenantId);
  }
  if (tenants.length > 1) {
    const available = tenants
      .map((t) => `${t.tenantName ?? "Unknown"} (${t.tenantId})`)
      .join(", ");
    throw new Error(
      `This write requires an explicit tenantId: multiple Xero organisations are connected (${available}). ` +
        `Pass tenantId explicitly, or call switch-tenant first if every subsequent write should target one organisation.`,
    );
  }
  return resolveTenantId(tenants, activeTenantId, overrideTenantId);
}
