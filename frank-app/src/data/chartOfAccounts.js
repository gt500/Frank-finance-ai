// A small, generic chart of accounts any small business's bookkeeper can
// post to — deliberately short (not a full statutory COA). Codes follow the
// same numbering convention as Xero/Sage/QuickBooks default charts (4000s
// income, 5000 cost of sales, 6000s expenses) so an accountant recognises
// the shape immediately.

export const UNCATEGORIZED_CODE = '9999'

export const CHART_OF_ACCOUNTS = [
  { code: '4000', name: 'Sales / Fees Income',    type: 'income' },
  { code: '4900', name: 'Other Income',           type: 'income' },
  { code: '4950', name: 'Interest Income',        type: 'income' },
  { code: '5000', name: 'Cost of Sales',          type: 'cogs' },
  { code: '6000', name: 'Staff Costs',            type: 'expense' },
  { code: '6100', name: 'Rent & Occupancy',       type: 'expense' },
  { code: '6200', name: 'Utilities',              type: 'expense' },
  { code: '6300', name: 'Materials & Supplies',   type: 'expense' },
  { code: '6400', name: 'Admin & Compliance',     type: 'expense' },
  { code: '6500', name: 'Bank & Finance Charges', type: 'expense' },
  { code: '6600', name: 'Marketing',              type: 'expense' },
  { code: '6700', name: 'Insurance',              type: 'expense' },
  { code: '6900', name: 'Other Expenses',         type: 'expense' },
  { code: '9000', name: 'Owner Drawings / Transfers (excl. P&L)', type: 'transfer' },
  { code: UNCATEGORIZED_CODE, name: 'Uncategorized — needs review', type: 'unknown' },
]

// Best-effort defaults for the category labels the AI extraction prompts
// already produce (see useFrank.js) — a business can override any of these
// via the Reconciliation view without touching code.
export const DEFAULT_CATEGORY_MAP = {
  'School Fees':          '4000',
  'Sales':                '4000',
  'Fees':                 '4000',
  'WCED Subsidy':         '4900',
  'Subsidy':              '4900',
  'Interest':             '4950',
  'Staff':                '6000',
  'Staff salaries':       '6000',
  'Salaries':             '6000',
  'Wages':                '6000',
  'Rent':                 '6100',
  'Rent & utilities':     '6100',
  'Utilities':            '6200',
  'Food':                 '6300',
  'Food & nutrition':     '6300',
  'Materials':            '6300',
  'Learning materials':   '6300',
  'Admin':                '6400',
  'Admin & compliance':   '6400',
  'Bank Charges':         '6500',
  'Transfer':             '9000',
  'Other':                '6900',
}

export function accountFor(code) {
  return CHART_OF_ACCOUNTS.find(a => a.code === code) || CHART_OF_ACCOUNTS.find(a => a.code === UNCATEGORIZED_CODE)
}

// customMap overrides the defaults; anything still unmatched falls to Uncategorized.
export function mapCategory(rawCategory, customMap = {}) {
  const key = (rawCategory || 'Unknown').trim()
  return customMap[key] || DEFAULT_CATEGORY_MAP[key] || UNCATEGORIZED_CODE
}
