-- Demo records for Totara Ridge Foods, a crackers, relish and muesli maker selling into supermarkets
-- in New Zealand and Australia. Every business and person here is invented.
-- Dates are relative to this week's Monday, so the attention lists always have something to say.
-- Deliberate problems: a funded promotion with no funding clause in the supply agreement, a live
-- promotion with no written notice from the retailer, a promotional order cut 20% with no consent,
-- promotional stock left over after the promotion, a set-off taken with no consent, an unmatched
-- deduction, an over-claim, a scan claim outside the promotion dates, the same claim twice, a deal
-- under the margin floor, a price increase with no answer after 30 days, a customer over its trade
-- budget, and a proposed promotion still not agreed two weeks before it is in store.

insert into customers (id, code, name, country, currency, large_grocery, funding_clause, setoff_clause, payment_days, account_manager) values
  ('c0000000-0000-4000-8000-000000000001', 'HSM-NZ', 'Harbour Supermarkets NZ', 'NZ', 'NZD', true, true, true, 20, 'Sophie Lee'),
  ('c0000000-0000-4000-8000-000000000002', 'SGC-NZ', 'Southern Grocers Co-operative', 'NZ', 'NZD', true, true, false, 20, 'Sophie Lee'),
  ('c0000000-0000-4000-8000-000000000003', 'CSM-AU', 'Coastline Supermarkets', 'AU', 'AUD', true, true, false, 30, 'Daniel Brooks'),
  ('c0000000-0000-4000-8000-000000000004', 'MGG-AU', 'Metro Grocery Group', 'AU', 'AUD', true, false, false, 30, 'Daniel Brooks'),
  ('c0000000-0000-4000-8000-000000000005', 'IGW-AU', 'Independent Grocers Wholesale', 'AU', 'AUD', false, false, false, 45, 'Daniel Brooks')
on conflict do nothing;

insert into products (id, sku, name, brand, category, units_per_case) values
  ('d0000000-0000-4000-8000-000000000001', 'TRF-CRK-SS', 'Sea Salt Crackers 200g', 'Totara Ridge', 'Crackers', 12),
  ('d0000000-0000-4000-8000-000000000002', 'TRF-CRK-RO', 'Rosemary Crackers 200g', 'Totara Ridge', 'Crackers', 12),
  ('d0000000-0000-4000-8000-000000000003', 'TRF-REL-TOM', 'Tomato Relish 300g', 'Totara Ridge', 'Condiments', 6),
  ('d0000000-0000-4000-8000-000000000004', 'TRF-JAM-CHI', 'Chilli Jam 250g', 'Totara Ridge', 'Condiments', 6),
  ('d0000000-0000-4000-8000-000000000005', 'TRF-MUE-500', 'Toasted Muesli 500g', 'Totara Ridge', 'Cereal', 8),
  ('d0000000-0000-4000-8000-000000000006', 'TRF-MUE-1KG', 'Toasted Muesli 1kg', 'Totara Ridge', 'Cereal', 6)
on conflict do nothing;

-- Prices, costs and baselines for every customer and product.
insert into product_prices (customer_id, product_id, list_cents, cost_cents, shelf_cents, baseline_units_week)
select c.id, p.id,
  case when c.country = 'NZ' then v.nz_list else v.au_list end,
  case when c.country = 'NZ' then v.nz_cost else v.au_cost end,
  case when c.country = 'NZ' then v.nz_shelf else v.au_shelf end,
  round(v.base * f.factor)::int
from customers c cross join products p
join (values
  ('TRF-CRK-SS', 310, 150, 549, 290, 140, 500, 400),
  ('TRF-CRK-RO', 310, 150, 549, 290, 140, 500, 250),
  ('TRF-REL-TOM', 420, 210, 749, 400, 200, 700, 300),
  ('TRF-JAM-CHI', 450, 230, 799, 430, 215, 750, 150),
  ('TRF-MUE-500', 520, 260, 899, 500, 250, 850, 350),
  ('TRF-MUE-1KG', 880, 450, 1499, 840, 430, 1400, 200)
) v(sku, nz_list, nz_cost, nz_shelf, au_list, au_cost, au_shelf, base) on v.sku = p.sku
join (values ('HSM-NZ', 1.0), ('SGC-NZ', 0.8), ('CSM-AU', 1.5), ('MGG-AU', 1.2), ('IGW-AU', 0.3)) f(code, factor) on f.code = c.code
on conflict do nothing;

