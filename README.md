<h1 align="center">Trade Promotions for Claude Code</h1>

<p align="center">
  <strong>The open-source trade promotion system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Promax data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=promax">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/promax?utm_source=github&utm_medium=readme&utm_campaign=promax">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-promax">Instead of Promax</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

Trade Promotions for Claude Code does the job you pay Promax for, as a Postgres database and a set of agent commands. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask for what you want in plain language. It runs the right query, and it can answer questions the Promax dashboard cannot.

Promax publishes no prices: it is quoted privately and priced per feature ([docs/research.md](docs/research.md)), and suppliers bring Wipro or a partner in to implement it alongside their ERP. The work underneath is a list of customers, products, deals, orders, scan weeks and claims, and that is what this holds.

Want the same thing with a web front end, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=promax).

It is for New Zealand and Australian food, beverage and household suppliers selling into supermarkets and wholesalers. It covers customers and what their supply agreements provide for, products with list price, cost, shelf price and a weekly baseline per customer, promotions with off-invoice, scan and fixed funding, the retailer's promotional order and any cut to it, weekly scan data, claims and deductions matched to promotions, month-end accruals, post-event uplift and ROI, trade budgets from 1 July, price increases, and checks against the Australian Food and Grocery Code and the New Zealand Grocery Supply Code. The demo is Totara Ridge Foods, a crackers, relish and muesli maker selling on both sides of the Tasman.

## Ten questions your own version answers

Each one is a command that works today on the demo data.

- Which promotions are in store in the next three weeks and still not agreed? `/calendar`
- Which retailer deductions have we not matched to a promotion, and how old are they? `/deductions`
- Where has a retailer claimed more than the promotion was worth? `/compliance`
- Which deductions were taken off our remittance without our written consent? `/compliance`
- Which promotional orders were cut by more than 10% without our agreement? `/compliance`
- How much promotional stock was left unsold after each promotion, and what is that worth back to us? `/compliance`
- What do we owe retailers in scan and fixed funding at month end that they have not claimed yet? `/accruals`
- Which of last quarter's promotions made us money once you take out what we would have sold anyway? `/evaluation`
- Which customers are over their trade budget for the year, and what is proposed on top? `/budgets`
- Which Australian retailers have sat on our price increase for more than 30 days? `/compliance`

## Your first hour: ten things to ask for

1. Put our business name and logo on the promotion agreement.
2. What needs a person this week?
3. Show me the promotion calendar for the next six weeks.
4. Load our Promax promotion export as a dry run.
5. Load this week's scan data from the Coastline portal.
6. Which deductions have not been matched, and which promotion could each one be?
7. Draft a query to Coastline about the deduction they took off our remittance.
8. What do we need to accrue at month end, by customer?
9. Our margin floor is 20%, not 15%. Change it.
10. Add a promotion number field the retailer uses, and show it on every claim.

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your data sits in plain Postgres tables you own. Any tool can read them. No export, no lock-in.
- No seats, no tiers, no add-ons. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for the honest trade-offs too.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node):

```bash
git clone https://github.com/Enterprise-DNA-OS/trade-promotions-for-claude-code.git
cd trade-promotions-for-claude-code
npm install
npm run demo
```

Then open the folder in Claude Code and type `/attention`, then `/compliance`.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared data, no per-seat fee.

## The commands

| Command | What it does |
|---|---|
| `/attention` | The one list of everything in trade promotions that needs a person this week. |
| `/weekly-review` | The Monday trade review. |
| `/calendar` | The promotion calendar: everything live, upcoming, proposed or in draft, in store order. |
| `/promotions` | Every promotion with its phase, spend and claims. |
| `/promotion` | One promotion: its deal by product, orders, claims and the checks that apply. |
| `/new-promotion` | Start a promotion for a customer. |
| `/add-line` | Add a product to a draft or proposed promotion with its deal rates and forecast. |
| `/propose` | Mark a draft promotion as proposed to the retailer. |
| `/agree` | Record that a promotion is agreed with the retailer. |
| `/notice` | Record the date the retailer's written notice of a funded promotion arrived. |
| `/order` | Record the retailer's promotional order and any cut to it. |
| `/cancel` | Cancel a promotion with a reason. |
| `/deductions` | Claims and deductions still to clear, oldest first, with the promotions each could belong to. |
| `/claims` | Every retailer claim and deduction with its status. |
| `/claim` | One claim: what it is, what it is matched to, and the checks that apply. |
| `/add-claim` | Record a retailer claim, or a deduction taken off a remittance. |
| `/match` | Match a claim to the promotion it pays for. |
| `/approve-claim` | Approve a matched claim for payment or to stand as a deduction. |
| `/dispute` | Dispute a claim with a reason. |
| `/write-off` | Write a claim off, accepting the cost, with a reason. |
| `/consent` | Record your written consent to a set-off. |
| `/accruals` | Month end: scan and fixed funding owed on promotions that have started, less what retailers have claimed. |
| `/evaluation` | Post-event results: uplift on baseline, trade spend and the extra gross profit it bought. |
| `/budgets` | Trade budget by customer for the year: committed, proposed, spent and left. |
| `/budget` | Set a customer's trade budget for a year. |
| `/price-increases` | Every list price increase you notified, and the retailer's answer. |
| `/price-increase` | Record a price increase notified to a customer. |
| `/price-response` | Record the customer's answer to the oldest pending price increase. |
| `/customers` | Every customer with its country and what its supply agreement provides for. |
| `/customer` | One customer: promotions, open claims, budget and price increases. |
| `/add-customer` | Add a retailer or wholesaler account. |
| `/products` | Every product. |
| `/add-product` | Add a product. |
| `/prices` | List price, cost, shelf price, margin and weekly baseline for every customer and product. |
| `/set-price` | Set or change a product's list price, cost, shelf price and baseline for one customer. |
| `/compliance` | Check promotions, orders, claims and price increases against the rules in docs/compliance.md. |
| `/policy` | The thresholds the checks use. |
| `/history` | The audit trail: every change, who made it, with what. |
| `/import` | Bring a Promax promotion export, retailer claims or scan data across. |
| `/export` | Write every record to one JSON file. |
| `/draft-dispute` | Draft a query to the retailer about a claim that fails a check or is disputed. |
| `/draft-review` | Write the weekly trade review to drafts/. |
| `/customise` | Make this system yours in plain language. Add a field, rename stages, change a rule, add a column to a document. Writes the migration, applies it, updates the commands that touch it. |
| `/new-view` | Add a read-only HTML view (a dashboard page) from a plain-language description, rendered in the operator's brand by `npm run view`. |

