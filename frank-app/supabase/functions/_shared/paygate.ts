// Shared helpers for talking to PayGate PayHost (SOAP/XML), not PayWeb3.
// Docs: https://docs.paygate.co.za/paygate-by-network/reference/payhost

export const PAYHOST_URL = "https://secure.paygate.co.za/payhost/process.trans"

// Sandbox vs live host is the same URL for PayHost — sandbox behaviour is
// determined by which PayGateId/Password you use (test IDs vs live IDs).

type Account = { id: string; password: string }

export function accounts() {
  return {
    // Customer-facing card capture + 3D Secure — used for WebPaymentRequest (tokenize)
    threeDS: {
      id: mustEnv("PAYGATE_3DS_ID"),
      password: mustEnv("PAYGATE_3DS_KEY"),
    } as Account,
    // Merchant-initiated recurring charge against a stored vault — MOTO account
    moto: {
      id: mustEnv("PAYGATE_MOTO_ID"),
      password: mustEnv("PAYGATE_MOTO_KEY"),
    } as Account,
  }
}

function mustEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Missing required secret: ${name}`)
  return v
}

function esc(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Very small tag extractor — PayHost responses are flat/predictable enough
// that a full XML parser is overkill. Returns the first match's inner text.
export function xmlTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, "i"))
  return m ? m[1].trim() : null
}

async function soapCall(soapAction: string, envelope: string): Promise<string> {
  const res = await fetch(PAYHOST_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      "SOAPAction": soapAction,
    },
    body: envelope,
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`PayGate ${soapAction} HTTP ${res.status}: ${text.slice(0, 500)}`)
  }
  return text
}

/**
 * Step 1: WebPaymentRequest with Vault=true.
 * Sends the customer to PayGate's hosted page to enter card details and
 * complete 3D Secure. On completion PayGate POSTs to notifyUrl/returnUrl
 * with PAY_REQUEST_ID — you then Query to get the VaultId + status.
 */
export async function initiateWebPayment(opts: {
  merchantOrderId: string
  amountCents: number
  currency?: string
  firstName: string
  lastName: string
  email: string
  notifyUrl: string
  returnUrl: string
}) {
  const { id, password } = accounts().threeDS
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Header/>
  <SOAP-ENV:Body>
    <SinglePaymentRequest xmlns="http://www.paygate.co.za/PayHOST">
      <WebPaymentRequest>
        <Account>
          <PayGateId>${esc(id)}</PayGateId>
          <Password>${esc(password)}</Password>
        </Account>
        <Customer>
          <FirstName>${esc(opts.firstName)}</FirstName>
          <LastName>${esc(opts.lastName)}</LastName>
          <Email>${esc(opts.email)}</Email>
          <Address><Country>ZAF</Country></Address>
        </Customer>
        <Vault>true</Vault>
        <Redirect>
          <NotifyUrl>${esc(opts.notifyUrl)}</NotifyUrl>
          <ReturnUrl>${esc(opts.returnUrl)}</ReturnUrl>
        </Redirect>
        <Order>
          <MerchantOrderId>${esc(opts.merchantOrderId)}</MerchantOrderId>
          <Currency>${esc(opts.currency ?? "ZAR")}</Currency>
          <Amount>${opts.amountCents}</Amount>
          <BillingDetails>
            <Customer>
              <FirstName>${esc(opts.firstName)}</FirstName>
              <LastName>${esc(opts.lastName)}</LastName>
              <Email>${esc(opts.email)}</Email>
              <Address><Country>ZAF</Country></Address>
            </Customer>
            <Address><Country>ZAF</Country></Address>
          </BillingDetails>
          <Locale>en</Locale>
        </Order>
        <Recurring>
          <InitialAuth>true</InitialAuth>
          <RecurringTransactionType>CARD_ON_FILE</RecurringTransactionType>
          <InitiatedType>CARD_HOLDER</InitiatedType>
        </Recurring>
      </WebPaymentRequest>
    </SinglePaymentRequest>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`

  const xml = await soapCall("WebPaymentRequest", envelope)
  const payRequestId = xmlTag(xml, "PayRequestId")
  const redirectUrl = xmlTag(xml, "RedirectUrl") ?? xmlTag(xml, "Url")
  const errorMessage = xmlTag(xml, "ErrorMessage")
  if (!payRequestId || !redirectUrl) {
    throw new Error(`PayGate initiate failed: ${errorMessage ?? xml.slice(0, 500)}`)
  }
  return { payRequestId, redirectUrl, raw: xml }
}

