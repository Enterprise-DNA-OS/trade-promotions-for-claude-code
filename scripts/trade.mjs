#!/usr/bin/env node
// The one CLI for trade promotions. Human tables by default, --json for machines.
//   npm run trade -- help
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table } from './lib/format.mjs';
import { parseCsv } from './lib/csv.mjs';

const pol = (k) => `(select value from policy where key='${k}')`;

export const reads = {
  customers: 'select code,name,country,currency,large_grocery,funding_clause,setoff_clause,payment_days,account_manager from customers where active order by country,code',
  products: 'select sku,name,brand,category,units_per_case from products where active order by category,sku',
  prices: 'select c.code as customer,p.sku,p.name as product,c.currency,pp.list_cents,pp.cost_cents,pp.shelf_cents,round(100.0*(pp.list_cents-pp.cost_cents)/pp.list_cents,1) as margin_pct,pp.baseline_units_week from product_prices pp join customers c on c.id=pp.customer_id join products p on p.id=pp.product_id order by c.code,p.sku',
  calendar: "select instore_start,instore_end,ref,customer_code as customer,title,mechanic,phase,lines,forecast_units,currency,trade_spend_cents,notice_on from promo_totals where phase in ('draft','proposed','upcoming','live') order by instore_start,customer_code",
  promotions: "select ref,customer_code as customer,title,mechanic,phase,instore_start,instore_end,lines,currency,trade_spend_cents,claimed_cents from promo_totals order by array_position(array['live','upcoming','proposed','draft','completed','cancelled'],phase),instore_start,ref",
  accruals: 'select customer_code as customer,ref,phase,instore_start,instore_end,currency,accrued_cents,claimed_cents,open_cents,basis from accruals order by customer_code,instore_start',
  claims: "select ref,customer_code as customer,retailer_ref,received_on,kind,method,currency,amount_cents,promotion,expected_cents,status from claim_work order by array_position(array['open','matched','disputed','approved','written_off'],status),received_on,ref",
  deductions: `select w.ref,w.customer_code as customer,w.retailer_ref,w.received_on,w.days_open,w.kind,w.method,w.currency,w.amount_cents,w.status,w.promotion,
      (select string_agg(t.ref,', ' order by t.instore_start) from promo_totals t where t.customer_id=w.customer_id and t.status='agreed' and w.promotion is null
        and t.instore_start<=coalesce(w.period_to,w.received_on) and t.instore_end>=coalesce(w.period_from,w.received_on-60)) as could_be
    from claim_work w where w.status in ('open','matched','disputed') order by w.days_open desc,w.ref`,
  budgets: 'select customer_code as customer,year_start,currency,budget_cents,committed_cents,proposed_cents,spent_cents,remaining_cents from budget_work order by year_start desc,customer_code',
  evaluation: 'select ref,customer_code as customer,title,mechanic,instore_start,baseline_units,units,uplift_pct,currency,trade_spend_cents,incremental_gp_cents,roi,measured from evaluation order by instore_start desc',
  'price-increases': 'select c.code as customer,c.country,i.notified_on,i.effective_on,i.pct,i.response,i.responded_on,(coalesce(i.responded_on,current_date)-i.notified_on) as days,i.note from price_increases i join customers c on c.id=i.customer_id order by i.notified_on desc',
  attention: `select what,item,detail from (
    select 1 as ord,'live or starting soon, not agreed' as what,ref as item,customer||', in store '||instore_start||', still '||status as detail from promo_totals where status in ('draft','proposed') and instore_start<=current_date+${pol('notice_days')}::int
    union all select 2,'claim to match',ref,customer||' '||retailer_ref||', '||currency||' '||to_char(amount_cents/100.0,'FM999999990.00')||', '||days_open||' days' from claim_work where status='open' and promotion is null
    union all select 3,'claim to approve',ref,customer||' '||retailer_ref||' on '||promotion||', '||currency||' '||to_char(amount_cents/100.0,'FM999999990.00') from claim_work where status='matched'
    union all select 4,'promotion ended, not evaluated',ref,customer||', ended '||instore_end||', no scan data' from promo_totals where phase='completed' and actual_units is null and lines>0
    union all select 5,'open accrual',ref,customer||', '||currency||' '||to_char(open_cents/100.0,'FM999999990.00')||' not yet claimed' from accruals where phase='completed' and open_cents>0
    union all select 6,'check '||rule,ref,subject||': '||finding from compliance_findings
  ) a order by ord,item`,
  compliance: 'select rule,ref,subject,finding from compliance_findings order by rule,ref',
  history: 'select action,record_id,actor,detail,created_at from audit order by created_at,id',
  policy: 'select key,value,note from policy order by key',
};

export const usage = {
  ...Object.fromEntries(Object.keys(reads).map((k) => [k, k])),
  promotion: 'promotion <ref>',
  customer: 'customer <code-or-name>',
  claim: 'claim <ref>',
  'weekly-review': 'weekly-review',
  'add-customer': 'add-customer --code= --name= --country=NZ|AU [--currency=] [--large=yes|no] [--funding-clause=yes|no] [--setoff-clause=yes|no] [--payment-days=] [--manager=] --actor=',
  'add-product': 'add-product --sku= --name= [--brand=] [--category=] [--case=] --actor=',
  'set-price': 'set-price <customer> <sku> --list= --cost= [--shelf=] [--baseline=] --actor=',
  'new-promotion': 'new-promotion <customer> --title= --mechanic=tpr|multibuy|catalogue|display|online|other --start=YYYY-MM-DD --end=YYYY-MM-DD [--fixed=] [--fixed-kind=] [--owner=] --actor=',
  'add-line': 'add-line <promotion> <sku> [--promo-price=] [--off-invoice=] [--scan=] [--forecast=] --actor=',
  propose: 'propose <promotion> --actor=',
  agree: 'agree <promotion> --by= [--reason=] [--date=] --actor=',
  notice: 'notice <promotion> --date= --actor=',
  order: 'order <promotion> <sku> --ordered= [--final=] [--consent=] --actor=',
  cancel: 'cancel <promotion> --reason= --actor=',
  'add-claim': 'add-claim <customer> --retailer-ref= --date= --kind=scan|fixed|other --amount= [--from=] [--to=] [--method=invoice|setoff] [--consent=] [--note=] --actor=',
  match: 'match <claim> <promotion> --actor=',
  'approve-claim': 'approve-claim <claim> --actor=',
  dispute: 'dispute <claim> --reason= --actor=',
  'write-off': 'write-off <claim> --reason= --actor=',
  consent: 'consent <claim> --ref= --actor=',
  budget: 'budget <customer> --amount= [--year=YYYY] --actor=',
  'price-increase': 'price-increase <customer> --notified= --effective= --pct= [--note=] --actor=',
  'price-response': 'price-response <customer> --response=accepted|partial|declined --date= --actor=',
  import: 'import promax|claims|scan --file= [--map=examples/import-map.json] [--dry-run] --actor=',
  export: 'export --file=exports/backup.json',
  'draft-dispute': 'draft-dispute <claim> --actor=',
  'draft-review': 'draft-review --actor=',
};

