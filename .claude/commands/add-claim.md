---
description: Record a retailer claim, or a deduction taken off a remittance.
---

Run: `npm run trade -- add-claim <customer> --retailer-ref= --date= --kind=scan|fixed|other --amount= [--from= --to=] [--method=invoice|setoff] [--consent=] [--note=] --actor=`

Amount is GST exclusive. A deduction off a remittance is --method=setoff; ask whether you consented to it in writing.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
