---
description: Month end: scan and fixed funding owed on promotions that have started, less what retailers have claimed.
---

Run: `npm run trade -- accruals`

Total the open amount by customer and currency for the journal. Say which lines are on forecast units because no scan data has come in. Off-invoice is not accrued: it came off the invoice.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