const allowed = {
  'add-customer': ['code', 'name', 'country', 'currency', 'large', 'funding-clause', 'setoff-clause', 'payment-days', 'manager'],
  'add-product': ['sku', 'name', 'brand', 'category', 'case'],
  'set-price': ['list', 'cost', 'shelf', 'baseline'],
  'new-promotion': ['title', 'mechanic', 'start', 'end', 'fixed', 'fixed-kind', 'owner'],
  'add-line': ['promo-price', 'off-invoice', 'scan', 'forecast'],
  propose: [], agree: ['by', 'reason', 'date'], notice: ['date'], order: ['ordered', 'final', 'consent'], cancel: ['reason'],
  'add-claim': ['retailer-ref', 'date', 'kind', 'amount', 'from', 'to', 'method', 'consent', 'note'],
  match: [], 'approve-claim': [], dispute: ['reason'], 'write-off': ['reason'], consent: ['ref'], budget: ['amount', 'year'],
  'price-increase': ['notified', 'effective', 'pct', 'note'], 'price-response': ['response', 'date'],
  import: ['file', 'map', 'dry-run'], export: ['file'], 'draft-dispute': [], 'draft-review': [],
};
const positional = {
  promotion: 1, customer: 1, claim: 1, 'set-price': 2, 'new-promotion': 1, 'add-line': 2, propose: 1, agree: 1, notice: 1, order: 2, cancel: 1,
  'add-claim': 1, match: 2, 'approve-claim': 1, dispute: 1, 'write-off': 1, consent: 1, budget: 1, 'price-increase': 1, 'price-response': 1,
  import: 1, 'draft-dispute': 1,
};
const BOOLEAN = ['json', 'dry-run'];

export function parse(args) {
  const opts = {}, pos = [];
  for (const a of args) {
    if (a.startsWith('--')) {
      const i = a.indexOf('=');
      const k = a.slice(2, i < 0 ? undefined : i);
      if (k in opts) throw Error(`Repeated --${k}`);
      opts[k] = i < 0 ? true : a.slice(i + 1);
    } else pos.push(a);
  }
  return { opts, pos };
}
const required = (o, k) => { const v = o[k]; if (typeof v !== 'string' || !v.trim()) throw Error(`--${k} is required`); return v.trim(); };
const optional = (o, k) => (o[k] === undefined ? null : required(o, k));

