import { xeroClient } from "../clients/xero-client.js";
import { PurchaseOrder } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

type PurchaseOrderStatus = "DRAFT" | "SUBMITTED" | "AUTHORISED" | "BILLED" | "DELETED";

async function getPurchaseOrders(
  page: number,
  status?: PurchaseOrderStatus,
  tenantId?: string,
): Promise<PurchaseOrder[]> {
  await xeroClient.authenticate();
  const resolvedTenantId = xeroClient.resolveTenantId(tenantId);

  const response = await xeroClient.accountingApi.getPurchaseOrders(
    resolvedTenantId,
    undefined, // ifModifiedSince
    status,
    undefined, // dateFrom
    undefined, // dateTo
    "Date DESC", // order
    page,
    undefined, // pageSize
    getClientHeaders(),
  );

  return response.body.purchaseOrders ?? [];
}

/**
 * List purchase orders from Xero.
 */
export async function listXeroPurchaseOrders(
  page: number = 1,
  status?: PurchaseOrderStatus,
  tenantId?: string,
): Promise<XeroClientResponse<PurchaseOrder[]>> {
  try {
    const purchaseOrders = await getPurchaseOrders(page, status, tenantId);

    return {
      result: purchaseOrders,
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
