// @vitest-environment node
// Runs the real migration SQL on an in-memory Postgres (PGlite). Row-level security is exercised by
// switching to the `authenticated` / `anon` roles exactly as Supabase does.
import { describe, test, expect, beforeAll } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const sql = (f) => readFileSync(new URL(`../../supabase/migrations/${f}`, import.meta.url), 'utf8')

let db
const ids = {}                     // tenant name -> user id

const asUser = async (uid, query, params = []) => {
  await db.exec('set role authenticated')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [uid])
  try { return await db.query(query, params) } finally { await db.exec('reset role') }
}
const asAnon = async (query) => {
  await db.exec('set role anon')
  try { return await db.query(query) } finally { await db.exec('reset role') }
}

async function tenant(name, { vat = '4123456789', business = 'Cape Fresh Grocery' } = {}) {
  const uid = randomUUID()
  ids[name] = uid
  await db.query('insert into profiles (id, tenant_id) values ($1, $2)', [uid, name])
  if (business) await asUser(uid, 'insert into invoice_settings (business_name, address, vat_number) values ($1, $2, $3)', [business, '1 Main Rd, Bellville', vat])
  return uid
}

async function draft(uid, { type = 'invoice', vat = true, lines = [['Fresh produce', 4, 225000]], name = 'Durbanville Catering Co.' } = {}) {
  const { rows: [d] } = await asUser(uid,
    `insert into documents (doc_type, customer_name, customer_email, vat_enabled, due_date)
     values ($1, $2, 'accounts@durbanvillecatering.co.za', $3, current_date + 14) returning id`, [type, name, vat])
  for (const [i, [desc, qty, unit]] of lines.entries()) {
    await asUser(uid, 'insert into document_lines (document_id, position, description, qty, unit_cents) values ($1, $2, $3, $4, $5)', [d.id, i, desc, qty, unit])
  }
  return d.id
}
const issue = async (uid, id) => (await asUser(uid, 'select * from issue_document($1)', [id])).rows[0]
const journalFor = async (sourceId) => (await db.query(
  `select jl.account_code as account, jl.debit_cents::int as debit, jl.credit_cents::int as credit
     from journal_lines jl join journal_entries je on je.id = jl.entry_id where je.source_id = $1 order by 1, 2, 3`, [sourceId])).rows
