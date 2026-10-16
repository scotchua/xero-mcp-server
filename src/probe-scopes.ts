#!/usr/bin/env node

// Capability probe: logs in with the auth-code flow and runs every tool this
// fork adds beyond Xero's hosted Remote MCP, against the Xero Demo Company
// only, to show which ones a newly registered app's granular scopes allow.
// Writes are reversible and cleaned up; the one irreversible write (a bank
// transfer, which the API cannot delete) runs only with --write-transfer.

import dotenv from "dotenv";

dotenv.config();
process.env.XERO_AUTH_MODE = "auth_code";

if (!process.env.XERO_CLIENT_ID || !process.env.XERO_CLIENT_SECRET) {
  process.stderr.write(
    "[Probe] XERO_CLIENT_ID and XERO_CLIENT_SECRET must be set (env or .env).\n",
  );
  process.exit(1);
}

const { AccountType, PurchaseOrder } = await import("xero-node");
const { xeroClient, XERO_AUTH_CODE_SCOPES } = await import("./clients/xero-client.js");
const { listXeroOrganisationDetails } = await import("./handlers/list-xero-organisation-details.handler.js");
const { listXeroAccounts } = await import("./handlers/list-xero-accounts.handler.js");
const { listXeroContacts } = await import("./handlers/list-xero-contacts.handler.js");
const { listXeroInvoices } = await import("./handlers/list-xero-invoices.handler.js");
const { listXeroBankTransactions } = await import("./handlers/list-xero-bank-transactions.handler.js");
const { listXeroJournals } = await import("./handlers/list-xero-journals.handler.js");
const { listXeroBankTransfers } = await import("./handlers/list-xero-bank-transfers.handler.js");
const { createXeroBankTransfer } = await import("./handlers/create-xero-bank-transfer.handler.js");
const { getXeroInvoicePdf } = await import("./handlers/get-xero-invoice-pdf.handler.js");
const { createXeroAccount } = await import("./handlers/create-xero-account.handler.js");
const { updateXeroAccount } = await import("./handlers/update-xero-account.handler.js");
const { deleteXeroAccount } = await import("./handlers/delete-xero-account.handler.js");
const { createXeroBankTransaction } = await import("./handlers/create-xero-bank-transaction.handler.js");
const { deleteXeroBankTransaction } = await import("./handlers/delete-xero-bank-transaction.handler.js");
const { createXeroPurchaseOrder } = await import("./handlers/create-xero-purchase-order.handler.js");
const { listXeroPurchaseOrders } = await import("./handlers/list-xero-purchase-orders.handler.js");
const { updateXeroPurchaseOrder } = await import("./handlers/update-xero-purchase-order.handler.js");
const { uploadXeroAttachment } = await import("./handlers/upload-xero-attachment.handler.js");
const { listXeroAttachments } = await import("./handlers/list-xero-attachments.handler.js");
const { getXeroAttachment } = await import("./handlers/get-xero-attachment.handler.js");

type Status = "PASS" | "BLOCKED" | "FAIL" | "SKIP";
interface Row { feature: string; step: string; status: Status; detail: string }
type Response<T> = { isError: false; result: T } | { isError: true; error: string };

const rows: Row[] = [];
const writeTransfer = process.argv.includes("--write-transfer");

function record(feature: string, step: string, status: Status, detail = ""): void {
  rows.push({ feature, step, status, detail });
}

// A 401/403 on a call the login succeeded for is how Xero reports a scope
// the token does not carry.
function classify(error: string): Status {
  return /Authentication failed|permission|401|403|scope/i.test(error) ? "BLOCKED" : "FAIL";
}

async function step<T>(
  feature: string,
  name: string,
  call: () => Promise<Response<T>>,
  ok: (result: T) => string = () => "",
): Promise<T | undefined> {
  try {
    const res = await call();
    if (res.isError) {
      record(feature, name, classify(res.error), res.error);
      return undefined;
    }
    record(feature, name, "PASS", ok(res.result));
    return res.result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    record(feature, name, classify(msg), msg);
    return undefined;
  }
}

function skip(feature: string, name: string, why: string): void {
  record(feature, name, "SKIP", why);
}

await xeroClient.authenticate();

