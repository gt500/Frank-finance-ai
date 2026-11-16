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
