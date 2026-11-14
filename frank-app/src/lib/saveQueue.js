// Ordered, self-healing saves for one workspace row.
// - Saves run one at a time, so an older write can never land after a newer one.
// - Each save sends every field not yet confirmed saved, with its latest value.
// - A failed save keeps its fields; the next push (or retry) resends them.
// ponytail: one row, last-write-wins per field. Upgrade to versioned rows if two tabs/devices edit at once.

/**
 * @param {(batch: object) => Promise<void>} save - must throw on failure
 * @param {(error: Error|null) => void} [onStatus] - called after each save: error, or null on success
 */
export function createSaveQueue(save, onStatus = () => {}) {
  let dirty = {}
  let chain = Promise.resolve()
  let inFlight = 0
  let generation = 0

  async function run(gen) {
    if (gen !== generation || !Object.keys(dirty).length) return
    const batch = dirty
    try {
      await save(batch)
      if (gen !== generation) return
      // Keep only fields edited again while this save was in flight.
      dirty = Object.fromEntries(Object.entries(dirty).filter(([k, v]) => v !== batch[k]))
      onStatus(null)
    } catch (e) {
      if (gen === generation) onStatus(e)
    }
  }

  function push(patch) {
    dirty = { ...dirty, ...patch }
    inFlight++
    const gen = generation
    chain = chain.then(() => run(gen)).then(() => { inFlight-- })
    return chain
  }

  return {
    push,
    retry: () => push({}),
    hasPending: () => inFlight > 0 || Object.keys(dirty).length > 0,
    reset: () => { generation++; dirty = {} },
  }
}
