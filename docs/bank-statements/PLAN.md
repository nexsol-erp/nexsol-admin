# Bank statement ingestion and the daily transaction report — plan

Two outcomes, and both are required:

1. **The daily-tab Excel report** — one tab per date, both banks combined, four columns.
   This is what was asked for and it is not deferred behind the rest.
2. **Persisted statement lines in the ERP**, so the report is a query rather than a PDF
   parse, and so reconciliation against the general ledger becomes possible later.

Everything below was checked against the pilot tenant (`9446968394a`).

---

## The ERP already has half of this, unused

| table | rows | what it is |
|---|---|---|
| `bank_statement` | **0** | statement lines: `ledger_account_id`, `statement_date`, `description`, `debit_amount`, `credit_amount`, `reference_number`, `is_reconciled` |
| `bank_reconciliation` | **0** | one statement line ↔ one `ledger_transaction`, unique on both sides |
| `ledger_account` | 30 | carries `is_bank`, `bank_name`, `bank_account_number`, `bank_ifsc`, `bank_branch` |
| `ledger_transaction` | 320,322 | the general ledger, real and populated |

So the shape was designed and never filled. **This is an extension, not a new subsystem** —
which also means the reconciliation payoff is closer than it looks.

Five accounts are flagged `is_bank`, but they are placeholders: one is literally named
`Bank Account`, and none has a bank name, account number or IFSC. The real ICICI and Axis
accounts have to be set up before anything can be imported against them.

---

## What has to be added

`bank_statement` as it stands cannot support the requirement. Four gaps:

**No uniqueness of any kind.** There is no constraint stopping the same PDF being imported
twice and doubling every row. Given the report is meant to be run repeatedly, this is the
first thing to fix, not the last.

**No provenance.** Nothing records which file a line came from, when, or by whom. When a
figure is questioned six months from now, the answer has to be traceable to a statement.

**`description` is raw narration only.** The report needs the *resolved* party — `SP Wave`,
not `NEFT/HSBCN.../SPWAVE PRIVATE LIMITED/HSBC BANK//ACC/...`. There is nowhere to put it,
and no way to tell a resolved name from a guess.

**No value date and no category.** Only `statement_date`. POS, self transfer, bank charges
and bank GST all need to be identifiable without re-reading the narration.

### Proposed additions

```sql
ALTER TABLE bank_statement
  ADD COLUMN value_date           date,
  ADD COLUMN counterparty         varchar(200),   -- the resolved Party / Comment
  ADD COLUMN counterparty_source  varchar(20),    -- RULE | MANUAL | UNRESOLVED
  ADD COLUMN txn_category         varchar(30),    -- POS | SELF_TRANSFER | BANK_CHARGES |
                                                  -- BANK_GST | NEFT | RTGS | IMPS |
                                                  -- CASH_DEPOSIT | OTHER
  ADD COLUMN self_transfer_ref    varchar(64),    -- the UTR that pairs the two sides
  ADD COLUMN import_batch_id      varchar(36),
  ADD COLUMN dedup_key            varchar(200);

CREATE UNIQUE INDEX ux_bank_statement_dedup
  ON bank_statement (company_id, ledger_account_id, dedup_key);
```

`counterparty_source` earns its place: it is what lets the report print
`Party Not Identified` honestly instead of a plausible-looking guess, and it makes
"how many lines still need a human?" a query.

**`bank_statement_import`** — one row per uploaded file: source filename, SHA-256 of the
bytes, the account it was imported against, the period the file actually covers, row count,
opening and closing balance as printed, who imported it and when, and a status. The hash is
what makes re-uploading the same file a no-op rather than a duplication.

**`bank_narration_rule`** — pattern → counterparty and category, per bank, with a priority
and an active flag. This is the important one: *`SPWAVE` → `SP Wave` should be a row an
accountant can add, not a code change*. Every new vendor otherwise becomes an engineering
ticket, and the report degrades quietly the moment nobody has time for one.

