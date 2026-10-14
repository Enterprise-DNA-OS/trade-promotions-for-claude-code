---
description: Record that a promotion is agreed with the retailer.
---

Run: `npm run trade -- agree <promotion> --by= [--reason=] [--date=] --actor=`

For a customer covered by the grocery code, ask why the funding is reasonable for both sides and record it with --reason: that is the record AU s28(3) and NZ cl 17 look for. Show the checks it returns.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
