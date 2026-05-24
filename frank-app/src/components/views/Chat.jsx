import { useState, useRef, useEffect } from 'react'
import { C } from '../../lib/theme'
import { ChatMessage, TypingIndicator } from '../shared'

const QUICK_QUESTIONS = [
  'How do I fix my cashflow before 25 July?',
  "What's causing my margin decline?",
  'Can I afford a fee increase?',
  'How do I build a December reserve?',
  'What are my 3 biggest risks right now?',
  'Can I afford to hire another teacher?',
]

export function Chat({ frank }) {
  const { messages, loading, send } = frank
  const [input, setInput] = useState('')
  const chatEnd = useRef(null)

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const handleSend = () => {
    if (!input.trim() || loading) return
    send(input.trim())
    setInput('')
  }

  return (
    <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 110px)', maxWidth: 700, margin: '0 auto' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 10 }}>
        {messages.map((m, i) => <ChatMessage key={i} message={m} />)}
        {loading && <TypingIndicator />}
        <div ref={chatEnd} />
      </div>

      {/* Input area */}
      <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        {/* Quick questions */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
          {QUICK_QUESTIONS.map(q => (
            <button key={q} onClick={() => setInput(q)} style={{
              padding: '3px 10px', borderRadius: 12,
              border: `1px solid ${C.border}`, background: 'transparent',
              color: C.sub, fontSize: 9, cursor: 'pointer',
            }}>
              {q}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 7 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask Frank about Wonderland's finances..."
            style={{ flex: 1, padding: '10px 13px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 11 }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            style={{ padding: '10px 18px', background: input.trim() && !loading ? C.frank : C.muted, border: 'none', borderRadius: 6, color: C.bg, cursor: input.trim() && !loading ? 'pointer' : 'default', fontWeight: 700, fontSize: 11, transition: 'background .15s' }}
          >
            {loading ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  )
}
