import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { LineItem, PurchaseOrder } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface PurchaseOrderUpdateFields {
  lineItems?: LineItem[];
  reference?: string;
  date?: string;
  deliveryDate?: string;
  status?: PurchaseOrder.StatusEnum;
}

async function updatePurchaseOrder(
  purchaseOrderId: string,
  fields: PurchaseOrderUpdateFields,
  tenantId?: string,
): Promise<PurchaseOrder | undefined> {
  await xeroClient.authenticate();
  const resolvedTenantId = xeroClient.resolveTenantIdForWrite(tenantId);

  const purchaseOrder: PurchaseOrder = {
    lineItems: fields.lineItems,
    reference: fields.reference,
    date: fields.date,
    deliveryDate: fields.deliveryDate,
    status: fields.status,
  };

  const response = await xeroClient.accountingApi.updatePurchaseOrder(
    resolvedTenantId,
    purchaseOrderId,
    { purchaseOrders: [purchaseOrder] },
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  return response.body.purchaseOrders?.[0];
}

/**
 * Update an existing purchase order in Xero. Only draft or submitted purchase
 * orders can have their line items changed; set status to AUTHORISED to
 * approve one, or DELETED to remove a draft.
 */
export async function updateXeroPurchaseOrder(
  purchaseOrderId: string,
  fields: PurchaseOrderUpdateFields,
  tenantId?: string,
): Promise<XeroClientResponse<PurchaseOrder>> {
  try {
    const purchaseOrder = await updatePurchaseOrder(purchaseOrderId, fields, tenantId);

    if (!purchaseOrder) {
      throw new Error("Purchase order update failed.");
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
