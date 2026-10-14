---
description: Set a customer's trade budget for a year.
---

Run: `npm run trade -- budget <customer> --amount= [--year=YYYY] --actor=`

The trade year starts 1 July; --year=2027 means the year from 1 July 2027.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
