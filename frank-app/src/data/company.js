// ─── ZEEDER (PTY) LTD — PLATFORM OPERATOR / INVOICE ISSUER ───────────────────
// This is Zeeder's own company info, used as the "supplier" on subscription
// tax invoices and statements billed to tenants — not tenant business data.

export const ZEEDER_COMPANY = {
  name:        'Zeeder (Pty) Ltd',
  regNo:       '2023/184920/07',
  vatNo:       '4480123456',
  addressLines: ['12 Bree Street', 'Cape Town CBD', 'Cape Town, 8001', 'South Africa'],
  email:       'billing@zeeder.ai',
  phone:       '+27 21 555 0142',
  website:     'www.zeeder.ai',
  bank: {
    name:          'FNB Business',
    accountName:   'Zeeder (Pty) Ltd',
    accountNumber: '62812345678',
    branchCode:    '250655',
    swift:         'FIRNZAJJ',
  },
}
