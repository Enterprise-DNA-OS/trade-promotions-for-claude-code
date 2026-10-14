# Trade Promotions for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **Business:** [YOUR BUSINESS]
- **Operator:** [YOUR NAME], [your role]
- **What matters most:** [the one or two outcomes you care about]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a record, read its full history first.
3. **Plain language.** Short sentences. No filler. Numbers in tables.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, or faces a customer waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| What needs doing this week | `/attention` |
| The Monday review | `/weekly-review` then `/draft-review` |
| What is in store, what is not agreed | `/calendar` |
| A promotion, its deal and claims | `/promotion` |
| A new promotion | `/new-promotion`, `/add-line`, `/propose`, `/agree` |
| Retailer notice or a promotional order | `/notice`, `/order` |
| Claims and deductions to clear | `/deductions`, `/match`, `/approve-claim` |
| A claim that looks wrong | `/claim`, `/dispute`, `/draft-dispute` |
| A deduction we agreed to | `/consent` |
| Month-end accrual | `/accruals` |
| Did that promotion work | `/evaluation` |
| Trade budget | `/budgets`, `/budget` |
| A price increase | `/price-increase`, `/price-response`, `/price-increases` |
| Customers, products, prices | `/customers`, `/customer`, `/products`, `/prices`, `/set-price` |
| Grocery code and our own rules | `/compliance` |
| Bring Promax, claims or scan data in | `/import` |
| Change a field, rule or threshold | `/customise` |
| A new dashboard page | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run trade -- help`) and then propose a new command for it.

## Hard rules

- Money is whole cents, excluding GST, in each customer's currency. Never add NZD to AUD.
- A claim is never approved while a check fails on it. Dispute it or fix the record.
- Grocery code findings are record checks, not legal advice. Cite the rule from `docs/compliance.md` and say so.
- Never send email or messages from here. Draft to `drafts/`, a person sends.
- Never delete records without an explicit yes in this session. Prefer marking closed or archived.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/trade.mjs` the CLI (`npm run trade -- help`). `scripts/` `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/compliance.md` the rules and their sources. `docs/replace-promax.md` the import guide.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/promax
