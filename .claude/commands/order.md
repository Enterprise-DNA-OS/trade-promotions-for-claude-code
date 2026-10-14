---
description: Record the retailer's promotional order and any cut to it.
---

Run: `npm run trade -- order <promotion> <sku> --ordered= [--final=] [--consent=] --actor=`

If the order was cut by more than 10% (AU s33(3), NZ cl 18), ask whether you gave written consent and record the reference with --consent. If not, say the cut is flagged.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
