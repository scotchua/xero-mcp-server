import { z } from "zod";
import { getXeroAttachment } from "../../handlers/get-xero-attachment.handler.js";
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

const GetAttachmentTool = CreateXeroTool(
  "get-attachment",
  "Download an attachment from a Xero entity. Returns the file content as base64. Use list-attachments first to find the file name and content type.",
  {
    ...tenantIdSchema,
    entityType: z.enum(ENTITY_TYPES).describe("The type of Xero entity the attachment belongs to."),
    entityId: z.string().describe("The unique Xero identifier for the entity."),
    fileName: z.string().describe("The attachment's file name, from list-attachments."),
    contentType: z.string().describe("The attachment's content (MIME) type, from list-attachments."),
  },
  async ({ entityType, entityId, fileName, contentType, tenantId }) => {
    const response = await getXeroAttachment(entityType, entityId, fileName, contentType, tenantId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving attachment: ${response.error}`,
          },
        ],
      };
    }

    const attachment = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `File: ${attachment?.fileName} (${attachment?.contentType}, ${attachment?.sizeBytes} bytes)`,
        },
        {
          type: "text" as const,
          text: attachment?.contentBase64 ?? "",
        },
      ],
    };
  },
);

export default GetAttachmentTool;
