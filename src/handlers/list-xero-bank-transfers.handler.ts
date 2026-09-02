import { xeroClient } from "../clients/xero-client.js";
import { BankTransfer } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";

async function getBankTransfers(tenantId?: string): Promise<BankTransfer[]> {
  await xeroClient.authenticate();
  const resolvedTenantId = xeroClient.resolveTenantId(tenantId);

  const response = await xeroClient.accountingApi.getBankTransfers(
    resolvedTenantId,
    undefined, // ifModifiedSince
    undefined, // where
    "Date DESC", // order
    getClientHeaders(),
  );

  return response.body.bankTransfers ?? [];
}

/**
 * List bank transfers between Xero bank accounts.
 */
export async function listXeroBankTransfers(
  tenantId?: string,
): Promise<XeroClientResponse<BankTransfer[]>> {
  try {
    const bankTransfers = await getBankTransfers(tenantId);

    return {
      result: bankTransfers,
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
