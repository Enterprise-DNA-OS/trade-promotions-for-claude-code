// npm test: a temporary database, migrate twice, seed twice, then every CLI command with assertions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { seed } from './seed.mjs';
import { run, reads, usage, cents, monday } from './trade.mjs';
import { parseCsv } from './lib/csv.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'trade-smoke-'));
process.env.DATA_DIR = path.join(temp, 'db');
process.env.OUTPUT_DIR = temp;
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const db = await getDb();
const covered = new Set();
let checks = 0;
const check = (v, message) => { assert.ok(v, message); checks++; };
async function call(...args) { covered.add(args[0]); return run(db, args); }
async function fails(args, pattern) { covered.add(args[0]); await assert.rejects(() => run(db, args), pattern); checks++; }
const d = (await db.query("select current_date::text as today,(current_date+10)::text as soon,(current_date+23)::text as soon_end,(current_date-2)::text as recent,(current_date+60)::text as later,(current_date+73)::text as later_end"))[0];
const rules = async () => (await call('compliance')).map((f) => `${f.rule} ${f.ref}`);

try {
  await migrate(db);
  check((await migrate(db)).ran.length === 0, 'migration repeat is a no-op');
  if (db.mode === 'postgres') await db.exec('truncate audit,claims,promo_lines,promotions,scan_sales,trade_budgets,price_increases,product_prices,products,customers,policy cascade');
  await seed(db); await seed(db);
  check((await db.query('select count(*)::int n from promo_lines'))[0].n === 12, 'seed is idempotent');
  check((await db.query('select count(*)::int n from scan_sales'))[0].n === 480, 'sixteen weeks of scan data for 30 products');

  for (const cmd of Object.keys(reads)) check(Array.isArray(await call(cmd)), cmd + ' returns rows');
  check((await call('help')).length === Object.keys(usage).length, 'help lists every command');

  // The seeded problems show up where an owner would look.
  const found = await call('compliance');
  for (const r of ['TP01', 'TP02', 'TP03', 'TP04', 'TP05', 'TP06', 'TP07', 'TP08', 'TP09', 'TP10', 'TP11', 'TP12']) check(found.some((f) => f.rule === r), 'compliance finds ' + r);
  check(found.find((f) => f.rule === 'TP01').ref === 'PRM-2404', 'funding with no clause');
  check(found.find((f) => f.rule === 'TP03').finding.includes('3600 to 2880 units (20%)'), 'order cut, exact');
  check(found.filter((f) => f.rule === 'TP05').map((f) => f.finding).join(' ').includes('NZD 800.00'), 'leftover promotional stock, exact');
  check(found.filter((f) => f.rule === 'TP07').length === 3, 'over-claims by promotion');
  check(found.find((f) => f.rule === 'TP07' && f.ref === 'PRM-2402').finding.includes('15% over'), 'over-claim percent');
  check(found.find((f) => f.rule === 'TP09').ref === 'CLM-5005 and CLM-5006', 'same claim twice');
  check(found.find((f) => f.rule === 'TP10').finding.includes('6.7%'), 'margin floor');
  check(found.find((f) => f.rule === 'TP12').finding.includes('NZD 10220'), 'over budget');
  check(!found.some((f) => f.ref === 'PRM-2406' && f.rule === 'TP03'), 'a cut with consent is not flagged');
  const att = await call('attention');
  for (const w of ['live or starting soon, not agreed', 'claim to match', 'claim to approve']) check(att.some((r) => r.what === w), 'attention: ' + w);
  check((await call('promotions')).length === 8 && (await call('promotions'))[0].phase === 'live', 'live promotions first');
  check((await call('calendar')).map((r) => r.ref).join() === 'PRM-2403,PRM-2405,PRM-2404,PRM-2407', 'calendar in store order');
  const acc = await call('accruals');
  check(Number(acc.find((r) => r.ref === 'PRM-2403').open_cents) === 126000, 'live accrual on scan units');
  check(Number(acc.find((r) => r.ref === 'PRM-2401').open_cents) === 0, 'claimed accrual closes');
  const ev = await call('evaluation');
  check(ev.length === 3 && Number(ev.find((r) => r.ref === 'PRM-2401').roi) === 0.33 && Number(ev.find((r) => r.ref === 'PRM-2406').incremental_gp_cents) < 0, 'post-event ROI');
  check(Number((await call('budgets')).find((r) => r.customer === 'SGC-NZ').remaining_cents) === -422000, 'budget remaining');
  check((await call('deductions')).length === 6, 'claims to clear');
  check((await call('claims')).length === 9, 'claims list');
  check((await call('price-increases')).length === 3, 'price increases');
  check((await call('prices')).length === 30 && (await call('customers')).length === 5 && (await call('products')).length === 6, 'master data');
  const promo = await call('promotion', 'prm-2401');
  check(promo.lines.length === 2 && promo.claims.length === 2 && promo.findings.some((f) => f.rule === 'TP07'), 'promotion detail');
  check((await call('promotion', 'gondola')).findings.some((f) => f.rule === 'TP01'), 'promotion by title');
  const coast = await call('customer', 'coastline');
  check(coast.claims_open.length === 2 && coast.price_increases.length === 1, 'customer detail');
  check((await call('claim', 'CLM-5006')).findings.some((f) => f.rule === 'TP09'), 'claim detail shows a shared finding');
  const wr = await call('weekly-review');
  check(wr.compliance.length > 10 && wr.deductions.length === 6 && wr.evaluated_recently.length === 2, 'weekly review');
  await fails(['customer', 'a'], /Ambiguous customer/);
  await fails(['promotion', 'nothing-like-this'], /No matching promotion/);

  // Master data.
  await call('add-customer', '--code=test-nz', '--name=Test <script> Grocer', '--country=nz', '--manager=Sophie Lee', '--actor=Test');
  await fails(['add-customer', '--code=TEST-NZ', '--name=Dup', '--country=NZ', '--actor=T'], /unique|duplicate/);
  await fails(['add-customer', '--code=X', '--name=X', '--country=UK', '--actor=T'], /--country must be/);
  await fails(['add-customer', '--code=X', '--name=X', '--country=NZ', '--large=maybe', '--actor=T'], /yes or no/);
  await fails(['add-customer', '--code=X', '--name=X', '--country=NZ'], /--actor is required/);
  await call('add-product', '--sku=test-sku', '--name=Test Oatcakes 150g', '--category=Crackers', '--case=10', '--actor=Test');
  await fails(['set-price', 'TEST-NZ', 'TEST-SKU', '--list=4', '--cost=-1', '--actor=T'], /Money must be/);
  const price = await call('set-price', 'TEST-NZ', 'TEST-SKU', '--list=4.00', '--cost=2.00', '--shelf=6.99', '--baseline=100', '--actor=Test');
  check(Number(price.list_cents) === 400 && price.baseline_units_week === 100, 'price set');
  check(Number((await call('set-price', 'TEST-NZ', 'TEST-SKU', '--list=4.20', '--cost=2.00', '--actor=Test')).shelf_cents) === 699, 'price update keeps the shelf price');

  // A promotion from draft to claim.
  const p = await call('new-promotion', 'TEST-NZ', '--title=Oatcakes launch', '--mechanic=TPR', `--start=${d.soon}`, `--end=${d.soon_end}`, '--actor=Test');
  check(/^PRM-\d{4}$/.test(p.ref) && p.status === 'draft', 'new promotion gets a reference');
  await fails(['new-promotion', 'TEST-NZ', '--title=X', '--mechanic=tpr', `--start=${d.soon_end}`, `--end=${d.soon}`, '--actor=T'], /before --start/);
  await fails(['new-promotion', 'TEST-NZ', '--title=X', '--mechanic=tpr', `--start=${d.soon}`, `--end=${d.soon_end}`, '--fixed=500', '--actor=T'], /--fixed-kind/);
  await fails(['propose', p.ref, '--actor=T'], /no products/);
  await fails(['agree', p.ref, '--by=Sophie Lee', '--actor=T'], /no products/);
  await fails(['add-line', p.ref, 'TRF-CRK-SS', '--actor=T'], /No price/);
  await fails(['add-line', p.ref, 'TEST-SKU', '--off-invoice=3', '--scan=1.20', '--actor=T'], /not below the list price/);
  const line = await call('add-line', p.ref, 'test-sku', '--promo-price=4.99', '--off-invoice=0.30', '--scan=0.50', '--forecast=1000', '--actor=Test');
  check(Number(line.net_cents) === 340 && Number(line.margin_pct) === 41.2 && line.baseline_units === 200, 'net price, margin and baseline over two weeks');
  await call('propose', p.ref, '--actor=Test');
  await fails(['propose', p.ref, '--actor=T'], /only a draft/);
  await fails(['agree', p.ref, '--by=Sophie Lee', '--actor=T'], /record why the funding is reasonable/);
  const agreed = await call('agree', p.ref, '--by=Sophie Lee', '--reason=Launch support for a new line; both sides gain trial', '--actor=Test');
  check(agreed.findings.some((f) => f.rule === 'TP01') && agreed.findings.some((f) => f.rule === 'TP02'), 'agreeing shows the code checks');
  await fails(['add-line', p.ref, 'TEST-SKU', '--actor=T'], /only draft or proposed/);
  const n = await call('notice', p.ref, `--date=${d.today}`, '--actor=Test');
  check(n.days_notice === 10 && (await rules()).includes(`TP02 ${p.ref}`), 'short notice still flagged');
  await call('notice', p.ref, `--date=${d.recent}`, '--actor=Test');
  await fails(['order', p.ref, 'TRF-CRK-SS', '--ordered=10', '--actor=T'], /not on/);
  const cut = await call('order', p.ref, 'TEST-SKU', '--ordered=1200', '--final=900', '--actor=Test');
  check(cut.cut_pct === 25 && (await rules()).includes(`TP03 ${p.ref}`), 'order cut without consent');
  await call('order', p.ref, 'TEST-SKU', '--ordered=1200', '--final=900', '--consent=Email 12 Oct from the buyer', '--actor=Test');
  check(!(await rules()).includes(`TP03 ${p.ref}`), 'consent clears the cut');

  // Claims.
  const k = await call('add-claim', 'TEST-NZ', '--retailer-ref=T-SC-1', `--date=${d.today}`, '--kind=scan', '--amount=500.00', `--from=${d.soon}`, `--to=${d.soon_end}`, '--actor=Test');
  check(k.status === 'open' && /^CLM-\d{4}$/.test(k.ref), 'claim recorded');
  await fails(['add-claim', 'TEST-NZ', '--retailer-ref=T-SC-1', `--date=${d.today}`, '--kind=scan', '--amount=1', '--actor=T'], /unique|duplicate/);
  await fails(['add-claim', 'TEST-NZ', '--retailer-ref=T-X', `--date=${d.today}`, '--kind=gift', '--amount=1', '--actor=T'], /--kind must be/);
  await fails(['approve-claim', k.ref, '--actor=T'], /match it to a promotion/);
  await fails(['match', k.ref, 'PRM-2401', '--actor=T'], /is for HSM-NZ/);
  await fails(['match', k.ref, 'PRM-2405', '--actor=T'], /is for HSM-NZ|agreed promotions only/);
  const m = await call('match', k.ref, p.ref, '--actor=Test');
  check(Number(m.claim[0].expected_cents) === 50000, 'expected scan claim from forecast units');
  await call('approve-claim', k.ref, '--actor=Sophie Lee');
  await fails(['approve-claim', k.ref, '--actor=T'], /is approved/);
  await fails(['approve-claim', 'CLM-5006', '--actor=T'], /fails a check/);
  const s = await call('add-claim', 'TEST-NZ', '--retailer-ref=T-DED-1', `--date=${d.today}`, '--kind=other', '--amount=99.50', '--method=setoff', '--actor=Test');
  check((await rules()).includes(`TP04 ${s.ref}`), 'set-off without consent');
  await call('consent', s.ref, '--ref=Letter 14 Oct', '--actor=Test');
  check(!(await rules()).includes(`TP04 ${s.ref}`), 'consent clears the set-off');
  await fails(['consent', k.ref, '--ref=x', '--actor=T'], /not a set-off/);
  await call('dispute', s.ref, '--reason=No agreement behind it', '--actor=Test');
  await fails(['match', s.ref, p.ref, '--actor=T'], /only open or matched/);
  check((await call('write-off', s.ref, '--reason=Agreed with the retailer to drop it', '--actor=Test')).status === 'written_off', 'write-off after dispute');
  await fails(['dispute', s.ref, '--reason=x', '--actor=T'], /written_off/);
  await fails(['cancel', p.ref, '--reason=x', '--actor=T'], /claims matched/);
  const p2 = await call('new-promotion', 'TEST-NZ', '--title=Oatcakes winter', '--mechanic=display', `--start=${d.later}`, `--end=${d.later_end}`, '--fixed=1500', '--fixed-kind=display', '--actor=Test');
  check((await call('cancel', p2.ref, '--reason=Ranging moved', '--actor=Test')).status === 'cancelled', 'cancel');
  await fails(['cancel', p2.ref, '--reason=x', '--actor=T'], /already cancelled/);

  // Budgets and price increases.
  const b = await call('budget', 'TEST-NZ', '--amount=300', '--actor=Test');
  check(Number(b.committed_cents) === 27000 + 50000 && (await rules()).some((r) => r.startsWith('TP12 TEST-NZ')), 'budget against agreed spend');
  check((await call('budget', 'TEST-NZ', '--amount=5000', '--year=2027', '--actor=Test')).year_start === '2027-07-01', 'budget for another year');
  const pi = await call('price-increase', 'CSM-AU', `--notified=${d.today}`, `--effective=${d.later}`, '--pct=3', '--actor=Test');
  check(pi.answer_due.includes('30 days'), 'AU price increase deadline');
  await fails(['price-increase', 'CSM-AU', `--notified=${d.later}`, `--effective=${d.today}`, '--pct=3', '--actor=T'], /before --notified/);
  await fails(['price-increase', 'CSM-AU', `--notified=${d.today}`, `--effective=${d.later}`, '--pct=120', '--actor=T'], /--pct/);
  const pr = await call('price-response', 'CSM-AU', '--response=partial', `--date=${d.today}`, '--actor=Test');
  check(pr.response === 'partial' && !(await rules()).some((r) => r.startsWith('TP11')), 'answering the oldest increase clears TP11');
  await fails(['price-response', 'HSM-NZ', '--response=accepted', `--date=${d.today}`, '--actor=T'], /No pending/);

  // Imports.
  await fails(['import', 'promax', '--file=examples/promax-promotions.csv', '--actor=T'], /stopped before writing anything/);
  check((await db.query("select count(*)::int n from promotions where ref like 'PMX-%'"))[0].n === 0, 'a stopped import writes nothing');
  const dry = await call('import', 'promax', '--file=examples/promax-promotions.csv', '--map=examples/import-map.json', '--dry-run', '--actor=Test');
  check(dry.dry_run && dry.promotions_added === 3 && (await db.query("select count(*)::int n from promotions where ref like 'PMX-%'"))[0].n === 0, 'dry run rolls back');
  const imp = await call('import', 'promax', '--file=examples/promax-promotions.csv', '--map=examples/import-map.json', '--actor=Test');
  check(imp.promotions_added === 3 && imp.lines_added === 4, 'Promax promotions imported');
  const pmx = (await db.query("select status,mechanic,fixed_cents from promotions where ref='PMX-88131'"))[0];
  check(pmx.status === 'proposed' && pmx.mechanic === 'catalogue' && Number(pmx.fixed_cents) === 350000, 'status, mechanic and fixed spend mapped');
  check((await call('import', 'promax', '--file=examples/promax-promotions.csv', '--map=examples/import-map.json', '--actor=Test')).promotions_unchanged === 3, 'import repeat is a no-op');
  const ci = await call('import', 'claims', '--file=examples/retailer-claims.csv', '--actor=Test');
  check(ci.added === 2 && ci.matched === 1, 'retailer claims imported and matched');
  check((await db.query("select method from claims where retailer_ref='DED-90115'"))[0].method === 'setoff', 'remittance deduction is a set-off');
  check((await call('import', 'claims', '--file=examples/retailer-claims.csv', '--actor=Test')).unchanged === 2, 'claims repeat is a no-op');
  const si = await call('import', 'scan', '--file=examples/scan-data.csv', '--actor=Test');
  check(si.weeks_added === 4, 'scan weeks imported');
  check((await call('import', 'scan', '--file=examples/scan-data.csv', '--actor=Test')).weeks_updated === 4, 'scan repeat updates');
  check(Number((await db.query("select actual_units from promo_totals where ref='PMX-88104'"))[0].actual_units) === 2890, 'scan weeks land in the promotion');
  await fails(['import', 'tradeedge', '--file=x.csv', '--actor=T'], /supports promax, claims and scan/);
  assert.equal(monday('2027-02-07'), '2027-02-01'); assert.equal(monday('2027-02-01'), '2027-02-01'); checks += 2;

  // Drafts, export, history.
  const dd = await call('draft-dispute', 'CLM-5006', '--actor=Daniel Brooks');
  const letter = fs.readFileSync(dd.file, 'utf8');
  check(letter.startsWith('# DRAFT') && letter.includes('CSM-SC-32255') && letter.includes('claimed twice'), 'dispute letter drafted');
  check(fs.readFileSync((await call('draft-dispute', 'CLM-5004', '--actor=Daniel Brooks')).file, 'utf8').includes('written consent'), 'set-off dispute names consent');
  await fails(['draft-dispute', 'CLM-5002', '--actor=T'], /Nothing to dispute/);
  const rv = await call('draft-review', '--actor=Test');
  check(fs.readFileSync(rv.file, 'utf8').includes('## Checks that failed'), 'weekly review drafted');
  const ex = await call('export', `--file=${path.join(temp, 'backup.json')}`);
  check(JSON.parse(fs.readFileSync(ex.file, 'utf8')).promotions.length === 13, 'export holds every promotion');
  await fails(['export', `--file=${ex.file}`], /EEXIST/);
  await fails(['claims', '--json=yes'], /flag without a value/);
  await fails(['claims', '--oops'], /Unknown option/);
  await fails(['not-a-command'], /Unknown command/);
  await fails(['promotion'], /Usage/);
  await assert.rejects(() => db.query("update audit set actor='x'"), /append-only/); checks++;
  await assert.rejects(() => db.query('delete from claims'), /append-only/); checks++;
  await assert.rejects(() => db.query("update scan_sales set week_start=week_start+1 where id=(select id from scan_sales limit 1)"), /check/); checks++;
  check((await call('history')).some((r) => r.action === 'import promax'), 'audit trail');
  check((await call('policy')).length === 7, 'policy');
  assert.throws(() => cents('0')); assert.throws(() => cents('1e3')); assert.equal(cents('0', { zero: true }), 0); assert.equal(cents('0.01'), 1); checks += 4;
  check(parseCsv('﻿a,b\r\n"x,1","2"\r\n')[0].a === 'x,1', 'quoted CSV');

  await db.close();
  for (const script of ['view', 'docs']) {
    const r = spawnSync(process.execPath, ['scripts/' + script + '.mjs'], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
    check(r.status === 0, script + ': ' + r.stderr);
  }
  const html = fs.readdirSync(path.join(temp, 'views')).map((f) => fs.readFileSync(path.join(temp, 'views', f), 'utf8')).join('');
  check(html.includes('Test &lt;script&gt;') && !html.includes('Test <script>'), 'HTML escapes record text');
  check(fs.readdirSync(path.join(temp, 'docs-out')).length === 4, 'four documents rendered');
  const cli = spawnSync(process.execPath, ['scripts/trade.mjs', 'claims', '--json'], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  check(cli.status === 0 && Array.isArray(JSON.parse(cli.stdout)), 'CLI JSON');
  const amb = spawnSync(process.execPath, ['scripts/trade.mjs', 'customer', 'a', '--json'], { cwd: REPO_ROOT, env: process.env, encoding: 'utf8' });
  const ambJson = String(amb.stderr).split(/\r?\n/).find((l) => l.startsWith('{"error"'));
  check(amb.status === 1 && ambJson && JSON.parse(ambJson).candidates.length > 1, `ambiguous name lists candidates and exits 1 (status ${amb.status}): ${amb.stderr}`);
  for (const command of Object.keys(usage)) check(covered.has(command), 'not exercised: ' + command);
  console.log(`PASS: ${checks} checks; ${Object.keys(usage).length} CLI commands; ${process.env.TEST_DATABASE_URL ? 'PostgreSQL' : 'PGlite'}`);
} finally {
  try { await db.close(); } catch {}
  fs.rmSync(temp, { recursive: true, force: true });
}
