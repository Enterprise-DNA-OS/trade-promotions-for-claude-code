---
description: Add a retailer or wholesaler account.
---

Run: `npm run trade -- add-customer --code= --name= --country=NZ|AU [--large=yes|no] [--funding-clause=yes|no] [--setoff-clause=yes|no] [--payment-days=] [--manager=] --actor=`

Ask whether the customer is covered by the grocery code, and whether its supply agreement expressly provides for promotion funding and for set-offs.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
