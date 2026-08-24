import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

// fetch is mocked before the module loads so API_KEY is captured with test value
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const { extractFromDocument } = await import('./useFrank.js')

const okResponse = (json) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ content: [{ text: JSON.stringify(json) }] }),
})

const rateLimitResponse = () => ({
  ok: false,
  status: 429,
  json: () => Promise.resolve({}),
})

const apiErrorResponse = (msg) => ({
  ok: false,
  status: 400,
  json: () => Promise.resolve({ error: { message: msg } }),
})

beforeEach(() => {
  mockFetch.mockReset()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('extractFromDocument — CSV / text files', () => {
  test('sends CSV content as plain text in message body', async () => {
    const csvContent = 'date,description,debit,credit\n2024-07-01,Salary,94500,0'
    mockFetch.mockResolvedValueOnce(okResponse({ transactions: [] }))

    const file = new File([csvContent], 'statement.csv', { type: 'text/csv' })
    await extractFromDocument(file, 'bank')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(typeof body.messages[0].content).toBe('string')
    expect(body.messages[0].content).toContain(csvContent)
  })

  test('slices CSV to 8000 characters to stay within token limits', async () => {
    // Build CSV where each row has a unique row number — boundary content is identifiable
    const rows = Array.from({ length: 500 }, (_, i) => `2024-01-01,ROW_${String(i).padStart(4,'0')},100,0`)
    const longCsv = rows.join('\n') // well over 8000 chars
    mockFetch.mockResolvedValueOnce(okResponse({ transactions: [] }))

    const file = new File([longCsv], 'big.csv', { type: 'text/csv' })
    await extractFromDocument(file, 'bank')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    const content = body.messages[0].content
    expect(content).toContain('ROW_0000')    // start is present
    expect(content).not.toContain('ROW_0499') // end is cut off
  })

  test('uses claude-haiku model for extraction', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ debtors: [] }))

    const file = new File(['name,amount\nSmith,9000'], 'debtors.csv')
    await extractFromDocument(file, 'debtor')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.model).toContain('haiku')
  })

  test('returns parsed JSON from successful response', async () => {
    const expected = { bank_name: 'Absa', transactions: [{ date: '2024-07-01', debit: 94500 }] }
    mockFetch.mockResolvedValueOnce(okResponse(expected))

    const file = new File(['date,debit\n2024-07-01,94500'], 'bank.csv')
    const result = await extractFromDocument(file, 'bank')

    expect(result).toEqual(expected)
  })

  test('strips markdown code fences before parsing JSON', async () => {
    const data = { transactions: [] }
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ content: [{ text: '```json\n' + JSON.stringify(data) + '\n```' }] }),
    })

    const file = new File(['date,debit'], 'bank.csv')
    const result = await extractFromDocument(file, 'bank')

    expect(result).toEqual(data)
  })
})

describe('extractFromDocument — PDF files', () => {
  test('sends PDF as base64 document block, not plain text', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ debtors: [] }))

    const file = new File(['%PDF fake'], 'invoice.pdf', { type: 'application/pdf' })
    await extractFromDocument(file, 'debtor')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    const content = body.messages[0].content
    expect(Array.isArray(content)).toBe(true)
    expect(content[0].type).toBe('document')
    expect(content[0].source.type).toBe('base64')
  })
})

describe('extractFromDocument — rate limit handling', () => {
  test('retries once after 65 seconds on first 429, then succeeds', async () => {
    const expected = { transactions: [{ date: '2024-07-01' }] }
    mockFetch
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(okResponse(expected))

    const file = new File(['date,debit'], 'bank.csv')
    const promise = extractFromDocument(file, 'bank')

    await vi.runAllTimersAsync()
    const result = await promise

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result).toEqual(expected)
  })

  test('throws rate-limit error message after two consecutive 429s', async () => {
    mockFetch
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(rateLimitResponse())

    const file = new File(['date,debit'], 'bank.csv')
    const promise = extractFromDocument(file, 'bank')

    // Register the rejection handler before running timers so it is never unhandled
    const assertion = expect(promise).rejects.toThrow('Rate limit')
    await vi.runAllTimersAsync()
    await assertion

    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  test('throws API error message for non-429 failures', async () => {
    mockFetch.mockResolvedValueOnce(apiErrorResponse('Invalid API key'))

    const file = new File(['date,debit'], 'bank.csv')
    await expect(extractFromDocument(file, 'bank')).rejects.toThrow('Invalid API key')
  })
})

describe('extractFromDocument — malformed responses', () => {
  test('throws with snippet of raw output when response is not valid JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ content: [{ text: 'Sorry, I cannot process this file.' }] }),
    })

    const file = new File(['garbled data'], 'bank.csv')
    await expect(extractFromDocument(file, 'bank')).rejects.toThrow('Zeeder could not read this document')
  })

  test('returns empty object when response has no content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ content: [] }),
    })

    const file = new File(['date,debit'], 'bank.csv')
    const result = await extractFromDocument(file, 'bank')
    expect(result).toEqual({})
  })
})
