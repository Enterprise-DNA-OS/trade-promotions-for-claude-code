---
description: Add a product to a draft or proposed promotion with its deal rates and forecast.
---

Run: `npm run trade -- add-line <promotion> <sku> [--promo-price=] [--off-invoice=] [--scan=] [--forecast=] --actor=`

Deal rates are per unit in dollars. Report the net price and margin back, and warn if the margin is under the floor in /policy.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