Every command runs `npm run trade -- <command>` underneath. `npm run trade -- help` prints the exact syntax. Add `--json` to any command for structured output. Names match without regard to case; an ambiguous name lists the candidates and exits 1.

Every change takes `--actor` and lands in an append-only `audit` table. Promotions and claims cannot be deleted: cancel a promotion, write off a claim. A claim that fails the set-off, over-claim, date or duplicate checks cannot be approved.

## How promotions work

Money is stored in whole cents, excluding GST, in each customer's currency. Units are consumer units. Each customer has a list price, cost, usual shelf price and weekly baseline for every product it ranges.

A promotion goes draft, proposed, agreed, then upcoming, live and completed by its in-store dates; cancelled stops it. Each line carries per-unit off-invoice funding (off the invoice on the promotional order) and scan funding (claimed by the retailer on units sold), plus any fixed fee on the promotion. Net price is list less both. Agreeing a promotion with a customer covered by a grocery code asks for the reason the funding is reasonable for both sides.

Trade spend is off-invoice on the final order, scan on units scanned (forecast until scan data arrives), and the fixed fee. Accruals are scan and fixed funding on promotions that have started, less claims matched to them. Post-event, uplift is units against the baseline for the in-store weeks, and extra gross profit is promotion gross profit less what the baseline would have earned at list price. ROI is extra gross profit over trade spend.

## Documents and views

`npm run docs` writes a promotion agreement for every proposed or agreed promotion, a claim query for every disputed or failing claim, a trade accrual schedule per customer and a post-event report for every completed promotion, in your brand from `brand.json`, to `docs-out/`. `npm run view` writes the week, trade spend and grocery code pages to `views/`. `/new-view` adds another.

## Record checks

`/compliance` checks promotion funding without a clause, missing or short notice, promotional order cuts over 10% without consent, set-offs without consent, leftover promotional stock, unmatched claims, over-claims, scan claims outside the promotion dates, the same claim twice, deals under your margin floor, Australian price increases with no answer after 30 days, and customers over budget. The sources are in [docs/compliance.md](docs/compliance.md). It is not legal advice.

## Instead of Promax

Export promotions from Promax as CSV, one row per promotion and product. One command, dry run first:

```bash
npm run trade -- import promax --file=examples/promax-promotions.csv --map=examples/import-map.json --dry-run --actor="Your name"
npm run trade -- import promax --file=examples/promax-promotions.csv --map=examples/import-map.json --actor="Your name"
npm run trade -- import claims --file=examples/retailer-claims.csv --actor="Your name"
npm run trade -- import scan --file=examples/scan-data.csv --actor="Your name"
```

It stops before writing anything if a customer or product is unknown. Approved Promax promotions land as agreed, submitted ones as proposed. The example files are synthetic. Full guide, including what does not carry over: [docs/replace-promax.md](docs/replace-promax.md).

## Architecture

```
trade-promotions-for-claude-code/
  CLAUDE.md                 how the operator wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/trade.mjs         the CLI the commands drive
  scripts/smoke.mjs         npm test: every command against a temporary database
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema
  supabase/seed.sql         demo data
  docs/                     the record checks, the Promax guide and why there is no front end
  views.json                the read-only HTML views (npm run view)
  documents.json            the promotion agreement, claim query, accrual schedule and post-event report (npm run docs)
  examples/                 synthetic Promax, claims and scan files to try the import on
```

## Built for coding agents

The database, CLI and command recipes work with Claude Code, Codex, OpenCode or Cursor. Ask your coding agent for a new command and have it implement and test the change against the same records.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs Trade Promotions for Claude Code for your business, migrates your Promax data, connects it to the rest of your tools, and runs it for you as part of **Omni**, our managed Command Center. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=promax)
- Read more: [enterprisedna.co/omni/instead-of/promax](https://enterprisedna.co/omni/instead-of/promax?utm_source=github&utm_medium=readme&utm_campaign=promax)

## License

MIT. Copyright (c) 2026 Enterprise DNA.
