import { z } from "zod";
import { deleteXeroAccount } from "../../handlers/delete-xero-account.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { tenantIdSchema } from "../../helpers/tenant-id-schema.js";

const DeleteAccountTool = CreateXeroTool(
  "delete-account",
  "Delete an account from Xero's chart of accounts. Only accounts that are not system accounts and have no transactions can be deleted. If the account has transactions, archive it instead using update-account with status ARCHIVED.",
  {
    ...tenantIdSchema,
    accountID: z.string().describe("The unique Xero identifier for the account to delete."),
  },
  async ({ accountID, tenantId }) => {
    const response = await deleteXeroAccount(accountID, tenantId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error deleting account: ${response.error}`,
          },
        ],
      };
    }

    const account = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Account deleted successfully: ${account?.name} (${account?.code})`,
        },
      ],
    };
  },
);

export default DeleteAccountTool;
