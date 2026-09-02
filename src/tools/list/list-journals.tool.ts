import { z } from "zod";
import { listXeroJournals } from "../../handlers/list-xero-journals.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { tenantIdSchema } from "../../helpers/tenant-id-schema.js";

const ListJournalsTool = CreateXeroTool(
  "list-journals",
  "List general ledger journals from Xero's read-only Journals endpoint: every journal Xero posts (invoices, payments, bank transactions, manual journals, etc.), up to 100 per call, ordered oldest to newest. Use offset to page through results, or journalId/journalNumber to fetch one journal directly.",
  {
    ...tenantIdSchema,
    offset: z
      .number()
      .optional()
      .describe("Return journals with a JournalNumber greater than this offset (for paging)."),
    paymentsOnly: z.boolean().optional().describe("Return only journals for payments."),
    journalId: z.string().optional().describe("Fetch a single journal by its Xero ID."),
    journalNumber: z.number().optional().describe("Fetch a single journal by its sequential journal number."),
  },
  async ({ offset, paymentsOnly, journalId, journalNumber, tenantId }) => {
    const response = await listXeroJournals(offset, paymentsOnly, journalId, journalNumber, tenantId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing journals: ${response.error}`,
          },
        ],
      };
    }

    const journals = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${journals?.length || 0} journal(s):`,
        },
        ...(journals?.map((journal) => ({
          type: "text" as const,
          text: [
            `Journal Number: ${journal.journalNumber}`,
            `ID: ${journal.journalID}`,
            `Date: ${journal.journalDate}`,
            `Reference: ${journal.reference || "None"}`,
            `Source: ${journal.sourceType} ${journal.sourceID || ""}`.trim(),
            `Lines: ${journal.journalLines?.length ?? 0}`,
          ].join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListJournalsTool;
