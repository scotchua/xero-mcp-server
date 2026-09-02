import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Account, AccountType } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function createAccount(
  code: string,
  name: string,
  type: AccountType,
  description?: string,
  taxType?: string,
  enablePaymentsToAccount?: boolean,
  showInExpenseClaims?: boolean,
  tenantId?: string,
): Promise<Account> {
  await xeroClient.authenticate();
  const resolvedTenantId = xeroClient.resolveTenantIdForWrite(tenantId);

  const account: Account = {
    code,
    name,
    type,
    description,
    taxType,
    enablePaymentsToAccount,
    showInExpenseClaims,
  };

  const response = await xeroClient.accountingApi.createAccount(
    resolvedTenantId,
    account,
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  const created = response.body.accounts?.[0];
  if (!created) {
    throw new Error("Failed to create account");
  }
  return created;
}

/**
 * Create a new account in Xero's chart of accounts.
 */
export async function createXeroAccount(
  code: string,
  name: string,
  type: AccountType,
  description?: string,
  taxType?: string,
  enablePaymentsToAccount?: boolean,
  showInExpenseClaims?: boolean,
  tenantId?: string,
): Promise<XeroClientResponse<Account>> {
  try {
    const account = await createAccount(
      code,
      name,
      type,
      description,
      taxType,
      enablePaymentsToAccount,
      showInExpenseClaims,
      tenantId,
    );

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
