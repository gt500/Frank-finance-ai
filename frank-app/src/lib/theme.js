export const C = {
  bg:       '#000000',   // brand: pure black
  sidebar:  '#0A0A0A',   // near-black sidebar
  card:     '#172748',   // brand: navy #172748
  border:   '#1e3a60',   // between bg and card
  frank:    '#20e5f6',   // brand: primary teal
  frankDim: '#20e5f608',
  frankMid: '#20e5f618',
  text:     '#E8F2F8',
  sub:      '#7FA8C0',
  dim:      '#4A6A85',
  muted:    '#1e3a60',
  teal:     '#22a5c8',   // brand: mid teal
  deepTeal: '#196e95',   // brand: dark blue
  gold:     '#c1b081',   // brand: sub-branding gold (Bruno Ace)
  warn:     '#c1b081',   // brand: gold for caution (no orange per brand rules)
  danger:   '#FF3D57',   // errors only (failed save, failed login) — never on charts
  good:     '#20e5f6',
  // Glass redesign text + status tokens
  bright:   '#F2F8FC',   // key figures
  soft:     '#B7CCDB',   // secondary text, chart labels
  label:    '#8FA9BF',   // muted labels (passes 4.5:1 on the glass surface)
  watch:    '#e2b65a',   // warning status — always shown with a text label
  goldText: '#e2c98f',   // gold button text
}

// Chart series palette — passed the dataviz validator (lightness band, chroma, colour-blind and
// normal-vision separation, contrast) against the dark glass surface. Assign in this fixed order.
export const CHART = {
  s1:      '#0b9db3',   // cyan  — revenue, money in, first category
  s2:      '#bf892b',   // gold  — expenses, money out, second category
  s3:      '#4060cc',   // blue  — net profit, third category
  other:   '#5d6b7d',   // neutral — "Other" bucket only
  surface: '#0e1a2c',
}

export const FONT_BODY = "'Century Gothic', 'Trebuchet MS', 'Gill Sans MT', system-ui, sans-serif"
export const FONT_BRAND = "'Century Gothic', 'Trebuchet MS', system-ui, sans-serif"
export const FONT_SUB = "'Bruno Ace', 'Century Gothic', sans-serif"  // sub-branding label

export const fmt  = n => `R ${Number(n).toLocaleString('en-ZA')}`
export const fmtK = n => n >= 1000 ? `R ${(n/1000).toFixed(0)}k` : `R ${n}`
export const fmtM = n => n >= 1000000 ? `R ${(n/1000000).toFixed(1)}M` : fmtK(n)

// Glass panel for inline-styled containers (same recipe as the .glass class in index.css).
export const GLASS = {
  background: 'linear-gradient(160deg, rgba(30,58,96,0.50) 0%, rgba(23,39,72,0.28) 100%)',
  backdropFilter: 'blur(22px) saturate(150%)',
  WebkitBackdropFilter: 'blur(22px) saturate(150%)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), 0 24px 48px -28px rgba(0,0,0,0.9)',
  borderRadius: 18,
}
export const INSET = 'rgba(0,0,0,0.25)'   // panel inside a glass panel

// A document preview looks like the paper it becomes (the emailed PDF is white), so it has its own tokens.
export const PAPER = { bg: '#f7f9fb', ink: '#17202b', muted: '#5b6673', rule: '#d5dbe2', accent: '#0b7f91' }
