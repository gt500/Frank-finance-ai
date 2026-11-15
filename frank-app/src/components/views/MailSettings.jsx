import { useEffect, useState } from 'react'
import { C } from '../../lib/theme'
import * as api from '../../lib/invoiceApi'
import { longDate } from '../../lib/documentModel'
import { Card } from '../shared'
import { Field, Notice, inputStyle } from '../invoices/fields'

const PRESETS = {
  gmail: { label: 'Gmail', host: 'smtp.gmail.com', port: '465', security: 'ssl', help: 'Gmail needs an app password: turn on 2-step verification, then create an app password in your Google account. Your normal password will not work.' },
  m365: { label: 'Microsoft 365', host: 'smtp.office365.com', port: '587', security: 'starttls', help: 'Microsoft 365 may need an administrator to allow "authenticated SMTP" for this mailbox, and may need an app password.' },
  other: { label: 'My own domain / other', host: '', port: '587', security: 'starttls', help: 'Use the outgoing (SMTP) details from your email provider. You only need the outgoing server: Zeeder never reads your inbox.' },
}
const EMPTY_BUSINESS = { business_name: '', address: '', vat_number: '', payment_terms_days: 14, bank_details: '', footer_note: '' }
const EMPTY_MAIL = { preset: 'gmail', host: PRESETS.gmail.host, port: PRESETS.gmail.port, security: PRESETS.gmail.security, username: '', password: '', from_name: '', from_email: '' }

