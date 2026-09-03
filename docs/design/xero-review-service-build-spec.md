# Xero File Review Engine, Build Spec

**`xero-review-service` · v0.1 design · 2026-09-03 · MHPE Certified Public Accountants (internal)**

Status: design only. Nothing in this document has been built. It is written so a Sonnet session can execute it phase by phase without re-deriving the design; the two places Opus is recommended are marked.

Internal name: "Xero audit engine." Every client-facing document is titled **Comprehensive Xero File Review**. This is a diagnostic review, not an audit under professional standards; no opinion is expressed and no AICPA procedures are performed. Same rule as the QBO engine, same reason.

---

## 0. Decision summary

- **Build it as a sibling of `qbo-review-service`, not inside `xero-mcp-server`.** The MCP server is a conversational tool surface; the review engine is a bulk extractor that writes raw evidence to disk and runs 12 check modules over it. Same split the QBO platform already uses (Python engine, TypeScript connector).
- **Reuse the QBO engine's platform-neutral half by copying it in with a provenance manifest.** Findings model, adjudication, redaction, deliverables shaping, the three renderers, delta, bid, and client paths carry zero or near-zero QuickBooks coupling (measured, section 3). Copy at a pinned commit; extract a shared `review-core` package later (Phase 5) once the Xero engine has proved the interfaces. Zero changes to the production QBO engine until then.
- **Rewrite the pull layer and the check bodies against Xero's data model.** The check *intent* transfers almost one for one; the check *source* does not. Xero's Journals endpoint is a better general ledger than QBO's report, Xero exposes voided and deleted records with no 30-day cap, and the 1099 report exists natively. Xero also has no reconciled-through date, no discrepancy account, no sub-accounts, and no payroll for US orgs.
- **US-only scope.** Both current Xero clients are US-domiciled (Scott, this session), so the TAX section (S-corp compensation, 1099, Ketchikan sales tax, WA B&O) transfers as-is.
- **Direct Xero API from Python, read-only scopes, its own app registration.** Not through the MCP server, not sharing the MCP server's token file (refresh-token rotation makes two writers unsafe).
- **Target: roughly 85 to 95 declared checks** after dropping the ones Xero makes structurally impossible and adding the Xero-native ones. The exact count is fixed at the end of Phase 0, when the nine PROBE items in section 14 are settled against live tenants. A declared check that goes silent fails the run, exactly as in the QBO engine.

---

## 1. What this is, and is not

| | Comprehensive Xero File Review (this spec) | Later: Xero monthly diagnostic (Phase 6, optional) |
|---|---|---|
| Window | 24 months default (`--months`), transaction level | 1 month plus 13-month context |
| Cadence | Once: onboarding, cleanup scoping, diligence | Monthly |
| Drives | Remediation plan with effort and sequence | Health score and its trend |
| Readers | Bookkeeper doing the work; client owner gets a one-pager | Client owner |

Out of scope for every phase of this spec: anything that writes to Xero (the remediation engine `qbo-apply-service` has no Xero counterpart here; read-only scopes make it impossible by construction), payroll detail (US Xero has no payroll module), Xero Projects time tracking, and the Xero Files inbox (separate OAuth scope, separate API).

---

## 2. Ground truth used for this design

Everything below is grounded in files inspected during this session. Where a Xero behaviour could not be verified from those sources it is marked **PROBE** and lands in Phase 0.

- `~/qbo-review-service` (the QBO engine): `SKILL.md`, `AUDIT-PLAN.md`, `AUDIT-PULL-PLAN.md`, `check-catalog.md`, `audit.py`, `audit_pull.py`, `checks/__init__.py`, `checks/rec.py`, `deliverables.py`, `client_paths.py`, `redaction.py` import graph, and the `CHECKS` declarations of all 12 modules. Measured size: 27,135 lines of Python across the engine, 41 test files, 100 declared checks, 6 pull stages, roughly 90 logical API calls per client run (`SKILL.md`, `AUDIT-PULL-PLAN.md` §1).
- `xero-node` SDK 13.3.0 as installed in `xero-mcp-server/node_modules` (`dist/gen/api/accountingApi.d.ts` method signatures; `dist/gen/model/accounting/*.d.ts` field lists).
- `XeroAPI/Xero-OpenAPI` `xero_accounting.yaml` (master, fetched 2026-09-03): parameter descriptions, enums, report row schema.
- `developer.xero.com` was **unreachable** from the build session (egress blocked). Rate limits, refresh-token lifetime, per-page maxima, and Custom Connections regional availability are therefore stated from memory of Xero's published docs and flagged for Phase 0 verification. The pull executor reads Xero's `X-MinLimit-Remaining`, `X-DayLimit-Remaining`, and `X-AppMinLimit-Remaining` response headers at runtime and never trusts the numbers in this document.

---

## 3. Architecture and reuse map

### 3.1 Repositories

```
~/Claude/platform/
  qbo-review-service/      unchanged until Phase 5
  xero-collector/          NEW  OAuth2 auth-code + PKCE, token store, tenant roster, paced GET
  xero-review-service/     NEW  the engine (mirrors qbo-review-service's tree)
    core/                  copied platform-neutral modules + PROVENANCE.json
    checks/                12 Xero check modules (same SECTION codes)
    xero_common.py         Xero report/entity parsing helpers (the qbo_common analog)
    audit_pull.py          6 stages, Xero calls
    audit.py               orchestrator (thin fork of the QBO one)
    xero_paths.py          Xero UI click paths per check id, for the bookkeeper report
    fixtures/              Demo Company (US) raw/ snapshot as the sandbox fixture
    tests/
    SKILL.md               mhpe-xero-audit (docs only; engine stays in ~/Claude/platform)
```

Client output tree is unchanged: `~/Claude/clients/<slug>/reviews/audit-<YYYY-MM>/{raw/, findings.json, findings.md, deliverables}` gated by `MHPE_RUN_MODE=production` (copied `client_paths.py`). `findings.json` and `_manifest.json` gain one field: `"platform": "xero"`.

### 3.2 What is reused, and how (measured against the QBO source)

