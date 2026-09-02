import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Attachment } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import type { AttachmentEntityType } from "./list-xero-attachments.handler.js";
import { resolveLocalFilePath } from "../helpers/resolve-local-file-path.js";
import fs from "fs";

async function uploadAttachment(
  entityType: AttachmentEntityType,
  entityId: string,
  fileName: string,
  body: Buffer,
  includeOnline?: boolean,
  tenantId?: string,
): Promise<Attachment> {
  await xeroClient.authenticate();
  const resolvedTenantId = xeroClient.resolveTenantIdForWrite(tenantId);
  const headers = getClientHeaders();
  const api = xeroClient.accountingApi;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let response: any;

  switch (entityType) {
    case "account":
      response = await api.createAccountAttachmentByFileName(resolvedTenantId, entityId, fileName, body, undefined, headers);
      break;
    case "bankTransaction":
      response = await api.createBankTransactionAttachmentByFileName(resolvedTenantId, entityId, fileName, body, undefined, headers);
      break;
    case "bankTransfer":
      response = await api.createBankTransferAttachmentByFileName(resolvedTenantId, entityId, fileName, body, undefined, headers);
      break;
    case "contact":
      response = await api.createContactAttachmentByFileName(resolvedTenantId, entityId, fileName, body, undefined, headers);
      break;
    case "creditNote":
      response = await api.createCreditNoteAttachmentByFileName(resolvedTenantId, entityId, fileName, body, includeOnline, undefined, headers);
      break;
    case "invoice":
      response = await api.createInvoiceAttachmentByFileName(resolvedTenantId, entityId, fileName, body, includeOnline, undefined, headers);
      break;
    case "manualJournal":
      response = await api.createManualJournalAttachmentByFileName(resolvedTenantId, entityId, fileName, body, undefined, headers);
      break;
    case "purchaseOrder":
      response = await api.createPurchaseOrderAttachmentByFileName(resolvedTenantId, entityId, fileName, body, undefined, headers);
      break;
    case "quote":
      response = await api.createQuoteAttachmentByFileName(resolvedTenantId, entityId, fileName, body, undefined, headers);
      break;
    case "receipt":
      response = await api.createReceiptAttachmentByFileName(resolvedTenantId, entityId, fileName, body, undefined, headers);
      break;
    case "repeatingInvoice":
      response = await api.createRepeatingInvoiceAttachmentByFileName(resolvedTenantId, entityId, fileName, body, undefined, headers);
      break;
    default:
      throw new Error(`Unsupported entity type: ${entityType}`);
  }

  const attachment = response.body.attachments?.[0];
  if (!attachment) {
    throw new Error("Failed to upload attachment");
  }
  return attachment;
}

/**
 * Upload an attachment to a Xero entity. Accepts either a base64-encoded
 * string or a local file path.
 */
export async function uploadXeroAttachment(
  entityType: AttachmentEntityType,
  entityId: string,
  fileName: string,
  source: { base64: string } | { filePath: string },
  includeOnline?: boolean,
  tenantId?: string,
): Promise<XeroClientResponse<Attachment>> {
  try {
    let buffer: Buffer;
    if ("base64" in source) {
      buffer = Buffer.from(source.base64, "base64");
    } else {
      buffer = await fs.promises.readFile(resolveLocalFilePath(source.filePath));
    }

    const attachment = await uploadAttachment(
      entityType,
      entityId,
      fileName,
      buffer,
      includeOnline,
      tenantId,
    );

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
