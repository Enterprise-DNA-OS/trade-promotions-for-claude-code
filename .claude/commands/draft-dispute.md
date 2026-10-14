---
description: Draft a query to the retailer about a claim that fails a check or is disputed.
---

Run: `npm run trade -- draft-dispute <claim> --actor=`

Show the draft and the file path. It is never sent from here.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