| Module | Lines | QBO tokens found | Reuse mode |
|---|---|---|---|
| `deliverables.py` | 294 | 0 | copy unchanged |
| `adjudication.py` | 248 | 0 | copy unchanged (fingerprints are check id plus stable ids; Xero GUIDs qualify) |
| `audit_delta.py` | 147 | 0 | copy unchanged |
| `classification.py` | 153 | 0 | copy unchanged |
| `client_paths.py` | 89 | 0 | copy unchanged |
| `brand_tokens.py` | 194 | 0 | copy unchanged (mhpe-brand tokens) |
| `redaction.py` | 350 | 10 | copy, then: import `norm_name` from `xero_common`; rename `realm_id` to `tenant_id` in `company_parties.json` schema; user roster comes from Xero `Users` and `HistoryRecord.User` instead of `create_by`/`last_mod_by` |
| `render_workbook.py` | 1,023 | 6 | copy, parametrize wording via `PLATFORM` dict |
| `render_onepager.py` | 627 | 10 | copy, parametrize wording |
| `render_bookkeeper.py` | 2,272 | 29 | copy, parametrize wording, **replace QBO click paths** with `xero_paths.py` lookups keyed by check id; the deletion-window paragraph (Intuit 30-day CDC) is deleted, Xero has no such cap |
| `build_deliverables.py` | 261 | 3 | copy, parametrize |
| `bid.py`, `rates.json` | 253 | 0 | copy unchanged; automation-share fingerprint keys off `Journal.CreatedDateUTC` minute clustering instead of `create_date` |
| `checks/__init__.py` (`AuditContext`, `TH`, `CheckOutcome`, `add/clean/na`) | 648 | QBO guard properties | **rewrite the guards, keep the recording API byte-compatible** (section 7) |
| `qbo_common.py` | ~650 | all | **replace** with `xero_common.py` |
| `audit_pull.py`, `checks/*.py` | ~8k | all | **rewrite** (section 6 and 8) |

`PLATFORM = {"name": "Xero", "short": "Xero", "doc_title": "Comprehensive Xero File Review", "monthly_title": "Monthly Xero Health Review", "api": "Xero Accounting API"}`. Every copied renderer reads its product wording from here. Grep gate in tests: the strings `QuickBooks`, `QBO`, `Intuit`, `realm` may not appear in any rendered Xero deliverable.

`core/PROVENANCE.json` records, per copied file, the source path, the `qbo-review-service` git commit, and the SHA-256 at copy time. Phase 5 uses it to prove the extraction is behaviour-neutral.

---

## 4. Auth and collector (`xero-collector`)

- **Grant type:** OAuth2 authorization code with PKCE (the flow `xero-mcp-server/src/login.ts` already implements in TypeScript; port the shape, not the code). Custom Connections (client credentials) were regionally restricted to AU/NZ/UK when last checked and are billed per org; **PROBE-1** confirms US availability, but the design does not depend on it.
- **Own app registration** in the Xero developer portal: "MHPE Review Engine". **Read-only scopes only:** `offline_access openid profile email accounting.settings.read accounting.contacts.read accounting.transactions.read accounting.reports.read accounting.journals.read accounting.attachments.read accounting.budgets.read`. No write scope is ever requested, so "nothing is ever written to Xero" is enforced by the token, not by discipline.
- **Token store:** `~/.xero-review/tokens.json` (mode 0600, atomic write). Separate from the MCP server's `~/.xero-mcp/tokens.json`. Xero rotates the refresh token on every refresh; two processes sharing one file would invalidate each other.
- **Roster:** `~/.xero-review/clients.json` mapping `slug -> {tenantId, tenantName, connected_on}`, populated from the `/connections` endpoint after login. `--list-clients` prints it. **Never guess a client**; the SKILL.md rule carries over verbatim.
- **Refresh-token lifetime:** Xero's published limit is 60 days of non-use (PROBE-2 confirms). A run refreshes it; a client not reviewed for 60 days needs a re-login. `xero_collector.py --check-auth` reports days since last refresh per tenant and exits non-zero past 50.
- **Pacing:** published limits are 60 calls/minute and 5,000 calls/day per tenant, 5 concurrent, 10,000/minute app-wide (PROBE-2). The executor reads the three `X-*Limit-Remaining` headers on every response, sleeps when the minute bucket is under 5, and treats HTTP 429 as "wait `Retry-After` and retry", never as "entity unavailable". One 429 recorded as a failed pull is the QBO engine's rule 8 and it applies here.
- **Header discipline:** every call carries `xero-tenant-id` explicitly. There is no "active tenant" fallback in the engine; the slug resolves to one tenant id at the top of the run and that id is stamped into `_manifest.json`.

---

## 5. Xero API engineering rules (each prevents a silently wrong number)

The Xero analogue of `AUDIT-PULL-PLAN.md` §5. Written from the SDK and spec; Phase 0 adds measured evidence beside each.

