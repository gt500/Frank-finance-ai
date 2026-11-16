// Database calls for the financial statements and manual transactions. Everything runs as the signed-in user,
// so row-level security keeps each client to their own books; posting goes through post_manual_journal, which
// derives the tenant from the session and refuses anything unbalanced.
import { supabase } from './supabaseClient'

const must = ({ data, error }) => { if (error) throw new Error(error.message); return data }

export const getChartAccounts = async () => must(await supabase.from('chart_accounts').select('code, name, type').order('code'))

/** Per account: everything before `from` (opening) and from `from` to `to` (period). */
export const getLedgerTotals = async (from, to) => must(await supabase.rpc('ledger_totals', { p_from: from, p_to: to }))

export const postEntry = async (entry) => must(await supabase.rpc('post_manual_journal', { p_date: entry.date, p_memo: entry.memo, p_lines: entry.lines }))

export const reverseEntry = async (id) => must(await supabase.rpc('reverse_journal_entry', { p_entry: id }))

/** The transactions recorded by hand and their reversals, newest first. */
export const listRecordedEntries = async () => must(await supabase.from('journal_entries')
  .select('id, entry_date, memo, source_type, reverses, journal_lines(debit_cents)')
  .in('source_type', ['manual', 'reversal']).order('created_at', { ascending: false }).limit(50))

// ── Bank statement lines ──────────────────────────────────────────────────────────────────────
const rpc = async (fn, args) => must(await supabase.rpc(fn, args))

/** Every bank line already posted (live = its entry still stands) or set aside (entry_id null). */
export const listBankPostings = () => rpc('list_bank_postings')
export const listBankRules = async () => must(await supabase.from('bank_rules').select('match, account, vat'))
export const postBankLine = (key, entry) => rpc('post_bank_line', { p_key: key, p_date: entry.date, p_memo: entry.memo, p_lines: entry.lines })
export const skipBankLine = (key) => rpc('skip_bank_line', { p_key: key })
export const saveBankRule = (match, account, vat) => rpc('save_bank_rule', { p_match: match, p_account: account, p_vat: vat })

// ── Equipment, depreciation, stock and the tax rate ───────────────────────────────────────────
export const listFixedAssets = async () => must(await supabase.from('fixed_assets')
  .select('id, name, cost_cents, residual_cents, purchase_date, life_months').is('voided_at', null).order('purchase_date'))
export const addFixedAsset = (a) => rpc('add_fixed_asset', {
  p_name: a.name, p_total_cents: a.totalCents, p_vat_cents: a.vatCents, p_date: a.date,
  p_residual_cents: a.residualCents, p_life_months: a.lifeMonths, p_funding: a.funding,
})
export const voidFixedAsset = (id) => rpc('void_fixed_asset', { p_id: id })
/** Posts any whole months of depreciation that are due. Returns how many monthly entries it posted. */
export const postDepreciation = (through) => rpc('post_depreciation', { p_through: through })
export const postStockCount = (date, valueCents) => rpc('post_stock_count', { p_date: date, p_value_cents: valueCents })

export async function getTaxRate() {
  const row = must(await supabase.from('tax_settings').select('rate_percent').maybeSingle())
  return row ? Number(row.rate_percent) : null
}
export const saveTaxRate = async (ratePercent) => must(await supabase.from('tax_settings').upsert({ rate_percent: ratePercent, updated_at: new Date().toISOString() }).select().single())

/** How many bank lines are currently posted to the books (for the accountant note on the statements). */
export const countPostedBankLines = async () => (await listBankPostings()).filter((p) => p.entry_id && p.live).length
