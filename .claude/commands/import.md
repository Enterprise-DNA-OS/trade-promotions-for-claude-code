---
description: Bring a Promax promotion export, retailer claims or scan data across.
---

Run: `npm run trade -- import promax|claims|scan --file= [--map=] [--dry-run] --actor=`

Always run with --dry-run first and show the counts. A Promax import stops before writing anything if a customer or product is unknown: add it, or map it in examples/import-map.json. See docs/replace-promax.md.

Options use --name=value. Add --json for structured output. Money is GST exclusive, in each customer's currency. Drafts go to drafts/ and are never sent from here. Nothing here pays, invoices or emails a retailer.
