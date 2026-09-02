import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { Account, Accounts } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

interface AccountUpdateFields {
  name?: string;
  code?: string;
  description?: string;
  taxType?: string;
  status?: Account.StatusEnum;
  enablePaymentsToAccount?: boolean;
  showInExpenseClaims?: boolean;
}

async function updateAccount(
  accountID: string,
  fields: AccountUpdateFields,
  tenantId?: string,
): Promise<Account> {
  await xeroClient.authenticate();
  const resolvedTenantId = xeroClient.resolveTenantIdForWrite(tenantId);

  const account: Account = {};
  if (fields.name !== undefined) account.name = fields.name;
  if (fields.code !== undefined) account.code = fields.code;
  if (fields.description !== undefined) account.description = fields.description;
  if (fields.taxType !== undefined) account.taxType = fields.taxType;
  if (fields.status !== undefined) account.status = fields.status;
  if (fields.enablePaymentsToAccount !== undefined)
    account.enablePaymentsToAccount = fields.enablePaymentsToAccount;
  if (fields.showInExpenseClaims !== undefined)
    account.showInExpenseClaims = fields.showInExpenseClaims;

  const accounts: Accounts = { accounts: [account] };

  const response = await xeroClient.accountingApi.updateAccount(
    resolvedTenantId,
    accountID,
    accounts,
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  const updated = response.body.accounts?.[0];
  if (!updated) {
    throw new Error("Failed to update account");
  }
  return updated;
}

/**
 * Update an existing account in Xero's chart of accounts.
 */
export async function updateXeroAccount(
  accountID: string,
  fields: AccountUpdateFields,
  tenantId?: string,
): Promise<XeroClientResponse<Account>> {
  try {
    const account = await updateAccount(accountID, fields, tenantId);

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
