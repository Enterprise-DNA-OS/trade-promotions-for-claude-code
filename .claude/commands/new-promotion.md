---
description: Start a promotion for a customer.
---

Run: `npm run trade -- new-promotion <customer> --title= --mechanic= --start= --end= [--fixed= --fixed-kind=] --actor=`

Ask for anything missing: customer, title, mechanic (tpr, multibuy, catalogue, display, online, other), in-store dates, and any fixed fee. Then add products with /add-line.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
