import { z } from "zod";
import { updateXeroPurchaseOrder } from "../../handlers/update-xero-purchase-order.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { tenantIdSchema } from "../../helpers/tenant-id-schema.js";
import { PurchaseOrder } from "xero-node";

const lineItemSchema = z.object({
  description: z.string().describe("The description of the line item"),
  quantity: z.number().describe("The quantity of the line item"),
  unitAmount: z.number().describe("The price per unit of the line item"),
  accountCode: z.string().describe("The account code of the line item - can be obtained from the list-accounts tool"),
  taxType: z.string().describe("The tax type of the line item - can be obtained from the list-tax-rates tool"),
  itemCode: z
    .string()
    .optional()
    .describe("The item code of the line item - can be obtained from the list-items tool"),
});

const UpdatePurchaseOrderTool = CreateXeroTool(
  "update-purchase-order",
  "Update an existing purchase order in Xero. If lineItems is provided, all line items must be included, any not provided will be removed. Set status to AUTHORISED to approve a draft, or DELETED to remove one.",
  {
    ...tenantIdSchema,
    purchaseOrderId: z.string().describe("The unique Xero identifier for the purchase order to update."),
    lineItems: z
      .array(lineItemSchema)
      .optional()
      .describe("All line items must be provided. Any line items not provided will be removed."),
    reference: z.string().optional().describe("An additional reference number for the purchase order."),
    date: z.string().optional().describe("The date the purchase order was issued, YYYY-MM-DD."),
    deliveryDate: z.string().optional().describe("The date the goods are to be delivered, YYYY-MM-DD."),
    status: z
      .enum(["DRAFT", "SUBMITTED", "AUTHORISED", "BILLED", "DELETED"])
      .optional()
      .describe("The new status of the purchase order."),
  },
  async ({ purchaseOrderId, lineItems, reference, date, deliveryDate, status, tenantId }) => {
    const result = await updateXeroPurchaseOrder(
      purchaseOrderId,
      {
        lineItems,
        reference,
        date,
        deliveryDate,
        status: status as PurchaseOrder.StatusEnum | undefined,
      },
      tenantId,
    );

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating purchase order: ${result.error}`,
          },
        ],
      };
    }

    const purchaseOrder = result.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Purchase order updated successfully:",
            `ID: ${purchaseOrder?.purchaseOrderID}`,
            `Number: ${purchaseOrder?.purchaseOrderNumber}`,
            `Total: ${purchaseOrder?.total}`,
            `Status: ${purchaseOrder?.status}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default UpdatePurchaseOrderTool;
