// @vitest-environment node
// Bank-line posting, depreciation, stock counts and the tax rate, run on the real migration SQL (PGlite).
import { describe, test, expect, beforeAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const sql = (f) => readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8')

let db
const asUser = async (uid, query, params = []) => {
  await db.exec('set role authenticated')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid])
  try { return await db.query(query, params) } finally { await db.exec('reset role') }
}
async function tenant(name) {
  const uid = randomUUID()
  await db.query('insert into profiles (id, tenant_id) values ($1, $2)', [uid, name])
  return { uid, name }
}
const balance = async (t, account) => Number((await db.query(
  `select coalesce(sum(debit_cents - credit_cents), 0) as b from journal_lines where tenant_id = $1 and account_code = $2`, [t.name, account])).rows[0].b)
const entries = async (t, source) => (await db.query(
  'select id, entry_date::text as d, memo from journal_entries where tenant_id = $1 and source_type = $2 order by entry_date', [t.name, source])).rows

const feeLines = (cents) => JSON.stringify([{ account: '6400', debit: cents, credit: 0 }, { account: '1000', debit: 0, credit: cents }])
const postBank = (t, key, cents = 12000, date = '2026-07-03') =>
  asUser(t.uid, 'select post_bank_line($1, $2, $3, $4::jsonb) as id', [key, date, 'Bank fee', feeLines(cents)]).then((r) => r.rows[0].id)
const addAsset = (t, { total = 1380000, vat = 180000, date = '2025-01-15', residual = 0, months = 12, funding = 'bank', name = 'Delivery fridge' } = {}) =>
  asUser(t.uid, 'select add_fixed_asset($1, $2, $3, $4, $5, $6, $7) as id', [name, total, vat, date, residual, months, funding]).then((r) => r.rows[0].id)
const depreciate = (t, through) => asUser(t.uid, 'select post_depreciation($1) as n', [through]).then((r) => r.rows[0].n)

