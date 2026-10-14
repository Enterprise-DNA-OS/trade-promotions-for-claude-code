# Moving off Promax

Promax (Wipro Promax TPM and TPx) holds your promotions, deal rates, trade budgets and settlements. The layout of its exports is set up per business, so this guide reads the common column names and takes a mapping file for the rest. Do a dry run first every time.

## 1. Set up customers and products

Promax names your accounts and products its own way. Add each customer and product here first, with the customer code and SKU you want to use:

```bash
npm run trade -- add-customer --code=HSM-NZ --name="Harbour Supermarkets NZ" --country=NZ --funding-clause=yes --setoff-clause=yes --actor="Your name"
npm run trade -- add-product --sku=TRF-CRK-SS --name="Sea Salt Crackers 200g" --category=Crackers --actor="Your name"
npm run trade -- set-price HSM-NZ TRF-CRK-SS --list=3.10 --cost=1.50 --shelf=5.49 --baseline=400 --actor="Your name"
```

Or ask Claude Code to load your customer and product lists from a spreadsheet: it runs the same commands.

## 2. Export promotions from Promax

Export a promotion list with one row per promotion and product, saved as CSV. The import reads these headings (case does not matter):

| Field | Headings it recognises |
|---|---|
| Promotion | Promotion ID, Promotion Number, Promo ID, Event ID |
| Customer | Customer, Customer Code, Account, Banner |
| Title | Promotion Name, Promotion Description, Event Name, Description |
| Mechanic | Mechanic, Promotion Type, Tactic |
| Dates | Start Date or In Store Start, End Date or In Store End (dd/mm/yyyy or yyyy-mm-dd) |
| Status | Status, Promotion Status, Approval Status |
| Product | Product Code, SKU, Material, Item Code |
| Deal | Promo Price, Off Invoice (per unit), Scan (per unit), Forecast Units, Fixed Amount |

Different headings, customer names or product codes go in a mapping file. `examples/import-map.json` shows the shape:

```json
{
  "columns": { "promo_price": "Promotional RRP" },
  "customers": { "Harbour NZ": "HSM-NZ" },
  "products": { "10045": "TRF-CRK-SS" },
  "mechanics": { "Shelf Price Reduction": "tpr" }
}
```

## 3. Import

```bash
npm run trade -- import promax --file=examples/promax-promotions.csv --map=examples/import-map.json --dry-run --actor="Your name"
npm run trade -- import promax --file=examples/promax-promotions.csv --map=examples/import-map.json --actor="Your name"
```

- It stops before writing anything if a customer or product is unknown, and lists them.
- Each Promax promotion becomes one promotion with reference `PMX-<id>`, one line per product.
- Approved, confirmed and closed promotions land as agreed, with the start date as the agreed date. Submitted and planned land as proposed. Cancelled and rejected land as cancelled. Everything else lands as draft.
- Running the same file again changes nothing. A promotion already here with a different number of lines stops the import for review.

## 4. Retailer claims and scan data

Claims and deductions from a retailer portal or remittance advice:

```bash
npm run trade -- import claims --file=examples/retailer-claims.csv --dry-run --actor="Your name"
```

Headings: Customer, Claim Number, Claim Date, Claim Type, Amount (excluding GST), Period From, Period To, Method, Promotion. A method containing "deduction", "set off" or "remittance" lands as a set-off. A Promotion value that matches an agreed promotion (`PRM-2401`, or the Promax id) matches the claim on the way in.

Weekly scan or depletion data:

```bash
npm run trade -- import scan --file=examples/scan-data.csv --dry-run --actor="Your name"
```

Headings: Customer, SKU, Week Ending (or Week Starting), Units, Value. Any date in a week is stored against that week's Monday. Loading the same week again replaces it.

## What does not carry over

- **Baselines and forecasts from Promax's models.** Set a weekly baseline per customer and product with `set-price --baseline=`. Forecast units come across on each line.
- **Approval workflow history.** The import records who imported it; Promax's own approval trail stays in Promax. Export it to PDF if you need it.
- **Settlement documents and attachments.** Claims come across as records; keep the source documents where they are and note the reference.
- **Retailer portal connections.** The free version reads the CSVs you download. A live link to a retailer portal or your accounting system is something Enterprise DNA builds into your version.
- **Custom fields.** Add them with `/customise`, then map them.

The example files are synthetic.
