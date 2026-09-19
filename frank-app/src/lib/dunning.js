// Dunning policy: 3 retries after the first failure (4 attempts total),
// then downgrade on the 4th consecutive failure.
export const MAX_ATTEMPTS = 4
export const RETRY_DAYS = 3

/**
 * @param {number} failedChargeCount - consecutive failures BEFORE this attempt
 * @param {boolean} approved - whether this charge attempt succeeded
 * @returns {{ status: 'active'|'downgraded', failed_charge_count: number, retryInDays: number|null, downgrade: boolean }}
 */
export function nextDunningState(failedChargeCount, approved) {
  if (approved) {
    return { status: 'active', failed_charge_count: 0, retryInDays: null, downgrade: false }
  }
  const count = (failedChargeCount ?? 0) + 1
  if (count >= MAX_ATTEMPTS) {
    return { status: 'downgraded', failed_charge_count: count, retryInDays: null, downgrade: true }
  }
  return { status: 'active', failed_charge_count: count, retryInDays: RETRY_DAYS, downgrade: false }
}
