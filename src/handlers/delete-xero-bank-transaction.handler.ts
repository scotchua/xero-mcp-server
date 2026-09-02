import { xeroClient } from "../clients/xero-client.js";
import { XeroClientResponse } from "../types/tool-response.js";
import { formatError } from "../helpers/format-error.js";
import { BankTransaction } from "xero-node";
import { getClientHeaders } from "../helpers/get-client-headers.js";

async function deleteBankTransaction(
  bankTransactionId: string,
  tenantId?: string,
): Promise<BankTransaction> {
  await xeroClient.authenticate();
  const resolvedTenantId = xeroClient.resolveTenantIdForWrite(tenantId);

  // Xero deletes a spend/receive money transaction by POSTing Status=DELETED.
  // Only the ID and status are required.
  const response = await xeroClient.accountingApi.updateBankTransaction(
    resolvedTenantId,
    bankTransactionId,
    {
      // Minimal delete payload — Xero only requires the ID and status. The
      // SDK type marks type/lineItems/bankAccount as required, so we cast.
      bankTransactions: [
        {
          bankTransactionID: bankTransactionId,
          status: BankTransaction.StatusEnum.DELETED,
        } as BankTransaction,
      ],
    },
    undefined, // unitdp
    undefined, // idempotencyKey
    getClientHeaders(),
  );

  const deleted = response.body.bankTransactions?.[0];
  if (!deleted) {
    throw new Error("Failed to delete bank transaction");
  }
  return deleted;
}

/**
 * Delete (set Status=DELETED) a spend money or receive money bank transaction.
 */
export async function deleteXeroBankTransaction(
  bankTransactionId: string,
  tenantId?: string,
): Promise<XeroClientResponse<BankTransaction>> {
  try {
    const deleted = await deleteBankTransaction(bankTransactionId, tenantId);

    return {
      result: deleted,
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