const granted = String(xeroClient.readTokenSet()?.scope ?? "(not reported)");
process.stderr.write(`\n[Probe] Requested scopes: ${XERO_AUTH_CODE_SCOPES}\n`);
process.stderr.write(`[Probe] Granted scopes:   ${granted}\n`);

let demoTenantId: string | undefined;
for (const t of xeroClient.getTenants()) {
  const org = (await xeroClient.accountingApi.getOrganisations(t.tenantId)).body.organisations?.[0];
  if (org?.isDemoCompany) {
    demoTenantId = t.tenantId;
    break;
  }
}
if (!demoTenantId) {
  process.stderr.write(
    "[Probe] No Demo Company is connected to this authorization. Connect Xero's Demo Company (US) with `npm run login` and re-run. Refusing to write to a real organisation.\n",
  );
  process.exit(1);
}
xeroClient.switchTenantId(demoTenantId);
const T = demoTenantId;

// Baseline: tools Xero's hosted MCP also has. If these fail the login itself
// is the problem, not the fork-only features.
const org = await step("baseline", "organisation details", () => listXeroOrganisationDetails(),
  (o) => `${o.name} (${o.countryCode}, demo=${o.isDemoCompany})`);
const accounts = (await step("baseline", "list accounts", () => listXeroAccounts(),
  (a) => `${a.length} accounts`)) ?? [];
const contacts = (await step("baseline", "list contacts", () => listXeroContacts(1),
  (c) => `${c.length} contacts on page 1`)) ?? [];
const invoices = (await step("baseline", "list invoices", () => listXeroInvoices(1),
  (i) => `${i.length} invoices on page 1`)) ?? [];
await step("baseline", "list bank transactions", () => listXeroBankTransactions(1),
  (b) => `${b.length} on page 1`);

if (org && !org.isDemoCompany) {
  process.stderr.write("[Probe] Active organisation is not a Demo Company. Stopping before any write.\n");
  process.exit(1);
}

const banks = accounts.filter((a) => a.type === AccountType.BANK && String(a.status) === "ACTIVE");
const expense = accounts.find((a) => a.type === AccountType.EXPENSE && String(a.status) === "ACTIVE" && a.code);
const contact = contacts[0];
const tag = `MHPE-PROBE-${Date.now().toString(36).toUpperCase()}`;

// Fork-only reads.
await step("journals (GL)", "list journals", () => listXeroJournals(0, false, undefined, undefined, T),
  (j) => `${j.length} journals returned`);
await step("bank transfers", "list bank transfers", () => listXeroBankTransfers(T),
  (b) => `${b.length} transfers`);
const pdfInvoice = invoices.find((i) => i.invoiceID);
if (pdfInvoice?.invoiceID) {
  await step("invoice PDF", "get invoice PDF", () => getXeroInvoicePdf(pdfInvoice.invoiceID!, T),
    (p) => `${p.sizeBytes} bytes`);
} else {
  skip("invoice PDF", "get invoice PDF", "no invoice found to render");
}

// Chart of accounts writes: create, update, delete one throwaway account.
const code = `P${Date.now().toString(36).toUpperCase()}`.slice(0, 10);
const acct = await step("account edits", "create account", () =>
  createXeroAccount(code, `${tag} delete me`, AccountType.EXPENSE, "MHPE capability probe", undefined, undefined, undefined, T),
  (a) => `code ${a.code}`);
let createdAccountId = acct?.accountID;
if (createdAccountId) {
  await step("account edits", "update account", () =>
    updateXeroAccount(createdAccountId!, { description: "MHPE capability probe (updated)" }, T));
  const gone = await step("account edits", "delete account", () => deleteXeroAccount(createdAccountId!, T));
  if (gone) createdAccountId = undefined;
} else {
  skip("account edits", "update account", "create failed");
  skip("account edits", "delete account", "create failed");
}

