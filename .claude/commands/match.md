---
description: Match a claim to the promotion it pays for.
---

Run: `npm run trade -- match <claim> <promotion> --actor=`

The promotion must be agreed and for the same customer. Show expected against claimed afterwards.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
