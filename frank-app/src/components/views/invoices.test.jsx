import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

// The screens are tested against a stubbed database layer: the SQL has its own tests (ledgerDb.test.js).
const api = vi.hoisted(() => ({
  listDocuments: vi.fn(), listPayments: vi.fn(), getLines: vi.fn(), getSettings: vi.fn(), getMailbox: vi.fn(),
  saveDraft: vi.fn(), deleteDraft: vi.fn(), issueDocument: vi.fn(), convertQuote: vi.fn(), voidDocument: vi.fn(), recordPayment: vi.fn(),
  sendDocument: vi.fn(), sendStatement: vi.fn(), connectMailbox: vi.fn(), disconnectMailbox: vi.fn(), saveSettings: vi.fn(),
}))
vi.mock('../../lib/invoiceApi', async (orig) => ({ ...(await orig()), ...api }))

import { Invoices } from './Invoices'
import { MailSettings } from './MailSettings'
import { PaymentMatches } from './PaymentMatches'

const settings = { business_name: 'Cape Fresh Grocery', address: '1 Main Rd', vat_number: '4123456789', payment_terms_days: 14, bank_details: 'Nedbank 123', footer_note: '' }
const doc = (over = {}) => ({
  id: 'd1', doc_type: 'invoice', number: 47, status: 'issued', customer_name: 'Durbanville Catering Co.', customer_email: 'accounts@durbanvillecatering.co.za',
  customer_address: '5 Oak St', customer_vat: '', issue_date: '2020-01-01', due_date: '2020-01-15', vat_enabled: true, notes: '',
  supplier_name: 'Cape Fresh Grocery', supplier_address: '1 Main Rd', supplier_vat: '4123456789',
  sub_cents: 1000000, vat_cents: 150000, total_cents: 1150000, paid_cents: 0, sent_at: null, last_sent_to: null, ...over,
})
const line = { description: 'Fresh produce', qty: 4, unit_cents: 250000 }

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset())
  api.listDocuments.mockResolvedValue([]); api.listPayments.mockResolvedValue([])
  api.getSettings.mockResolvedValue(settings); api.getMailbox.mockResolvedValue({ from_email: 'sales@capefresh.co.za', host: 'smtp.gmail.com' })
  api.getLines.mockResolvedValue([line])
})

