import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

export interface InvoicePdf {
  invoiceId: string;
  contentBase64: string;
  sizeBytes: number;
}

async function getInvoicePdf(invoiceId: string, tenantId?: string): Promise<InvoicePdf> {
  await xeroClient.authenticate();
  const resolvedTenantId = xeroClient.resolveTenantId(tenantId);

  const response = await xeroClient.accountingApi.getInvoiceAsPdf(
    resolvedTenantId,
    invoiceId,
    getClientHeaders(),
  );

  const buffer = response.body;

  return {
    invoiceId,
    contentBase64: buffer.toString("base64"),
    sizeBytes: buffer.length,
  };
}

/**
 * Retrieve an invoice or bill from Xero as a PDF.
 */
export async function getXeroInvoicePdf(
  invoiceId: string,
  tenantId?: string,
): Promise<XeroClientResponse<InvoicePdf>> {
  try {
    const pdf = await getInvoicePdf(invoiceId, tenantId);

    return {
      result: pdf,
      isError: false,
      error: null,
    };
  } catch (error) {
    return {
      result: null,
      isError: true,
      error: formatError(error),
    };
  }
}