// Dollars to cents. Prices and claims are above zero; a per-unit deal rate may be zero.
export function cents(v, { zero = false } = {}) {
  const s = String(v).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw Error('Money must be a decimal with at most two decimals, no currency symbols or separators');
  const [a, b = ''] = s.split('.');
  const n = Number(a) * 100 + Number(b.padEnd(2, '0'));
  if (!Number.isSafeInteger(n) || n > 10000000000) throw Error('Amount must be below 100,000,000');
  if (n <= 0 && !zero) throw Error('Amount must be above zero');
  return n;
}
function date(v) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) !== v) throw Error('Use a valid YYYY-MM-DD date');
  return v;
}
// The Monday of the week a date falls in: scan weeks are stored by their Monday.
export function monday(v) {
  const d = new Date(date(v) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
function int(v, name, min = 0) {
  if (!/^\d+$/.test(String(v)) || Number(v) < min) throw Error(`--${name} must be a whole number of at least ${min}`);
  return Number(v);
}
function yesNoFlag(v, name, dflt) {
  if (v === undefined) return dflt;
  const s = String(v).toLowerCase();
  if (['yes', 'y', 'true'].includes(s)) return true;
  if (['no', 'n', 'false'].includes(s)) return false;
  throw Error(`--${name} must be yes or no`);
}
function oneOf(v, list, name) { if (!list.includes(v)) throw Error(`--${name} must be one of ${list.join(', ')}`); return v; }
const MECHANICS = ['tpr', 'multibuy', 'catalogue', 'display', 'online', 'other'];
const tx = async (db, fn) => { await db.exec('BEGIN'); try { const r = await fn(); await db.exec('COMMIT'); return r; } catch (e) { await db.exec('ROLLBACK'); throw e; } };

// Exact id prefix or exact label first, then a case-insensitive contains match. More than one is an error with candidates.
async function resolve(db, sql, label, needle, what) {
  let rows = await db.query(`select * from (${sql}) r where r.id::text like $1 or lower(r.${label}::text)=lower($2) order by r.${label}`, [needle.toLowerCase() + '%', needle]);
  if (!rows.length) rows = await db.query(`select * from (${sql}) r where position(lower($1) in lower(r.${label}::text))>0 order by r.${label}`, [needle]);
  if (rows.length !== 1) {
    const err = Error(rows.length ? `Ambiguous ${what}; use the full code or reference` : `No matching ${what}: ${needle}`);
    err.candidates = rows.map((r) => ({ id: r.id, [label]: r[label], ...(r.code && label !== 'code' ? { code: r.code } : {}), ...(r.ref && label !== 'ref' ? { ref: r.ref } : {}) }));
    throw err;
  }
  return rows[0];
}
async function byKeyOr(db, sql, key, label, needle, what) {
  const exact = await db.query(`select * from (${sql}) r where lower(r.${key})=lower($1)`, [needle]);
  return exact.length === 1 ? exact[0] : resolve(db, sql, label, needle, what);
}
const findCustomer = (db, n) => byKeyOr(db, 'select * from customers', 'code', 'name', n, 'customer');
const findProduct = (db, n) => byKeyOr(db, 'select * from products', 'sku', 'name', n, 'product');
const promoSql = 'select p.*,c.code as customer_code,c.name as customer,c.currency,c.large_grocery from promotions p join customers c on c.id=p.customer_id';
const findPromotion = (db, n) => byKeyOr(db, promoSql, 'ref', 'title', n, 'promotion');
const claimSql = 'select k.*,c.code as customer_code,c.name as customer,c.currency from claims k join customers c on c.id=k.customer_id';
const findClaim = (db, n) => byKeyOr(db, claimSql, 'ref', 'retailer_ref', n, 'claim');

const audit = (db, action, id, actor, detail) => db.query('insert into audit(action,record_id,actor,detail) values($1,$2,$3,$4)', [action, id, actor, JSON.stringify(detail)]);
const today = async (db) => (await db.query('select current_date::text as d'))[0].d;
const editable = (p) => { if (!['draft', 'proposed'].includes(p.status)) throw Error(`${p.ref} is ${p.status}; only draft or proposed promotions change their deal`); };
const undecided = (c) => { if (!['open', 'matched'].includes(c.status)) throw Error(`${c.ref} is ${c.status}; only open or matched claims change`); };
const dollars = (c, cur) => `${cur} ${(Number(c) / 100).toFixed(2)}`;

async function promotionDetail(db, p) {
  return {
    promotion: await db.query('select ref,customer,title,mechanic,phase,instore_start,instore_end,weeks,owner,agreed_on,notice_on,currency,fixed_cents,fixed_kind,trade_spend_cents,claimed_cents,funding_reason from promo_totals where id=$1', [p.id]),
    lines: await db.query('select sku,product,shelf_cents,promo_shelf_cents,list_cents,off_invoice_cents,scan_cents,net_cents,margin_pct,baseline_units,forecast_units,ordered_units,final_units,actual_units from line_work where promotion_id=$1 order by sku', [p.id]),
    claims: await db.query('select ref,retailer_ref,received_on,kind,method,amount_cents,status from claims where promotion_id=$1 order by received_on', [p.id]),
    findings: await db.query("select rule,subject,finding from compliance_findings where ref=$1 or subject like '%/ '||$1 order by rule", [p.ref]),
  };
}

async function review(db) {
  const out = {};
  for (const k of ['calendar', 'deductions', 'accruals', 'compliance']) out[k] = await db.query(reads[k]);
  out.calendar = out.calendar.filter((r) => String(r.instore_start) <= new Date(Date.now() + 42 * 86400000).toISOString().slice(0, 10));
  out.evaluated_recently = await db.query("select ref,customer_code as customer,title,uplift_pct,currency,trade_spend_cents,incremental_gp_cents,roi from evaluation where instore_end>=current_date-56 order by instore_end desc");
  out.budgets = await db.query(reads.budgets + '');
  return out;
}

function draftFile(name, content) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}-${randomUUID().slice(0, 8)}.md`);
  fs.writeFileSync(file, content, { flag: 'wx' });
  return file;
}

export async function run(db, args) {
  const { opts: o, pos } = parse(args);
  const cmd = pos.shift() || 'help';
  if (cmd === 'help' || o.help) return Object.entries(usage).map(([command, syntax]) => ({ command, syntax }));
  if (!(cmd in usage)) throw Error(`Unknown command ${cmd}. Run help for the list.`);
  for (const f of BOOLEAN) if (f in o && o[f] !== true) throw Error(`--${f} is a flag without a value`);
  for (const k of Object.keys(o)) if (!['json', 'actor', ...(allowed[cmd] || [])].includes(k)) throw Error(`Unknown option --${k} for ${cmd}`);
  if (pos.length !== (positional[cmd] || 0)) throw Error(`Usage: ${usage[cmd]}`);

  if (cmd in reads) return db.query(reads[cmd]);
  if (cmd === 'promotion') return promotionDetail(db, await findPromotion(db, pos[0]));
  if (cmd === 'customer') {
    const c = await findCustomer(db, pos[0]);
    return {
      customer: await db.query('select code,name,country,currency,large_grocery,funding_clause,setoff_clause,payment_days,account_manager from customers where id=$1', [c.id]),
      promotions: await db.query('select ref,title,mechanic,phase,instore_start,instore_end,trade_spend_cents,claimed_cents from promo_totals where customer_id=$1 order by instore_start desc', [c.id]),
      claims_open: await db.query("select ref,retailer_ref,received_on,kind,method,amount_cents,promotion,status from claim_work where customer_id=$1 and status in ('open','matched','disputed') order by received_on", [c.id]),
      budget: await db.query('select year_start,budget_cents,committed_cents,spent_cents,remaining_cents from budget_work where customer_code=$1 order by year_start desc', [c.code]),
      price_increases: await db.query('select notified_on,effective_on,pct,response,responded_on from price_increases where customer_id=$1 order by notified_on desc', [c.id]),
    };
  }
  if (cmd === 'claim') {
    const c = await findClaim(db, pos[0]);
    return {
      claim: await db.query('select ref,customer,retailer_ref,received_on,kind,method,consent_ref,currency,amount_cents,period_from,period_to,promotion,expected_cents,status,decided_by,decided_on,note from claim_work where id=$1', [c.id]),
      findings: await db.query("select rule,finding from compliance_findings where ref=$1 or ref like $1||' and %' or ref like '% and '||$1 order by rule", [c.ref]),
    };
  }
  if (cmd === 'weekly-review') return review(db);
  if (cmd === 'export') {
    const file = path.resolve(REPO_ROOT, required(o, 'file'));
    const data = await tx(db, async () => {
      const out = { version: 1, exported_at: new Date().toISOString() };
      for (const t of ['customers', 'products', 'product_prices', 'promotions', 'promo_lines', 'scan_sales', 'claims', 'trade_budgets', 'price_increases', 'policy', 'audit']) out[t] = await db.query(`select * from ${t} order by ${t === 'policy' ? 'key' : 'id'}`);
      return out;
    });
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
    return { file, records: Object.values(data).filter(Array.isArray).reduce((n, a) => n + a.length, 0) };
  }

  const actor = required(o, 'actor');
  if (cmd === 'import') {
    if (pos[0] === 'promax') return importPromax(db, o, actor);
    if (pos[0] === 'claims') return importClaims(db, o, actor);
    if (pos[0] === 'scan') return importScan(db, o, actor);
    throw Error('Import supports promax, claims and scan');
  }
  if (cmd === 'draft-dispute') {
    const c = await findClaim(db, pos[0]);
    const w = (await db.query('select * from claim_work where id=$1', [c.id]))[0];
    const findings = await db.query("select rule,finding from compliance_findings where ref=$1 or ref like $1||' and %' or ref like '% and '||$1 or (ref=$2 and rule='TP07' and subject like '%/ '||$3||' claims') order by rule", [c.ref, w.promotion || '', c.kind]);
    if (!findings.length && c.status !== 'disputed') throw Error(`Nothing to dispute on ${c.ref}: no check failed and it is not marked disputed`);
    const reasons = findings.map((f) => `- ${f.finding}`).join('\n') || `- ${c.note || 'See our note on this claim.'}`;
    const file = draftFile(`dispute-${c.ref.toLowerCase()}`, `# DRAFT: review before sending\n\nTo: ${c.customer} accounts payable\nSubject: Claim ${c.retailer_ref} (${dollars(c.amount_cents, c.currency)}): query\n\nHello,\n\nWe have received your ${c.method === 'setoff' ? 'deduction' : 'claim'} ${c.retailer_ref} dated ${w.received_on} for ${dollars(c.amount_cents, c.currency)}${w.promotion ? `, which we have matched to our promotion ${w.promotion} (${w.instore_start} to ${w.instore_end})` : ''}.\n\nBefore we can accept it:\n\n${reasons}\n\nPlease send the scan data or agreement reference behind this amount${c.method === 'setoff' ? ', and note that we have not given written consent to this amount being set off against our invoices' : ''}. Until then we are holding it as disputed.\n\nKind regards,\n${actor}\n`);
    await audit(db, 'draft-dispute', c.id, actor, { file: path.basename(file) });
    return { file, claim: c.ref, reasons: findings.length };
  }
  if (cmd === 'draft-review') {
    const r = await review(db);
    const line = (rows, f) => rows.map(f).join('\n') || '- Nothing.';
    const file = draftFile('weekly-review', `# DRAFT: trade promotions review, week of ${await today(db)}\n\n## In store in the next six weeks\n${line(r.calendar, (x) => `- ${x.instore_start} ${x.ref} ${x.customer} ${x.title} (${x.phase})`)}\n\n## Claims and deductions to clear\n${line(r.deductions, (x) => `- ${x.ref} ${x.customer} ${x.retailer_ref} ${dollars(x.amount_cents, x.currency)}, ${x.status}${x.could_be ? `, could be ${x.could_be}` : ''}`)}\n\n## Open accruals\n${line(r.accruals.filter((x) => Number(x.open_cents) > 0), (x) => `- ${x.ref} ${x.customer} ${dollars(x.open_cents, x.currency)} not yet claimed`)}\n\n## Checks that failed\n${line(r.compliance, (x) => `- ${x.rule} ${x.ref}: ${x.finding}`)}\n\n## Recent promotions\n${line(r.evaluated_recently, (x) => `- ${x.ref} ${x.customer}: uplift ${x.uplift_pct ?? 'n/a'}%, spend ${dollars(x.trade_spend_cents, x.currency)}, extra gross profit ${dollars(x.incremental_gp_cents, x.currency)}`)}\n`);
    await audit(db, 'draft-review', null, actor, { file: path.basename(file) });
    return { file, sections: 5 };
  }

  return tx(db, async () => {
    if (cmd === 'add-customer') {
      const country = oneOf(required(o, 'country').toUpperCase(), ['NZ', 'AU'], 'country');
      const cur = optional(o, 'currency') || (country === 'NZ' ? 'NZD' : 'AUD');
      if (!/^[A-Z]{3}$/.test(cur)) throw Error('Currency must be three uppercase letters');
      const row = (await db.query('insert into customers(code,name,country,currency,large_grocery,funding_clause,setoff_clause,payment_days,account_manager) values(upper($1),$2,$3,$4,$5,$6,$7,$8,$9) returning code,name,country,currency,large_grocery,funding_clause,setoff_clause,payment_days,account_manager,id',
        [required(o, 'code'), required(o, 'name'), country, cur, yesNoFlag(o.large, 'large', true), yesNoFlag(o['funding-clause'], 'funding-clause', false), yesNoFlag(o['setoff-clause'], 'setoff-clause', false), o['payment-days'] === undefined ? 30 : int(o['payment-days'], 'payment-days'), optional(o, 'manager')]))[0];
      await audit(db, cmd, row.id, actor, { code: row.code });
      return row;
    }
    if (cmd === 'add-product') {
      const row = (await db.query('insert into products(sku,name,brand,category,units_per_case) values(upper($1),$2,coalesce($3,$6),coalesce($4,$7),$5) returning sku,name,brand,category,units_per_case,id',
        [required(o, 'sku'), required(o, 'name'), optional(o, 'brand'), optional(o, 'category'), o.case === undefined ? 12 : int(o.case, 'case', 1), 'House', 'General']))[0];
      await audit(db, cmd, row.id, actor, { sku: row.sku });
      return row;
    }
    if (cmd === 'set-price') {
      const c = await findCustomer(db, pos[0]); const p = await findProduct(db, pos[1]);
      const v = [c.id, p.id, cents(required(o, 'list')), cents(required(o, 'cost')), o.shelf === undefined ? null : cents(required(o, 'shelf')), o.baseline === undefined ? null : int(o.baseline, 'baseline')];
      const old = (await db.query('select list_cents,cost_cents,shelf_cents,baseline_units_week from product_prices where customer_id=$1 and product_id=$2', [c.id, p.id]))[0] || null;
      const row = (await db.query(`insert into product_prices(customer_id,product_id,list_cents,cost_cents,shelf_cents,baseline_units_week) values($1,$2,$3,$4,$5,coalesce($6,0))
        on conflict (customer_id,product_id) do update set list_cents=excluded.list_cents,cost_cents=excluded.cost_cents,shelf_cents=coalesce($5,product_prices.shelf_cents),baseline_units_week=coalesce($6,product_prices.baseline_units_week)
        returning id,list_cents,cost_cents,shelf_cents,baseline_units_week`, v))[0];
      await audit(db, cmd, row.id, actor, { customer: c.code, sku: p.sku, old, new: row });
      return { customer: c.code, sku: p.sku, currency: c.currency, ...row };
    }
    if (cmd === 'new-promotion') {
      const c = await findCustomer(db, pos[0]);
      const start = date(required(o, 'start')), end = date(required(o, 'end'));
      if (end < start) throw Error('--end is before --start');
      const fixed = o.fixed === undefined ? 0 : cents(required(o, 'fixed'));
      if (fixed && !o['fixed-kind']) throw Error('--fixed-kind is required with --fixed (catalogue, display, co-op)');
      const row = (await db.query("insert into promotions(customer_id,title,mechanic,instore_start,instore_end,fixed_cents,fixed_kind,owner) values($1,$2,$3,$4,$5,$6,$7,coalesce($8,$9)) returning ref,title,mechanic,status,instore_start,instore_end,fixed_cents,id",
        [c.id, required(o, 'title'), oneOf(required(o, 'mechanic').toLowerCase(), MECHANICS, 'mechanic'), start, end, fixed, optional(o, 'fixed-kind'), optional(o, 'owner'), c.account_manager]))[0];
      await audit(db, cmd, row.id, actor, { ref: row.ref, customer: c.code });
      return { customer: c.code, ...row };
    }
    if (cmd === 'add-line') {
      const p = await findPromotion(db, pos[0]); editable(p);
      const pr = await findProduct(db, pos[1]);
      const price = (await db.query('select * from product_prices where customer_id=$1 and product_id=$2', [p.customer_id, pr.id]))[0];
      if (!price) throw Error(`No price for ${pr.sku} at ${p.customer_code}; run set-price first`);
      const off = o['off-invoice'] === undefined ? 0 : cents(required(o, 'off-invoice'), { zero: true });
      const scan = o.scan === undefined ? 0 : cents(required(o, 'scan'), { zero: true });
      if (off + scan >= Number(price.list_cents)) throw Error(`Deals of ${dollars(off + scan, p.currency)} a unit are not below the list price ${dollars(price.list_cents, p.currency)}`);
      const row = (await db.query(`insert into promo_lines(promotion_id,product_id,promo_shelf_cents,off_invoice_cents,scan_cents,forecast_units) values($1,$2,$3,$4,$5,$6)
        on conflict (promotion_id,product_id) do update set promo_shelf_cents=excluded.promo_shelf_cents,off_invoice_cents=excluded.off_invoice_cents,scan_cents=excluded.scan_cents,forecast_units=excluded.forecast_units returning id`,
        [p.id, pr.id, o['promo-price'] === undefined ? null : cents(required(o, 'promo-price')), off, scan, o.forecast === undefined ? 0 : int(o.forecast, 'forecast')]))[0];
      await audit(db, cmd, row.id, actor, { ref: p.ref, sku: pr.sku, off, scan });
      return (await db.query('select ref,sku,product,currency,list_cents,off_invoice_cents,scan_cents,net_cents,margin_pct,baseline_units,forecast_units from line_work where id=$1', [row.id]))[0];
    }
    if (cmd === 'propose') {
      const p = await findPromotion(db, pos[0]);
      if (p.status !== 'draft') throw Error(`${p.ref} is ${p.status}; only a draft is proposed`);
      if (!(await db.query('select 1 from promo_lines where promotion_id=$1', [p.id])).length) throw Error(`${p.ref} has no products; add-line first`);
      await db.query("update promotions set status='proposed',proposed_on=current_date where id=$1", [p.id]);
      await audit(db, cmd, p.id, actor, { ref: p.ref });
      return { ref: p.ref, status: 'proposed' };
    }
    if (cmd === 'agree') {
      const p = await findPromotion(db, pos[0]);
      if (!['draft', 'proposed'].includes(p.status)) throw Error(`${p.ref} is ${p.status}`);
      if (!(await db.query('select 1 from promo_lines where promotion_id=$1', [p.id])).length) throw Error(`${p.ref} has no products; add-line first`);
      const reason = optional(o, 'reason') || p.funding_reason;
      if (p.large_grocery && !reason) throw Error(`${p.customer} is covered by the grocery code: record why the funding is reasonable for both sides with --reason`);
      await db.query("update promotions set status='agreed',agreed_on=coalesce($2::date,current_date),agreed_by=$3,funding_reason=$4,proposed_on=coalesce(proposed_on,current_date) where id=$1", [p.id, o.date === undefined ? null : date(required(o, 'date')), required(o, 'by'), reason]);
      await audit(db, cmd, p.id, actor, { ref: p.ref, by: o.by });
      return { ref: p.ref, status: 'agreed', findings: (await promotionDetail(db, p)).findings };
    }
    if (cmd === 'notice') {
      const p = await findPromotion(db, pos[0]);
      if (p.status === 'cancelled') throw Error(`${p.ref} is cancelled`);
      await db.query('update promotions set notice_on=$2 where id=$1', [p.id, date(required(o, 'date'))]);
      await audit(db, cmd, p.id, actor, { ref: p.ref, notice_on: o.date });
      return (await db.query('select ref,instore_start,notice_on,(instore_start-notice_on) as days_notice from promotions where id=$1', [p.id]))[0];
    }
    if (cmd === 'order') {
      const p = await findPromotion(db, pos[0]);
      if (p.status !== 'agreed') throw Error(`${p.ref} is ${p.status}; record orders on an agreed promotion`);
      const pr = await findProduct(db, pos[1]);
      const ordered = int(required(o, 'ordered'), 'ordered'), final = o.final === undefined ? ordered : int(required(o, 'final'), 'final');
      const rows = await db.query('update promo_lines set ordered_units=$3,final_units=$4,cut_consent=$5 where promotion_id=$1 and product_id=$2 returning id', [p.id, pr.id, ordered, final, optional(o, 'consent')]);
      if (!rows.length) throw Error(`${pr.sku} is not on ${p.ref}`);
      await audit(db, cmd, rows[0].id, actor, { ref: p.ref, sku: pr.sku, ordered, final, consent: o.consent || null });
      return { ref: p.ref, sku: pr.sku, ordered_units: ordered, final_units: final, cut_pct: ordered ? Math.round((100 * (ordered - final)) / ordered) : 0, consent: o.consent || null };
    }
    if (cmd === 'cancel') {
      const p = await findPromotion(db, pos[0]);
      if (p.status === 'cancelled') throw Error(`${p.ref} is already cancelled`);
      if ((await db.query("select 1 from claims where promotion_id=$1 and status in ('matched','approved')", [p.id])).length) throw Error(`${p.ref} has claims matched to it; unmatch or dispute them first`);
      await db.query("update promotions set status='cancelled',cancelled_reason=$2 where id=$1", [p.id, required(o, 'reason')]);
      await audit(db, cmd, p.id, actor, { ref: p.ref, reason: o.reason });
      return { ref: p.ref, status: 'cancelled' };
    }
    if (cmd === 'add-claim') {
      const c = await findCustomer(db, pos[0]);
      const from = o.from === undefined ? null : date(required(o, 'from')), to = o.to === undefined ? null : date(required(o, 'to'));
      if (from && to && to < from) throw Error('--to is before --from');
      const row = (await db.query('insert into claims(customer_id,retailer_ref,received_on,kind,amount_cents,period_from,period_to,method,consent_ref,note) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning ref,retailer_ref,kind,method,amount_cents,status,id',
        [c.id, required(o, 'retailer-ref'), date(required(o, 'date')), oneOf(required(o, 'kind'), ['scan', 'fixed', 'other'], 'kind'), cents(required(o, 'amount')), from, to, o.method === undefined ? 'invoice' : oneOf(required(o, 'method'), ['invoice', 'setoff'], 'method'), optional(o, 'consent'), optional(o, 'note')]))[0];
      await audit(db, cmd, row.id, actor, { ref: row.ref, customer: c.code });
      return { customer: c.code, currency: c.currency, ...row };
    }
    if (cmd === 'match') {
      const c = await findClaim(db, pos[0]); undecided(c);
      const p = await findPromotion(db, pos[1]);
      if (p.customer_id !== c.customer_id) throw Error(`${p.ref} is for ${p.customer_code}, but ${c.ref} came from ${c.customer_code}`);
      if (p.status !== 'agreed') throw Error(`${p.ref} is ${p.status}; claims match agreed promotions only`);
      await db.query("update claims set promotion_id=$2,status='matched' where id=$1", [c.id, p.id]);
      await audit(db, cmd, c.id, actor, { claim: c.ref, promotion: p.ref });
      return (await run(db, ['claim', c.ref]));
    }
    if (cmd === 'approve-claim') {
      const c = await findClaim(db, pos[0]);
      if (c.status !== 'matched') throw Error(`${c.ref} is ${c.status}; match it to a promotion before approving`);
      const blocking = await db.query("select rule,finding from compliance_findings where rule in ('TP04','TP07','TP08','TP09') and (ref=$1 or ref like $1||' and %' or ref like '% and '||$1 or ref=(select ref from promotions where id=$2))", [c.ref, c.promotion_id]);
      if (blocking.length) { const e = Error(`${c.ref} fails a check; dispute it or fix the record first`); e.candidates = blocking; throw e; }
      await db.query("update claims set status='approved',decided_by=$2,decided_on=current_date where id=$1", [c.id, actor]);
      await audit(db, cmd, c.id, actor, { claim: c.ref, amount_cents: c.amount_cents });
      return { ref: c.ref, status: 'approved' };
    }
    if (cmd === 'dispute' || cmd === 'write-off') {
      const c = await findClaim(db, pos[0]);
      if (!['open', 'matched', ...(cmd === 'write-off' ? ['disputed'] : [])].includes(c.status)) throw Error(`${c.ref} is ${c.status}`);
      const status = cmd === 'dispute' ? 'disputed' : 'written_off';
      await db.query('update claims set status=$2,decided_by=$3,decided_on=current_date,note=$4 where id=$1', [c.id, status, actor, required(o, 'reason')]);
      await audit(db, cmd, c.id, actor, { claim: c.ref, reason: o.reason });
      return { ref: c.ref, status };
    }
    if (cmd === 'consent') {
      const c = await findClaim(db, pos[0]);
      if (c.method !== 'setoff') throw Error(`${c.ref} was not a set-off`);
      await db.query('update claims set consent_ref=$2 where id=$1', [c.id, required(o, 'ref')]);
      await audit(db, cmd, c.id, actor, { claim: c.ref, consent: o.ref });
      return { ref: c.ref, consent_ref: o.ref };
    }
    if (cmd === 'budget') {
      const c = await findCustomer(db, pos[0]);
      const year = o.year === undefined ? (await db.query('select trade_year(current_date)::text as y'))[0].y : `${int(required(o, 'year'), 'year', 2000)}-07-01`;
      const row = (await db.query('insert into trade_budgets(customer_id,year_start,budget_cents) values($1,$2,$3) on conflict (customer_id,year_start) do update set budget_cents=excluded.budget_cents returning id,year_start,budget_cents', [c.id, year, cents(required(o, 'amount'), { zero: true })]))[0];
      await audit(db, cmd, row.id, actor, { customer: c.code, year, budget_cents: row.budget_cents });
      return (await db.query('select customer_code as customer,year_start,currency,budget_cents,committed_cents,remaining_cents from budget_work where id=$1', [row.id]))[0];
    }
    if (cmd === 'price-increase') {
      const c = await findCustomer(db, pos[0]);
      const pct = String(required(o, 'pct'));
      if (!/^\d+(\.\d{1,2})?$/.test(pct) || Number(pct) <= 0 || Number(pct) >= 100) throw Error('--pct must be a percentage above 0 and below 100');
      const notified = date(required(o, 'notified')), effective = date(required(o, 'effective'));
      if (effective < notified) throw Error('--effective is before --notified');
      const row = (await db.query('insert into price_increases(customer_id,notified_on,effective_on,pct,note) values($1,$2,$3,$4,$5) returning id,notified_on,effective_on,pct,response', [c.id, notified, effective, pct, optional(o, 'note')]))[0];
      await audit(db, cmd, row.id, actor, { customer: c.code, pct });
      return { customer: c.code, ...row, answer_due: c.country === 'AU' && c.large_grocery ? 'in writing within 30 days (AU s40(2))' : 'no code deadline' };
    }
    if (cmd === 'price-response') {
      const c = await findCustomer(db, pos[0]);
      const rows = await db.query("update price_increases set response=$2,responded_on=$3 where id=(select id from price_increases where customer_id=$1 and response='pending' order by notified_on limit 1) returning notified_on,pct,response,responded_on,(responded_on-notified_on) as days,id",
        [c.id, oneOf(required(o, 'response'), ['accepted', 'partial', 'declined'], 'response'), date(required(o, 'date'))]);
      if (!rows.length) throw Error(`No pending price increase for ${c.code}`);
      if (rows[0].days < 0) throw Error('--date is before the increase was notified');
      await audit(db, cmd, rows[0].id, actor, { customer: c.code, response: o.response });
      return { customer: c.code, ...rows[0] };
    }
    throw Error(`Unhandled command ${cmd}`);
  });
}