describe('Invoices & Quotes', () => {
  test('starts with a friendly empty state and no setup warning once business details exist', async () => {
    render(<Invoices onNav={vi.fn()} />)
    expect(await screen.findByText(/No invoices yet/)).toBeTruthy()
    expect(screen.queryByText(/Add your business name/)).toBeNull()
  })

  test('asks for business details first when none are saved, and links to Connections', async () => {
    api.getSettings.mockResolvedValue(null)
    const onNav = vi.fn()
    render(<Invoices onNav={onNav} />)
    fireEvent.click(await screen.findByText('Add business details'))
    expect(onNav).toHaveBeenCalledWith('connect')
  })

  test('the editor shows live totals with 15% VAT and saves the draft', async () => {
    api.saveDraft.mockResolvedValue(doc({ id: 'd2', number: null, status: 'draft' }))
    render(<Invoices />)
    fireEvent.click(await screen.findByText('New invoice'))
    fireEvent.change(screen.getByLabelText('Customer name'), { target: { value: 'Durbanville Catering Co.' } })
    fireEvent.change(screen.getByLabelText('Line 1 description'), { target: { value: 'Fresh produce' } })
    fireEvent.change(screen.getByLabelText('Line 1 quantity'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Line 1 unit price'), { target: { value: '2250' } })
    expect(screen.getAllByText('R 9 000,00').length).toBeGreaterThan(0)
    expect(screen.getByText('R 1 350,00')).toBeTruthy()
    expect(screen.getByText('R 10 350,00')).toBeTruthy()
    fireEvent.click(screen.getByLabelText(/Charge 15% VAT/))
    expect(screen.queryByText('VAT 15%')).toBeNull()
    expect(screen.getAllByText('R 9 000,00').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByText('Save draft'))
    await waitFor(() => expect(api.saveDraft).toHaveBeenCalledTimes(1))
    expect(api.saveDraft.mock.calls[0][0]).toMatchObject({ customer_name: 'Durbanville Catering Co.', vat_enabled: false })
  })

  test('lists an overdue invoice and previews exactly what the PDF will say', async () => {
    api.listDocuments.mockResolvedValue([doc()])
    render(<Invoices />)
    fireEvent.click(await screen.findByText('INV-0047'))
    expect(await screen.findByText('Overdue')).toBeTruthy()          // status is visible on the document itself
    expect(await screen.findByText('TAX INVOICE')).toBeTruthy()
    const paper = screen.getByLabelText('TAX INVOICE INV-0047')
    for (const t of ['VAT No: 4123456789', 'Fresh produce', 'R 10 000,00', 'VAT 15%', 'R 1 500,00', 'R 11 500,00', 'Banking details: Nedbank 123']) {
      expect(within(paper).getAllByText((c) => c.includes(t)).length).toBeGreaterThan(0)
    }
  })

  test('sending asks first, then emails the document and says where it went', async () => {
    api.listDocuments.mockResolvedValue([doc()])
    api.sendDocument.mockResolvedValue({ ok: true, sentTo: 'accounts@durbanvillecatering.co.za' })
    render(<Invoices />)
    fireEvent.click(await screen.findByText('INV-0047'))
    fireEvent.click(await screen.findByText('Send by email'))
    expect(screen.getByRole('alertdialog').textContent).toContain('sales@capefresh.co.za')
    expect(api.sendDocument).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Send now'))
    await waitFor(() => expect(api.sendDocument).toHaveBeenCalledWith('d1'))
    expect(await screen.findByText('Sent to accounts@durbanvillecatering.co.za.')).toBeTruthy()
  })

  test('the demo workspace says nothing was really emailed', async () => {
    api.listDocuments.mockResolvedValue([doc()])
    api.sendDocument.mockResolvedValue({ ok: true, sentTo: 'a@b.co', simulated: true })
    render(<Invoices />)
    fireEvent.click(await screen.findByText('INV-0047'))
    fireEvent.click(await screen.findByText('Send by email'))
    fireEvent.click(screen.getByText('Send now'))
    expect(await screen.findByText(/nothing was emailed/)).toBeTruthy()
  })

  test('a send failure is shown plainly', async () => {
    api.listDocuments.mockResolvedValue([doc()])
    api.sendDocument.mockRejectedValue(new Error('Connect your mailbox under Connections before sending.'))
    render(<Invoices />)
    fireEvent.click(await screen.findByText('INV-0047'))
    fireEvent.click(await screen.findByText('Send by email'))
    fireEvent.click(screen.getByText('Send now'))
    expect((await screen.findByRole('alert')).textContent).toContain('Connect your mailbox')
  })

  test('a draft is issued only after confirming, and can be deleted', async () => {
    api.listDocuments.mockResolvedValue([doc({ number: null, status: 'draft' })])
    api.issueDocument.mockResolvedValue(doc())
    render(<Invoices />)
    fireEvent.click((await screen.findAllByText('Draft'))[0])
    fireEvent.click(await screen.findByText('Issue invoice'))
    expect(screen.getByRole('alertdialog').textContent).toContain("can't be edited afterwards")
    fireEvent.click(screen.getByText('Issue'))
    await waitFor(() => expect(api.issueDocument).toHaveBeenCalledWith('d1'))
  })

  test('recording a payment sends whole cents and the date', async () => {
    api.listDocuments.mockResolvedValue([doc()])
    api.recordPayment.mockResolvedValue(doc({ paid_cents: 400000 }))
    render(<Invoices />)
    fireEvent.click(await screen.findByText('INV-0047'))
    fireEvent.click(await screen.findByText('Record payment'))
    fireEvent.change(screen.getByLabelText('Amount received (R)'), { target: { value: '4000.00' } })
    fireEvent.change(screen.getByLabelText('Date received'), { target: { value: '2026-07-20' } })
    fireEvent.click(screen.getAllByText('Record payment').at(-1))
    await waitFor(() => expect(api.recordPayment).toHaveBeenCalledWith('d1', 400000, '2026-07-20', ''))
  })

  test('statements list customers who owe money and send after confirming', async () => {
    api.listDocuments.mockResolvedValue([doc(), doc({ id: 'd9', number: 48, customer_name: 'Paid Up Ltd', status: 'paid', paid_cents: 1150000 })])
    api.listPayments.mockResolvedValue([{ document_id: 'd9', amount_cents: 1150000, paid_on: '2020-01-10', reference: '' }])
    api.sendStatement.mockResolvedValue({ ok: true, sentTo: 'accounts@durbanvillecatering.co.za' })
    render(<Invoices />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Statements' }))
    expect(screen.queryByText('Paid Up Ltd')).toBeNull()
    fireEvent.click(await screen.findByText('Durbanville Catering Co.'))
    expect(await screen.findByText('STATEMENT')).toBeTruthy()
    fireEvent.click(screen.getByText('Send statement by email'))
    fireEvent.click(screen.getByText('Send now'))
    await waitFor(() => expect(api.sendStatement).toHaveBeenCalledWith('Durbanville Catering Co.'))
  })
})

describe('Mailbox and business settings', () => {
  test('choosing Gmail fills in the server, and connecting sends the details once without echoing the password', async () => {
    api.getMailbox.mockResolvedValue(null)
    api.connectMailbox.mockResolvedValue({ ok: true })
    render(<MailSettings />)
    await screen.findByText('Connect mailbox')
    expect(screen.getByLabelText('Outgoing server').value).toBe('smtp.gmail.com')
    expect(screen.getByLabelText('Port').value).toBe('465')
    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'sales@capefresh.co.za' } })
    fireEvent.change(screen.getByLabelText('Password or app password'), { target: { value: 'abcd efgh ijkl mnop' } })
    fireEvent.change(screen.getByLabelText('Send from (email address)'), { target: { value: 'sales@capefresh.co.za' } })
    fireEvent.click(screen.getByText('Connect mailbox'))
    await waitFor(() => expect(api.connectMailbox).toHaveBeenCalledTimes(1))
    expect(api.connectMailbox.mock.calls[0][0]).toMatchObject({ host: 'smtp.gmail.com', port: 465, security: 'ssl', username: 'sales@capefresh.co.za' })
    expect(await screen.findByText(/Mailbox connected/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('abcd efgh')
  })

  test('a rejected login is shown and nothing looks connected', async () => {
    api.getMailbox.mockResolvedValue(null)
    api.connectMailbox.mockRejectedValue(new Error('The mail server rejected the username or password.'))
    render(<MailSettings />)
    await screen.findByText('Connect mailbox')
    for (const [l, v] of [['Username', 'a@b.co'], ['Password or app password', 'x'], ['Send from (email address)', 'a@b.co']]) fireEvent.change(screen.getByLabelText(l), { target: { value: v } })
    fireEvent.click(screen.getByText('Connect mailbox'))
    expect((await screen.findByRole('alert')).textContent).toContain('rejected the username')
  })

  test('a connected mailbox shows its address and can be disconnected', async () => {
    api.disconnectMailbox.mockResolvedValue({ ok: true })
    render(<MailSettings />)
    expect(await screen.findByText('sales@capefresh.co.za')).toBeTruthy()
    fireEvent.click(screen.getByText('Disconnect'))
    await waitFor(() => expect(api.disconnectMailbox).toHaveBeenCalled())
    expect(await screen.findByText(/password deleted/)).toBeTruthy()
  })

  test('business details save', async () => {
    api.saveSettings.mockResolvedValue(settings)
    render(<MailSettings />)
    await screen.findByDisplayValue('Cape Fresh Grocery')
    fireEvent.click(screen.getByText('Save business details'))
    await waitFor(() => expect(api.saveSettings).toHaveBeenCalled())
    expect(await screen.findByText('Business details saved.')).toBeTruthy()
  })
})

describe('Payments to match (Reconciliation)', () => {
  const credits = [
    { id: 'cr-0', date: '2026-07-20', description: 'EFT DURBANVILLE CATERING INV-0047', amount: 11500 },
    { id: 'cr-1', date: '2026-07-21', description: 'WOOLWORTHS REFUND', amount: 55.55 },
  ]
  beforeEach(() => {
    api.listDocuments.mockResolvedValue([doc({ issue_date: '2026-07-01', due_date: '2026-07-15' })])
  })

  test('proposes a match, and records the payment only after confirming', async () => {
    api.recordPayment.mockResolvedValue(doc({ status: 'paid' }))
    render(<PaymentMatches credits={credits} />)
    expect(await screen.findByText(/Looks like/)).toBeTruthy()
    expect(screen.getByText('Confirm: mark INV-0047 paid')).toBeTruthy()
    expect(screen.queryByText(/WOOLWORTHS/)).toBeNull()                  // matches nothing: not proposed
    expect(api.recordPayment).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Confirm: mark INV-0047 paid'))
    await waitFor(() => expect(api.recordPayment).toHaveBeenCalledTimes(1))
    const [id, cents, date, ref] = api.recordPayment.mock.calls[0]
    expect([id, cents, date]).toEqual(['d1', 1150000, '2026-07-20'])
    expect(ref).toContain('cr-0|2026-07-20|11500')
  })

  test('a bank line that has already been applied is not proposed again', async () => {
    api.listPayments.mockResolvedValue([{ document_id: 'd1', amount_cents: 1150000, paid_on: '2026-07-20', reference: 'Bank cr-0|2026-07-20|11500 EFT' }])
    render(<PaymentMatches credits={credits} />)
    await waitFor(() => expect(api.listPayments).toHaveBeenCalled())
    expect(screen.queryByText(/Looks like/)).toBeNull()
  })

  test('shows nothing when there is no unpaid invoice', async () => {
    api.listDocuments.mockResolvedValue([])
    const { container } = render(<PaymentMatches credits={credits} />)
    await waitFor(() => expect(api.listDocuments).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })
})
