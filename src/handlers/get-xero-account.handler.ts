import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Account } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function getAccount(accountID: string, tenantId?: string): Promise<Account> {
  await xeroClient.authenticate();
  const resolvedTenantId = xeroClient.resolveTenantId(tenantId);

  const response = await xeroClient.accountingApi.getAccount(
    resolvedTenantId,
    accountID,
    getClientHeaders(),
  );

  const account = response.body.accounts?.[0];
  if (!account) {
    throw new Error(`Account not found: ${accountID}`);
  }
  return account;
}

/**
 * Get a single account from Xero's chart of accounts by ID.
 */
export async function getXeroAccount(
  accountID: string,
  tenantId?: string,
): Promise<XeroClientResponse<Account>> {
  try {
    const account = await getAccount(accountID, tenantId);

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