1. **Journals are paged by `offset`, not by page number.** `GET /Journals?offset=N` returns journals with `JournalNumber > N`, 100 per call (PROBE-3 confirms the 100). There is no date filter; `If-Modified-Since` filters on `CreatedDateUTC`, not `JournalDate`. Pull the whole ledger from offset 0 and window it locally. Loop until a call returns fewer than the page size; assert `JournalNumber` is strictly increasing across pages.
2. **Journals carry account ids on every line** (`JournalLine.AccountID`, `AccountCode`, `AccountName`, `AccountType`, `NetAmount`, `GrossAmount`, `TaxAmount`, `TaxType`, `TrackingCategories`) and `CreatedDateUTC`, `SourceType`, `SourceID` on the header. This is the transaction-level GL, the create-date audit trail, and the class-coverage source in one pull. Join to contacts through `SourceID` (an `InvoiceID`, `BankTransactionID`, `ManualJournalID`, and so on) against the Stage 4 entity corpus; journals themselves carry no contact.
3. **Report rows join by attribute, not by label.** `ReportCell.Attributes[]` carries `{Id: "account", Value: <AccountID>}` on account rows. Parse `Rows` recursively by `RowType` (`Header`, `Section`, `Row`, `SummaryRow`) and key account rows by the attribute id. The QBO engine's 141-of-160 label-join failure (`checks/__init__.py` comment, 2026-08-20) cannot happen here if labels are never used as keys.
4. **Comparative periods are capped per call.** The spec states `periods` is 1 to 12 for Profit and Loss and Budget Summary; the Balance Sheet parameter has no stated maximum in the spec and Xero's docs have historically capped it at 11 (PROBE-4). A 24-month window is two calls per report, with `timeframe=MONTH`. **Assert the returned column count equals the requested count** and fail loudly; never assume.
5. **Entities page at 100 by default.** Invoices, Contacts, BankTransactions, ManualJournals, Payments, CreditNotes, Overpayments and Prepayments accept `page` and `pageSize`; the spec's example is 100 and states no maximum (PROBE-5 tests `pageSize=1000`). Always pass `page`, always loop until a short page.
6. **Voided and deleted records are addressable.** `Invoice.Status` includes `VOIDED` and `DELETED`; `BankTransaction.Status` includes `DELETED` and `VOIDED`; `ManualJournal.Status` includes `DELETED`, `VOIDED`, `ARCHIVED`; `CreditNote` likewise. Whether a plain GET returns them by default is not stated in the spec (PROBE-6). Pull them **explicitly** with `Statuses=VOIDED,DELETED` (Invoices) or `where=Status=="DELETED"` so the answer never depends on a default.
7. **Archived masters may hide by default.** `Contacts` needs `includeArchived=true`; `TrackingCategories` needs `includeArchived=true`; `Accounts` has no such parameter and whether `ARCHIVED` accounts are returned by default is unverified (PROBE-7). If not, a second call with `where=Status=="ARCHIVED"`. The hidden half carries findings (QBO lesson: 13 deleted classes holding $2.08M).
8. **Aged reports are per contact.** `AgedReceivablesByContact` and `AgedPayablesByContact` require `contactId`. Do not iterate contacts to build an aging (hundreds of calls). Build the aging from open invoices (`Status==AUTHORISED`, `AmountDue>0`, `Type` ACCREC or ACCPAY, `Date<=window end`) plus unallocated `CreditNotes`, `Overpayments`, `Prepayments` (`RemainingCredit>0`). Use the per-contact report only to spot-check the top 5 balances in the tie-out.
9. **Cash basis is `paymentsOnly=true`** on Profit and Loss, Balance Sheet, Trial Balance and Journals. Do not double-pull the Journals ledger for cash basis; the cash-basis Trial Balance is one call and answers the AR/AP-residue check.
10. **`UpdatedDateUTC` moves for reasons other than edits.** Applying a payment to an invoice updates the invoice. Any "modified after lock date" test must classify the change (section 8, PER-003) before it grades.
11. **Xero enforces constraints QBO does not.** Unique account codes and names, no sub-accounts, a required narration on manual journals, no manual journals to the AR/AP system accounts. A check that can only ever return zero because Xero forbids the condition must either be dropped or recorded as PASS-by-construction with a statement saying so; it must never sit in the catalog looking like a test that ran.
12. **`Account.SystemAccount` names the special accounts.** `DEBTORS`, `CREDITORS`, `RETAINEDEARNINGS`, `HISTORICAL` (conversion balances), `ROUNDING`, `UNPAIDEXPCLM`, `TRACKINGTRANSFERS`, `BANKCURRENCYGAIN`, `REALISEDCURRENCYGAIN`, `UNREALISEDCURRENCYGAIN`, `WAGEPAYABLES`. Use these, not name matching, for control-account logic. Name matching is a fallback for user-created suspense and clearing accounts only.

---

## 6. Pull plan, six stages, dependency order

Stage numbering, `_manifest.json` schema (version 2), `_window.json`, per-key `FAILED: <reason>` logging, retry-once, and the rule that a failed pull makes dependent checks N/A with the reason all carry over unchanged from `audit_pull.py`. Call counts below are for a small client and are estimates to be replaced by Phase 0 measurements.

### Stage 0, configuration gates (about 6 calls)

| raw key | call | why first |
|---|---|---|
| `organisation` | `GET /Organisation` | `PeriodLockDate`, `EndOfYearLockDate` (two-tier lock, replaces `BookCloseDate`), `FinancialYearEndDay/Month`, `BaseCurrency`, `CountryCode`, `OrganisationEntityType` (`S_CORPORATION`, `SCORPORATIONLLC`, `CCORPORATIONLLC`, `LLC`, `SOLE_TRADER`, ... gates TAX-001), `Class` (plan tier, `PREMIUM*` implies multicurrency possible), `SalesTaxBasis`, `PaysTax`, `CreatedDateUTC` (conversion-date proxy), `IsDemoCompany` (refuse production writes when true) |
| `users` | `GET /Users` | redaction roster (`FirstName`, `LastName`, `EmailAddress`, `OrganisationRole`); PER-007 attribution |
| `tracking_categories` | `GET /TrackingCategories?includeArchived=true` | gate for the CLASS-* analogues; archived options with activity |
| `currencies` | `GET /Currencies` | multicurrency gate (HYG-091) |
| `tax_rates` | `GET /TaxRates` | TAX-006/007 vocabulary |
| `connections` | `GET /connections` | confirms the tenant id matches the roster; refuse to run if not |

### Stage 1, master data (about 8 to 15 calls)

`accounts` (plus archived pass if PROBE-7 says needed), `contacts` (`includeArchived=true`, paged; a single Contacts entity carries `IsSupplier`/`IsCustomer`, so "vendors" and "customers" are views, not separate pulls), `items`, `repeating_invoices` (`GET /RepeatingInvoices`, both ACCREC and ACCPAY templates), `budgets_index` (`GET /Budgets`, no detail), `employees` (`GET /Employees`, Accounting-scope employee list; expected empty or sparse on US orgs, pulled so the redactor and HYG-010 can say so rather than assume).

### Stage 2, gating probes (about 3 to 8 calls)

| key | call | gates |
|---|---|---|
| `budgets` | `GET /Budgets/{id}?DateFrom&DateTo` per budget in the index, window-bounded | every BUDGET check. Xero orgs carry an `OVERALL` budget object even when empty (PROBE-8), so BUDGET-001 tests for non-zero lines in the window, not existence |
| `linked_transactions` | `GET /LinkedTransactions?page=N` (all statuses) | REV-001 billable expenses: `Status` in `DRAFT`, `ONDRAFT`, `APPROVED` and not `BILLED` or `VOIDED` is unbilled; `SourceTransactionTypeCode` is `ACCPAY` or `SPEND` |
| conversion cliff | computed over Stage 3 `CreatedDateUTC` by month | PER-004 back-dating, PER-008 cadence; same 50% rule as the QBO `conversion_cliff` guard |
| bulk-touch | computed over Stage 4 `UpdatedDateUTC` by day | PER-003 so a mass re-code is one finding, not 370 |

Attachments need no join pull: `HasAttachments` is a field on Invoice, BankTransaction, ManualJournal, CreditNote, RepeatingInvoice, Account and Contact. DOC checks read the flag. This removes the QBO engine's Attachable join and its pre-signed-URL security hazard entirely.

### Stage 3, bulk corpus, the ledger (roughly 50 to 300 calls)

