---
description: Record the customer's answer to the oldest pending price increase.
---

Run: `npm run trade -- price-response <customer> --response=accepted|partial|declined --date= --actor=`

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