/** Business details printed on documents, and the mailbox they are emailed from. */
export function MailSettings() {
  const [biz, setBiz] = useState(EMPTY_BUSINESS)
  const [mail, setMail] = useState(EMPTY_MAIL)
  const [connected, setConnected] = useState(null)
  const [changing, setChanging] = useState(false)
  const [bizNote, setBizNote] = useState(null)
  const [mailNote, setMailNote] = useState(null)
  const [busy, setBusy] = useState('')

  useEffect(() => {
    let live = true
    Promise.all([api.getSettings(), api.getMailbox()]).then(([s, m]) => {
      if (!live) return
      if (s) setBiz({ ...EMPTY_BUSINESS, ...s })
      setConnected(m)
    }).catch((e) => live && setBizNote({ kind: 'error', text: `Couldn't load your settings: ${e.message}` }))
    return () => { live = false }
  }, [])

  const saveBusiness = async (e) => {
    e.preventDefault(); setBusy('biz'); setBizNote(null)
    try { await api.saveSettings(biz); setBizNote({ kind: 'ok', text: 'Business details saved.' }) }
    catch (err) { setBizNote({ kind: 'error', text: err.message }) } finally { setBusy('') }
  }
  const pickPreset = (e) => { const p = PRESETS[e.target.value]; setMail({ ...mail, preset: e.target.value, host: p.host, port: p.port, security: p.security }) }
  const connect = async (e) => {
    e.preventDefault(); setBusy('mail'); setMailNote(null)
    try {
      await api.connectMailbox({ host: mail.host, port: Number(mail.port), security: mail.security, username: mail.username, password: mail.password, from_name: mail.from_name, from_email: mail.from_email })
      setConnected(await api.getMailbox()); setChanging(false); setMail({ ...EMPTY_MAIL }); setMailNote({ kind: 'ok', text: 'Mailbox connected. Your documents will be sent from it.' })
    } catch (err) { setMailNote({ kind: 'error', text: err.message }) } finally { setBusy('') }
  }
  const disconnect = async () => {
    setBusy('mail'); setMailNote(null)
    try { await api.disconnectMailbox(); setConnected(null); setMailNote({ kind: 'ok', text: 'Mailbox disconnected and its password deleted.' }) }
    catch (err) { setMailNote({ kind: 'error', text: err.message }) } finally { setBusy('') }
  }
  const setB = (f) => (e) => setBiz({ ...biz, [f]: e.target.value })
  const setM = (f) => (e) => setMail({ ...mail, [f]: e.target.value })
  const grid = { display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <Card title="Business details" sub="Printed on every invoice, quote and statement.">
        <form onSubmit={saveBusiness} style={{ display: 'grid', gap: 14 }}>
          <div style={grid}>
            <Field label="Business name"><input style={inputStyle} value={biz.business_name} onChange={setB('business_name')} required /></Field>
            <Field label="VAT number" hint="Needed to issue tax invoices. Leave empty if you are not VAT registered."><input style={inputStyle} value={biz.vat_number} onChange={setB('vat_number')} /></Field>
            <Field label="Business address"><textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={biz.address} onChange={setB('address')} /></Field>
            <Field label="Banking details" hint="Shown on invoices so customers know where to pay."><textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} value={biz.bank_details} onChange={setB('bank_details')} /></Field>
            <Field label="Payment terms (days)"><input style={inputStyle} type="number" min="0" max="365" value={biz.payment_terms_days} onChange={setB('payment_terms_days')} /></Field>
            <Field label="Footer message (optional)"><input style={inputStyle} value={biz.footer_note} onChange={setB('footer_note')} /></Field>
          </div>
          {bizNote && <Notice kind={bizNote.kind}>{bizNote.text}</Notice>}
          <div><button type="submit" className="btn-gold" disabled={busy === 'biz'}>{busy === 'biz' ? 'Saving…' : 'Save business details'}</button></div>
        </form>
      </Card>

      <Card title="Email account" sub="Invoices, quotes and statements are sent from your own mailbox, to the customer address on the document. Zeeder only sends: it never reads your inbox.">
        {connected && !changing ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ fontSize: 14, color: C.text }}>
              Connected: <strong>{connected.from_email}</strong> via {connected.host}
              {connected.verified_at && <span style={{ color: C.label }}> · checked {longDate(connected.verified_at.slice(0, 10))}</span>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-ghost" onClick={() => setChanging(true)}>Change mailbox</button>
              <button type="button" className="btn-ghost" disabled={busy === 'mail'} onClick={disconnect}>Disconnect</button>
            </div>
          </div>
        ) : (
          <form onSubmit={connect} style={{ display: 'grid', gap: 14 }}>
            <div style={grid}>
              <Field label="Email provider">
                <select style={inputStyle} value={mail.preset} onChange={pickPreset}>
                  {Object.entries(PRESETS).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
                </select>
              </Field>
              <Field label="Outgoing server"><input style={inputStyle} value={mail.host} onChange={setM('host')} placeholder="smtp.example.com" required /></Field>
              <Field label="Port"><input style={inputStyle} inputMode="numeric" value={mail.port} onChange={setM('port')} required /></Field>
              <Field label="Security">
                <select style={inputStyle} value={mail.security} onChange={setM('security')}>
                  <option value="ssl">SSL/TLS (usually port 465)</option>
                  <option value="starttls">STARTTLS (usually port 587)</option>
                </select>
              </Field>
              <Field label="Username"><input style={inputStyle} autoComplete="off" value={mail.username} onChange={setM('username')} required /></Field>
              <Field label="Password or app password"><input style={inputStyle} type="password" autoComplete="new-password" value={mail.password} onChange={setM('password')} required /></Field>
              <Field label="Sender name" hint="What your customer sees, for example your business name."><input style={inputStyle} value={mail.from_name} onChange={setM('from_name')} /></Field>
              <Field label="Send from (email address)"><input style={inputStyle} type="email" value={mail.from_email} onChange={setM('from_email')} required /></Field>
            </div>
            <div style={{ fontSize: 13, color: C.label }}>{PRESETS[mail.preset].help} Your password is stored encrypted and is never shown again.</div>
            {mailNote && <Notice kind={mailNote.kind}>{mailNote.text}</Notice>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" className="btn-gold" disabled={busy === 'mail'}>{busy === 'mail' ? 'Checking the login…' : 'Connect mailbox'}</button>
              {connected && <button type="button" className="btn-ghost" onClick={() => setChanging(false)}>Cancel</button>}
            </div>
          </form>
        )}
        {connected && !changing && mailNote && <div style={{ marginTop: 12 }}><Notice kind={mailNote.kind}>{mailNote.text}</Notice></div>}
      </Card>
    </div>
  )
}