`journals`: `GET /Journals?offset=N` from 0 until a short page, accrual basis. Persist parsed, windowed to `[start, end]` by `JournalDate`, but keep a `journals_prewindow_summary` (count and date span of journals before the window) so PER-006 and the conversion-date logic can reason about history without storing it. Assert debits equal credits per journal to the penny (`sum(NetAmount) == 0`); a journal that does not balance is recorded as an engine anomaly, never silently included.

This single pull replaces QBO's `TransactionList`, `GeneralLedger` and `TransactionListWithSplits` and their monthly chunking. There is no cell cap to defend against; the risk is the opposite, a whole-history pull on a large org. Record the journal count and elapsed time in the manifest.

### Stage 4, entity scan, window-bounded (roughly 20 to 60 calls)

Each with `where=Date>=DateTime(y,m,d)&&Date<=DateTime(y,m,d)` (Xero filter syntax), paged, plus an explicit voided/deleted pass per rule 6:

`invoices` (ACCREC and ACCPAY: `InvoiceNumber`, `Reference`, `DueDate`, `AmountDue`, `AmountPaid`, `FullyPaidOnDate`, `SentToContact`, `HasAttachments`, `RepeatingInvoiceID`, `UpdatedDateUTC`, `LineItems[]` with `AccountCode`, `TaxType`, `TaxAmount`, `Taxability`, `Tracking`), `credit_notes`, `payments` (`IsReconciled`, `Account`, `Status`), `bank_transactions` (`Type` SPEND/RECEIVE and the overpayment, prepayment and transfer variants, `IsReconciled`, `HasAttachments`, `BankAccount`, `Contact`, `LineItems`), `bank_transfers` (`FromIsReconciled`, `ToIsReconciled`, `CreatedDateUTC`), `manual_journals` (`Narration`, `Status`, `ShowOnCashBasisReports`, `HasAttachments`, lines), `overpayments`, `prepayments`, `purchase_orders` (optional, INFO only).

Plus, **after** the PER-003 candidate set is known: `history_<entity>_<id>` via `GET /Invoices/{id}/History` (and the BankTransactions, ManualJournals, CreditNotes equivalents) for at most `TH["history_sample_cap"]` (default 200) candidates. `HistoryRecord` carries `Changes`, `DateUTC`, `User`, `Details`. This is the bounded audit trail; the cap is stated in the scope note.

### Stage 5, period reports and tie-outs (about 15 calls)

`pl_24mo` (2 × ProfitAndLoss, `timeframe=MONTH`, `periods` per rule 4), `pl_cash_24mo` (same, `paymentsOnly=true`), `bs_24mo` (2 × BalanceSheet monthly), `bs_end`, `bs_cash_end`, `trial_balance` (window end), `trial_balance_cash` (`paymentsOnly=true`), `bank_summary` (`fromDate`, `toDate`), `executive_summary`, `budget_summary` (gated on Stage 2), `pl_by_tracking` (`trackingCategoryID`, gated on Stage 0 categories existing; three outcomes: off, on, unknown, exactly as the QBO `gated()` helper), `ten_ninety_nine` (`GET /Reports/TenNinetyNine?reportYear=YYYY` for each calendar year in the window; US orgs only, gated on `CountryCode=="US"`), `aged_spotcheck_ar` and `aged_spotcheck_ap` (per-contact aged reports for the top 5 balances each, rule 8).

**Total: roughly 100 to 400 calls per client**, well inside a 5,000/day tenant allowance if the published limit holds. At 60/minute that is 2 to 7 minutes, dominated by Journals.

---

## 7. `XeroAuditContext` contract

Keep `add()`, `clean()`, `na()`, `record_outcome()`, `reported()`, the `SEVERITIES` tuple, `CheckOutcome`, `InputProvenance`, `TH` merge order (catalog defaults, then `clients/<slug>/reviews/thresholds.json`, then command line, with the TH-000 INFO finding when overrides are in force), identity length limit of 3, duplicate-fingerprint refusal, and audience routing **byte-for-byte compatible** with `checks/__init__.py`. The deliverables layer depends on that finding shape and is being copied unchanged.

Replace the QBO guards with Xero ones:

