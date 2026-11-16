// The three packs: one source of truth for the landing page, sign-up, billing and what each pack unlocks.
// Prices are rand a month. Keep in step with PLANS in supabase/functions/paygate-initiate/index.ts.
import { PLAN_ORDER, PACK_AI_REQUESTS, planFor } from '../../supabase/functions/_shared/packs.js'

export { PLAN_ORDER, planFor }
export { PACKS_START } from '../../supabase/functions/_shared/packs.js'

// Features a pack unlocks. Everything in a lower pack is in the higher ones.
export const FEATURES = {
  invoicing: 'Invoices, quotes and customer statements',
  reconciliation: 'Bank reconciliation and payment matching',
  recording: 'Record expenses, supplier payments and cash sales',
  incomeStatement: 'Income statement',
  fullStatements: 'Balance sheet, cash flows, changes in equity and trial balance',
  bankPosting: 'Automatic posting of bank lines to the books',
  adjustments: 'Equipment and depreciation, stock counts and income tax estimate',
}

export const PLANS = {
  starter: {
    id: 'starter', name: 'Starter', price: 499,
    tagline: 'Know your cash',
    summary: 'For a small business that wants to see its cash, who owes it and whom it owes, without the paperwork.',
    aiRequests: PACK_AI_REQUESTS.starter, // chats and document reads a month together
    highlights: ['Cash and 13-week forecast', 'Bank statement upload', 'Debtors and creditors', '60 AI questions a month'],
    features: [],
    groups: [
      ['See your cash', ['Dashboard and 13-week cash flow forecast', 'Business health score', 'Basic reports']],
      ['Get your numbers in', ['Upload your bank statement (CSV, Excel or PDF)', 'Debtors and creditors tracking']],
      ['Ask for help', ['Ask Zeeder AI: 60 questions and document reads a month', 'Email support']],
    ],
  },
  growth: {
    id: 'growth', name: 'Growth', price: 999, badge: 'Most popular',
    tagline: 'Bill and get paid',
    summary: 'For a business that sends invoices and needs to match the money that comes in.',
    aiRequests: PACK_AI_REQUESTS.growth,
    highlights: ['Everything in Starter', 'Invoices and quotes', 'Bank reconciliation', 'Income statement'],
    features: ['invoicing', 'reconciliation', 'recording', 'incomeStatement'],
    groups: [
      ['Everything in Starter, plus billing', ['Invoices and quotes, emailed from your own mailbox', 'Customer statements with ageing']],
      ['Match and record', ['Bank reconciliation that matches payments to invoices', 'Record expenses, supplier payments and cash sales', 'Income statement showing profit before tax']],
      ['Ask for help', ['Ask Zeeder AI: 340 questions and document reads a month', 'Priority support']],
    ],
  },
  pro: {
    id: 'pro', name: 'Pro', price: 1999,
    tagline: 'Books ready for your accountant',
    summary: 'For a business that wants complete financial statements and its books kept up to date for year end.',
    aiRequests: PACK_AI_REQUESTS.pro,
    highlights: ['Everything in Growth', 'Full financial statements', 'Automatic bank posting', 'Depreciation, stock and tax estimate'],
    features: ['invoicing', 'reconciliation', 'recording', 'incomeStatement', 'fullStatements', 'bankPosting', 'adjustments'],
    groups: [
      ['Everything in Growth, plus full statements', ['Balance sheet, cash flow statement, changes in equity and trial balance', 'A note for your accountant on every statement']],
      ['Books that keep themselves up to date', ['Bank statement lines posted to your books automatically, with you in control', 'Equipment and depreciation, stock counts and an income tax estimate']],
      ['Ask for help', ['Ask Zeeder AI: 1 100 questions and document reads a month', 'Priority support and onboarding help']],
    ],
  },
}

export function allows(planId, feature) {
  return PLANS[planId]?.features.includes(feature) ?? false
}

/** The cheapest pack that includes a feature, for "Upgrade to ..." messages. */
export function packWith(feature) {
  return PLAN_ORDER.map((id) => PLANS[id]).find((p) => p.features.includes(feature)) ?? null
}

export const priceText = (p) => `R${String.fromCharCode(160)}${p.price.toLocaleString('en-ZA').replace(/\s/g, String.fromCharCode(160))}`
