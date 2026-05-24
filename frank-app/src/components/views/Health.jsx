import { C } from '../../lib/theme'
export function Health({ onAsk, frank }) {
  return (
    <div className="fade-up" style={{ color: C.sub, fontSize: 12 }}>
      <div style={{ padding: '20px', background: C.card, border: `1px solid ${C.border}`, borderRadius: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.frank, marginBottom: 8 }}>Health</div>
        <div>This view is ready to build — see the skill files in <code>/frank-financial-ai/</code> for the full data and component spec.</div>
        <button onClick={() => onAsk('Tell me about the Health for Wonderland Educare')}
          style={{ marginTop: 12, padding: '7px 14px', borderRadius: 5, border: `1px solid ${C.frank}44`, background: C.frankDim, color: C.frank, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>
          Ask Frank about this →
        </button>
      </div>
    </div>
  )
}
