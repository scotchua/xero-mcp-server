import { z } from "zod";
import { listXeroAttachments } from "../../handlers/list-xero-attachments.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { tenantIdSchema } from "../../helpers/tenant-id-schema.js";

const ENTITY_TYPES = [
  "account",
  "bankTransaction",
  "bankTransfer",
  "contact",
  "creditNote",
  "invoice",
  "manualJournal",
  "purchaseOrder",
  "quote",
  "receipt",
  "repeatingInvoice",
] as const;

const ListAttachmentsTool = CreateXeroTool(
  "list-attachments",
  "List the attachments (file names, content types, and sizes) on a Xero entity such as an invoice, contact, or bank transaction.",
  {
    ...tenantIdSchema,
    entityType: z.enum(ENTITY_TYPES).describe("The type of Xero entity the attachments belong to."),
    entityId: z.string().describe("The unique Xero identifier for the entity."),
  },
  async ({ entityType, entityId, tenantId }) => {
    const response = await listXeroAttachments(entityType, entityId, tenantId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error listing attachments: ${response.error}`,
          },
        ],
      };
    }

    const attachments = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Found ${attachments?.length || 0} attachment(s):`,
        },
        ...(attachments?.map((attachment) => ({
          type: "text" as const,
          text: [
            `File: ${attachment.fileName}`,
            `Content Type: ${attachment.mimeType}`,
            `Size: ${attachment.contentLength} bytes`,
          ].join("\n"),
        })) || []),
      ],
    };
  },
);

export default ListAttachmentsTool;
