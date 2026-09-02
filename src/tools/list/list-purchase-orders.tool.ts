import { z } from "zod";
import { listXeroPurchaseOrders } from "../../handlers/list-xero-purchase-orders.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { tenantIdSchema } from "../../helpers/tenant-id-schema.js";

const ListPurchaseOrdersTool = CreateXeroTool(
  "list-purchase-orders",
  "Retrieve a list of purchase orders from Xero, most recent first.",
  {
    ...tenantIdSchema,
    page: z.number().optional().describe("The page number to retrieve, for paging through results. Defaults to 1."),
    status: z
      .enum(["DRAFT", "SUBMITTED", "AUTHORISED", "BILLED", "DELETED"])
      .optional()
      .describe("Filter to purchase orders with this status."),
  },
  async ({ page, status, tenantId }) => {
    const response = await listXeroPurchaseOrders(page, status, tenantId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing purchase orders: ${response.error}`,
          },
        ],
      };
    }

    const purchaseOrders = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${purchaseOrders?.length || 0} purchase order(s):`,
        },
        ...(purchaseOrders?.map((po) => ({
          type: "text" as const,
          text: [
            `ID: ${po.purchaseOrderID}`,
            `Number: ${po.purchaseOrderNumber}`,
            `Contact: ${po.contact?.name}`,
            `Date: ${po.date}`,
            `Total: ${po.total}`,
            `Status: ${po.status}`,
          ].join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListPurchaseOrdersTool;
