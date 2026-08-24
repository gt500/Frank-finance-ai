import { describe, test, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

const { useFrank } = await import('./useFrank.js')

const assistantResponse = (text) => ({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ content: [{ text }] }),
})

beforeEach(() => {
  mockFetch.mockReset()
})

describe('useFrank — chat hook', () => {
  test('starts with empty messages and no loading', () => {
    const { result } = renderHook(() => useFrank())
    expect(result.current.messages).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  test('starts with provided initial messages', () => {
    const initial = [{ role: 'assistant', content: 'Hello' }]
    const { result } = renderHook(() => useFrank(initial))
    expect(result.current.messages).toEqual(initial)
  })

  test('adds user message immediately when send is called', async () => {
    mockFetch.mockResolvedValueOnce(assistantResponse('Got it'))
    const { result } = renderHook(() => useFrank())

    await act(async () => {
      result.current.send('What is my cash balance?')
    })

    expect(result.current.messages[0]).toEqual({ role: 'user', content: 'What is my cash balance?' })
  })

  test('appends assistant reply after successful API call', async () => {
    mockFetch.mockResolvedValueOnce(assistantResponse('Your cash is R 61,400.'))
    const { result } = renderHook(() => useFrank())

    await act(async () => {
      await result.current.send('What is my cash balance?')
    })

    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg).toEqual({ role: 'assistant', content: 'Your cash is R 61,400.' })
  })

  test('trims whitespace from user message before sending', async () => {
    mockFetch.mockResolvedValueOnce(assistantResponse('ok'))
    const { result } = renderHook(() => useFrank())

    await act(async () => {
      await result.current.send('  hello  ')
    })

    expect(result.current.messages[0].content).toBe('hello')
  })

  test('ignores empty or whitespace-only messages', async () => {
    const { result } = renderHook(() => useFrank())

    await act(async () => {
      await result.current.send('   ')
    })

    expect(result.current.messages).toHaveLength(0)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test('sets loading true while waiting for response', async () => {
    let resolveFetch
    mockFetch.mockReturnValueOnce(new Promise(r => { resolveFetch = r }))
    const { result } = renderHook(() => useFrank())

    act(() => { result.current.send('hello') })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveFetch(assistantResponse('done'))
    })

    expect(result.current.loading).toBe(false)
  })

  test('sets error and adds fallback message on API failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const { result } = renderHook(() => useFrank())

    await act(async () => {
      await result.current.send('hello')
    })

    expect(result.current.error).toBe('Network error')
    const lastMsg = result.current.messages[result.current.messages.length - 1]
    expect(lastMsg.role).toBe('assistant')
    expect(lastMsg.content).toContain('Connection error')
  })

  test('sends all prior messages in the API request for context', async () => {
    const initial = [{ role: 'user', content: 'First message' }, { role: 'assistant', content: 'First reply' }]
    mockFetch.mockResolvedValueOnce(assistantResponse('Second reply'))
    const { result } = renderHook(() => useFrank(initial))

    await act(async () => {
      await result.current.send('Second message')
    })

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.messages).toHaveLength(3)
    expect(body.messages[0].content).toBe('First message')
    expect(body.messages[2].content).toBe('Second message')
  })

  test('reset clears messages and error back to initial state', async () => {
    mockFetch.mockRejectedValueOnce(new Error('fail'))
    const { result } = renderHook(() => useFrank())

    await act(async () => {
      await result.current.send('hello')
    })

    expect(result.current.messages.length).toBeGreaterThan(0)

    act(() => { result.current.reset() })

    expect(result.current.messages).toEqual([])
    expect(result.current.error).toBeNull()
  })

  test('returns the assistant reply text from send()', async () => {
    mockFetch.mockResolvedValueOnce(assistantResponse('R 61,400 in Absa.'))
    const { result } = renderHook(() => useFrank())

    let reply
    await act(async () => {
      reply = await result.current.send('balance?')
    })

    expect(reply).toBe('R 61,400 in Absa.')
  })
})