-- Sixteen weeks of scan data at baseline for every customer and product.
insert into scan_sales (customer_id, product_id, week_start, units, value_cents, source)
select pp.customer_id, pp.product_id, date_trunc('week', current_date)::date - 7 * n, pp.baseline_units_week, pp.baseline_units_week * pp.shelf_cents, 'demo'
from product_prices pp cross join generate_series(1, 16) n
on conflict do nothing;

insert into promotions (id, ref, customer_id, title, mechanic, status, instore_start, instore_end, fixed_cents, fixed_kind, funding_reason, owner, proposed_on, agreed_on, agreed_by, notice_on, cancelled_reason) values
  ('f0000000-0000-4000-8000-000000000001', 'PRM-2401', 'c0000000-0000-4000-8000-000000000001', 'Crackers half price lead-in', 'tpr', 'agreed',
    date_trunc('week', current_date)::date - 56, date_trunc('week', current_date)::date - 43, 0, null,
    'Shelf price 3.99 against 5.49; both sides gain on volume through the summer entertaining weeks.', 'Sophie Lee',
    date_trunc('week', current_date)::date - 100, date_trunc('week', current_date)::date - 90, 'Sophie Lee', date_trunc('week', current_date)::date - 90, null),
  ('f0000000-0000-4000-8000-000000000002', 'PRM-2402', 'c0000000-0000-4000-8000-000000000002', 'Muesli catalogue feature', 'catalogue', 'agreed',
    date_trunc('week', current_date)::date - 42, date_trunc('week', current_date)::date - 29, 450000, 'catalogue',
    'Front page cereal feature; the retailer carries the catalogue cost above this fee.', 'Sophie Lee',
    date_trunc('week', current_date)::date - 80, date_trunc('week', current_date)::date - 70, 'Sophie Lee', date_trunc('week', current_date)::date - 66, null),
  ('f0000000-0000-4000-8000-000000000003', 'PRM-2403', 'c0000000-0000-4000-8000-000000000003', 'Relish and chilli jam 2 for 10', 'multibuy', 'agreed',
    date_trunc('week', current_date)::date - 7, date_trunc('week', current_date)::date + 6, 0, null,
    'Multibuy across two condiments; the retailer funds the end-of-aisle space.', 'Daniel Brooks',
    date_trunc('week', current_date)::date - 60, date_trunc('week', current_date)::date - 45, 'Daniel Brooks', null, null),
  ('f0000000-0000-4000-8000-000000000004', 'PRM-2404', 'c0000000-0000-4000-8000-000000000004', 'Crackers gondola end', 'display', 'agreed',
    date_trunc('week', current_date)::date + 21, date_trunc('week', current_date)::date + 34, 250000, 'display',
    null, 'Daniel Brooks',
    date_trunc('week', current_date)::date - 30, date_trunc('week', current_date)::date - 14, 'Daniel Brooks', date_trunc('week', current_date)::date - 3, null),
  ('f0000000-0000-4000-8000-000000000005', 'PRM-2405', 'c0000000-0000-4000-8000-000000000001', 'Chilli jam summer barbecue', 'tpr', 'proposed',
    date_trunc('week', current_date)::date + 14, date_trunc('week', current_date)::date + 27, 0, null,
    null, 'Sophie Lee', date_trunc('week', current_date)::date - 20, null, null, null, null),
  ('f0000000-0000-4000-8000-000000000006', 'PRM-2406', 'c0000000-0000-4000-8000-000000000003', 'Muesli winter price drop', 'tpr', 'agreed',
    date_trunc('week', current_date)::date - 112, date_trunc('week', current_date)::date - 99, 0, null,
    'Price drop to hold shelf space against the private label launch.', 'Daniel Brooks',
    date_trunc('week', current_date)::date - 150, date_trunc('week', current_date)::date - 140, 'Daniel Brooks', date_trunc('week', current_date)::date - 135, null),
  ('f0000000-0000-4000-8000-000000000007', 'PRM-2407', 'c0000000-0000-4000-8000-000000000002', 'Sea salt crackers Christmas', 'tpr', 'draft',
    date_trunc('week', current_date)::date + 70, date_trunc('week', current_date)::date + 83, 0, null,
    null, 'Sophie Lee', null, null, null, null, null),
  ('f0000000-0000-4000-8000-000000000008', 'PRM-2408', 'c0000000-0000-4000-8000-000000000004', 'Relish online feature', 'online', 'cancelled',
    date_trunc('week', current_date)::date - 28, date_trunc('week', current_date)::date - 15, 80000, 'online',
    null, 'Daniel Brooks', date_trunc('week', current_date)::date - 70, null, null, null, 'The range review moved the online slot to next year.')
