---
description: Check promotions, orders, claims and price increases against the rules in docs/compliance.md.
---

Run: `npm run trade -- compliance`

Group the findings by rule, cite the rule and its source from docs/compliance.md, and give the fix for each. This is a record check, not legal advice: when a rule or threshold has changed, say so and update it with /customise.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
