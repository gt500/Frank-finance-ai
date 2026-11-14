// Billing state rules shared by the PayGate edge functions (imported like dunning.js).

// PayHost TransactionStatus: 1 Approved · 2 Declined · 3 Cancelled · 4 User Cancelled · 7 Voided.
// 0 Not Done / 5 Received / missing = not settled yet, so the row stays pending.
const FAILED_STATUSES = ['2', '3', '4', '7']

/**
 * @param {string|null|undefined} transactionStatus
 * @returns {'active'|'failed'|null} new subscription status, or null to leave the row untouched
 */
export function notifyTransition(transactionStatus) {
  if (transactionStatus === '1') return 'active'
  if (FAILED_STATUSES.includes(transactionStatus)) return 'failed'
  return null
}

// A notify may only settle an open checkout attempt. 'superseded' = replaced by a newer Upgrade
// click but still payable on PayGate's page. 'cancelled' (by the user or account deletion) is final.
export const NOTIFIABLE_STATUSES = ['pending', 'superseded']

/** @param {Date} from @returns {Date} */
export function addOneMonth(from) {
  const next = new Date(from)
  next.setMonth(next.getMonth() + 1)
  return next
}