on conflict do nothing;

insert into promo_lines (promotion_id, product_id, promo_shelf_cents, off_invoice_cents, scan_cents, forecast_units, ordered_units, final_units, cut_consent) values
  ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 399, 20, 50, 1600, 1800, 1800, null),
  ('f0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 399, 20, 50, 1000, 1100, 1100, null),
  ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000005', 699, 80, 60, 2000, 2400, 2400, null),
  ('f0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000006', 1199, 140, 100, 1200, 1400, 1400, null),
  ('f0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', 500, 40, 60, 3000, 3600, 2880, null),
  ('f0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004', 500, 40, 60, 1200, 1300, 1300, null),
  ('f0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000001', 350, 60, 80, 2400, null, null, null),
  ('f0000000-0000-4000-8000-000000000004', 'd0000000-0000-4000-8000-000000000002', 400, 30, 50, 1300, null, null, null),
  ('f0000000-0000-4000-8000-000000000005', 'd0000000-0000-4000-8000-000000000004', 599, 0, 80, 900, null, null, null),
  ('f0000000-0000-4000-8000-000000000006', 'd0000000-0000-4000-8000-000000000005', 650, 100, 100, 1800, 1900, 1300, 'Email from Coastline buyer agreeing the cut'),
  ('f0000000-0000-4000-8000-000000000007', 'd0000000-0000-4000-8000-000000000001', 449, 50, 50, 1500, null, null, null),
  ('f0000000-0000-4000-8000-000000000008', 'd0000000-0000-4000-8000-000000000003', 549, 0, 0, 0, null, null, null)
on conflict do nothing;

-- Scan weeks inside each promotion, with the uplift it delivered.
update scan_sales s set units = v.units, value_cents = v.units * v.price
from (values
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 8, 950, 399),
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 7, 950, 399),
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 8, 600, 399),
  ('c0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 7, 600, 399),
  ('c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000005', 6, 700, 699),
  ('c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000005', 5, 700, 699),
  ('c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000006', 6, 500, 1199),
  ('c0000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000006', 5, 500, 1199),
  ('c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000003', 1, 1500, 500),
  ('c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000004', 1, 600, 500),
  ('c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005', 16, 600, 650),
  ('c0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000005', 15, 600, 650)
) v(customer_id, product_id, n, units, price)
where s.customer_id = v.customer_id::uuid and s.product_id = v.product_id::uuid and s.week_start = date_trunc('week', current_date)::date - 7 * v.n;

