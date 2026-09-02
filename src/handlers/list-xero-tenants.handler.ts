import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

export interface TenantInfo {
  tenantId: string;
  tenantName: string;
  tenantType: string;
  isActive: boolean;
}

async function getTenants(): Promise<TenantInfo[]> {
  await xeroClient.authenticate();

  return xeroClient.getTenants().map((t) => ({
    tenantId: t.tenantId ?? "",
    tenantName: t.tenantName ?? "",
    tenantType: t.tenantType ?? "",
    isActive: t.tenantId === xeroClient.tenantId,
  }));
}

/**
 * List all connected Xero tenants/organisations.
 */
export async function listXeroTenants(): Promise<
  XeroClientResponse<TenantInfo[]>
> {
  try {
    const tenants = await getTenants();

    return {
      result: tenants,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
