import { describe, test, expect, vi } from 'vitest'
import { createSaveQueue } from './saveQueue.js'

const deferred = () => { let resolve, reject; const p = new Promise((r, j) => { resolve = r; reject = j }); return { p, resolve, reject } }
const settle = () => new Promise(r => setTimeout(r, 0))

describe('createSaveQueue', () => {
  test('saves run one at a time, in order — a slow first save cannot land after a later one', async () => {
    const first = deferred()
    const calls = []
    const save = vi.fn(async (batch) => { calls.push(batch); if (calls.length === 1) await first.p })
    const q = createSaveQueue(save)

    q.push({ imported: 'v1' })
    await settle()                        // v1's save is now in flight (and slow)
    q.push({ imported: 'v2' })
    await settle()
    expect(save).toHaveBeenCalledTimes(1) // v2 waits for v1 to finish

    first.resolve()
    await settle(); await settle()
    expect(calls.map(c => c.imported)).toEqual(['v1', 'v2'])
  })

  test('a field changed while a save is in flight stays dirty and is sent next', async () => {
    const first = deferred()
    const calls = []
    const q = createSaveQueue(async (batch) => { calls.push(batch); if (calls.length === 1) await first.p })
    q.push({ bank_data: 'a' })
    await settle()
    q.push({ bank_data: 'b' })
    first.resolve()
    await settle(); await settle()
    expect(calls.at(-1)).toEqual({ bank_data: 'b' })
    expect(q.hasPending()).toBe(false)
  })

  test('edits made in the same tick are merged into one save with the latest values', async () => {
    const calls = []
    const q = createSaveQueue(async (batch) => { calls.push(batch) })
    q.push({ imported: 'v1' })
    q.push({ imported: 'v2', monthly: 'm' })
    await settle(); await settle()
    expect(calls).toEqual([{ imported: 'v2', monthly: 'm' }])
  })

  test('a failed save keeps its fields and resends them with the next save, then reports recovery', async () => {
    const statuses = []
    let fail = true
    const calls = []
    const q = createSaveQueue(async (batch) => { calls.push(batch); if (fail) throw new Error('offline') }, (err) => statuses.push(err ? 'error' : 'ok'))

    q.push({ imported: 'debtors' })
    await settle()
    expect(statuses).toEqual(['error'])
    expect(q.hasPending()).toBe(true)

    fail = false
    q.push({ bank_data: 'stmt' })
    await settle()
    expect(calls.at(-1)).toEqual({ imported: 'debtors', bank_data: 'stmt' })
    expect(statuses).toEqual(['error', 'ok'])
    expect(q.hasPending()).toBe(false)
  })

  test('retry() resends unsaved fields without a new edit', async () => {
    let fail = true
    const calls = []
    const q = createSaveQueue(async (batch) => { calls.push(batch); if (fail) throw new Error('offline') })
    q.push({ monthly: [1] })
    await settle()
    fail = false
    q.retry()
    await settle()
    expect(calls).toEqual([{ monthly: [1] }, { monthly: [1] }])
    expect(q.hasPending()).toBe(false)
  })

  test('reset() drops unsaved fields and cancels queued saves (e.g. on sign-out)', async () => {
    const first = deferred()
    const save = vi.fn(async () => { await first.p })
    const q = createSaveQueue(save)
    q.push({ imported: 'user A' })
    q.push({ imported: 'user A again' })
    await settle()
    q.reset()
    first.resolve()
    await settle(); await settle()
    expect(save).toHaveBeenCalledTimes(1)
    expect(q.hasPending()).toBe(false)
  })

  test('hasPending() is true while a save is in flight', async () => {
    const first = deferred()
    const q = createSaveQueue(() => first.p)
    q.push({ imported: 'x' })
    expect(q.hasPending()).toBe(true)
    first.resolve()
    await settle()
    expect(q.hasPending()).toBe(false)
  })
})