// Bank transaction create, then delete (the fork's delete tool).
let createdTxnId: string | undefined;
if (banks[0]?.accountID && contact?.contactID && expense?.code) {
  const txn = await step("delete bank transaction", "create $1.00 spend", () =>
    createXeroBankTransaction("SPEND", banks[0].accountID!, contact.contactID!, [
      { description: tag, quantity: 1, unitAmount: 1, accountCode: expense.code!, taxType: expense.taxType ?? "NONE" },
    ], tag), (b) => `id ${b.bankTransactionID}`);
  createdTxnId = txn?.bankTransactionID;
  if (createdTxnId) {
    const ok = await step("delete bank transaction", "delete it", () => deleteXeroBankTransaction(createdTxnId!, T));
    if (ok) createdTxnId = undefined;
  } else {
    skip("delete bank transaction", "delete it", "create failed");
  }
} else {
  skip("delete bank transaction", "create $1.00 spend", "needs an active bank account, a contact and an expense account");
}

// Purchase order, with an attachment on it, then deleted.
let createdPoId: string | undefined;
if (contact?.contactID && expense?.code) {
  const po = await step("purchase orders", "create draft PO", () =>
    createXeroPurchaseOrder(contact.contactID!, [
      { description: tag, quantity: 1, unitAmount: 1, accountCode: expense.code! },
    ], undefined, undefined, tag, T), (p) => `id ${p.purchaseOrderID}, status ${p.status}`);
  createdPoId = po?.purchaseOrderID;
  await step("purchase orders", "list POs", () => listXeroPurchaseOrders(1, undefined, T),
    (p) => `${p.length} on page 1`);
  if (createdPoId) {
    const fileName = "mhpe-probe.txt";
    const body = Buffer.from(`${tag} capability probe attachment\n`).toString("base64");
    const att = await step("attachments", "upload to the PO", () =>
      uploadXeroAttachment("purchaseOrder", createdPoId!, fileName, { base64: body }, false, T),
      (a) => `${a.fileName}`);
    await step("attachments", "list attachments", () => listXeroAttachments("purchaseOrder", createdPoId!, T),
      (l) => `${l.length} on the PO`);
    if (att) {
      await step("attachments", "download attachment", () =>
        getXeroAttachment("purchaseOrder", createdPoId!, fileName, "text/plain", T),
        (c) => `${c.sizeBytes} bytes`);
    } else {
      skip("attachments", "download attachment", "upload failed");
    }
    const del = await step("purchase orders", "delete draft PO", () =>
      updateXeroPurchaseOrder(createdPoId!, { status: PurchaseOrder.StatusEnum.DELETED }, T));
    if (del) createdPoId = undefined;
  } else {
    skip("attachments", "upload to the PO", "PO create failed");
  }
} else {
  skip("purchase orders", "create draft PO", "needs a contact and an expense account");
}

// Bank transfer write: off by default, because the API cannot delete it.
if (!writeTransfer) {
  skip("bank transfers", "create $1.00 transfer", "re-run with --write-transfer; the API cannot delete it, so remove it in Xero afterwards");
} else if (banks.length >= 2) {
  await step("bank transfers", "create $1.00 transfer", () =>
    createXeroBankTransfer(banks[0].accountID!, banks[1].accountID!, 1, undefined, tag, undefined, undefined, T),
    (b) => `id ${b.bankTransferID} (delete it in Xero: reference ${tag})`);
} else {
  skip("bank transfers", "create $1.00 transfer", "needs two active bank accounts");
}

const leftovers = [
  createdAccountId && `account ${code}`,
  createdTxnId && `bank transaction ${createdTxnId}`,
  createdPoId && `purchase order ${createdPoId}`,
].filter(Boolean);

process.stdout.write(`\nMHPE capability probe, ${new Date().toISOString()}\nOrganisation: ${org?.name ?? "?"}\nGranted scopes: ${granted}\n\n`);
process.stdout.write("| Feature | Step | Result | Detail |\n|---|---|---|---|\n");
for (const r of rows) {
  process.stdout.write(`| ${r.feature} | ${r.step} | ${r.status} | ${r.detail.replace(/\|/g, "/").slice(0, 160)} |\n`);
}
process.stdout.write(`\nTagged ${tag}. ${leftovers.length ? `Left behind, delete in Xero: ${leftovers.join(", ")}.` : "Nothing left behind."}\n`);
process.exit(rows.some((r) => r.status === "FAIL" || r.status === "BLOCKED") ? 2 : 0);
