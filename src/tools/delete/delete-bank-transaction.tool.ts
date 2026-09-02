import { z } from "zod";
import { deleteXeroBankTransaction } from "../../handlers/delete-xero-bank-transaction.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { tenantIdSchema } from "../../helpers/tenant-id-schema.js";

const DeleteBankTransactionTool = CreateXeroTool(
  "delete-bank-transaction",
  "Delete (set Status=DELETED) a spend money or receive money bank transaction in Xero. Does not apply to bank transactions created from bank feed reconciliation.",
  {
    ...tenantIdSchema,
    bankTransactionId: z.string().describe("The unique Xero identifier for the bank transaction to delete."),
  },
  async ({ bankTransactionId, tenantId }) => {
    const response = await deleteXeroBankTransaction(bankTransactionId, tenantId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error deleting bank transaction: ${response.error}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: `Bank transaction deleted successfully: ${response.result?.bankTransactionID}`,
        },
      ],
    };
  },
);

export default DeleteBankTransactionTool;
