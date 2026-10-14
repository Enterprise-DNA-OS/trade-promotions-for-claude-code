# Record checks

`npm run trade -- compliance` (or `/compliance`) runs every check below against your records. Each finding names its rule. Thresholds live in the `policy` table and change with `/customise`.

This is a record check for suppliers, not legal advice. The grocery codes put their duties on the large retailers and wholesalers; the checks show you where a retailer's conduct, or a gap in your own records, needs a conversation or a complaint. Read the code itself, or ask your adviser, before you act on a finding. Checked 14 October 2026.

## The codes

- **Australia.** The Food and Grocery Code of Conduct, made mandatory by the Competition and Consumer (Industry Codes, Food and Grocery) Regulations 2024, in force from 1 April 2025. It binds large grocery businesses (ALDI, Coles, Metcash and Woolworths today). Text: [legislation.gov.au F2024L01651](https://www.legislation.gov.au/F2024L01651). Section numbers below are from that instrument.
- **New Zealand.** The Grocery Supply Code made by the Commerce Commission under the Grocery Industry Competition Act 2023. It binds the regulated grocery retailers (Foodstuffs North Island, Foodstuffs South Island and Woolworths NZ). The Commission's 2025 review renumbered the funded promotion clause from 20 to 18 and added record-keeping and repayment rules, in force from the later of 1 May 2026 or when the penalties are confirmed. Code and FAQs: [comcom.govt.nz Grocery Supply Code](https://www.comcom.govt.nz/regulated-industries/grocery/grocery-supply-code/grocery-supply-code-2025-faqs/). Review decisions: [final report, 16 October 2025](https://www.comcom.govt.nz/assets/Documents/review-of-the-grocery-supply-code/Review-of-the-Grocery-Supply-Code-Final-Report-Decisions-and-Reasons-paper-16-October-2025.pdf).

A customer is checked against these rules only when `large_grocery` is yes on its record. A wholesaler or independent outside the codes is checked on your own rules (TP06 to TP10, TP12) only.

## The rules

| Rule | What it checks | Source |
|---|---|---|
| TP01 | A funded promotion (any off-invoice, scan or fixed funding) with a code customer whose supply agreement has no express promotion funding clause on file (`funding_clause`). | AU s28(1) and (2)(a): a large grocery business must not require a supplier to fund a promotion unless the agreement expressly provides for it and the funding is reasonable. NZ cl 17: the same rule, with records kept for 7 years. |
| TP02 | An agreed funded promotion, in store within `notice_days`, with no written notice from the retailer, or notice that arrived fewer than `notice_days` before the start. | AU s33(1): the funded promotion must not be held unless the supplier has been given reasonable written notice. NZ cl 18(1): reasonable notice of a funded promotion. The codes do not set a number of days; `notice_days` (21) is your own view of reasonable. |
| TP03 | A promotional order cut by more than `order_cut_pct` (10%), or cancelled, with no written consent recorded. | AU s33(3)(b)(i): a retailer must not reduce a funded promotion order by more than 10% (20% for a wholesaler) without the supplier's written consent, unless it gave reasonable written notice or compensates (s33(4)). NZ cl 18: orders cancelled or reduced by more than 10% need written consent, reasonable notice or compensation. |
| TP04 | A deduction taken off your remittance (a set-off) by a code customer with no written consent recorded. | AU s22(2): a large grocery business must not set off any amount against a supplier's invoice or remittance without the supplier's written consent, unless the agreement provides for it as an allowable contrary provision and it is reasonable (s22(3)). NZ cl 12: no set-off without written consent, or a provision in the agreement that is reasonable, with a written explanation of how it was calculated. |
| TP05 | Promotional stock left over: the final promotional order less units scanned in the promotion is above `overorder_pct` (10%) of the order, on a deal with off-invoice funding. The finding works out the off-invoice amount on the leftover units. | AU s33(2): the order quantity must be calculated transparently, the retailer must not over-order, and if over-ordered stock sells above the promotional price the retailer pays the supplier the difference. NZ cl 18: a retailer that sells funded promotion stock at a non-promotional price repays the funding on it. Your scan data shows the gap; whether the stock later sold at full price is the question to ask. |
| TP06 | A claim not matched to any promotion after `unmatched_claim_days` (14). | Your own control: a claim you cannot tie to an agreed promotion is not yet owed. |
| TP07 | Claims matched to a promotion that add up to more than the expected funding by over `claim_tolerance_pct` (2%), by promotion and kind (scan or fixed). Expected scan funding is the scan rate times units scanned (forecast units until scan data arrives); expected fixed funding is the agreed fee. | Your own control. |
| TP08 | A scan claim whose sales period runs outside the promotion's in-store dates. | Your own control: scan funding was agreed for the in-store weeks. |
| TP09 | The same amount claimed twice by the same customer for the same period and kind. | Your own control. |
| TP10 | A deal line on a draft, proposed, upcoming or live promotion whose margin on net price after off-invoice and scan is below `margin_floor_pct` (15%). | Your own rule. |
| TP11 | A price increase notified to an Australian code customer with no written answer after `price_response_days` (30). | AU s40(2): within 30 days of being told of a price increase, the large grocery business must notify the supplier in writing whether it accepts it, accepts a smaller increase, or does not accept it. |
| TP12 | Agreed trade spend for a customer above its trade budget for the year from 1 July. | Your own budget. |

## Records the codes expect you to be able to show

- **Why the funding is reasonable.** AU s28(3) weighs the likely and actual benefits, costs and risks for both sides. Record it on the promotion with `agree --reason=`; it prints on the promotion agreement (`npm run docs`).
- **Written consent.** Keep the reference for every set-off you agreed to (`consent`) and every order cut you agreed to (`order --consent=`). AU s78(2)(c) has the retailer keep your set-off consents for 6 years; keep your own copy.
- **Notice.** The day the retailer's written notice arrived (`notice`).
- **Price increase answers.** The day you notified and the day they answered (`price-increase`, `price-response`).

Every change is in the append-only `audit` table with who made it.
