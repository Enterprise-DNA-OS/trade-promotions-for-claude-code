---
description: Approve a matched claim for payment or to stand as a deduction.
---

Run: `npm run trade -- approve-claim <claim> --actor=`

It refuses a claim that fails the set-off, over-claim, date or duplicate checks. Offer /dispute instead.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
