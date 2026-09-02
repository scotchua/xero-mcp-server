import { Journal } from "xero-node";
import { xeroClient } from "../clients/xero-client.js";
import { formatError } from "../helpers/format-error.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getJournals(
  offset?: number,
  paymentsOnly?: boolean,
  journalId?: string,
  journalNumber?: number,
  tenantId?: string,
): Promise<Journal[]> {
  await xeroClient.authenticate();
  const resolvedTenantId = xeroClient.resolveTenantId(tenantId);

  if (journalId) {
    const response = await xeroClient.accountingApi.getJournal(
      resolvedTenantId,
      journalId,
      getClientHeaders(),
    );
    return response.body.journals ?? [];
  }

  if (journalNumber !== undefined) {
    const response = await xeroClient.accountingApi.getJournalByNumber(
      resolvedTenantId,
      journalNumber,
      getClientHeaders(),
    );
    return response.body.journals ?? [];
  }

  // Xero recommends offset-based paging over the If-Modified-Since header,
  // which can silently miss journals during extraction.
  const response = await xeroClient.accountingApi.getJournals(
    resolvedTenantId,
    undefined, // ifModifiedSince
    offset,
    paymentsOnly,
    getClientHeaders(),
  );

  return response.body.journals ?? [];
}

/**
 * List general ledger journals from Xero (read-only Journals endpoint).
 * Returns every journal Xero posts (invoices, payments, bank transactions,
 * manual journals, etc.), up to 100 per call, ordered oldest to newest.
 */
export async function listXeroJournals(
  offset?: number,
  paymentsOnly?: boolean,
  journalId?: string,
  journalNumber?: number,
  tenantId?: string,
): Promise<XeroClientResponse<Journal[]>> {
  try {
    const journals = await getJournals(offset, paymentsOnly, journalId, journalNumber, tenantId);

    return {
      result: journals,
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
