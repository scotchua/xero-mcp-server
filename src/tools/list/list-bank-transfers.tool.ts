import { listXeroBankTransfers } from "../../handlers/list-xero-bank-transfers.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { tenantIdSchema } from "../../helpers/tenant-id-schema.js";

const ListBankTransfersTool = CreateXeroTool(
  "list-bank-transfers",
  "List transfers of funds between Xero bank accounts, most recent first.",
  { ...tenantIdSchema },
  async ({ tenantId }) => {
    const response = await listXeroBankTransfers(tenantId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing bank transfers: ${response.error}`,
          },
        ],
      };
    }

    const transfers = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${transfers?.length || 0} bank transfer(s):`,
        },
        ...(transfers?.map((transfer) => ({
          type: "text" as const,
          text: [
            `ID: ${transfer.bankTransferID}`,
            `Date: ${transfer.date}`,
            `Amount: ${transfer.amount}`,
            `From: ${transfer.fromBankAccount?.name || transfer.fromBankAccount?.accountID}`,
            `To: ${transfer.toBankAccount?.name || transfer.toBankAccount?.accountID}`,
          ].join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListBankTransfersTool;
