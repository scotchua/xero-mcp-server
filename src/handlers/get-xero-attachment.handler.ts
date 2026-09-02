import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import type { AttachmentEntityType } from "./list-xero-attachments.handler.js";

export interface AttachmentContent {
  fileName: string;
  contentType: string;
  contentBase64: string;
  sizeBytes: number;
}

async function getAttachment(
  entityType: AttachmentEntityType,
  entityId: string,
  fileName: string,
  contentType: string,
  tenantId?: string,
): Promise<AttachmentContent> {
  await xeroClient.authenticate();
  const resolvedTenantId = xeroClient.resolveTenantId(tenantId);
  const headers = getClientHeaders();
  const api = xeroClient.accountingApi;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let response: any;

  switch (entityType) {
    case "account":
      response = await api.getAccountAttachmentByFileName(resolvedTenantId, entityId, fileName, contentType, headers);
      break;
    case "bankTransaction":
      response = await api.getBankTransactionAttachmentByFileName(resolvedTenantId, entityId, fileName, contentType, headers);
      break;
    case "bankTransfer":
      response = await api.getBankTransferAttachmentByFileName(resolvedTenantId, entityId, fileName, contentType, headers);
      break;
    case "contact":
      response = await api.getContactAttachmentByFileName(resolvedTenantId, entityId, fileName, contentType, headers);
      break;
    case "creditNote":
      response = await api.getCreditNoteAttachmentByFileName(resolvedTenantId, entityId, fileName, contentType, headers);
      break;
    case "invoice":
      response = await api.getInvoiceAttachmentByFileName(resolvedTenantId, entityId, fileName, contentType, headers);
      break;
    case "manualJournal":
      response = await api.getManualJournalAttachmentByFileName(resolvedTenantId, entityId, fileName, contentType, headers);
      break;
    case "purchaseOrder":
      response = await api.getPurchaseOrderAttachmentByFileName(resolvedTenantId, entityId, fileName, contentType, headers);
      break;
    case "quote":
      response = await api.getQuoteAttachmentByFileName(resolvedTenantId, entityId, fileName, contentType, headers);
      break;
    case "receipt":
      response = await api.getReceiptAttachmentByFileName(resolvedTenantId, entityId, fileName, contentType, headers);
      break;
    case "repeatingInvoice":
      response = await api.getRepeatingInvoiceAttachmentByFileName(resolvedTenantId, entityId, fileName, contentType, headers);
      break;
    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }

  const body = response.body;
  const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body as ArrayBuffer);

  return {
    fileName,
    contentType,
    contentBase64: buffer.toString("base64"),
    sizeBytes: buffer.length,
  };
}

/**
 * Get/download an attachment from a Xero entity.
 */
export async function getXeroAttachment(
  entityType: AttachmentEntityType,
  entityId: string,
  fileName: string,
  contentType: string,
  tenantId?: string,
): Promise<XeroClientResponse<AttachmentContent>> {
  try {
    const attachment = await getAttachment(entityType, entityId, fileName, contentType, tenantId);

    return {
      result: attachment,
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