/**
 * Step 2: Query (SingleFollowUpRequest) — call after the notify/return
 * fires, to get the authoritative transaction status and the VaultId
 * that was created for the card.
 */
export async function queryPayRequest(payRequestId: string) {
  const { id, password } = accounts().threeDS
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Header/>
  <SOAP-ENV:Body>
    <SingleFollowUpRequest xmlns="http://www.paygate.co.za/PayHOST">
      <QueryRequest>
        <Account>
          <PayGateId>${esc(id)}</PayGateId>
          <Password>${esc(password)}</Password>
        </Account>
        <PayRequestId>${esc(payRequestId)}</PayRequestId>
      </QueryRequest>
    </SingleFollowUpRequest>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`

  const xml = await soapCall("SingleFollowUpRequest", envelope)
  return {
    transactionStatus: xmlTag(xml, "TransactionStatus"),
    resultCode: xmlTag(xml, "ResultCode"),
    vaultId: xmlTag(xml, "VaultId"),
    raw: xml,
  }
}

/**
 * Step 3: CardPaymentRequest against a stored VaultId — the actual
 * recurring/merchant-initiated charge. Uses the MOTO account since the
 * cardholder is not present for this transaction.
 */
export async function chargeVault(opts: {
  vaultId: string
  merchantOrderId: string
  amountCents: number
  currency?: string
  firstName: string
  lastName: string
  email: string
  notifyUrl: string
}) {
  const { id, password } = accounts().moto
  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/">
  <SOAP-ENV:Header/>
  <SOAP-ENV:Body>
    <SinglePaymentRequest xmlns="http://www.paygate.co.za/PayHOST">
      <CardPaymentRequest>
        <Account>
          <PayGateId>${esc(id)}</PayGateId>
          <Password>${esc(password)}</Password>
        </Account>
        <Customer>
          <FirstName>${esc(opts.firstName)}</FirstName>
          <LastName>${esc(opts.lastName)}</LastName>
          <Email>${esc(opts.email)}</Email>
        </Customer>
        <VaultId>${esc(opts.vaultId)}</VaultId>
        <BudgetPeriod>0</BudgetPeriod>
        <Redirect>
          <NotifyUrl>${esc(opts.notifyUrl)}</NotifyUrl>
          <ReturnUrl>${esc(opts.notifyUrl)}</ReturnUrl>
        </Redirect>
        <Order>
          <MerchantOrderId>${esc(opts.merchantOrderId)}</MerchantOrderId>
          <Currency>${esc(opts.currency ?? "ZAR")}</Currency>
          <Amount>${opts.amountCents}</Amount>
        </Order>
        <Recurring>
          <InitialAuth>false</InitialAuth>
          <RecurringTransactionType>CARD_ON_FILE</RecurringTransactionType>
          <InitiatedType>MERCHANT</InitiatedType>
        </Recurring>
      </CardPaymentRequest>
    </SinglePaymentRequest>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`

  const xml = await soapCall("SinglePayment", envelope)
  return {
    transactionStatus: xmlTag(xml, "TransactionStatus"),
    resultCode: xmlTag(xml, "ResultCode"),
    resultDesc: xmlTag(xml, "ResultDesc") ?? xmlTag(xml, "ErrorMessage"),
    raw: xml,
  }
}