const balanceOf = async (tid, account) => Number((await db.query(
  `select coalesce(sum(debit_cents - credit_cents), 0) as b from journal_lines where tenant_id = $1 and account_code = $2`, [tid, account])).rows[0].b)

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
    -- minimal stand-in for Supabase Vault
    create schema vault;
    create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, description text, secret text);
    create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
    create function vault.create_secret(s text, n text, d text default '') returns uuid language sql as
      $$ insert into vault.secrets (secret, name, description) values (s, n, d) returning id $$;
    create function vault.update_secret(i uuid, s text) returns void language sql as
      $$ update vault.secrets set secret = s where id = i $$;
  `)
  await db.exec(sql('20261115a_invoicing_ledger.sql'))
  await db.exec(sql('20261115b_mailbox_vault.sql'))
}, 60000)

describe('issuing an invoice', () => {
  test('numbers it, recomputes totals from the lines and posts a balanced journal', async () => {
    const uid = await tenant('t-issue')
    const id = await draft(uid, { lines: [['Produce', 4, 225000], ['Delivery', 4, 25000]] })
    const inv = await issue(uid, id)
    expect(inv).toMatchObject({ number: 1, status: 'issued', sub_cents: 1000000, vat_cents: 150000, total_cents: 1150000, supplier_name: 'Cape Fresh Grocery', supplier_vat: '4123456789' })
    expect(await journalFor(id)).toEqual([
      { account: '1100', debit: 1150000, credit: 0 },
      { account: '2200', debit: 0, credit: 150000 },
      { account: '4000', debit: 0, credit: 1000000 },
    ])
  })

  test('does not trust totals written by the browser', async () => {
    const uid = await tenant('t-trust')
    const id = await draft(uid)
    await asUser(uid, 'update documents set sub_cents = 1, vat_cents = 1, total_cents = 2 where id = $1', [id])
    expect((await issue(uid, id)).total_cents).toBe(1035000)   // 4 × R2 250 = R9 000 + 15% VAT = R10 350
  })

  test('numbers keep counting, separately for invoices and quotes', async () => {
    const uid = await tenant('t-numbers')
    expect((await issue(uid, await draft(uid))).number).toBe(1)
    expect((await issue(uid, await draft(uid))).number).toBe(2)
    expect((await issue(uid, await draft(uid, { type: 'quote' }))).number).toBe(1)
  })

  test('VAT rounds half up to the cent, like the app', async () => {
    const uid = await tenant('t-round')
    expect((await issue(uid, await draft(uid, { lines: [['x', 1, 10]] }))).vat_cents).toBe(2)    // 1.5 → 2
    expect((await issue(uid, await draft(uid, { lines: [['x', 1, 1]] }))).vat_cents).toBe(0)     // 0.15 → 0
  })

  test('a no-VAT invoice posts no VAT line', async () => {
    const uid = await tenant('t-novat', { vat: '' })
    const id = await draft(uid, { vat: false })
    await issue(uid, id)
    expect((await journalFor(id)).map((l) => l.account)).toEqual(['1100', '4000'])
  })

  test('a quote posts nothing to the ledger', async () => {
    const uid = await tenant('t-quote')
    const id = await draft(uid, { type: 'quote' })
    await issue(uid, id)
    expect(await journalFor(id)).toEqual([])
  })

  test('is refused with no lines, no business name, or VAT on without a VAT number', async () => {
    const uid = await tenant('t-refuse')
    await expect(issue(uid, await draft(uid, { lines: [] }))).rejects.toThrow(/at least one line/)
    const bare = await tenant('t-refuse-bare', { business: '' })
    await expect(issue(bare, await draft(bare))).rejects.toThrow(/business name/)
    const noVat = await tenant('t-refuse-vat', { vat: '' })
    await expect(issue(noVat, await draft(noVat))).rejects.toThrow(/VAT number/)
  })

  test('cannot be issued twice', async () => {
    const uid = await tenant('t-twice')
    const id = await draft(uid)
    await issue(uid, id)
    await expect(issue(uid, id)).rejects.toThrow(/Only a draft/)
  })
})

describe('the database rejects what the app must never do', () => {
  test('an unbalanced journal entry cannot be committed', async () => {
    await expect(db.exec(`
      insert into journal_entries (id, tenant_id, entry_date, memo, source_type) values ('00000000-0000-0000-0000-0000000000a1', 'bad', '2026-01-01', 'x', 'invoice');
      insert into journal_lines (entry_id, tenant_id, account_code, debit_cents) values ('00000000-0000-0000-0000-0000000000a1', 'bad', '1100', 100);
      insert into journal_lines (entry_id, tenant_id, account_code, credit_cents) values ('00000000-0000-0000-0000-0000000000a1', 'bad', '4000', 99);
    `)).rejects.toThrow(/not balanced/)
    expect((await db.query("select count(*)::int as n from journal_entries where tenant_id = 'bad'")).rows[0].n).toBe(0)
  })

  test('an entry with no lines cannot be committed', async () => {
    await expect(db.exec(`insert into journal_entries (tenant_id, entry_date, memo, source_type) values ('bad2', '2026-01-01', 'x', 'invoice')`)).rejects.toThrow(/no lines/)
  })

  test('a line cannot be both a debit and a credit', async () => {
    await expect(db.exec(`insert into journal_lines (entry_id, tenant_id, account_code, debit_cents, credit_cents) values (gen_random_uuid(), 't', '1000', 5, 5)`)).rejects.toThrow()
  })

  test('posted entries cannot be edited or deleted', async () => {
    const uid = await tenant('t-immutable')
    const id = await draft(uid)
    await issue(uid, id)
    await expect(db.exec(`update journal_lines set debit_cents = debit_cents + 1 where tenant_id = 't-immutable'`)).rejects.toThrow(/cannot be changed/)
    await expect(db.exec(`delete from journal_entries where tenant_id = 't-immutable'`)).rejects.toThrow(/cannot be changed/)
  })

  test('the browser cannot write journals or numbers directly', async () => {
    const uid = await tenant('t-direct')
    await expect(asUser(uid, `insert into journal_entries (tenant_id, entry_date, memo, source_type) values ('t-direct', '2026-01-01', 'x', 'invoice')`)).rejects.toThrow(/permission denied|row-level security/)
    await expect(asUser(uid, `update document_counters set last_number = 0`)).rejects.toThrow(/permission denied/)
    await expect(asUser(uid, `insert into document_payments (tenant_id, document_id, amount_cents, paid_on) values ('t-direct', gen_random_uuid(), 1, current_date)`)).rejects.toThrow(/permission denied/)
  })

  test('an issued document cannot be edited, marked paid or deleted by the browser', async () => {
    const uid = await tenant('t-frozen')
    const id = await draft(uid)
    await issue(uid, id)
    expect((await asUser(uid, 'update documents set customer_name = $2 where id = $1', [id, 'Someone else'])).affectedRows).toBe(0)
    expect((await asUser(uid, 'delete from documents where id = $1', [id])).affectedRows).toBe(0)
    expect((await asUser(uid, 'delete from document_lines where document_id = $1', [id])).affectedRows).toBe(0)
    const d = await draft(uid)
    await expect(asUser(uid, `update documents set status = 'paid' where id = $1`, [d])).rejects.toThrow(/row-level security/)
    await expect(asUser(uid, `insert into documents (doc_type, customer_name, status, paid_cents) values ('invoice', 'x', 'issued', 0)`)).rejects.toThrow(/row-level security/)
  })

  test('signed-out visitors can read nothing', async () => {
    await expect(asAnon('select * from documents')).rejects.toThrow(/permission denied/)
    await expect(asAnon('select * from journal_lines')).rejects.toThrow(/permission denied/)
  })
})

describe('one client can never touch another client’s documents', () => {
  test('cannot see, edit, issue, void, pay or convert them', async () => {
    const a = await tenant('t-a'), b = await tenant('t-b')
    const id = await draft(a)
    await issue(a, id)
    expect((await asUser(b, 'select * from documents where id = $1', [id])).rows).toEqual([])
    expect((await asUser(b, 'select * from journal_lines')).rows).toEqual([])
    expect((await asUser(b, 'update documents set customer_name = $2 where id = $1', [id, 'x'])).affectedRows).toBe(0)
    for (const call of ['void_document($1)', 'convert_quote($1)', `record_payment($1, 100, current_date, '')`]) {
      await expect(asUser(b, `select * from ${call}`, [id])).rejects.toThrow(/not found/)
    }
    await expect(asUser(b, `insert into document_lines (document_id, description, qty, unit_cents) values ($1, 'x', 1, 1)`, [id])).rejects.toThrow(/row-level security/)
  })
})

describe('getting paid', () => {
  test('part payment then the rest: invoice turns Paid and Debtors returns to zero', async () => {
    const uid = await tenant('t-pay')
    const id = await draft(uid, { lines: [['Produce', 1, 100000]] })     // R1 000 + VAT = R1 150
    await issue(uid, id)
    let d = (await asUser(uid, `select * from record_payment($1, 40000, '2026-07-10', 'EFT 1')`, [id])).rows[0]
    expect(d).toMatchObject({ status: 'issued', paid_cents: 40000 })
    d = (await asUser(uid, `select * from record_payment($1, 75000, '2026-07-20', 'EFT 2')`, [id])).rows[0]
    expect(d).toMatchObject({ status: 'paid', paid_cents: 115000 })
    expect(await balanceOf('t-pay', '1100')).toBe(0)
    expect(await balanceOf('t-pay', '1000')).toBe(115000)
    expect(await balanceOf('t-pay', '4000')).toBe(-100000)
    expect(await balanceOf('t-pay', '2200')).toBe(-15000)
    const all = (await db.query(`select coalesce(sum(debit_cents),0)::int as d, coalesce(sum(credit_cents),0)::int as c from journal_lines where tenant_id = 't-pay'`)).rows[0]
    expect(all.d).toBe(all.c)
  })

  test('refuses an overpayment, a zero payment and a payment on a paid invoice', async () => {
    const uid = await tenant('t-pay2')
    const id = await draft(uid, { lines: [['x', 1, 10000]] })
    await issue(uid, id)
    await expect(asUser(uid, `select * from record_payment($1, 999999, current_date, '')`, [id])).rejects.toThrow(/more than the amount outstanding/)
    await expect(asUser(uid, `select * from record_payment($1, 0, current_date, '')`, [id])).rejects.toThrow(/more than zero/)
    await asUser(uid, `select * from record_payment($1, 11500, current_date, '')`, [id])
    await expect(asUser(uid, `select * from record_payment($1, 1, current_date, '')`, [id])).rejects.toThrow(/issued, unpaid/)
  })
})

describe('voiding and converting', () => {
  test('voiding an unpaid invoice posts a reversal that nets the ledger to zero', async () => {
    const uid = await tenant('t-void')
    const id = await draft(uid)
    await issue(uid, id)
    const v = (await asUser(uid, 'select * from void_document($1)', [id])).rows[0]
    expect(v.status).toBe('void')
    for (const acct of ['1100', '2200', '4000']) expect(await balanceOf('t-void', acct)).toBe(0)
    expect((await db.query(`select count(*)::int as n from journal_entries where tenant_id = 't-void' and source_type = 'reversal' and reverses is not null`)).rows[0].n).toBe(1)
  })

  test('an invoice with a payment cannot be voided', async () => {
    const uid = await tenant('t-void2')
    const id = await draft(uid)
    await issue(uid, id)
    await asUser(uid, `select * from record_payment($1, 100, current_date, '')`, [id])
    await expect(asUser(uid, 'select * from void_document($1)', [id])).rejects.toThrow(/payments recorded/)
  })

  test('converting an issued quote makes a draft invoice with the same lines', async () => {
    const uid = await tenant('t-convert')
    const q = await draft(uid, { type: 'quote', lines: [['Crates', 10, 5000], ['Delivery', 1, 20000]] })
    await issue(uid, q)
    const inv = (await asUser(uid, 'select * from convert_quote($1)', [q])).rows[0]
    expect(inv).toMatchObject({ doc_type: 'invoice', status: 'draft', number: null, customer_name: 'Durbanville Catering Co.' })
    expect((await db.query('select count(*)::int as n from document_lines where document_id = $1', [inv.id])).rows[0].n).toBe(2)
    expect((await db.query('select status, converted_to from documents where id = $1', [q])).rows[0]).toMatchObject({ status: 'converted', converted_to: inv.id })
    await expect(asUser(uid, 'select * from convert_quote($1)', [q])).rejects.toThrow(/Only an issued quote/)
  })
})

describe('mailbox password and account deletion', () => {
  test('the password round-trips through the vault and disappears on disconnect', async () => {
    await db.exec('set role service_role')
    try {
      const a = (await db.query(`select store_mailbox_secret('t-mail', 'app-pass-1') as id`)).rows[0].id
      expect((await db.query(`select read_mailbox_secret('t-mail') as p`)).rows[0].p).toBe('app-pass-1')
      expect((await db.query(`select store_mailbox_secret('t-mail', 'app-pass-2') as id`)).rows[0].id).toBe(a)   // same secret, updated
      expect((await db.query(`select read_mailbox_secret('t-mail') as p`)).rows[0].p).toBe('app-pass-2')
      await db.query(`select delete_mailbox('t-mail')`)
      expect((await db.query(`select read_mailbox_secret('t-mail') as p`)).rows[0].p).toBeNull()
    } finally { await db.exec('reset role') }
  })

  test('the browser cannot call the vault or purge functions', async () => {
    const uid = await tenant('t-nopurge')
    for (const call of [`read_mailbox_secret('t-mail')`, `store_mailbox_secret('t', 'x')`, `delete_mailbox('t')`, `purge_tenant_ledger('t-nopurge')`]) {
      await expect(asUser(uid, `select ${call}`)).rejects.toThrow(/permission denied/)
    }
  })

  test('purging an account removes its documents and posted journals, and no one else’s', async () => {
    const gone = await tenant('t-purge'), kept = await tenant('t-keep')
    for (const uid of [gone, kept]) { const id = await draft(uid); await issue(uid, id); await asUser(uid, `select * from record_payment($1, 100, current_date, '')`, [id]) }
    await db.exec('set role service_role')
    try { await db.query(`select purge_tenant_ledger('t-purge')`) } finally { await db.exec('reset role') }
    for (const t of ['journal_entries', 'journal_lines', 'documents', 'document_lines', 'document_payments', 'document_counters', 'invoice_settings']) {
      expect((await db.query(`select count(*)::int as n from ${t} where tenant_id = 't-purge'`)).rows[0].n).toBe(0)
      expect((await db.query(`select count(*)::int as n from ${t} where tenant_id = 't-keep'`)).rows[0].n).toBeGreaterThan(0)
    }
  })
})
