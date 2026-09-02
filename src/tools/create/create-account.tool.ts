import { z } from "zod";
import { createXeroAccount } from "../../handlers/create-xero-account.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { tenantIdSchema } from "../../helpers/tenant-id-schema.js";
import { AccountType } from "xero-node";

const CreateAccountTool = CreateXeroTool(
  "create-account",
  "Create a new account in Xero's chart of accounts. Requires a code, name, and account type. Note: you cannot create accounts with type BANK via the API, use the Xero UI for bank accounts.",
  {
    ...tenantIdSchema,
    code: z.string().describe("Account code (max 10 characters). e.g. '200', 'SALES', '4100'"),
    name: z.string().describe("Account name (max 150 characters). e.g. 'Office Supplies'"),
    type: z
      .enum([
        "BANK",
        "CURRENT",
        "CURRLIAB",
        "DEPRECIATN",
        "DIRECTCOSTS",
        "EQUITY",
        "EXPENSE",
        "FIXED",
        "INVENTORY",
        "LIABILITY",
        "NONCURRENT",
        "OTHERINCOME",
        "OVERHEADS",
        "PREPAYMENT",
        "REVENUE",
        "SALES",
        "TERMLIAB",
        "PAYGLIABILITY",
        "SUPERANNUATIONEXPENSE",
        "SUPERANNUATIONLIABILITY",
        "WABORECEIVEDCAPITALLIAB",
        "WAGESEXPENSE",
        "WAGESPAYABLELIABILITY",
      ])
      .describe("The account type. Common types: REVENUE, EXPENSE, CURRENT, CURRLIAB, FIXED, EQUITY"),
    description: z.string().optional().describe("Account description (max 4000 characters)"),
    taxType: z
      .string()
      .optional()
      .describe("Tax type for the account. Use list-tax-rates to see available options."),
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
    code,
    name,
    type,
    description,
    taxType,
    enablePaymentsToAccount,
    showInExpenseClaims,
    tenantId,
  }) => {
    const response = await createXeroAccount(
      code,
      name,
      type as unknown as AccountType,
      description,
      taxType,
      enablePaymentsToAccount,
      showInExpenseClaims,
      tenantId,
    );

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error creating account: ${response.error}`,
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
            `Account created successfully.`,
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

export default CreateAccountTool;