// Promax promotion export, saved as CSV: one row per promotion and product.
// These are the common headings; anything else goes in a mapping file (examples/import-map.json).
const aliases = {
  promotion: ['Promotion ID', 'Promotion Number', 'Promo ID', 'Event ID'], customer: ['Customer', 'Customer Code', 'Account', 'Banner'],
  title: ['Promotion Name', 'Promotion Description', 'Event Name', 'Description'], mechanic: ['Mechanic', 'Promotion Type', 'Tactic'],
  start: ['Start Date', 'In Store Start', 'Instore Start', 'Promo Start'], end: ['End Date', 'In Store End', 'Instore End', 'Promo End'],
  status: ['Status', 'Promotion Status', 'Approval Status'], product: ['Product Code', 'SKU', 'Material', 'Item Code'],
  promo_price: ['Promo Price', 'Promotional Shelf Price', 'Promo RRP'], off_invoice: ['Off Invoice', 'Off Invoice Rate', 'OI Rate'],
  scan: ['Scan', 'Scan Rate', 'Scan Deal'], forecast: ['Forecast Units', 'Forecast Volume', 'Volume'], fixed: ['Fixed Amount', 'Fixed Spend', 'Lump Sum'],
};
function columnReader(map) {
  for (const [k, v] of Object.entries(map)) if (!(k in aliases) || typeof v !== 'string' || !v) throw Error('Invalid column mapping ' + k);
  return (row, k) => {
    const names = map[k] ? [map[k]] : aliases[k];
    const hits = Object.keys(row).filter((h) => names.some((n) => n.toLowerCase() === h.toLowerCase()));
    if (hits.length > 1) throw Error('Ambiguous columns for ' + k + ': ' + hits.join(', '));
    return hits.length ? String(row[hits[0]]).trim() : '';
  };
}
const dmy = (v) => { const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(v); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : v; };
const money = (v, opts) => (v === '' ? 0 : cents(v.replace(/[$,\s]/g, ''), opts));
function promaxStatus(v) {
  const s = v.toLowerCase();
  if (/cancel|reject|deleted/.test(s)) return 'cancelled';
  if (/approved|confirmed|committed|closed|complete|agreed/.test(s)) return 'agreed';
  if (/submitted|pending|proposed|planned/.test(s)) return 'proposed';
  return 'draft';
}
function promaxMechanic(v, map) {
  const s = (map[v.toLowerCase()] || v).toLowerCase();
  if (MECHANICS.includes(s)) return s;
  if (/multi|2 for|3 for|bundle/.test(s)) return 'multibuy';
  if (/cat|mailer/.test(s)) return 'catalogue';
  if (/display|gondola|end|bin/.test(s)) return 'display';
  if (/online|digital/.test(s)) return 'online';
  if (/tpr|price|discount|half/.test(s)) return 'tpr';
  return 'other';
}
async function importPromax(db, o, actor) {
  const mapping = o.map ? JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, required(o, 'map')), 'utf8')) : {};
  const value = columnReader(mapping.columns || {});
  const custMap = Object.fromEntries(Object.entries(mapping.customers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const prodMap = Object.fromEntries(Object.entries(mapping.products || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const mechMap = Object.fromEntries(Object.entries(mapping.mechanics || {}).map(([k, v]) => [k.toLowerCase(), v]));
  const rows = parseCsv(fs.readFileSync(path.resolve(REPO_ROOT, required(o, 'file')), 'utf8'));
  if (!rows.length) throw Error('CSV contains no records');
  const customers = await db.query('select * from customers');
  const products = await db.query('select * from products');
  const custOf = (v) => { const w = (custMap[v.toLowerCase()] || v).toLowerCase(); return customers.find((c) => c.code.toLowerCase() === w || c.name.toLowerCase() === w); };
  const prodOf = (v) => { const w = (prodMap[v.toLowerCase()] || v).toLowerCase(); return products.find((p) => p.sku.toLowerCase() === w); };
  const unknownCust = new Set(), unknownProd = new Set();
  const clean = rows.map((row, i) => {
    try {
      const id = value(row, 'promotion'); if (!id) throw Error('promotion id is empty');
      const cv = value(row, 'customer'); const c = custOf(cv); if (!c) unknownCust.add(cv || '(blank)');
      const pv = value(row, 'product'); const p = prodOf(pv); if (!p) unknownProd.add(pv || '(blank)');
      const start = date(dmy(value(row, 'start'))), end = date(dmy(value(row, 'end')));
      if (end < start) throw Error('end date is before start date');
      return { id, c, p, start, end, title: value(row, 'title') || `Promax ${id}`, mechanic: promaxMechanic(value(row, 'mechanic'), mechMap), status: promaxStatus(value(row, 'status')),
        promo: value(row, 'promo_price') ? money(value(row, 'promo_price')) : null, off: money(value(row, 'off_invoice'), { zero: true }), scan: money(value(row, 'scan'), { zero: true }),
        forecast: value(row, 'forecast') ? int(value(row, 'forecast').replace(/,/g, ''), 'forecast') : 0, fixed: money(value(row, 'fixed'), { zero: true }) };
    } catch (e) { throw Error(`Row ${i + 2}: ${e.message}`); }
  });
  if (unknownCust.size || unknownProd.size) {
    const err = Error(`Import stopped before writing anything. ${unknownCust.size ? `Add or map these customers (add-customer, or "customers" in the mapping file): ${[...unknownCust].join(', ')}. ` : ''}${unknownProd.size ? `Add or map these products (add-product, or "products" in the mapping file): ${[...unknownProd].join(', ')}.` : ''}`.trim());
    err.candidates = [...[...unknownCust].map((v) => ({ customer: v })), ...[...unknownProd].map((v) => ({ product: v }))];
    throw err;
  }
  const promos = new Map();
  for (const r of clean) { if (!promos.has(r.id)) promos.set(r.id, []); promos.get(r.id).push(r); }
  return tx(db, async () => {
    let added = 0, lines = 0, unchanged = 0, noPrice = 0;
    for (const [id, rs] of promos) {
      const ref = `PMX-${id}`;
      if (new Set(rs.map((r) => r.c.id)).size > 1) throw Error(`Promotion ${id} has rows for more than one customer`);
      const existing = (await db.query('select id,(select count(*)::int from promo_lines where promotion_id=promotions.id) as n from promotions where ref=$1', [ref]))[0];
      if (existing) { if (existing.n === rs.length) { unchanged++; continue; } throw Error(`${ref} is already here with ${existing.n} lines; the file has ${rs.length}. Review before importing.`); }
      const f = rs[0];
      const fixed = Math.max(...rs.map((r) => r.fixed));
      const p = (await db.query("insert into promotions(ref,customer_id,title,mechanic,status,instore_start,instore_end,fixed_cents,fixed_kind,owner,proposed_on,agreed_on,agreed_by,cancelled_reason,source) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'promax') returning id",
        [ref, f.c.id, f.title, f.mechanic, f.status, f.start, f.end, fixed, fixed ? 'imported' : null, f.c.account_manager, f.status === 'draft' ? null : f.start, f.status === 'agreed' ? f.start : null, f.status === 'agreed' ? 'Promax import' : null, f.status === 'cancelled' ? 'Cancelled in Promax' : null]))[0];
      for (const r of rs) {
        if (!(await db.query('select 1 from product_prices where customer_id=$1 and product_id=$2', [r.c.id, r.p.id])).length) noPrice++;
        await db.query('insert into promo_lines(promotion_id,product_id,promo_shelf_cents,off_invoice_cents,scan_cents,forecast_units) values($1,$2,$3,$4,$5,$6)', [p.id, r.p.id, r.promo, r.off, r.scan, r.forecast]);
        lines++;
      }
      added++;
    }
    await audit(db, 'import promax', null, actor, { file: path.basename(o.file), rows: clean.length, promotions: added, lines, unchanged });
    if (o['dry-run']) { await db.exec('ROLLBACK'); await db.exec('BEGIN'); }
    return { rows: clean.length, promotions: promos.size, promotions_added: added, lines_added: lines, promotions_unchanged: unchanged, lines_without_price: noPrice, dry_run: !!o['dry-run'],
      note: 'Approved Promax promotions land as agreed with the start date as the agreed date. Record the retailer notice and any funding reason before they go live.' };
  });
}

// A retailer's claims or deductions, saved as CSV from its supplier portal or remittance advice.
async function importClaims(db, o, actor) {
  const rows = parseCsv(fs.readFileSync(path.resolve(REPO_ROOT, required(o, 'file')), 'utf8'));
  if (!rows.length) throw Error('CSV contains no records');
  const pick = (row, ...names) => { const k = Object.keys(row).find((h) => names.some((n) => n.toLowerCase() === h.toLowerCase())); return k === undefined ? '' : String(row[k]).trim(); };
  return tx(db, async () => {
    let added = 0, unchanged = 0, matched = 0;
    for (const [i, row] of rows.entries()) {
      try {
        const c = await findCustomer(db, pick(row, 'customer', 'customer code', 'retailer') || '(blank)');
        const ref = pick(row, 'claim number', 'claim no', 'deduction number', 'reference', 'document number');
        if (!ref) throw Error('claim number is empty');
        const amount = money(pick(row, 'amount', 'claim amount', 'deduction amount', 'amount ex gst'));
        const kindRaw = pick(row, 'type', 'claim type', 'kind').toLowerCase();
        const kind = /scan/.test(kindRaw) ? 'scan' : /catalog|display|fixed|lump|co-op|coop/.test(kindRaw) ? 'fixed' : 'other';
        const method = /deduct|set.?off|remit/i.test(pick(row, 'method', 'payment method', 'settlement')) ? 'setoff' : 'invoice';
        const received = date(dmy(pick(row, 'date', 'claim date', 'document date')));
        const from = pick(row, 'period from', 'from'), to = pick(row, 'period to', 'to');
        const old = (await db.query('select amount_cents from claims where customer_id=$1 and retailer_ref=$2', [c.id, ref]))[0];
        if (old) { if (Number(old.amount_cents) === amount) { unchanged++; continue; } throw Error(`claim ${ref} is already recorded with a different amount`); }
        const promoRef = pick(row, 'promotion', 'promotion id', 'promo id', 'deal reference');
        let promotionId = null;
        if (promoRef) {
          const p = (await db.query("select id from promotions where customer_id=$1 and status='agreed' and (lower(ref)=lower($2) or lower(ref)=lower('PMX-'||$2))", [c.id, promoRef]))[0];
          if (p) { promotionId = p.id; matched++; }
        }
        await db.query("insert into claims(customer_id,retailer_ref,received_on,kind,amount_cents,period_from,period_to,method,promotion_id,status,source) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'import')",
          [c.id, ref, received, kind, amount, from ? date(dmy(from)) : null, to ? date(dmy(to)) : null, method, promotionId, promotionId ? 'matched' : 'open']);
        added++;
      } catch (e) { throw Error(`Row ${i + 2}: ${e.message}`); }
    }
    await audit(db, 'import claims', null, actor, { file: path.basename(o.file), rows: rows.length, added, unchanged, matched });
    if (o['dry-run']) { await db.exec('ROLLBACK'); await db.exec('BEGIN'); }
    return { rows: rows.length, added, matched, unchanged, dry_run: !!o['dry-run'] };
  });
}

// Weekly scan or depletion data: customer, product, week, units, value. Any day in the week is moved to its Monday.
async function importScan(db, o, actor) {
  const rows = parseCsv(fs.readFileSync(path.resolve(REPO_ROOT, required(o, 'file')), 'utf8'));
  if (!rows.length) throw Error('CSV contains no records');
  const pick = (row, ...names) => { const k = Object.keys(row).find((h) => names.some((n) => n.toLowerCase() === h.toLowerCase())); return k === undefined ? '' : String(row[k]).trim(); };
  return tx(db, async () => {
    let added = 0, updated = 0;
    for (const [i, row] of rows.entries()) {
      try {
        const c = await findCustomer(db, pick(row, 'customer', 'customer code', 'retailer') || '(blank)');
        const p = await findProduct(db, pick(row, 'sku', 'product code', 'item code', 'article') || '(blank)');
        const week = monday(dmy(pick(row, 'week', 'week starting', 'week ending', 'week start', 'date')));
        const units = int(pick(row, 'units', 'qty', 'quantity', 'scan units').replace(/,/g, ''), 'units');
        const valueRaw = pick(row, 'value', 'sales value', 'dollars', 'scan value');
        const val = valueRaw ? money(valueRaw, { zero: true }) : 0;
        const r = (await db.query(`insert into scan_sales(customer_id,product_id,week_start,units,value_cents,source) values($1,$2,$3,$4,$5,$6)
          on conflict (customer_id,product_id,week_start) do update set units=excluded.units,value_cents=excluded.value_cents,source=excluded.source returning (xmax = 0) as inserted`, [c.id, p.id, week, units, val, path.basename(o.file)]))[0];
        if (r.inserted) added++; else updated++;
      } catch (e) { throw Error(`Row ${i + 2}: ${e.message}`); }
    }
    await audit(db, 'import scan', null, actor, { file: path.basename(o.file), rows: rows.length, added, updated });
    if (o['dry-run']) { await db.exec('ROLLBACK'); await db.exec('BEGIN'); }
    return { rows: rows.length, weeks_added: added, weeks_updated: updated, dry_run: !!o['dry-run'] };
  });
}

export function human(value) {
  if (Array.isArray(value)) {
    if (!value.length) return '(none)';
    const keys = [...new Set(value.flatMap(Object.keys))].filter((k) => k !== 'id');
    return table(value, keys.map((key) => ({
      key, label: key.replace(/_cents$/, '').replace(/_/g, ' '),
      align: /(_cents|_units|_pct|_days|units|lines|days|days_open|roi|pct|weeks)$/.test(key) ? 'right' : undefined,
      format: (v) => v == null ? '' : key.endsWith('_cents') ? (Number(v) / 100).toFixed(2) : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'boolean' ? (v ? 'yes' : 'no') : typeof v === 'object' ? JSON.stringify(v) : String(v),
    })));
  }
  if (value && typeof value === 'object') {
    if (Object.values(value).every((v) => v === null || typeof v !== 'object' || v instanceof Date)) return human([value]);
    return Object.entries(value).map(([k, v]) => `${k.replace(/_/g, ' ')}\n${v && typeof v === 'object' && !(v instanceof Date) ? human(Array.isArray(v) ? v : [v]) : String(v)}`).join('\n\n');
  }
  return String(value);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let db;
  try {
    db = await getDb();
    const result = await run(db, process.argv.slice(2));
    console.log(process.argv.includes('--json') ? JSON.stringify(result, null, 2) : human(result));
  } catch (e) {
    if (process.argv.includes('--json')) console.error(JSON.stringify({ error: e.message, candidates: e.candidates || [] }));
    else { console.error(e.message); if (e.candidates?.length) console.error(human(e.candidates)); }
    process.exitCode = 1;
  } finally { if (db) await db.close(); }
}
