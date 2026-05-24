import { useState, useCallback } from 'react'
import { FRANK_SYSTEM_PROMPT } from '../data/wonderland'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

export function useFrank(initialMessages = []) {
  const [messages, setMessages] = useState(initialMessages)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)

  const send = useCallback(async (userMessage, customSystem) => {
    if (!userMessage?.trim()) return
    setError(null)

    const userMsg = { role: 'user', content: userMessage.trim() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: customSystem || FRANK_SYSTEM_PROMPT,
          messages: [...messages, userMsg].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error(`API error ${response.status}`)
      }

      const data = await response.json()
      const reply = data.content?.[0]?.text || 'No response.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      return reply
    } catch (err) {
      setError(err.message)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Check your API key in .env and try again.',
      }])
    } finally {
      setLoading(false)
    }
  }, [messages])

  const reset = useCallback(() => {
    setMessages(initialMessages)
    setError(null)
  }, [initialMessages])

  return { messages, loading, error, send, reset, setMessages }
}

// ─── PDF / Document extraction ────────────────────────────────────────────────
export async function extractFromDocument(file, documentType) {
  const toBase64 = (f) => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result.split(',')[1])
    r.onerror = rej
    r.readAsDataURL(f)
  })

  const prompts = {
    debtor: `Extract all debtor/accounts receivable data. Return ONLY valid JSON (no markdown):
{"document_type":"...","debtors":[{"name":"","reference":"","amount":0,"invoice_date":"YYYY-MM-DD or null","due_date":"YYYY-MM-DD or null","days_overdue":0,"contact":null,"confidence":"high|medium|low"}],"total_outstanding":0,"notes":""}
Amounts as numbers only.`,
    creditor: `Extract all creditor/accounts payable data. Return ONLY valid JSON (no markdown):
{"document_type":"...","creditors":[{"supplier":"","reference":"","amount":0,"invoice_date":"YYYY-MM-DD or null","due_date":"YYYY-MM-DD or null","days_until_due":0,"overdue":false,"line_items":null,"confidence":"high|medium|low"}],"total_owed":0,"notes":""}`,
    bank: `Extract all bank transactions. Return ONLY valid JSON (no markdown):
{"bank_name":"","period_start":"YYYY-MM-DD","period_end":"YYYY-MM-DD","opening_balance":0,"closing_balance":0,"transactions":[{"date":"YYYY-MM-DD","description":"","debit":0,"credit":0,"balance":0,"category":""}],"total_credits":0,"total_debits":0,"notes":""}
Categories: School Fees|WCED Subsidy|Staff|Rent|Food|Utilities|Materials|Admin|Transfer|Unknown`,
  }

  const isCSV = file.name.endsWith('.csv') || file.name.endsWith('.txt')
  let messageContent

  if (isCSV) {
    const text = await file.text()
    messageContent = `${prompts[documentType]}\n\nFile content:\n${text.slice(0, 8000)}`
  } else {
    const base64 = await toBase64(file)
    const mediaType = file.type === 'application/pdf' ? 'application/pdf'
      : file.type.startsWith('image/') ? file.type : 'application/pdf'
    messageContent = [
      { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } },
      { type: 'text', text: prompts[documentType] },
    ]
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: messageContent }],
    }),
  })

  const data = await response.json()
  const raw = data.content?.[0]?.text || '{}'
  const clean = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}
