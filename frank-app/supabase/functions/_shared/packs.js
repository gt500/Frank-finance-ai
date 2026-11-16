// Which pack a workspace is on, and the AI allowance it carries. Shared by the app and the edge functions
// (like invoicing.js), so the screen and the server never disagree.

export const PLAN_ORDER = ['starter', 'growth', 'pro']

// Chats and document reads together, a month.
export const PACK_AI_REQUESTS = { starter: 60, growth: 340, pro: 1100 }

// Our own demo and partner workspaces are not paying customers: they see everything.
export const OPEN_TENANTS = ['cape-fresh-grocery', 'wonderland-educare']

// Workspaces opened before the packs launched keep full access until they choose a pack.
export const PACKS_START = '2026-11-16'

/** The subscription's pack, otherwise the pack chosen at sign-up (the trial). */
export function planFor({ tenantId, subscription, chosen, trialStart } = {}) {
  if (tenantId && OPEN_TENANTS.includes(tenantId)) return 'pro'
  if (!subscription && trialStart && new Date(trialStart) < new Date(PACKS_START)) return 'pro'
  const id = String(subscription?.plan ?? chosen ?? 'growth').toLowerCase()
  return PLAN_ORDER.includes(id) ? id : 'growth'
}
