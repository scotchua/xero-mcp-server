import { z } from "zod";
import { getXeroInvoicePdf } from "../../handlers/get-xero-invoice-pdf.handler.js";
import { CreateXeroTool } from "../../helpers/create-xero-tool.js";
import { tenantIdSchema } from "../../helpers/tenant-id-schema.js";

const GetInvoicePdfTool = CreateXeroTool(
  "get-invoice-pdf",
  "Retrieve an invoice or bill from Xero as a PDF, returned as base64-encoded content.",
  {
    ...tenantIdSchema,
    invoiceId: z.string().describe("The unique Xero identifier for the invoice or bill."),
  },
  async ({ invoiceId, tenantId }) => {
    const response = await getXeroInvoicePdf(invoiceId, tenantId);

    if (response.isError) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error retrieving invoice PDF: ${response.error}`,
          },
        ],
      };
    }

    const pdf = response.result;

    return {
      content: [
        {
          type: "text" as const,
          text: `Invoice ${pdf?.invoiceId} PDF (${pdf?.sizeBytes} bytes):`,
        },
        {
          type: "text" as const,
          text: pdf?.contentBase64 ?? "",
        },
      ],
    };
  },
);

export default GetInvoicePdfTool;
