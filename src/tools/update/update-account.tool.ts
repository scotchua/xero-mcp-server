import { z } from "zod";
import { updateXeroAccount } from "../../handlers/update-xero-account.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { tenantIdSchema } from "../../helpers/tenant-id-schema.js";
import { Account } from "xero-node";

const UpdateAccountTool = CreateXeroTool(
  "update-account",
  "Update an existing account in Xero's chart of accounts. Provide the account ID and any fields to change. You can archive an account by setting status to ARCHIVED.",
  {
    ...tenantIdSchema,
    accountID: z.string().describe("The unique Xero identifier for the account to update."),
    name: z.string().optional().describe("New account name (max 150 characters)"),
    code: z.string().optional().describe("New account code (max 10 characters)"),
    description: z.string().optional().describe("New account description (max 4000 characters)"),
    taxType: z
      .string()
      .optional()
      .describe("New tax type. Use list-tax-rates to see available options."),
    status: z
      .enum(["ACTIVE", "ARCHIVED"])
      .optional()
      .describe("Account status. Set to ARCHIVED to archive the account."),
    enablePaymentsToAccount: z
      .boolean()
      .optional()
      .describe("Whether payments can be applied to this account"),
    showInExpenseClaims: z
      .boolean()
      .optional()
      .describe("Whether this account is available for expense claims"),
  },
  async ({
    accountID,
    name,
    code,
    description,
    taxType,
    status,
    enablePaymentsToAccount,
    showInExpenseClaims,
    tenantId,
  }) => {
    const response = await updateXeroAccount(
      accountID,
      {
        name,
        code,
        description,
        taxType,
        status: status as Account.StatusEnum | undefined,
        enablePaymentsToAccount,
        showInExpenseClaims,
      },
      tenantId,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error updating account: ${response.error}`,
          },
        ],
      };
    }

    const account = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: [
            `Account updated successfully.`,
            `Name: ${account?.name}`,
            `Code: ${account?.code}`,
            `ID: ${account?.accountID}`,
            `Type: ${account?.type}`,
            `Status: ${account?.status}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  },
);

export default UpdateAccountTool;
