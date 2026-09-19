import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../lib/supabaseClient.js', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'fake-token' } } }),
    },
  },
}))

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
  json: () => Promise.resolve({ error: msg }),
})

beforeEach(() => {
  mockFetch.mockReset()
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('extractFromDocument — calls the edge function, not Anthropic directly', () => {
  test('posts to extract-document with a bearer token', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ transactions: [] }))

    const file = new File(['date,debit\n2024-07-01,94500'], 'bank.csv', { type: 'text/csv' })
    await extractFromDocument(file, 'bank')

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://test-project.supabase.co/functions/v1/extract-document')
    expect(options.headers.Authorization).toBe('Bearer fake-token')
    expect(options.headers['x-api-key']).toBeUndefined()
  })
})

describe('extractFromDocument — CSV / text files', () => {
  test('sends CSV content as plain text inside messageContent', async () => {
    const csvContent = 'date,description,debit,credit\n2024-07-01,Salary,94500,0'
    mockFetch.mockResolvedValueOnce(okResponse({ transactions: [] }))

    const file = new File([csvContent], 'statement.csv', { type: 'text/csv' })
    await extractFromDocument(file, 'bank')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(typeof body.messageContent).toBe('string')
    expect(body.messageContent).toContain(csvContent)
  })

  test('slices CSV to 8000 characters to stay within token limits', async () => {
    const rows = Array.from({ length: 500 }, (_, i) => `2024-01-01,ROW_${String(i).padStart(4, '0')},100,0`)
    const longCsv = rows.join('\n') // well over 8000 chars
    mockFetch.mockResolvedValueOnce(okResponse({ transactions: [] }))

    const file = new File([longCsv], 'big.csv', { type: 'text/csv' })
    await extractFromDocument(file, 'bank')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    const content = body.messageContent
    expect(content).toContain('ROW_0000')    // start is present
    expect(content).not.toContain('ROW_0499') // end is cut off
  })

  test('returns parsed JSON from successful response', async () => {
    const expected = { bank_name: 'Absa', transactions: [{ date: '2024-07-01', debit: 94500 }] }
    mockFetch.mockResolvedValueOnce(okResponse(expected))

    const file = new File(['date,debit\n2024-07-01,94500'], 'bank.csv', { type: 'text/csv' })
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

    const file = new File(['date,debit'], 'bank.csv', { type: 'text/csv' })
    const result = await extractFromDocument(file, 'bank')

    expect(result).toEqual(data)
  })
})

describe('extractFromDocument — PDF files', () => {
  test('sends PDF as base64 document block inside messageContent, not plain text', async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ debtors: [] }))

    const file = new File(['%PDF fake'], 'invoice.pdf', { type: 'application/pdf' })
    await extractFromDocument(file, 'debtor')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    const content = body.messageContent
    expect(Array.isArray(content)).toBe(true)
    expect(content[0].type).toBe('document')
    expect(content[0].source.type).toBe('base64')
  })
})

describe('extractFromDocument — rate limit handling', () => {
  // The 429-retry-after-65s logic now lives inside the extract-document edge
  // function (supabase/functions/extract-document/index.ts), not the client.
  // From the browser's side, a rate limit is just a single failed response —
  // covered by the "non-429 failures" case below, since the client treats
  // any edge-function error response the same way.

  test('throws API error message for non-429 failures', async () => {
    mockFetch.mockResolvedValueOnce(apiErrorResponse('Invalid API key'))

    const file = new File(['date,debit'], 'bank.csv', { type: 'text/csv' })
    await expect(extractFromDocument(file, 'bank')).rejects.toThrow('Invalid API key')
  })

  test('surfaces a 429 from the edge function as an error, same as any other failure', async () => {
    mockFetch.mockResolvedValueOnce(rateLimitResponse())

    const file = new File(['date,debit'], 'bank.csv', { type: 'text/csv' })
    await expect(extractFromDocument(file, 'bank')).rejects.toThrow('API error 429')
  })
})

describe('extractFromDocument — malformed responses', () => {
  test('throws with snippet of raw output when response is not valid JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ content: [{ text: 'Sorry, I cannot process this file.' }] }),
    })

    const file = new File(['garbled data'], 'bank.csv', { type: 'text/csv' })
    await expect(extractFromDocument(file, 'bank')).rejects.toThrow('Zeeder could not read this document')
  })

  test('returns empty object when response has no content', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ content: [] }),
    })

    const file = new File(['date,debit'], 'bank.csv', { type: 'text/csv' })
    const result = await extractFromDocument(file, 'bank')
    expect(result).toEqual({})
  })
})
