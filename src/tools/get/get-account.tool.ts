import { z } from "zod";
import { getXeroAccount } from "../../handlers/get-xero-account.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { tenantIdSchema } from "../../helpers/tenant-id-schema.js";

const GetAccountTool = CreateXeroTool(
  "get-account",
  "Retrieve a single account from Xero's chart of accounts by its ID. Returns full account details including code, name, type, status, description, and tax type.",
  {
    ...tenantIdSchema,
    accountID: z.string().describe("The unique Xero identifier for the account."),
  },
  async ({ accountID, tenantId }) => {
    const response = await getXeroAccount(accountID, tenantId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving account: ${response.error}`,
          },
        ],
      };
    }

    const account = response.result;

    if (!account) {
      return {
        content: [
          {
            type: "text" as const,
            text: `No account found with ID: ${accountID}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Account: ${account.name || "Unnamed"}`,
            `Code: ${account.code || "No code"}`,
            `ID: ${account.accountID}`,
            `Type: ${account.type || "Unknown"}`,
            `Class: ${account._class || "Unknown"}`,
            `Status: ${account.status || "Unknown"}`,
            account.description ? `Description: ${account.description}` : null,
            account.taxType ? `Tax Type: ${account.taxType}` : null,
            account.bankAccountNumber ? `Bank Account: ${account.bankAccountNumber}` : null,
            account.currencyCode ? `Currency: ${account.currencyCode}` : null,
            account.reportingCode ? `Reporting Code: ${account.reportingCode}` : null,
            `Payments Enabled: ${account.enablePaymentsToAccount ? "Yes" : "No"}`,
            `Show in Expense Claims: ${account.showInExpenseClaims ? "Yes" : "No"}`,
            account.systemAccount ? `System Account: ${account.systemAccount}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default GetAccountTool;
