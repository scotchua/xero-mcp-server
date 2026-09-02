import { z } from "zod";
import { createXeroPurchaseOrder } from "../../handlers/create-xero-purchase-order.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { tenantIdSchema } from "../../helpers/tenant-id-schema.js";

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

const CreatePurchaseOrderTool = CreateXeroTool(
  "create-purchase-order",
  "Create a draft purchase order in Xero, addressed to a supplier contact.",
  {
    ...tenantIdSchema,
    contactId: z.string().describe("The ID of the supplier contact. Can be obtained from the list-contacts tool."),
    lineItems: z.array(lineItemSchema),
    date: z.string().optional().describe("The date the purchase order was issued, YYYY-MM-DD. Defaults to today in Xero."),
    deliveryDate: z.string().optional().describe("The date the goods are to be delivered, YYYY-MM-DD."),
    reference: z.string().optional().describe("An additional reference number for the purchase order."),
  },
  async ({ contactId, lineItems, date, deliveryDate, reference, tenantId }) => {
    const result = await createXeroPurchaseOrder(contactId, lineItems, date, deliveryDate, reference, tenantId);

    if (result.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating purchase order: ${result.error}`,
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
            "Purchase order created successfully:",
            `ID: ${purchaseOrder?.purchaseOrderID}`,
            `Number: ${purchaseOrder?.purchaseOrderNumber}`,
            `Contact: ${purchaseOrder?.contact?.name}`,
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

export default CreatePurchaseOrderTool;
