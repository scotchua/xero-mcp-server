import { z } from "zod";
import { uploadXeroAttachment } from "../../handlers/upload-xero-attachment.handler.js";
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

const UploadAttachmentTool = CreateXeroTool(
  "upload-attachment",
  "Upload a file as an attachment to a Xero entity such as an invoice, bill, or contact. Provide the file content as base64, or a filePath under the server's configured XERO_FILES_DIR.",
  {
    ...tenantIdSchema,
    entityType: z.enum(ENTITY_TYPES).describe("The type of Xero entity to attach the file to."),
    entityId: z.string().describe("The unique Xero identifier for the entity."),
    fileName: z.string().describe("The file name to store the attachment as, including extension."),
    base64: z
      .string()
      .optional()
      .describe("The file content, base64-encoded. Provide this or filePath, not both."),
    filePath: z
      .string()
      .optional()
      .describe(
        "A path to the file, resolved relative to the server's configured XERO_FILES_DIR. Provide this or base64, not both.",
      ),
    includeOnline: z
      .boolean()
      .optional()
      .describe("For invoices and credit notes, whether the attachment should appear on the Xero online invoice."),
  },
  async ({ entityType, entityId, fileName, base64, filePath, includeOnline, tenantId }) => {
    if ((base64 && filePath) || (!base64 && !filePath)) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Error uploading attachment: provide exactly one of base64 or filePath.",
          },
        ],
      };
    }

    const source = base64 ? { base64 } : { filePath: filePath! };
    const response = await uploadXeroAttachment(entityType, entityId, fileName, source, includeOnline, tenantId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error uploading attachment: ${response.error}`,
          },
        ],
      };
    }

    const attachment = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Attachment uploaded successfully: ${attachment?.fileName} (${attachment?.contentLength} bytes)`,
        },
      ],
    };
  },
);

export default UploadAttachmentTool;
