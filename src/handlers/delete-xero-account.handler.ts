import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Account } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function deleteAccount(accountID: string, tenantId?: string): Promise<Account> {
  await xeroClient.authenticate();
  const resolvedTenantId = xeroClient.resolveTenantIdForWrite(tenantId);

  const response = await xeroClient.accountingApi.deleteAccount(
    resolvedTenantId,
    accountID,
    getClientHeaders(),
  );

  const deleted = response.body.accounts?.[0];
  if (!deleted) {
    throw new Error("Failed to delete account");
  }
  return deleted;
}

/**
 * Delete an account from Xero's chart of accounts.
 */
export async function deleteXeroAccount(
  accountID: string,
  tenantId?: string,
): Promise<XeroClientResponse<Account>> {
  try {
    const account = await deleteAccount(accountID, tenantId);

    return {
      result: account,
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
