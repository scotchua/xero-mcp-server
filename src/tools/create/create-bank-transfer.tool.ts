import { z } from "zod";
import { createXeroBankTransfer } from "../../handlers/create-xero-bank-transfer.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { tenantIdSchema } from "../../helpers/tenant-id-schema.js";

const CreateBankTransferTool = CreateXeroTool(
  "create-bank-transfer",
  "Create a transfer of funds between two Xero bank accounts.",
  {
    ...tenantIdSchema,
    fromBankAccountId: z.string().describe("The Xero account ID of the bank account to transfer from."),
    toBankAccountId: z.string().describe("The Xero account ID of the bank account to transfer to."),
    amount: z.number().describe("The amount to transfer."),
    date: z.string().optional().describe("The transfer date, YYYY-MM-DD. Defaults to today in Xero."),
    reference: z.string().optional().describe("An optional reference for the transfer."),
    fromIsReconciled: z.boolean().optional().describe("Whether the from-account side is already reconciled."),
    toIsReconciled: z.boolean().optional().describe("Whether the to-account side is already reconciled."),
  },
  async ({
    fromBankAccountId,
    toBankAccountId,
    amount,
    date,
    reference,
    fromIsReconciled,
    toIsReconciled,
    tenantId,
  }) => {
    const response = await createXeroBankTransfer(
      fromBankAccountId,
      toBankAccountId,
      amount,
      date,
      reference,
      fromIsReconciled,
      toIsReconciled,
      tenantId,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating bank transfer: ${response.error}`,
          },
        ],
      };
    }

    const transfer = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            "Bank transfer created successfully.",
            `ID: ${transfer?.bankTransferID}`,
            `Amount: ${transfer?.amount}`,
            `Date: ${transfer?.date}`,
          ].join("\n"),
        },
      ],
    };
  },
);

export default CreateBankTransferTool;