---

## Rules that carry the weight

**Derive the date range from the transactions, never the filename.** The sample ICICI file
is named for 31 August and contains 29, 30 and 31 August. Reading the filename silently
drops two days.

**Self transfers are deterministic.** The two RTGS movements between the company's own ICICI
and Axis accounts appear as a credit in one statement and a debit in the other, carrying the
**same UTR** in both narrations. Pair on that reference and store it in `self_transfer_ref`.
Matching on account *name* is a heuristic that fails the first time a counterparty is
similarly named. Keep the list of own accounts in `ledger_account.bank_account_number` —
that is what the column is for.

**The two formats share almost nothing.** ICICI gives Transaction ID, Value Date, Txn Posted
Date, Description and a `CR`/`DR` column; Axis gives Transaction Date, Value Date,
Transaction Particulars, Amount, Transaction Type, Balance and Branch Name. In the ICICI text
layer, balances wrap across lines and amount sits adjacent to balance, so line-splitting
attaches the wrong number to a row. **Column-aware extraction, not line splitting.**

**Narration shapes**, since the party sits in a different position in each:

```
RTGS/<ref>/<IFSC>/<PARTY>
INF/NEFT/<ref>/<IFSC>/<PARTY>
NEFT/<ref>/<PARTY>/<BANK>//ACC/NEFT///REC/SENDREF:<x>
IMPS/P2A/<ref>/<PARTY>/<BANK>/Paytoacc/<account>
SAK/CASH DEP/<ref>/<branch>/SELF          -> cash deposit
EZY/ICICIPOS_SET_<terminal>_<ddmmyy>      -> POS
```

**Verification is arithmetic, so make it a gate.** Per date and per bank, compare row counts
and total amounts between the parsed file and what was stored. The statements also print
opening and closing balances: `opening + credits − debits = closing` must hold, or the
import is rejected. That single check catches a dropped row, a duplicated row and a
misread amount, and it needs no human.

---

## Phasing

**Phase 1 — configure the two bank accounts** (Finance, not engineering). Set `bank_name`,
`bank_account_number` and `bank_ifsc` on the ICICI and Axis ledger accounts. Nothing can be
imported until a statement has an account to belong to.

**Phase 2 — schema.** The migration above plus the two new tables, with a runner, as
`V053`. Seed `bank_narration_rule` with the abbreviations already known.

**Phase 3 — parse and import.** One parser per bank behind a common interface, column-aware,
with the balance check as the gate and the file hash for idempotency. Upload screen returns
what it parsed before committing.

**Phase 4 — resolve the party.** Apply narration rules, pair self transfers on UTR, mark
everything else `UNRESOLVED` rather than guessing. A small screen to review and correct,
where a correction can optionally become a rule.

**Phase 5 — the report.** Daily tabs, four columns, both banks combined. At this point it is
a query with an Excel writer, and re-running it costs nothing. **This is the deliverable
that was asked for**; it does not wait for Phase 6.

**Phase 6 — reconciliation.** Match statement lines to `ledger_transaction` and populate
`bank_reconciliation`, which is what those tables were designed for. This is where the
persisted data stops being a convenience and starts being worth the effort.

---

## Decisions needed before Phase 3

**Where does the file live?** Storing the PDF makes provenance real and disputes settleable;
it also puts bank statements in the tenant database or on the server's disk. Storing only
the hash is lighter but means "show me the source" cannot be answered from the ERP.

**Who may see it?** These lines carry counterparty names, amounts and balances for the whole
business. This is not branch-scoped data and should not be visible to a branch user. It
needs its own menu and role, decided before the screen exists rather than after — the same
mistake as `A2` in the backlog otherwise repeats here with more sensitive data.

**Manual entry?** Not every account will have a parsable statement. Whether a line can be
keyed in by hand changes the schema very little and the screen a great deal.
