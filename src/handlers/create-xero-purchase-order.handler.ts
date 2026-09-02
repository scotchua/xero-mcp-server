import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { LineItem, PurchaseOrder } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function createPurchaseOrder(
  contactId: string,
  lineItems: LineItem[],
  date?: string,
  deliveryDate?: string,
  reference?: string,
  tenantId?: string,
): Promise<PurchaseOrder | undefined> {
  await xeroClient.authenticate();
  const resolvedTenantId = xeroClient.resolveTenantIdForWrite(tenantId);

  const purchaseOrder: PurchaseOrder = {
    contact: { contactID: contactId },
    lineItems,
    date,
    deliveryDate,
    reference,
  };

  const response = await xeroClient.accountingApi.createPurchaseOrders(
    resolvedTenantId,
    { purchaseOrders: [purchaseOrder] },
    true, // summarizeErrors
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  return response.body.purchaseOrders?.[0];
}

/**
 * Create a new purchase order in Xero.
 */
export async function createXeroPurchaseOrder(
  contactId: string,
  lineItems: LineItem[],
  date?: string,
  deliveryDate?: string,
  reference?: string,
  tenantId?: string,
): Promise<XeroClientResponse<PurchaseOrder>> {
  try {
    const purchaseOrder = await createPurchaseOrder(
      contactId,
      lineItems,
      date,
      deliveryDate,
      reference,
      tenantId,
    );

    if (!purchaseOrder) {
      throw new Error("Purchase order creation failed.");
    }

    return {
      result: purchaseOrder,
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
