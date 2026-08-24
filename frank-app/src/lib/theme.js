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
  danger:   '#FF3D57',
  good:     '#20e5f6',
}

export const FONT_BODY = "'Century Gothic', 'Trebuchet MS', 'Gill Sans MT', system-ui, sans-serif"
export const FONT_BRAND = "'Century Gothic', 'Trebuchet MS', system-ui, sans-serif"
export const FONT_SUB = "'Bruno Ace', 'Century Gothic', sans-serif"  // sub-branding label

export const fmt  = n => `R ${Number(n).toLocaleString('en-ZA')}`
export const fmtK = n => n >= 1000 ? `R ${(n/1000).toFixed(0)}k` : `R ${n}`
export const fmtM = n => n >= 1000000 ? `R ${(n/1000000).toFixed(1)}M` : fmtK(n)
