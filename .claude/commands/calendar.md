---
description: The promotion calendar: everything live, upcoming, proposed or in draft, in store order.
---

Run: `npm run trade -- calendar`

Group by week in store. Flag anything proposed or in draft that is within three weeks of store, and any funded promotion with no notice date from the retailer.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
