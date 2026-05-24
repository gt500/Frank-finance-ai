export const C = {
  bg:       '#060A12',
  sidebar:  '#07090F',
  card:     '#0B1020',
  border:   '#141E32',
  frank:    '#00E5B0',
  frankDim: '#00E5B010',
  frankMid: '#00E5B025',
  text:     '#E4EAF4',
  sub:      '#7A8599',
  muted:    '#1E2A3C',
  warn:     '#F5C518',
  danger:   '#FF3D57',
  purple:   '#8B72FF',
  blue:     '#3B9EFF',
  amber:    '#FF9500',
  good:     '#00E5B0',
}

export const fmt  = n => `R ${Number(n).toLocaleString('en-ZA')}`
export const fmtK = n => n >= 1000 ? `R ${(n/1000).toFixed(0)}k` : `R ${n}`
export const fmtM = n => n >= 1000000 ? `R ${(n/1000000).toFixed(1)}M` : fmtK(n)
