---
description: Write a claim off, accepting the cost, with a reason.
---

Run: `npm run trade -- write-off <claim> --reason= --actor=`

Use it when the amount is not worth chasing or the retailer has agreed a settlement.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
