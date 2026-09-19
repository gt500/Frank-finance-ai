import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'text/csv', 'text/plain', 'text/tab-separated-values',
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/octet-stream', // some browsers report this for xlsx
])

function fetchWithTimeout(url, options, ms = 30000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  return fetch(url, { ...options, signal: ctrl.signal }).finally(() => clearTimeout(timer))
}

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in — please log in again.')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
}

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
      const headers = await authHeader()
      const response = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/chat-message`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          system: customSystem,
          messages: [...messages, userMsg].map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `API error ${response.status}`)

      const reply = data.content?.[0]?.text || 'No response.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      return reply
    } catch (err) {
      setError(err.message)
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Please try again.',
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
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB) — maximum is 20 MB. Try exporting a shorter date range.`)
  }

  if (file.type && file.type !== 'application/octet-stream' && !ALLOWED_MIMES.has(file.type)) {
    throw new Error(`File type not supported (${file.type}). Please upload a PDF, CSV, image, or Excel file.`)
  }

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
    bank: `Extract bank transactions. Return ONLY valid JSON (no markdown). Include up to 60 transactions maximum — prioritise the most recent ones if there are more.
{"bank_name":"","period_start":"YYYY-MM-DD","period_end":"YYYY-MM-DD","opening_balance":0,"closing_balance":0,"transactions":[{"date":"YYYY-MM-DD","description":"","debit":0,"credit":0,"balance":0,"category":""}],"total_credits":0,"total_debits":0,"notes":""}
Categories: School Fees|WCED Subsidy|Staff|Rent|Food|Utilities|Materials|Admin|Transfer|Unknown`,
    payroll: `Extract payroll data from this SimplePay or payroll report. Return ONLY valid JSON (no markdown):
{"payroll_system":"SimplePay or other","period":"YYYY-MM or description","pay_date":"YYYY-MM-DD or null","headcount":0,"employees":[{"name":"","id_number":"","gross_salary":0,"paye":0,"uif":0,"net_pay":0,"confidence":"high|medium|low"}],"totals":{"gross":0,"paye":0,"uif":0,"sdl":0,"net":0},"notes":""}
Amounts as numbers. PAYE = Pay As You Earn (income tax). UIF = Unemployment Insurance Fund. SDL = Skills Development Levy.`,
  }

  const ext = file.name.split('.').pop().toLowerCase()
  const isText = ['csv', 'txt', 'tsv'].includes(ext)
  const isImage = file.type.startsWith('image/')
  let messageContent

  if (isText) {
    const text = await file.text()
    messageContent = `${prompts[documentType]}\n\nFile content:\n${text.slice(0, 8000)}`
  } else if (isImage) {
    const base64 = await toBase64(file)
    messageContent = [
      { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } },
      { type: 'text', text: prompts[documentType] },
    ]
  } else if (['xlsx', 'xls', 'ods'].includes(ext)) {
    const XLSX = await import('xlsx')
    const arrayBuffer = await file.arrayBuffer()
    const wb = XLSX.read(arrayBuffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const csv = XLSX.utils.sheet_to_csv(ws)
    messageContent = `${prompts[documentType]}\n\nFile content (converted from Excel):\n${csv.slice(0, 8000)}`
  } else {
    const base64 = await toBase64(file)
    messageContent = [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
      { type: 'text', text: prompts[documentType] },
    ]
  }

  const headers = await authHeader()
  const response = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/extract-document`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ messageContent }),
  }, 90000) // extraction can legitimately take longer than a chat turn

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.error || `API error ${response.status}`)
  }
  if (data.stop_reason === 'max_tokens') {
    throw new Error('The document is too large to process in one pass. Try splitting it into smaller date ranges, or export only the last 2–3 months.')
  }
  const raw = data.content?.[0]?.text || '{}'
  const stripped = raw.replace(/```(?:json)?/gi, '').trim()
  const jsonStart = stripped.indexOf('{')
  const jsonEnd   = stripped.lastIndexOf('}')
  const clean     = jsonStart >= 0 && jsonEnd > jsonStart
    ? stripped.slice(jsonStart, jsonEnd + 1)
    : stripped
  try {
    return JSON.parse(clean)
  } catch {
    throw new Error(`Zeeder could not read this document. Try exporting it as a CSV instead of PDF, or split it into smaller date ranges.`)
  }
}