beforeAll(async () => {
  db = new PGlite()
  await db.exec(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table profiles (id uuid primary key, tenant_id text not null);
    create function public.current_tenant_id() returns text language sql stable security definer set search_path = public as
      $$ select tenant_id from public.profiles where id = auth.uid() $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function public.current_tenant_id() to authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create schema vault;
    create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, description text, secret text);
    create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
    create function vault.create_secret(s text, n text, d text default '') returns uuid language sql as
      $$ insert into vault.secrets (secret, name, description) values (s, n, d) returning id $$;
    create function vault.update_secret(i uuid, s text) returns void language sql as
      $$ update vault.secrets set secret = s where id = i $$;
  `)
  for (const f of ['20261115a_invoicing_ledger.sql', '20261115b_mailbox_vault.sql', '20261115c_manual_journal_and_statements.sql', '20261115d_bank_depreciation_stock_tax.sql']) {
    await db.exec(sql(f))
  }
}, 60000)

describe('posting bank statement lines', () => {
  test('posts a balanced bank entry once, however many times it is asked', async () => {
    const t = await tenant('bk-once')
    const first = await postBank(t, 'db|2026-07-03|120|bank fee#1')
    const again = await postBank(t, 'db|2026-07-03|120|bank fee#1')
    expect(again).toBe(first)
    expect(await entries(t, 'bank')).toHaveLength(1)
    expect(await balance(t, '1000')).toBe(-12000)
    expect(await balance(t, '6400')).toBe(12000)
  })

  test('the same key for another client is a different line', async () => {
    const a = await tenant('bk-a'), b = await tenant('bk-b')
    await postBank(a, 'same-key'); await postBank(b, 'same-key')
    expect(await balance(a, '6400')).toBe(12000)
    expect(await balance(b, '6400')).toBe(12000)
  })

  test('must move the bank account and may not touch Debtors', async () => {
    const t = await tenant('bk-refuse')
    const noBank = JSON.stringify([{ account: '6400', debit: 100, credit: 0 }, { account: '3000', debit: 0, credit: 100 }])
    await expect(asUser(t.uid, 'select post_bank_line($1, $2, $3, $4::jsonb)', ['k1', '2026-07-03', 'x', noBank])).rejects.toThrow(/bank account/)
    const debtors = JSON.stringify([{ account: '1000', debit: 100, credit: 0 }, { account: '1100', debit: 0, credit: 100 }])
    await expect(asUser(t.uid, 'select post_bank_line($1, $2, $3, $4::jsonb)', ['k2', '2026-07-03', 'x', debtors])).rejects.toThrow(/Debtors/)
    const unbalanced = JSON.stringify([{ account: '1000', debit: 100, credit: 0 }, { account: '4000', debit: 0, credit: 90 }])
    await expect(asUser(t.uid, 'select post_bank_line($1, $2, $3, $4::jsonb)', ['k3', '2026-07-03', 'x', unbalanced])).rejects.toThrow(/not balanced/)
    expect(await entries(t, 'bank')).toHaveLength(0)
  })

  test('a wrongly posted line can be reversed and then posted again correctly', async () => {
    const t = await tenant('bk-fix')
    const wrong = await postBank(t, 'line-1', 50000)
    await asUser(t.uid, 'select reverse_journal_entry($1)', [wrong])
    expect(await balance(t, '6400')).toBe(0)
    const right = await postBank(t, 'line-1', 5000)
    expect(right).not.toBe(wrong)
    expect(await balance(t, '6400')).toBe(5000)
    const { rows } = await asUser(t.uid, 'select entry_id from bank_postings where line_key = $1', ['line-1'])
    expect(rows).toEqual([{ entry_id: right }])
  })

  test('a line can be set aside, and still posted later; a posted line cannot be set aside', async () => {
    const t = await tenant('bk-skip')
    await asUser(t.uid, 'select skip_bank_line($1)', ['transfer-1'])
    expect((await asUser(t.uid, 'select entry_id from bank_postings where line_key = $1', ['transfer-1'])).rows).toEqual([{ entry_id: null }])
    await postBank(t, 'transfer-1')
    expect(await balance(t, '6400')).toBe(12000)
    await expect(asUser(t.uid, 'select skip_bank_line($1)', ['transfer-1'])).rejects.toThrow(/already posted/)
  })

  test('clients only see their own posted lines and rules', async () => {
    const a = await tenant('bk-see-a'), b = await tenant('bk-see-b')
    await postBank(a, 'mine')
    await asUser(a.uid, "select save_bank_rule('Eskom', '6300', true)")
    expect((await asUser(b.uid, 'select * from bank_postings')).rows).toHaveLength(0)
    expect((await asUser(b.uid, 'select * from bank_rules')).rows).toHaveLength(0)
    expect((await asUser(a.uid, 'select match, account, vat from bank_rules')).rows).toEqual([{ match: 'eskom', account: '6300', vat: true }])
  })

  test('rules are remembered in lower case, replaced, deleted, and cannot point at the bank or Debtors', async () => {
    const t = await tenant('bk-rules')
    await asUser(t.uid, "select save_bank_rule('  Telkom ', '6300', false)")
    await asUser(t.uid, "select save_bank_rule('telkom', '6300', true)")
    expect((await asUser(t.uid, 'select match, vat from bank_rules')).rows).toEqual([{ match: 'telkom', vat: true }])
    await expect(asUser(t.uid, "select save_bank_rule('x', '6300', false)")).rejects.toThrow(/too short/)
    await expect(asUser(t.uid, "select save_bank_rule('telkom', '1000', false)")).rejects.toThrow(/Choose an account/)
    await asUser(t.uid, "select delete_bank_rule('TELKOM')")
    expect((await asUser(t.uid, 'select * from bank_rules')).rows).toHaveLength(0)
  })

  test('the browser cannot write the tables directly', async () => {
    const t = await tenant('bk-direct')
    await expect(asUser(t.uid, "insert into bank_postings (line_key) values ('x')")).rejects.toThrow(/permission denied/)
    await expect(asUser(t.uid, "insert into fixed_assets (name, cost_cents, purchase_date, life_months) values ('x', 1, '2026-01-01', 1)")).rejects.toThrow(/permission denied/)
  })
})

describe('equipment and depreciation', () => {
  test('buying equipment posts the cost without VAT, the VAT, and the payment', async () => {
    const t = await tenant('fa-buy')
    await addAsset(t)                                    // R13 800 incl VAT = R12 000 + R1 800 VAT
    expect(await balance(t, '1500')).toBe(1200000)
    expect(await balance(t, '2210')).toBe(180000)
    expect(await balance(t, '1000')).toBe(-1380000)
  })

  test('equipment you already owned is funded from owner equity and carries no VAT', async () => {
    const t = await tenant('fa-open')
    await addAsset(t, { total: 600000, vat: 0, funding: 'opening' })
    expect(await balance(t, '3000')).toBe(-600000)
    await expect(addAsset(t, { total: 600000, vat: 78000, funding: 'opening' })).rejects.toThrow(/no VAT/)
  })

  test('depreciates a whole month at a time, from the month of purchase, and never twice', async () => {
    const t = await tenant('fa-dep')
    await addAsset(t)                                    // R12 000 over 12 months from January 2025
    expect(await depreciate(t, '2025-03-31')).toBe(3)
    expect((await entries(t, 'depreciation')).map((e) => e.d)).toEqual(['2025-01-31', '2025-02-28', '2025-03-31'])
    expect(await balance(t, '6950')).toBe(300000)
    expect(await balance(t, '1510')).toBe(-300000)
    expect(await depreciate(t, '2025-03-31')).toBe(0)
    expect(await balance(t, '6950')).toBe(300000)
  })

  test('stops at the cost less the value left at the end, to the cent', async () => {
    const t = await tenant('fa-stop')
    await addAsset(t, { total: 100000, vat: 0, residual: 10000, months: 3 })     // R900 to write off over 3 months, 2025-01
    await depreciate(t, '2026-01-31')
    expect(await balance(t, '6950')).toBe(90000)
    expect(await balance(t, '1500') + await balance(t, '1510')).toBe(10000)
  })

  test('uneven amounts still add up exactly', async () => {
    const t = await tenant('fa-round')
    await addAsset(t, { total: 1000, vat: 0, months: 3, name: 'Thirds' })
    await depreciate(t, '2025-06-30')
    expect((await db.query(`select (debit_cents)::int as c from journal_lines where tenant_id = $1 and account_code = '6950' order by 1`, [t.name])).rows.map((r) => r.c)).toEqual([333, 333, 334])
    expect(await balance(t, '6950')).toBe(1000)
  })

  test('does not depreciate a month that has not finished', async () => {
    const t = await tenant('fa-future')
    const startOfThisMonth = new Date().toISOString().slice(0, 7) + '-01'
    await addAsset(t, { date: startOfThisMonth })
    expect(await depreciate(t, '2099-12-31')).toBe(0)
  })

  test('equipment added late catches up month by month, each month dated to itself', async () => {
    const t = await tenant('fa-late')
    await addAsset(t, { total: 120000, vat: 0, name: 'First' })                       // R100/month
    await depreciate(t, '2025-03-31')
    await addAsset(t, { total: 240000, vat: 0, name: 'Second' })                      // R200/month, also from January 2025
    await depreciate(t, '2025-03-31')
    expect(await balance(t, '6950')).toBe(90000)                                       // 3 months × R300
    expect((await entries(t, 'depreciation')).filter((e) => e.d <= '2025-03-31')).toHaveLength(6)
  })

  test('removing equipment reverses the purchase and takes its depreciation back out', async () => {
    const t = await tenant('fa-void')
    const id = await addAsset(t)
    await depreciate(t, '2025-04-30')
    await asUser(t.uid, 'select void_fixed_asset($1)', [id])
    expect(await balance(t, '1500')).toBe(0)
    expect(await balance(t, '6950')).toBe(0)
    expect(await balance(t, '1510')).toBe(0)
    await expect(asUser(t.uid, 'select void_fixed_asset($1)', [id])).rejects.toThrow(/already been removed/)
    expect(await depreciate(t, '2025-12-31')).toBe(0)
  })

  test('refuses nonsense and other clients', async () => {
    const t = await tenant('fa-bad'), o = await tenant('fa-other')
    await expect(addAsset(t, { total: 0 })).rejects.toThrow(/price/)
    await expect(addAsset(t, { vat: 1380000 })).rejects.toThrow(/VAT/)
    await expect(addAsset(t, { residual: 1200000 })).rejects.toThrow(/less than the cost/)
    await expect(addAsset(t, { months: 0 })).rejects.toThrow(/months/)
    await expect(addAsset(t, { funding: 'loan' })).rejects.toThrow(/paid for/)
    const id = await addAsset(t)
    await expect(asUser(o.uid, 'select void_fixed_asset($1)', [id])).rejects.toThrow(/not found/)
    expect((await asUser(o.uid, 'select * from fixed_assets')).rows).toHaveLength(0)
  })
})

describe('stock count', () => {
  const count = (t, date, cents) => asUser(t.uid, 'select post_stock_count($1, $2) as id', [date, cents]).then((r) => r.rows[0].id)

  test('moves stock to the counted value and the difference goes to cost of sales', async () => {
    const t = await tenant('st-up')
    await count(t, '2026-06-30', 4500000)
    expect(await balance(t, '1200')).toBe(4500000)
    expect(await balance(t, '5000')).toBe(-4500000)
    await count(t, '2026-07-31', 3000000)                                              // sold some: cost of sales rises back
    expect(await balance(t, '1200')).toBe(3000000)
    expect(await balance(t, '5000')).toBe(-3000000)
  })

  test('counting the same value again posts nothing', async () => {
    const t = await tenant('st-same')
    await count(t, '2026-06-30', 100000)
    expect(await count(t, '2026-06-30', 100000)).toBeNull()
    expect(await entries(t, 'stock')).toHaveLength(1)
  })

  test('refuses a future date or a negative value', async () => {
    const t = await tenant('st-bad')
    await expect(count(t, '2099-01-01', 100)).rejects.toThrow(/date/)
    await expect(count(t, '2026-06-30', -1)).rejects.toThrow(/value/)
  })
})

describe('income tax rate and account deletion', () => {
  test('a client keeps their own rate, between 0 and 45', async () => {
    const a = await tenant('tx-a'), b = await tenant('tx-b')
    await asUser(a.uid, 'insert into tax_settings (rate_percent) values (27)')
    await asUser(a.uid, 'update tax_settings set rate_percent = 21.5')
    expect((await asUser(a.uid, 'select rate_percent::float as r from tax_settings')).rows).toEqual([{ r: 21.5 }])
    expect((await asUser(b.uid, 'select * from tax_settings')).rows).toHaveLength(0)
    await expect(asUser(a.uid, 'update tax_settings set rate_percent = 80')).rejects.toThrow()
    await expect(asUser(b.uid, "insert into tax_settings (tenant_id, rate_percent) values ('tx-a', 5)")).rejects.toThrow()
  })

  test('deleting an account removes bank lines, rules, equipment and rates with the ledger', async () => {
    const t = await tenant('purge-new'), keep = await tenant('purge-keep')
    await postBank(t, 'p1'); await postBank(keep, 'p1')
    await asUser(t.uid, "select save_bank_rule('abc', '6300', false)")
    await addAsset(t); await depreciate(t, '2025-03-31')
    await asUser(t.uid, 'insert into tax_settings (rate_percent) values (27)')
    await db.query('select purge_tenant_ledger($1)', [t.name])
    for (const table of ['bank_postings', 'bank_rules', 'fixed_assets', 'tax_settings', 'journal_entries']) {
      expect(Number((await db.query(`select count(*) as n from ${table} where tenant_id = $1`, [t.name])).rows[0].n)).toBe(0)
    }
    expect(Number((await db.query('select count(*) as n from bank_postings where tenant_id = $1', [keep.name])).rows[0].n)).toBe(1)
  })
})