| QBO guard | Xero replacement |
|---|---|
| `book_close_date` | `period_lock_date`, `end_of_year_lock_date` (both may be None) |
| `class_tracking_on` | `tracking_on`: any `TrackingCategory` with status ACTIVE; `tracking_categories`: the list |
| `departments_on` | dropped (no Xero concept) |
| `sales_tax_on` | `sales_tax_on`: `Organisation.PaysTax` and any non-`NONE` tax rate in use |
| `multicurrency_on` | `multicurrency_on`: more than one currency in `/Currencies` |
| `txns`, `posting_txns` (the inverted `is_no_post` trap) | `journals` (every journal is posting by definition; the trap does not exist), `journal_lines` (flattened, each carrying its header's `JournalDate`, `CreatedDateUTC`, `SourceType`, `SourceID`, `JournalNumber`) |
| `gl`, `splits` | both are `journal_lines` |
| `bank_accounts()` | accounts with `Type==BANK`; `BankAccountType` distinguishes `BANK`, `CREDITCARD`, `PAYPAL` |
| `conversion_cliff` | same algorithm over `CreatedDateUTC` |
| `acct_by_id`, `_acct_label_index`, `resolve_account()` | `acct_by_id` keyed by `AccountID`, `acct_by_code`; label resolution exists only for report rows lacking an attribute id and is expected to be rare (assert and count) |
| `children_of` | dropped (flat chart) |
| new | `system_account(kind)`: the account carrying `SystemAccount==kind`; `entity_by_source_id`: Stage 4 records keyed by GUID for journal joins; `contacts_as_vendors`, `contacts_as_customers` views; `voided_deleted`: the explicit Stage 4 pass; `lock_dates_known`: False when Stage 0 failed, so lock-date checks report N/A rather than "no lock" |

Thresholds: keep every QBO key that still has a consumer, add `history_sample_cap` 200 and `unsent_invoice_days` 30 (REV-008). Remove keys whose check is dropped only at the end of Phase 3, so `thresholds.json` files never reference an unknown key mid-build.

---

## 8. Check catalog mapping

Status vocabulary: **DIRECT** (same logic, new source), **ADAPTED** (logic changes because Xero's model differs), **NEW** (Xero-native, no QBO counterpart), **DROP** (Xero makes the condition impossible; removed from the catalog, listed in the scope note's "not applicable on Xero" paragraph), **N/A-PERM** (kept in the catalog, always reports N/A with the stated reason so the gap stays visible).

Severity ladders, materiality scaling (`_grade` in `rec.py`), "confirm" wording on judgment checks, category mode above 25 items, and the rule that every check ends in a finding, a PASS or an N/A all carry over.

### REC, Reconciliation (headline section)

Xero has no reconciled-through date and no discrepancy account. Reconciliation is per line: `BankTransaction.IsReconciled`, `Payment.IsReconciled`, `BankTransfer.FromIsReconciled`/`ToIsReconciled`. Derive "last reconciled date" per bank account as the max `Date` of reconciled items, with the same 45-day outstanding grace and the same caveat text.

| Check | Status | Xero source and notes |
|---|---|---|
| REC-001 stale bank reconciliation | ADAPTED | max reconciled `Date` per BANK account vs window end; `recon_stale_months` |
| REC-002 uncleared items inside a reconciled period | ADAPTED | unreconciled items dated more than 45 days before that account's last reconciled date |
| REC-003 stale uncleared items | DIRECT | `IsReconciled==false`, older than 90 days |
| REC-004 discrepancy account balance | DROP | Xero writes no discrepancy account. The bank-statement side (statement balance, unreconciled statement lines) is **not exposed by the Accounting API**; this goes in the scope note as the single largest thing the review cannot see |
| REC-005 bank account never reconciled | DIRECT | no reconciled item in window, activity or balance present |
| REC-006 archived account with reconciled history | DIRECT | `Account.Status==ARCHIVED` |
| REC-007 duplicate discrepancy accounts | DROP | same reason as REC-004 |
| REC-008 check-number sequence | ADAPTED, PROBE-9 | US Xero checks: whether the check number surfaces on `BankTransaction.Reference`; N/A with reason if not |
| REC-009 half-reconciled bank transfers | NEW | `FromIsReconciled xor ToIsReconciled`; one finding per transfer, identity `[BankTransferID]` |
| REC-010 payments coded to non-bank accounts | NEW | `Payment.Account.Type != BANK` where the account has `EnablePaymentsToAccount==true`; a payment that never touched a bank cannot be reconciled |

### PER, Period integrity and audit trail

| Check | Status | Xero source and notes |
|---|---|---|
| PER-001 closing date is set | DIRECT | both lock dates; CRITICAL when neither is set |
| PER-002 closing date currency | DIRECT | the later of the two vs window end |
| PER-003 post-close modifications | ADAPTED, **Opus** | two-step: candidates are Stage 4 records with `Date <= lock` and `UpdatedDateUTC > lock`; classify via History (`Changes` values such as Edited, Voided, Approved, payment applied) up to `history_sample_cap`; grade only edits and voids; payments applied are excluded; state the sample cap. The classification rule set needs judgment and live examples, hence Opus |
| PER-004 material back-dating | DIRECT | `CreatedDateUTC` minus `JournalDate` > `backdate_days`, gated by the conversion cliff |
| PER-005 future-dated transactions | DIRECT | any Stage 4 record or journal dated after run date |
| PER-006 transactions before company start | ADAPTED | Xero has no start date; use the `HISTORICAL` system-account conversion journals' date as the conversion date, else `Organisation.CreatedDateUTC`; INFO when neither is decisive |
| PER-007 user attribution | ADAPTED, internal-only | `HistoryRecord.User` on the sampled candidates only; states the sample |
| PER-008 bookkeeping cadence | DIRECT | `CreatedDateUTC` vs `JournalDate` lag distribution by month |
| R58 invoice number sequence gaps | DIRECT | `InvoiceNumber`; gaps that match a VOIDED or DELETED invoice are auto-explained and reported as INFO, the rest stay WATCH |
| PER-009 voided and deleted transactions | NEW | counts and gross amounts by type and month from the explicit Stage 4 pass; no 30-day cap. WATCH above materiality, INFO otherwise; identity `[entity type, month]` |

### CODE, General ledger coding review

| Check | Status | Notes |
|---|---|---|
| CODE-001 vendor coding consistency | ADAPTED | journals joined to contact via `SourceID`; same dominance thresholds |
| CODE-002 parent-account postings | DROP | flat chart |
| CODE-003 journal entries to control accounts | ADAPTED | Xero blocks manual journals to `DEBTORS`/`CREDITORS`; implement anyway, expect PASS-by-construction and say so in the statement; also test manual journals to BANK accounts |
| CODE-004 round-dollar journal entries | DIRECT | `ManualJournals` |
| CODE-005 undocumented journal entries | ADAPTED | narration is required, so test for placeholder narrations (under 6 characters, or matching `/^(adj|je|journal|entry|misc)/i`) and `HasAttachments==false` above materiality |
| CODE-006 suspense account activity | ADAPTED | `SystemAccount==HISTORICAL` non-zero after the conversion month, plus name-match `/suspense|clearing|uncategori|ask my accountant/i` |
| CODE-007 duplicate postings | DIRECT | same account, date, amount, `SourceType` in journals; and same bank account, contact, amount within `dup_window_days` in bank transactions |
| CODE-008 bank transactions coded to balance-sheet accounts | NEW | SPEND/RECEIVE lines to `Class` ASSET/LIABILITY/EQUITY accounts other than transfers and loan accounts; WATCH, "confirm" wording |

### STRUCT, Chart of accounts

| Check | Status | Notes |
|---|---|---|
| STRUCT-000 chart overview | DIRECT | counts by `Class`, `Type`, `Status` |
| STRUCT-001 duplicate account names | ADAPTED | Xero enforces exact uniqueness; test normalized collisions ("Meals & Entertainment" vs "Meals and Entertainment") |
| STRUCT-002 confirm classification | DIRECT | name vs `Type`/`Class` |
| STRUCT-003 activity not attributable | ADAPTED | assertion: every `JournalLine.AccountID` resolves in the chart including archived; failure is an engine anomaly |
| STRUCT-004 account-number coverage | DROP | `Code` is required |
| STRUCT-005 sub-account parent problems | DROP | flat chart |
| STRUCT-006 duplicate account numbers | DROP | enforced |
| STRUCT-007 archived accounts with non-zero balance | ADAPTED | balance from trial balance by `AccountID`; Xero may prevent this (PROBE-10) |
| STRUCT-008 dormant active accounts | NEW | ACTIVE, zero balance, no journal line in window (`dormant_account_txns`) |
| STRUCT-009 payments enabled on non-bank accounts | NEW | `EnablePaymentsToAccount==true` on non-BANK accounts; INFO, becomes WATCH if REC-010 fires |

### DUP, Duplicate master records

Xero has one `Contact` entity with `IsSupplier` and `IsCustomer` flags. A party on both sides is normal and is one record.

| Check | Status | Notes |
|---|---|---|
| DUP-001 duplicate vendors | DIRECT | `IsSupplier` view, normalized `Name` |
| DUP-002 duplicate customers | DIRECT | `IsCustomer` view |
| DUP-003 near-duplicate party names | DIRECT | same tokenizer |
| DUP-004 party is both customer and vendor | ADAPTED | fires only when one contact carries both `Balances.AccountsReceivable.Outstanding` and `Balances.AccountsPayable.Outstanding` above zero (netting conversation); INFO otherwise |
| DUP-005 identity-field fill rates | DIRECT | `TaxNumber`, `EmailAddress`, `AccountNumber`, `Addresses` |
| DUP-006 merged contacts | NEW, INFO | `MergedToContactID` set; evidence that cleanup has happened; never scores |

### DOC, Source document coverage

| Check | Status | Notes |
|---|---|---|
| DOC-001 unsupported disbursements | DIRECT | SPEND bank transactions and ACCPAY invoices at or above `documentation_threshold` with `HasAttachments==false` |
| DOC-001B rate | DIRECT | |
| DOC-002 unmatched captured receipts | N/A-PERM | Xero Files inbox needs the `files` scope; stated as out of scope |
| DOC-003 no audit trail | ADAPTED | History is available per record; the check becomes "history sampled, cap stated" and is INFO |
| DOC-004 attachment coverage | DIRECT | by type and month |

### ARAP, Receivables, payables, tie-outs

| Check | Status | Notes |
|---|---|---|
| TIE-001 control account ties to subledger | ADAPTED | `bs_end` DEBTORS/CREDITORS rows (by attribute id) vs built aging vs `trial_balance`; three-way |
| TIE-002 negative aged buckets | ADAPTED | negative `AmountDue` cannot exist; test unallocated credits instead (feeds R56) |
| TIE-003 control-account sign | DIRECT | |
| AR-001 non-invoice items open in AR | ADAPTED | unallocated `CreditNotes`, `Overpayments`, `Prepayments` with `RemainingCredit>0` |
| AR-002 past-due receivables | DIRECT | `DueDate`, `AmountDue`; cross-check `Contact.Balances.AccountsReceivable.Overdue` |
| AR-003 receivable concentration | DIRECT | |
| AP-001 payables more than 90 days past due | DIRECT | ACCPAY |
| AP-002 near-term payables due | DIRECT | |
| AP-003 AP relief | DIRECT | ACCPAY invoices AUTHORISED vs PAID over the window |
| BS-cash-001 cash-basis AR/AP residue | DIRECT | `trial_balance_cash` DEBTORS/CREDITORS non-zero |
| R56 unapplied payments and vendor credits | DIRECT | Xero payments are always applied; the population is unallocated credits, overpayments, prepayments on both sides |

### REV, Revenue and billing leakage

| Check | Status | Notes |
|---|---|---|
| REV-001 billable job costs never invoiced | ADAPTED | `LinkedTransactions` not BILLED/VOIDED, joined to source SPEND/ACCPAY for amount and age; N/A with reason when the org has no linked transactions at all |
| REV-002, REV-002B, REV-002C unbilled time | N/A-PERM | Xero Projects is a separate API and scope |
| REV-003 revenue deposited outside the AR cycle | DIRECT | RECEIVE bank transactions with lines to `Class==REVENUE` vs invoice payments, by month |
| REV-003B sales receipts to operating income | merged into REV-003 | Xero has no sales-receipt object |
| REV-004 zero-dollar invoices | DIRECT | |
| REV-004B duplicate invoices | DIRECT | same contact, total, within `dup_window_days` |
| REV-004C zero-dollar conversion batch | DIRECT | `CreatedDateUTC` clustering |
| REV-005 invoice number gaps | DIRECT | shares R58's population; keep one of the two (decision: keep R58 in PER, make REV-005 the customer-facing count) |
| REV-006 revenue concentration | DIRECT | |
| REV-007 items mapped to uncategorized income | ADAPTED | `Item.SalesDetails.AccountCode` resolving to a non-REVENUE or suspense account |
| REV-008 authorised invoices never sent | NEW | `SentToContact==false`, `Status==AUTHORISED`, older than `unsent_invoice_days`; WATCH |
| REV-009 stale repeating invoice templates | NEW (replaces CTRL-003) | `RepeatingInvoice.Status==AUTHORISED` with `Schedule.NextScheduledDate` in the past, or no generated invoice carrying its `RepeatingInvoiceID` in the last two periods |

### HYG, Master data hygiene

| Check | Status | Notes |
|---|---|---|
| HYG-001 terminated employees active | N/A-PERM | no US payroll in Xero; future option: Gusto connector roster (out of scope here) |
| HYG-002 duplicate employee records | N/A-PERM | same |
| HYG-003 inventory asset with no subledger | DIRECT | `Item.IsTrackedAsInventory`, `TotalCostPool`; inventory asset account from `Item.InventoryAssetAccountCode` |
| HYG-004 inventory subledger tie-out | DIRECT | sum `TotalCostPool` vs account balance |
| HYG-005 1099 vendors with no tax ID | ADAPTED | `ten_ninety_nine` report rows joined to `Contact.TaxNumber` |
| HYG-006 duplicate payment terms | DROP | terms are per-contact fields, no master list |
| HYG-007 bills and invoices posted with no term | ADAPTED | `DueDate` null or equal to `Date` |
| HYG-008 dormant customer records still active | DIRECT | ACTIVE, `IsCustomer`, no invoice or journal in window, zero balances |
| HYG-009 1099 review queue | ADAPTED | Xero's own report is the primary population; independently rebuild calendar-year cash paid per contact from Payments (ACCPAY) plus SPEND bank transactions and report disagreements; still a review queue, never a list of errors; "Draft for licensed review" |
| HYG-010 vendor normalizes to employee | N/A-PERM | needs a payroll roster |
| HYG-090 item master consistency | DIRECT | |
| HYG-091 multicurrency master data | DIRECT | `Contact.DefaultCurrency` vs `BaseCurrency`, gated on `multicurrency_on` |
| R57 same party on both masters | merged into DUP-004 | one contact record in Xero |

### BUDGET

All six DIRECT, built by hand from `Budget.BudgetLines[].BudgetBalances[]` (`Period`, `Amount`) joined to `pl_24mo` by `AccountID`, never from the `BudgetSummary` report (QBO lesson: the packaged variance report was wrong; the same discipline costs nothing here). `Budget.Type` `TRACKING` budgets are reported by tracking option. BUDGET-001 tests for any non-zero line in the window (PROBE-8).

### TREND, 24-month statement trend and tracking coverage

| Check | Status | Notes |
|---|---|---|
| TREND-001 retained earnings moved inside a closed year | ADAPTED | `RETAINEDEARNINGS` system account; journals dated in a prior financial year with `CreatedDateUTC` after `EndOfYearLockDate`, plus `bs_24mo` roll |
| TREND-002 balance-sheet volatility | DIRECT | |
| TREND-003 chart churn | ADAPTED | `Account.UpdatedDateUTC` and archived counts by month |
| TREND-004, TREND-005 missing months | DIRECT | |
| TREND-006 credit balance | DIRECT | |
| TREND-007 gross margin swings | DIRECT | `DIRECTCOSTS` type is Xero's COGS |
| TREND-008 payroll stopped | DIRECT | wage accounts by name match plus `SystemAccount==WAGEPAYABLES`; Gusto posts into Xero as journals, so the P&L view still works |
| CLASS-001 tracking on but lines untracked | ADAPTED | `JournalLine.TrackingCategories` empty while `tracking_on` |
| CLASS-002 archived tracking option with activity | ADAPTED | |
| CLASS-003 tracking coverage by month | ADAPTED | |
| R59 Benford screen | DIRECT | journal `NetAmount` at or above $100 |
| R60 vendor spend anomaly | DIRECT | SPEND plus ACCPAY by contact by month |

### TAX, entity-aware tax exposure (US)

| Check | Status | Notes |
|---|---|---|
| TAX-001 S-corp reasonable compensation | DIRECT | gate on `OrganisationEntityType` in `S_CORPORATION`, `SCORPORATIONLLC`; wage accounts vs distributions (EQUITY drawings) |
| TAX-006 taxable lines with zero tax | DIRECT | `LineItem.Taxability==TAXABLE` (or a taxable `TaxType`) with `TaxAmount==0`; review queue wording |
| TAX-007 registered-jurisdiction exposure | ADAPTED | `Organisation.Addresses`, tax rates in use, liability accounts by name |
| R61 Ketchikan sales tax roll-forward | DIRECT | liability accounts `/ketchikan|kgb/i`, rolled from journals, tied to `trial_balance` |
| R61B Washington B&O presence | DIRECT | |
| R63 1099 readiness, TAX-1099 filing readiness | ADAPTED | Xero `TenNinetyNine` report per calendar year plus HYG-009 rebuild; "Draft for licensed review" on every line |

### Scope note paragraph (goes on every deliverable, verbatim once finalised)

The review reads the transaction-level general ledger with the date each entry was created, the reconciliation status of every bank transaction and payment, voided and deleted records across the full window, per-record change history for a stated sample, and lock dates. It does **not** see bank statement balances or unreconciled bank-feed lines, payroll detail, time tracking, or the Xero Files inbox. It is not a reconciliation, review or audit engagement under professional standards and no opinion or assurance is expressed.

---

## 9. Deliverables

Unchanged in shape: bookkeeper remediation report (HTML and PDF, four phases from `deliverables.PHASES`, names allowed), management one-pager (no score, no names, no advisory narrative, findings about *the file*), Excel workbook (Summary plus one tab per populated section, Done and Notes columns). `D.public_text()` remains the only path to client-facing text.

Changes:

- `xero_paths.py`: `{check_id: [step, step, ...]}` Xero UI click paths. Sonnet drafts from Xero's navigation (Accounting, Business, Contacts menus); **partner verifies every path against a live org before first release**, and unverified paths render as "Path to be confirmed" rather than a guess.
- Delete the CDC 30-day deletion paragraph; add the History sample-cap sentence and the bank-statement gap sentence.
- `SECTION_TITLES`, `EFFORT_MIN_PER_ITEM`, and `PHASES` keep their keys; CTRL is not a Xero section (its one surviving check moved to REV-009).

---

## 10. Adjudication, delta, bid

- `adjudications.json` per client, same three verdicts, same `last_seen` staleness rule. Identity values are Xero GUIDs (`AccountID`, `ContactID`, `InvoiceID`, `BankTransferID`) or fixed literals for population checks, so fingerprints are stable across runs by construction.
- `audit_delta.py` unchanged. Engine-added checks (the NEW rows above) are separated from genuine new defects on a re-review exactly as now.
- `bid.py` unchanged apart from the automation-share signal (section 3.2).

---

## 11. Skill packaging: `mhpe-xero-audit`

Mirror `mhpe-qbo-audit`'s `SKILL.md` section for section (engine location, use-this-or-monthly table, inputs and the never-guess-a-client rule, vocabulary, zero-context path, the command, stages, sections, deliverables, delta, bid, facts and standing rules, run report skeleton, adjudication, partner gate). Description triggers add "Xero" to every phrase. Delivered as an installable `.skill` zip with `SKILL.md` at the root, docs only, no executable code in the skill.

The three standing rules (no score on any deliverable, no individual named in the one-pager, nothing to a client without partner review) carry over unchanged.

---

## 12. Testing and pilots

- **Fixture:** Xero's **Demo Company (US)** is a real tenant with sample data that every Xero login can connect (it resets on a cycle, so snapshot it). Phase 0 connects it, Phase 1 pulls it into `fixtures/demo-company-us/raw/` and it becomes the deterministic `--offline` fixture for every test, with the slug added to `FIXTURE_SLUGS`. No client data enters the test tree.
- **Regression contract:** port the platform-neutral test files' *patterns* (redaction, deliverable name-audience, workbook round trip, check-outcome contract, coverage gate, fingerprint identity, source provenance). Target the same 41-file discipline, not the same count.
- **Tie-out gates before any check ships:** P&L net income for each month equals the movement in current-year earnings on the monthly balance sheet; trial balance debits equal credits; journals summed by `AccountID` over the window equal the trial-balance movement to the penny. A pull that fails these refuses to score.
- **Pilots:** the two US Xero clients. Before the first run on either, confirm IRC 7216 consent covers this use (it is the same engagement's own data, but confirm, do not assume). Whichever file is messier is the primary pilot; the cleaner one is the control that must degrade gracefully and not manufacture findings.
- **Brand safety test:** no `QuickBooks`, `QBO`, `Intuit`, `realm` in any rendered artifact; no `Arrow Financial` anywhere.

---

## 13. Build phases, model assignment, acceptance

Sizing is stated relative to the QBO engine's measured code, not in hours. Build phases in order; each ends with a hand-off artifact the next phase reads.

### Phase 0, capability sweep and collector (Opus recommended for the interpretation; Sonnet can execute the calls)

Build `xero-collector` (section 4). Connect the Demo Company (US) and, with consent confirmed, both client tenants. Run the probe list in section 14 as read-only calls and record evidence beside each. Write `XERO-PULL-PLAN.md` in the style of `AUDIT-PULL-PLAN.md`: observed page sizes, period caps, default-status behaviour, journal counts and elapsed time, rate-limit headers seen.

Acceptance: every PROBE row in section 14 has a verdict and quoted evidence; `--list-clients` and `--check-auth` work; no write scope in the granted token (print the scope list).

### Phase 1, pull layer and `xero_common.py` (Sonnet)

Stages 0 to 5, `_manifest.json` v2 with `platform: xero`, `ReportWithRows` parser keyed by attribute id, Journals pager, explicit voided/deleted pass, paced executor. Copy the neutral modules into `core/` with `PROVENANCE.json`.

Acceptance: the three tie-out gates in section 12 pass on the Demo Company fixture; `--offline` re-run is byte-identical; a deliberately failed pull produces `FAILED:` in the log and the dependent checks report N/A in a smoke run of the coverage gate.

### Phase 2, context and the four highest-value sections (Sonnet; PER-003 rules by Opus)

`XeroAuditContext` (section 7), then REC, PER, ARAP, CODE. Coverage gate live: every declared check answers.

Acceptance: run on the fixture and on the messy pilot; every CRITICAL verified by hand against `raw/`; the run report skeleton from `SKILL.md` prints; adjudication settle and suppression work end to end on one finding.

### Phase 3, remaining sections (Sonnet)

STRUCT, DUP, DOC, REV, HYG, BUDGET, TREND, TAX. Finalise the declared-check count and the scope-note paragraph. Remove orphaned `TH` keys.

Acceptance: both pilots run clean of console anomalies; the clean control produces mostly PASS findings and no manufactured CRITICAL.

### Phase 4, deliverables, skill, tests (Sonnet)

Parametrize the three renderers, write `xero_paths.py`, produce all three deliverables for the pilot, package `mhpe-xero-audit.skill`, land the test suite.

Acceptance: brand-safety and name-audience tests pass; partner reviews the pilot deliverables (this is the gate, nothing is sent); delta report runs between two pilot runs.

### Phase 5, shared core extraction (Opus recommended)

Move `core/` into `~/Claude/platform/review-core/`, repoint both engines. Prove behaviour-neutral the same way the 2026-07-25 `qbo_common` extraction was proved: `--offline` re-runs of the existing QBO client runs produce byte-identical `findings.json`, scores and pull logs. This is the only phase that touches the production QBO engine.

### Phase 6, optional, Xero monthly diagnostic (Sonnet)

`xero_diagnostic.py` mirroring `diagnostic.py` and `monthly-run.md`. Not designed here; the pull layer and context from Phases 1 and 2 are sufficient inputs.

---

## 14. PROBE list (Phase 0 resolves; the design does not depend on any answer)

| # | Question | Design consequence |
|---|---|---|
| 1 | Are Custom Connections available for US organisations, and at what cost? | None; auth-code is the default either way |
| 2 | Confirm published limits: 60/min and 5,000/day per tenant, 5 concurrent, 10,000/min app-wide; refresh token 60-day non-use expiry | Pacing constants and the `--check-auth` threshold |
| 3 | Journals page size (expected 100) and whole-history count and time for each tenant | Stage 3 estimate |
| 4 | Balance Sheet `periods` maximum (expected 11) | Chunk size for `bs_24mo` |
| 5 | Does `pageSize=1000` work on Invoices, Contacts, BankTransactions, ManualJournals, Payments? | Stage 4 call count |
| 6 | Are VOIDED and DELETED records returned by a plain GET, or only with `Statuses`/`where`? | Whether the explicit pass is additive or the only source |
| 7 | Does GET Accounts return ARCHIVED accounts by default? | Whether Stage 1 needs the second Accounts call |
| 8 | Does an org always carry an OVERALL budget object, and what does an empty one look like? | BUDGET-001 predicate |
| 9 | Do US Xero checks surface a check number on `BankTransaction.Reference`? | REC-008 alive or N/A |
| 10 | Can an account with a non-zero balance be archived? | STRUCT-007 alive or PASS-by-construction |
| 11 | When an approved invoice is edited in the UI (Demo Company), does the Journals endpoint mutate the journal in place, or post a reversal and a new journal? | PER-003 has a second, journal-side signal if reversals are posted |

---

## 15. Assumptions register

- Both current Xero clients are US-domiciled and will remain the only Xero clients through the pilot (Scott, this session).
- The QBO engine at `~/qbo-review-service` as inspected 2026-09-03 is the current production version; `PROVENANCE.json` pins whatever commit is current when Phase 1 copies.
- Sonnet has file access to `~/Claude/platform/qbo-review-service` when executing Phases 1 to 4; this spec references its files by path rather than reproducing them.
- No figure in this document is a client figure. Every count is either measured from the QBO source tree, read from the SDK or OpenAPI spec, or marked as an estimate to be replaced by Phase 0 measurement.

---

## 16. Decisions, settled 2026-09-03 (Scott Edwards)

Design is settled; only execution remains. Nothing in sections 0 to 15 is open.

1. **Repository home: new private repo** `scotchua/xero-review-service`, cloned to `~/Claude/platform/xero-review-service`, same visibility as `qbo-review-service`. `xero-collector` is a directory inside it, not a third repo, unless Phase 0 finds a reason to share it with another consumer.
2. **Fixture: Demo Company (US) snapshot first.** Phase 1 freezes it under `fixtures/demo-company-us/` and adds the slug to `FIXTURE_SLUGS`. An anonymised pilot fixture generated through `anonymize_run.py` is a Phase 4 deliverable, not earlier.
3. **Phase 5 timing: leave until forced.** The copied `core/` modules stay in place with `PROVENANCE.json`. Extraction happens only when a third platform arrives or a QBO engine change has to be mirrored into the Xero copy. Until then, any bug fix to a copied module is applied in both places and noted in `PROVENANCE.json`.
