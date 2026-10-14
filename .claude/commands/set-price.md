---
description: Set or change a product's list price, cost, shelf price and baseline for one customer.
---

Run: `npm run trade -- set-price <customer> <sku> --list= --cost= [--shelf=] [--baseline=] --actor=`

The baseline is weekly units sold with no promotion; it drives uplift and ROI.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
