-- Trade Promotions for Claude Code: trade promotion management for a New Zealand or Australian
-- food, beverage or household supplier selling into supermarkets and wholesalers.
-- Money is integer cents, GST exclusive, in each customer's currency. Units are consumer units.
-- A promotion belongs to one customer (a retailer or wholesaler account); its lines are the products
-- on deal. Retailer claims and deductions are matched back to the promotion they pay for.
create function touch_updated() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;

create table customers (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]+$'),
  name text not null check (length(trim(name)) > 0),
  country text not null check (country in ('NZ', 'AU')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- Covered by the grocery code: a designated large grocery business (AU) or regulated grocery retailer (NZ).
  large_grocery boolean not null default true,
  -- The supply agreement expressly provides for promotion funding (AU s28(2), NZ cl 17).
  funding_clause boolean not null default false,
  -- The supply agreement provides for set-offs against your invoices (AU s22(3), NZ cl 12).
  setoff_clause boolean not null default false,
  payment_days int not null default 30 check (payment_days between 0 and 180),
  account_manager text,
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (length(trim(sku)) > 0),
  name text not null check (length(trim(name)) > 0),
  brand text not null default 'House',
  category text not null default 'General',
  units_per_case int not null default 12 check (units_per_case > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

-- What each customer pays you, what the unit costs you landed in that market, the usual shelf
-- price, and the weekly units that customer sells with no promotion (the baseline).
create table product_prices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  product_id uuid not null references products(id),
  list_cents bigint not null check (list_cents > 0),
  cost_cents bigint not null check (cost_cents > 0),
  shelf_cents bigint check (shelf_cents is null or shelf_cents > 0),
  baseline_units_week int not null default 0 check (baseline_units_week >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (customer_id, product_id)
);

create sequence promotion_no start 2401;

create table promotions (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('PRM-' || nextval('promotion_no')),
  customer_id uuid not null references customers(id),
  title text not null check (length(trim(title)) > 0),
  mechanic text not null check (mechanic in ('tpr', 'multibuy', 'catalogue', 'display', 'online', 'other')),
  status text not null default 'draft' check (status in ('draft', 'proposed', 'agreed', 'cancelled')),
  instore_start date not null,
  instore_end date not null,
  -- Fixed funding: catalogue, display or co-op fees, paid by claim.
  fixed_cents bigint not null default 0 check (fixed_cents >= 0),
  fixed_kind text,
  -- Why the funding is reasonable for both sides: the record AU s28(3) and NZ cl 17 ask for.
  funding_reason text,
  owner text,
  proposed_on date,
  agreed_on date,
  agreed_by text,
  -- The day the retailer's written notice that it is holding the funded promotion arrived.
  notice_on date,
  cancelled_reason text,
  source text not null default 'manual',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check (instore_end >= instore_start),
  check (status <> 'agreed' or (agreed_on is not null and agreed_by is not null)),
  check (status <> 'cancelled' or cancelled_reason is not null)
);

create table promo_lines (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references promotions(id),
  product_id uuid not null references products(id),
  promo_shelf_cents bigint check (promo_shelf_cents is null or promo_shelf_cents > 0),
  -- Per unit. Off-invoice comes off the invoice on the promotional order; scan is claimed by the retailer on units sold.
  off_invoice_cents bigint not null default 0 check (off_invoice_cents >= 0),
  scan_cents bigint not null default 0 check (scan_cents >= 0),
  forecast_units int not null default 0 check (forecast_units >= 0),
  -- The retailer's promotional order, and what it became after any cut.
  ordered_units int check (ordered_units is null or ordered_units >= 0),
  final_units int check (final_units is null or final_units >= 0),
  cut_consent text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (promotion_id, product_id)
);

-- Weekly scan data from the retailer, or depletions from a wholesaler. week_start is a Monday.
create table scan_sales (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  product_id uuid not null references products(id),
  week_start date not null check (extract(isodow from week_start) = 1),
  units int not null check (units >= 0),
  value_cents bigint not null default 0 check (value_cents >= 0),
  source text not null default 'manual',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (customer_id, product_id, week_start)
);

create sequence claim_no start 5001;

-- A retailer's claim on you: an invoice they send, or a deduction they take off a remittance (a set-off).
create table claims (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default ('CLM-' || nextval('claim_no')),
  customer_id uuid not null references customers(id),
  retailer_ref text not null check (length(trim(retailer_ref)) > 0),
  received_on date not null,
  kind text not null check (kind in ('scan', 'fixed', 'other')),
  amount_cents bigint not null check (amount_cents > 0),
  period_from date,
  period_to date,
  method text not null default 'invoice' check (method in ('invoice', 'setoff')),
  -- Your written consent to this set-off (AU s22(2), NZ cl 12): an email or letter reference.
  consent_ref text,
  promotion_id uuid references promotions(id),
  status text not null default 'open' check (status in ('open', 'matched', 'approved', 'disputed', 'written_off')),
  decided_by text,
  decided_on date,
  note text,
  source text not null default 'manual',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (customer_id, retailer_ref),
  check (period_to is null or period_from is null or period_to >= period_from),
  check (status <> 'matched' or promotion_id is not null),
  check (status not in ('approved', 'disputed', 'written_off') or (decided_by is not null and decided_on is not null))
);

create table trade_budgets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  year_start date not null,
  budget_cents bigint not null check (budget_cents >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (customer_id, year_start)
);

-- A list price increase you notified to a customer. AU s40: a large grocery business answers in writing within 30 days.
create table price_increases (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id),
  notified_on date not null,
  effective_on date not null,
  pct numeric(6,2) not null check (pct > 0 and pct < 100),
  response text not null default 'pending' check (response in ('pending', 'accepted', 'partial', 'declined')),
  responded_on date,
  note text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((response = 'pending') = (responded_on is null))
);

create table policy (
  key text primary key,
  value numeric not null,
  note text not null
);

create table audit (
  id bigserial primary key,
  action text not null,
  record_id uuid,
  actor text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

do $$ declare t text; begin
  foreach t in array array['customers', 'products', 'product_prices', 'promotions', 'promo_lines', 'scan_sales', 'claims', 'trade_budgets', 'price_increases'] loop
    execute format('create trigger touch before update on %I for each row execute function touch_updated()', t);
  end loop;
end $$;

create function protect_history() returns trigger language plpgsql as $$ begin raise exception 'History is append-only'; end $$;
create trigger immutable_audit before update or delete on audit for each row execute function protect_history();
create trigger keep_claims before delete on claims for each row execute function protect_history();
create trigger keep_promotions before delete on promotions for each row execute function protect_history();

-- The trade year starts 1 July. Change it here and in policy if yours does not.
create function trade_year(d date) returns date language sql immutable as $$
  select make_date(case when extract(month from d) >= 7 then extract(year from d)::int else extract(year from d)::int - 1 end, 7, 1)
$$;

create view promo_phase as
select p.*, c.code as customer_code, c.name as customer, c.country, c.currency, c.large_grocery, c.funding_clause,
  case when p.status = 'cancelled' then 'cancelled'
       when p.status in ('draft', 'proposed') then p.status
       when current_date < p.instore_start then 'upcoming'
       when current_date <= p.instore_end then 'live'
       else 'completed' end as phase,
  ceil((p.instore_end - p.instore_start + 1) / 7.0)::int as weeks
from promotions p join customers c on c.id = p.customer_id;

create view line_work as
select l.id, l.promotion_id, p.ref, p.customer_id, p.customer_code, p.customer, p.country, p.currency, p.title, p.mechanic, p.phase,
  p.instore_start, p.instore_end, p.weeks, l.product_id, pr.sku, pr.name as product,
  pp.list_cents, pp.cost_cents, pp.shelf_cents, l.promo_shelf_cents, l.off_invoice_cents, l.scan_cents,
  l.off_invoice_cents + l.scan_cents as deal_cents,
  pp.list_cents - l.off_invoice_cents - l.scan_cents as net_cents,
  case when pp.list_cents - l.off_invoice_cents - l.scan_cents > 0
       then round(100.0 * (pp.list_cents - l.off_invoice_cents - l.scan_cents - pp.cost_cents) / (pp.list_cents - l.off_invoice_cents - l.scan_cents), 1) end as margin_pct,
  pp.baseline_units_week * p.weeks as baseline_units,
  l.forecast_units, l.ordered_units, l.final_units, l.cut_consent,
  s.units as actual_units,
  coalesce(s.units, l.forecast_units) as units,
  l.off_invoice_cents * coalesce(l.final_units, l.ordered_units, l.forecast_units) as off_invoice_spend_cents,
  l.scan_cents * coalesce(s.units, l.forecast_units) as scan_spend_cents
from promo_lines l
join promo_phase p on p.id = l.promotion_id
join products pr on pr.id = l.product_id
left join product_prices pp on pp.customer_id = p.customer_id and pp.product_id = l.product_id
left join lateral (
  select sum(ss.units)::int as units from scan_sales ss
  where ss.customer_id = p.customer_id and ss.product_id = l.product_id and ss.week_start between p.instore_start and p.instore_end
  having count(*) > 0
) s on true;

create view promo_totals as
select p.id, p.ref, p.customer_id, p.customer_code, p.customer, p.country, p.currency, p.large_grocery, p.funding_clause, p.title, p.mechanic, p.status, p.phase,
  p.instore_start, p.instore_end, p.weeks, p.owner, p.notice_on, p.agreed_on, p.agreed_by, p.fixed_cents, p.fixed_kind, p.funding_reason,
  count(w.id)::int as lines,
  coalesce(sum(w.forecast_units), 0)::int as forecast_units,
  sum(w.actual_units)::int as actual_units,
  coalesce(sum(w.baseline_units), 0)::int as baseline_units,
  coalesce(sum(w.off_invoice_spend_cents), 0)::bigint as off_invoice_cents,
  coalesce(sum(w.scan_spend_cents), 0)::bigint as scan_cents,
  (coalesce(sum(w.off_invoice_spend_cents + w.scan_spend_cents), 0) + p.fixed_cents)::bigint as trade_spend_cents,
  (coalesce(sum(w.units * (w.net_cents - w.cost_cents)), 0) - p.fixed_cents)::bigint as promo_gp_cents,
  coalesce(sum(w.baseline_units * (w.list_cents - w.cost_cents)), 0)::bigint as baseline_gp_cents,
  (select coalesce(sum(c.amount_cents), 0) from claims c where c.promotion_id = p.id and c.status in ('matched', 'approved'))::bigint as claimed_cents
from promo_phase p left join line_work w on w.promotion_id = p.id
group by p.id, p.ref, p.customer_id, p.customer_code, p.customer, p.country, p.currency, p.large_grocery, p.funding_clause, p.title, p.mechanic, p.status, p.phase,
  p.instore_start, p.instore_end, p.weeks, p.owner, p.notice_on, p.agreed_on, p.agreed_by, p.fixed_cents, p.fixed_kind, p.funding_reason;

-- Post-event: uplift on baseline, and what the trade spend bought in extra gross profit.
create view evaluation as
select ref, customer_code, customer, currency, title, mechanic, instore_start, instore_end, baseline_units,
  coalesce(actual_units, forecast_units) as units, actual_units is not null as measured,
  case when baseline_units > 0 then round(100.0 * (coalesce(actual_units, forecast_units) - baseline_units) / baseline_units, 0) end as uplift_pct,
  trade_spend_cents, promo_gp_cents - baseline_gp_cents as incremental_gp_cents,
  case when trade_spend_cents > 0 then round((promo_gp_cents - baseline_gp_cents)::numeric / trade_spend_cents, 2) end as roi
from promo_totals where phase = 'completed';

-- What you owe retailers for promotions that have started, less what they have already claimed.
-- Off-invoice is not accrued: it came off the invoice. Scan and fixed funding are paid by claim.
create view accruals as
select ref, customer_code, customer, currency, phase, instore_start, instore_end,
  scan_cents + fixed_cents as accrued_cents, claimed_cents,
  greatest(scan_cents + fixed_cents - claimed_cents, 0) as open_cents,
  case when actual_units is null then 'forecast units' else 'scan units' end as basis
from promo_totals where phase in ('live', 'completed') and status = 'agreed';

create view claim_work as
select c.id, c.ref, c.customer_id, cu.code as customer_code, cu.name as customer, cu.country, cu.currency, cu.large_grocery, cu.setoff_clause,
  c.retailer_ref, c.received_on, c.kind, c.amount_cents, c.period_from, c.period_to, c.method, c.consent_ref, c.status,
  c.decided_by, c.decided_on, c.note, c.promotion_id, p.ref as promotion, p.instore_start, p.instore_end,
  case c.kind when 'scan' then t.scan_cents when 'fixed' then t.fixed_cents end as expected_cents,
  (current_date - c.received_on) as days_open
from claims c join customers cu on cu.id = c.customer_id
left join promotions p on p.id = c.promotion_id
left join promo_totals t on t.id = c.promotion_id;

create view budget_work as
select b.id, cu.code as customer_code, cu.name as customer, cu.currency, b.year_start, b.budget_cents,
  coalesce(sum(t.trade_spend_cents) filter (where t.status = 'agreed'), 0)::bigint as committed_cents,
  coalesce(sum(t.trade_spend_cents) filter (where t.status = 'proposed'), 0)::bigint as proposed_cents,
  coalesce(sum(t.trade_spend_cents) filter (where t.phase in ('live', 'completed')), 0)::bigint as spent_cents,
  (b.budget_cents - coalesce(sum(t.trade_spend_cents) filter (where t.status = 'agreed'), 0))::bigint as remaining_cents
from trade_budgets b join customers cu on cu.id = b.customer_id
left join promo_totals t on t.customer_id = b.customer_id and trade_year(t.instore_start) = b.year_start
group by b.id, cu.code, cu.name, cu.currency, b.year_start, b.budget_cents;

-- Every rule cites its source in docs/compliance.md. Thresholds live in policy.
create view compliance_findings as
with pol as (select key, value from policy)
select 'TP01' as rule, ref, customer || ' / ' || title as subject,
  'funded promotion with ' || customer || ', but the supply agreement has no express promotion funding clause' as finding
from promo_totals t
where t.large_grocery and not t.funding_clause and t.status in ('proposed', 'agreed') and t.trade_spend_cents > 0
union all
select 'TP02', ref, customer || ' / ' || title,
  case when notice_on is null then 'funded promotion in store from ' || instore_start || ' with no written notice from the retailer on file'
       else 'written notice arrived ' || notice_on || ', only ' || (instore_start - notice_on) || ' days before the promotion started' end
from promo_totals t
where large_grocery and status = 'agreed' and trade_spend_cents > 0 and instore_start <= current_date + (select value from pol where key = 'notice_days')::int
  and (notice_on is null or instore_start - notice_on < (select value from pol where key = 'notice_days'))
union all
select 'TP03', w.ref, w.customer || ' / ' || w.product,
  'promotional order cut from ' || w.ordered_units || ' to ' || w.final_units || ' units (' || round(100.0 * (w.ordered_units - w.final_units) / w.ordered_units) || '%) with no written consent on file'
from line_work w join customers c on c.id = w.customer_id
where c.large_grocery and w.ordered_units > 0 and w.final_units is not null and w.cut_consent is null
  and (w.final_units = 0 or 100.0 * (w.ordered_units - w.final_units) / w.ordered_units > (select value from pol where key = 'order_cut_pct'))
union all
select 'TP04', ref, customer || ' / ' || retailer_ref,
  'set off ' || currency || ' ' || to_char(amount_cents / 100.0, 'FM999999990.00') || ' against your remittance with no written consent' || case when setoff_clause then ' (the agreement allows set-offs: check it was reasonable and explained)' else ' and no set-off clause in the agreement' end
from claim_work where large_grocery and method = 'setoff' and consent_ref is null and status <> 'written_off'
union all
select 'TP05', w.ref, w.customer || ' / ' || w.product,
  (w.final_units - w.actual_units) || ' of ' || w.final_units || ' units bought at the promotional price were not sold in the promotion: claim ' || w.currency || ' ' ||
  to_char((w.final_units - w.actual_units) * w.off_invoice_cents / 100.0, 'FM999999990.00') || ' back if they sold at full price'
from line_work w join customers c on c.id = w.customer_id
where c.large_grocery and w.phase = 'completed' and w.off_invoice_cents > 0 and w.final_units > 0 and w.actual_units is not null
  and 100.0 * (w.final_units - w.actual_units) / w.final_units > (select value from pol where key = 'overorder_pct')
union all
select 'TP06', ref, customer || ' / ' || retailer_ref,
  currency || ' ' || to_char(amount_cents / 100.0, 'FM999999990.00') || ' ' || kind || ' claim not matched to a promotion after ' || days_open || ' days'
from claim_work where status = 'open' and promotion is null and days_open > (select value from pol where key = 'unmatched_claim_days')
union all
select 'TP07', promotion, customer || ' / ' || kind || ' claims',
  'claimed ' || currency || ' ' || to_char(claimed / 100.0, 'FM999999990.00') || ' on ' || refs || ' against ' || to_char(expected_cents / 100.0, 'FM999999990.00') || ' expected (' ||
  to_char(100.0 * (claimed - expected_cents) / expected_cents, 'FM9990') || '% over)'
from (select promotion, customer, currency, kind, expected_cents, sum(amount_cents) as claimed, string_agg(ref, ', ' order by ref) as refs
  from claim_work where promotion is not null and expected_cents > 0 and status in ('open', 'matched', 'approved')
  group by promotion, customer, currency, kind, expected_cents) g
where claimed > expected_cents * (1 + (select value from pol where key = 'claim_tolerance_pct') / 100.0)
union all
select 'TP08', ref, customer || ' / ' || promotion,
  'claims sales from ' || period_from || ' to ' || period_to || ', outside the promotion (' || instore_start || ' to ' || instore_end || ')'
from claim_work where kind = 'scan' and promotion is not null and status not in ('written_off', 'disputed')
  and (period_from < instore_start or period_to > instore_end)
union all
select 'TP09', a.ref || ' and ' || b.ref, a.customer || ' / ' || coalesce(a.promotion, 'no promotion'),
  'same amount ' || a.currency || ' ' || to_char(a.amount_cents / 100.0, 'FM999999990.00') || ' claimed twice for the same period'
from claim_work a join claim_work b on a.customer_id = b.customer_id and a.amount_cents = b.amount_cents and a.id < b.id
  and a.kind = b.kind and coalesce(a.period_from, a.received_on) = coalesce(b.period_from, b.received_on)
  and a.status <> 'written_off' and b.status <> 'written_off'
union all
select 'TP10', w.ref, w.customer || ' / ' || w.product,
  'net price ' || w.currency || ' ' || to_char(w.net_cents / 100.0, 'FM999990.00') || ' after deals leaves a ' || coalesce(w.margin_pct::text, 'negative') || '% margin, under the ' || (select value from pol where key = 'margin_floor_pct') || '% floor'
from line_work w where w.phase in ('proposed', 'upcoming', 'live', 'draft') and (w.margin_pct is null or w.margin_pct < (select value from pol where key = 'margin_floor_pct'))
union all
select 'TP11', c.code || ' ' || i.notified_on, c.name,
  i.pct || '% price increase notified ' || i.notified_on || ', no written answer after ' || (current_date - i.notified_on) || ' days'
from price_increases i join customers c on c.id = i.customer_id
where c.country = 'AU' and c.large_grocery and i.response = 'pending' and current_date - i.notified_on > (select value from pol where key = 'price_response_days')
union all
select 'TP12', customer_code || ' ' || year_start, customer,
  'agreed trade spend ' || currency || ' ' || to_char(committed_cents / 100.0, 'FM999999990') || ' is over the ' || to_char(budget_cents / 100.0, 'FM999999990') || ' budget for the year from ' || year_start
from budget_work where committed_cents > budget_cents;