insert into claims (id, ref, customer_id, retailer_ref, received_on, kind, amount_cents, period_from, period_to, method, consent_ref, promotion_id, status, decided_by, decided_on, note) values
  ('b0000000-0000-4000-8000-000000000001', 'CLM-5001', 'c0000000-0000-4000-8000-000000000001', 'HSM-SC-40117', date_trunc('week', current_date)::date - 35, 'scan', 155000,
    date_trunc('week', current_date)::date - 56, date_trunc('week', current_date)::date - 43, 'invoice', null, 'f0000000-0000-4000-8000-000000000001', 'approved', 'Sophie Lee', date_trunc('week', current_date)::date - 30, null),
  ('b0000000-0000-4000-8000-000000000002', 'CLM-5002', 'c0000000-0000-4000-8000-000000000002', 'SGC-CAT-7781', date_trunc('week', current_date)::date - 40, 'fixed', 450000,
    date_trunc('week', current_date)::date - 42, date_trunc('week', current_date)::date - 29, 'invoice', null, 'f0000000-0000-4000-8000-000000000002', 'approved', 'Sophie Lee', date_trunc('week', current_date)::date - 38, null),
  ('b0000000-0000-4000-8000-000000000003', 'CLM-5003', 'c0000000-0000-4000-8000-000000000002', 'SGC-SC-7802', date_trunc('week', current_date)::date - 18, 'scan', 212000,
    date_trunc('week', current_date)::date - 42, date_trunc('week', current_date)::date - 29, 'invoice', null, 'f0000000-0000-4000-8000-000000000002', 'matched', null, null, null),
  ('b0000000-0000-4000-8000-000000000004', 'CLM-5004', 'c0000000-0000-4000-8000-000000000003', 'DED-88412', date_trunc('week', current_date)::date - 25, 'other', 386500,
    null, null, 'setoff', null, null, 'open', null, null, 'Taken off the remittance as "promotional support"'),
  ('b0000000-0000-4000-8000-000000000005', 'CLM-5005', 'c0000000-0000-4000-8000-000000000003', 'CSM-SC-31907', date_trunc('week', current_date)::date - 90, 'scan', 120000,
    date_trunc('week', current_date)::date - 112, date_trunc('week', current_date)::date - 99, 'invoice', null, 'f0000000-0000-4000-8000-000000000006', 'approved', 'Daniel Brooks', date_trunc('week', current_date)::date - 85, null),
  ('b0000000-0000-4000-8000-000000000006', 'CLM-5006', 'c0000000-0000-4000-8000-000000000003', 'CSM-SC-32255', date_trunc('week', current_date)::date - 20, 'scan', 120000,
    date_trunc('week', current_date)::date - 112, date_trunc('week', current_date)::date - 99, 'invoice', null, 'f0000000-0000-4000-8000-000000000006', 'matched', null, null, null),
  ('b0000000-0000-4000-8000-000000000007', 'CLM-5007', 'c0000000-0000-4000-8000-000000000001', 'HSM-SC-40388', date_trunc('week', current_date)::date - 12, 'scan', 42000,
    date_trunc('week', current_date)::date - 42, date_trunc('week', current_date)::date - 36, 'invoice', null, 'f0000000-0000-4000-8000-000000000001', 'matched', null, null, null),
  ('b0000000-0000-4000-8000-000000000008', 'CLM-5008', 'c0000000-0000-4000-8000-000000000004', 'MGG-CL-2291', date_trunc('week', current_date)::date - 10, 'other', 129000,
    date_trunc('week', current_date)::date - 28, date_trunc('week', current_date)::date - 15, 'invoice', null, null, 'disputed', 'Daniel Brooks', date_trunc('week', current_date)::date - 6,
    'Claims the cancelled online feature; no promotion ran'),
  ('b0000000-0000-4000-8000-000000000009', 'CLM-5009', 'c0000000-0000-4000-8000-000000000005', 'IGW-INV-0518', date_trunc('week', current_date)::date - 3, 'scan', 36000,
    date_trunc('week', current_date)::date - 28, date_trunc('week', current_date)::date - 1, 'invoice', null, null, 'open', null, null, 'Depletion claim, no promotion reference given')
on conflict do nothing;

insert into trade_budgets (customer_id, year_start, budget_cents) values
  ('c0000000-0000-4000-8000-000000000001', trade_year(current_date), 3000000),
  ('c0000000-0000-4000-8000-000000000002', trade_year(current_date), 600000),
  ('c0000000-0000-4000-8000-000000000003', trade_year(current_date), 4000000),
  ('c0000000-0000-4000-8000-000000000004', trade_year(current_date), 2500000),
  ('c0000000-0000-4000-8000-000000000005', trade_year(current_date), 500000)
on conflict do nothing;

insert into price_increases (id, customer_id, notified_on, effective_on, pct, response, responded_on, note) values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', date_trunc('week', current_date)::date - 45, date_trunc('week', current_date)::date + 30, 4.5, 'pending', null, 'Oats and packaging costs up; letter sent to the category buyer'),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000004', date_trunc('week', current_date)::date - 10, date_trunc('week', current_date)::date + 45, 4.5, 'pending', null, null),
  ('e0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', date_trunc('week', current_date)::date - 60, date_trunc('week', current_date)::date - 10, 3.8, 'accepted', date_trunc('week', current_date)::date - 40, null)
on conflict do nothing;

insert into policy (key, value, note) values
  ('notice_days', 21, 'Days of written notice from the retailer you treat as reasonable for a funded promotion (AU s33(1), NZ cl 18)'),
  ('order_cut_pct', 10, 'A promotional order cut by more than this percent needs your written consent (AU s33(3), NZ cl 18)'),
  ('overorder_pct', 10, 'Promotional stock left unsold after a promotion above this percent of the order is flagged'),
  ('unmatched_claim_days', 14, 'Days a claim may sit unmatched to a promotion before it is flagged'),
  ('claim_tolerance_pct', 2, 'Claims above the expected amount by more than this percent are flagged'),
  ('margin_floor_pct', 15, 'Lowest margin on net price after deals that you accept without a second look'),
  ('price_response_days', 30, 'Days an AU large grocery business has to answer a price increase in writing (AU s40(2))')
on conflict do nothing;

select setval('promotion_no', greatest((select max(substr(ref, 5)::int) from promotions where ref ~ '^PRM-[0-9]+$'), 2400));
select setval('claim_no', greatest((select max(substr(ref, 5)::int) from claims where ref ~ '^CLM-[0-9]+$'), 5000));
